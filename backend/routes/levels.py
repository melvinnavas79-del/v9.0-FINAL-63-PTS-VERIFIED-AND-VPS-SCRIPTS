"""
Level-up automático basado en XP (experiencia).
Cada acción suma XP; al alcanzar el umbral se sube de nivel y se premia con monedas.

Fuentes de XP (integradas via hooks):
- Regalos enviados: 2 XP por cada moneda gastada en gift
- Regalos recibidos: 1 XP por cada moneda recibida como gift
- Juegos ganados: 3 XP por victoria
- Tiempo activo (heartbeat): 10 XP por minuto en sala con mic activo (hasta 120 XP/hora)
- Login diario: 50 XP bonus

Curva de niveles: xp_needed(level) = 100 * level^1.5
- Nivel 1 -> 2: 141 XP
- Nivel 10 -> 11: 3162 XP
- Nivel 50 -> 51: 35355 XP
- Nivel 100 -> 101: 100000 XP

Recompensas automáticas cada cierto nivel (cofre de monedas):
- Nivel 5, 10, 20, 30, 50, 75, 100 => premios escalonados
"""
from database import db, datetime, timezone, uuid
from fastapi import APIRouter, HTTPException
import math

router = APIRouter()

# Milestone rewards (level -> coins)
LEVEL_REWARDS = {
    2: 5_000,
    5: 20_000,
    10: 80_000,
    15: 150_000,
    20: 300_000,
    30: 800_000,
    40: 1_500_000,
    50: 3_000_000,
    60: 5_000_000,
    75: 10_000_000,
    100: 25_000_000,
}

def xp_needed_for_level(level: int) -> int:
    """XP total requerido para estar EN ese nivel (acumulado desde 0)."""
    if level <= 1:
        return 0
    return int(100 * math.pow(level - 1, 1.5))


def compute_level_from_xp(xp: int) -> int:
    """Dado un XP acumulado, retorna el nivel actual."""
    if xp <= 0:
        return 1
    # Binary search style for efficiency
    lvl = 1
    while xp >= xp_needed_for_level(lvl + 1) and lvl < 500:
        lvl += 1
    return lvl


async def add_xp(user_id: str, amount: int, source: str = "unknown"):
    """Agrega XP al usuario y si corresponde hace level-up + premia.
    Retorna dict con {leveled_up, new_level, rewards_granted}."""
    if amount <= 0 or not user_id:
        return None
    user = await db.users.find_one({"id": user_id})
    if not user:
        return None
    old_xp = user.get("xp", 0)
    old_level = user.get("level", 1)
    new_xp = old_xp + amount
    new_level = compute_level_from_xp(new_xp)

    update = {"xp": new_xp, "level": new_level}
    rewards_granted = []

    if new_level > old_level:
        # Check all milestone rewards we crossed
        total_coin_reward = 0
        for lvl_crossed in range(old_level + 1, new_level + 1):
            if lvl_crossed in LEVEL_REWARDS:
                reward = LEVEL_REWARDS[lvl_crossed]
                total_coin_reward += reward
                rewards_granted.append({"level": lvl_crossed, "coins": reward})
        if total_coin_reward > 0:
            update["coins"] = user.get("coins", 0) + total_coin_reward

        # Notify user
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "level_up",
            "title": f"🎉 ¡Subiste al nivel {new_level}!",
            "message": (
                f"Pasaste del nivel {old_level} al {new_level}. "
                + (f"Recompensa: +{total_coin_reward:,} monedas 🪙" if total_coin_reward > 0 else "Sigue jugando para ganar más premios!")
            ),
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.users.update_one({"id": user_id}, {"$set": update})
    # Log XP source for analytics
    await db.xp_log.insert_one({
        "user_id": user_id,
        "amount": amount,
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "leveled_up": new_level > old_level,
        "old_level": old_level,
        "new_level": new_level,
        "xp": new_xp,
        "xp_added": amount,
        "rewards_granted": rewards_granted,
    }


@router.get("/levels/me/{user_id}")
async def get_my_level_info(user_id: str):
    """Retorna nivel actual + progreso hacia el siguiente."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    xp = user.get("xp", 0)
    level = user.get("level", 1)
    # Recompute in case of drift
    level = compute_level_from_xp(xp)
    current_threshold = xp_needed_for_level(level)
    next_threshold = xp_needed_for_level(level + 1)
    progress = xp - current_threshold
    needed = max(1, next_threshold - current_threshold)
    pct = min(100, round(100 * progress / needed))
    next_reward_level = None
    next_reward_coins = 0
    for lvl in sorted(LEVEL_REWARDS.keys()):
        if lvl > level:
            next_reward_level = lvl
            next_reward_coins = LEVEL_REWARDS[lvl]
            break
    return {
        "level": level,
        "xp": xp,
        "xp_into_level": progress,
        "xp_needed_for_next": needed,
        "progress_pct": pct,
        "next_level": level + 1,
        "next_reward_level": next_reward_level,
        "next_reward_coins": next_reward_coins,
    }


@router.get("/levels/leaderboard")
async def level_leaderboard(limit: int = 20):
    """Top N by level + xp."""
    rows = await db.users.find(
        {"ghost_mode": {"$ne": True}, "xp": {"$gt": 0}},
        {"_id": 0, "id": 1, "username": 1, "avatar": 1, "level": 1, "xp": 1, "country_flag": 1},
    ).sort([("level", -1), ("xp", -1)]).limit(min(limit, 100)).to_list(100)
    return [{**r, "rank": i + 1} for i, r in enumerate(rows)]


@router.post("/levels/heartbeat/{user_id}")
async def heartbeat(user_id: str):
    """Llamar cada minuto mientras el usuario está en una sala con mic activo.
    Suma 10 XP (capped en backend a 1 llamada por minuto por usuario)."""
    now = datetime.now(timezone.utc)
    last = await db.xp_heartbeat.find_one({"user_id": user_id})
    if last:
        last_ts = datetime.fromisoformat(last["last"].replace("Z", "+00:00")) if isinstance(last["last"], str) else last["last"]
        delta = (now - last_ts).total_seconds()
        if delta < 55:  # throttle
            return {"throttled": True, "seconds_until_next": int(55 - delta)}
    await db.xp_heartbeat.update_one(
        {"user_id": user_id},
        {"$set": {"last": now.isoformat()}},
        upsert=True,
    )
    result = await add_xp(user_id, 10, source="heartbeat")
    return result or {"throttled": False, "xp_added": 0}
