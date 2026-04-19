"""
Social routes: Clanes, Parejas (CP), Gifts, Sobres, Cofres.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from database import db, ClanCreate, GiftSend, serialize_user, uuid, datetime, timezone, create_notification, UPLOAD_DIR
from pydantic import BaseModel
import random
from datetime import timedelta

router = APIRouter()


# ==================== GIFTS LEADERBOARD (Daily/Weekly/Monthly con CORONA) ====================

def _window_start(window: str) -> datetime:
    now = datetime.now(timezone.utc)
    if window == "daily":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if window == "weekly":
        # Start of current ISO week (Monday 00:00 UTC)
        return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    if window == "monthly":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now - timedelta(days=30)


@router.get("/rankings/gifts")
async def gifts_leaderboard(window: str = "daily", limit: int = 20):
    """Top gifters by coins spent in time window.
    window: 'daily' | 'weekly' | 'monthly'
    """
    if window not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="window debe ser daily/weekly/monthly")
    start_iso = _window_start(window).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": "$sender_id",
            "total_spent": {"$sum": "$cost"},
            "gift_count": {"$sum": 1},
        }},
        {"$sort": {"total_spent": -1}},
        {"$limit": max(1, min(limit, 100))},
    ]
    rows = await db.gifts.aggregate(pipeline).to_list(100)
    out = []
    for i, r in enumerate(rows):
        u = await db.users.find_one({"id": r["_id"]})
        if not u or u.get("ghost_mode"):
            continue
        out.append({
            "rank": i + 1,
            "user_id": r["_id"],
            "username": u.get("username"),
            "avatar": u.get("avatar"),
            "country_flag": u.get("country_flag"),
            "level": u.get("level", 1),
            "svip_level": u.get("svip_level", 0),
            "total_spent": r.get("total_spent", 0),
            "gift_count": r.get("gift_count", 0),
            "is_crown": i == 0,   # 👑 king of gifts
        })
    return {"window": window, "starts_at": start_iso, "leaderboard": out}


@router.get("/rankings/gifts/crown")
async def current_gift_crown():
    """Quick endpoint: returns only the current top gifter for badge display in rooms."""
    daily = await gifts_leaderboard(window="daily", limit=1)
    weekly = await gifts_leaderboard(window="weekly", limit=1)
    monthly = await gifts_leaderboard(window="monthly", limit=1)
    def _first(d):
        lb = d.get("leaderboard") or []
        return lb[0] if lb else None
    return {
        "daily_king": _first(daily),
        "weekly_king": _first(weekly),
        "monthly_king": _first(monthly),
    }


@router.get("/rankings/gifts/room/{room_id}")
async def room_gifts_leaderboard(room_id: str, window: str = "daily", limit: int = 10):
    """Top gifters in a specific room (for in-room crown)."""
    if window not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="window debe ser daily/weekly/monthly")
    start_iso = _window_start(window).isoformat()
    pipeline = [
        {"$match": {"room_id": room_id, "created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": "$sender_id",
            "total_spent": {"$sum": "$cost"},
            "gift_count": {"$sum": 1},
        }},
        {"$sort": {"total_spent": -1}},
        {"$limit": max(1, min(limit, 50))},
    ]
    rows = await db.gifts.aggregate(pipeline).to_list(50)
    out = []
    for i, r in enumerate(rows):
        u = await db.users.find_one({"id": r["_id"]})
        if not u:
            continue
        out.append({
            "rank": i + 1,
            "user_id": r["_id"],
            "username": u.get("username"),
            "avatar": u.get("avatar"),
            "total_spent": r.get("total_spent", 0),
            "gift_count": r.get("gift_count", 0),
            "is_crown": i == 0,
        })
    return {"window": window, "room_id": room_id, "leaderboard": out}


# ClanCreate imported from database

@router.post("/clanes")
async def create_clan(data: ClanCreate):
    """Create Clan."""
    owner = await db.users.find_one({"id": data.owner_id})
    if not owner:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    existing = await db.clanes.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Clan ya existe")
    clan_id = str(uuid.uuid4())
    clan_doc = {
        "id": clan_id, "name": data.name, "owner_id": data.owner_id,
        "owner_name": owner['username'], "members": [data.owner_id],
        "total_coins": 0, "weekly_coins": 0, "monthly_coins": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.clanes.insert_one(clan_doc)
    await db.users.update_one({"id": data.owner_id}, {"$set": {"clan_id": clan_id, "clan_name": data.name}})
    clan_doc.pop('_id', None)
    return clan_doc

@router.get("/clanes")
async def get_clanes():
    """Get Clanes."""
    clanes = await db.clanes.find().sort("weekly_coins", -1).to_list(50)
    return [{k: v for k, v in c.items() if k != "_id"} for c in clanes]

@router.post("/clanes/{clan_id}/join")
async def join_clan(clan_id: str, user_id: str):
    """Join Clan."""
    clan = await db.clanes.find_one({"id": clan_id})
    if not clan:
        raise HTTPException(status_code=404, detail="Clan no encontrado")
    if user_id in clan.get('members', []):
        raise HTTPException(status_code=400, detail="Ya eres miembro")
    await db.clanes.update_one({"id": clan_id}, {"$push": {"members": user_id}})
    await db.users.update_one({"id": user_id}, {"$set": {"clan_id": clan_id, "clan_name": clan['name']}})
    return {"success": True}

@router.post("/clanes/{clan_id}/leave")
async def leave_clan(clan_id: str, user_id: str):
    """Leave Clan."""
    await db.clanes.update_one({"id": clan_id}, {"$pull": {"members": user_id}})
    await db.users.update_one({"id": user_id}, {"$set": {"clan_id": None, "clan_name": None}})
    return {"success": True}

# ==================== PAREJAS (CP) ====================

class CPCreate(BaseModel):
    user1_id: str
    user2_id: str

@router.post("/cp/create")
async def create_cp(data: CPCreate):
    """Create Cp."""
    u1 = await db.users.find_one({"id": data.user1_id})
    u2 = await db.users.find_one({"id": data.user2_id})
    if not u1 or not u2:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    cp_id = str(uuid.uuid4())
    cp_doc = {
        "id": cp_id, "user1_id": data.user1_id, "user2_id": data.user2_id,
        "user1_name": u1['username'], "user2_name": u2['username'],
        "level": 1, "total_coins": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.parejas.insert_one(cp_doc)
    await db.users.update_one({"id": data.user1_id}, {"$set": {"cp_id": cp_id, "cp_partner": u2['username']}})
    await db.users.update_one({"id": data.user2_id}, {"$set": {"cp_id": cp_id, "cp_partner": u1['username']}})
    
    # Notification hook: new CP
    await create_notification(
        "evento_cp",
        "Nueva Pareja",
        f"{u1['username']} y {u2['username']} son pareja oficial!",
        data={"cp_id": cp_id}
    )
    
    cp_doc.pop('_id', None)
    return cp_doc

@router.get("/cp")
async def get_parejas():
    """Get Parejas."""
    cps = await db.parejas.find().sort("total_coins", -1).to_list(50)
    return [{k: v for k, v in c.items() if k != "_id"} for c in cps]

@router.post("/cp/{cp_id}/level-up")
async def cp_level_up(cp_id: str):
    """Cp Level Up."""
    cp = await db.parejas.find_one({"id": cp_id})
    if not cp:
        raise HTTPException(status_code=404, detail="Pareja no encontrada")
    new_level = cp.get('level', 1) + 1
    bonus = 0
    ring = None
    if new_level == 6:
        bonus = 5000000
        ring = "V1"
    elif new_level == 7:
        bonus = 5000000
        ring = "V2"
    
    updates = {"level": new_level}
    if ring:
        updates["ring"] = ring
    
    await db.parejas.update_one({"id": cp_id}, {"$set": updates})
    if bonus > 0:
        await db.users.update_one({"id": cp['user1_id']}, {"$inc": {"coins": bonus}})
        await db.users.update_one({"id": cp['user2_id']}, {"$inc": {"coins": bonus}})
        # Add ring badge
        if ring:
            await db.users.update_one({"id": cp['user1_id']}, {"$push": {"badges": f"💍 Anillo {ring}"}})
            await db.users.update_one({"id": cp['user2_id']}, {"$push": {"badges": f"💍 Anillo {ring}"}})
    
    # Notification hook: CP level up
    await create_notification(
        "evento_cp",
        "Pareja Sube de Nivel",
        f"Pareja {cp.get('user1_name', '')} y {cp.get('user2_name', '')} llego a nivel {new_level}!" + (f" 💍 Anillo {ring}!" if ring else ""),
        data={"cp_id": cp_id, "new_level": new_level}
    )
    
    return {"success": True, "new_level": new_level, "bonus": bonus, "ring": ring}

# ==================== EVENTOS Y PREMIOS ====================



# ==================== GIFTS (REGALOS) ====================

BIG_GIFTS = ["dragon", "castillo", "lluvia_oro", "mega_crown"]

GIFTS = {
    "rosa": {"name": "Rosa", "emoji": "🌹", "cost": 100, "value": 80},
    "corazon": {"name": "Corazon", "emoji": "❤️", "cost": 500, "value": 400},
    "diamante": {"name": "Diamante", "emoji": "💎", "cost": 5000, "value": 4000},
    "corona": {"name": "Corona", "emoji": "👑", "cost": 10000, "value": 8000},
    "dragon": {"name": "Dragon", "emoji": "🐉", "cost": 50000, "value": 40000},
    "castillo": {"name": "Castillo", "emoji": "🏰", "cost": 100000, "value": 80000},
    "lluvia_oro": {"name": "Lluvia de Oro", "emoji": "🌧️💰", "cost": 500000, "value": 400000},
    "mega_crown": {"name": "Mega Corona", "emoji": "👑💎", "cost": 1000000, "value": 800000},
    "sobre_10k": {"name": "Sobre 10K", "emoji": "💌", "cost": 10000, "value": 8000},
    "sobre_50k": {"name": "Sobre 50K", "emoji": "💝", "cost": 50000, "value": 40000},
    "sobre_100k": {"name": "Sobre 100K", "emoji": "🎁", "cost": 100000, "value": 80000},
    "sobre_500k": {"name": "Sobre 500K", "emoji": "🎀", "cost": 500000, "value": 400000},
    "sobre_1m": {"name": "Sobre 1M", "emoji": "🧧", "cost": 1000000, "value": 800000},
    "sobre_5m": {"name": "Sobre 5M", "emoji": "💰", "cost": 5000000, "value": 4000000},
    "sobre_10m": {"name": "Sobre 10M", "emoji": "💎", "cost": 10000000, "value": 8000000},
}

@router.get("/gifts")
async def get_gifts():
    """Get Gifts."""
    return GIFTS

@router.post("/gifts/send")
async def send_gift(gift: GiftSend):
    """Send Gift."""
    if gift.gift_type not in GIFTS:
        raise HTTPException(status_code=400, detail="Regalo no válido")
    
    g = GIFTS[gift.gift_type]
    sender = await db.users.find_one({"id": gift.sender_id})
    if not sender:
        raise HTTPException(status_code=404, detail="Sender no encontrado")
    if sender['coins'] < g['cost']:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    
    receiver = await db.users.find_one({"id": gift.receiver_id})
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver no encontrado")
    
    # Deduct from sender, add to receiver
    await db.users.update_one({"id": gift.sender_id}, {"$inc": {"coins": -g['cost'], "total_spent": g['cost'], "total_gifts_sent": 1}})
    await db.users.update_one({"id": gift.receiver_id}, {"$inc": {"coins": g['value'], "total_received": g['value'], "total_gifts_received": 1}})
    
    # Log gift
    gift_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": gift.sender_id,
        "sender_name": sender['username'],
        "receiver_id": gift.receiver_id,
        "receiver_name": receiver['username'],
        "gift_type": gift.gift_type,
        "gift_name": g['name'],
        "gift_emoji": g['emoji'],
        "cost": g['cost'],
        "value": g['value'],
        "room_id": gift.room_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.gifts.insert_one(gift_doc)

    # Level-up XP: sender gets 2 XP per coin spent; receiver gets 1 XP per coin received
    try:
        from routes.levels import add_xp
        await add_xp(gift.sender_id, int(g['cost']) * 2, source="gift_sent")
        await add_xp(gift.receiver_id, int(g['cost']) * 1, source="gift_received")
    except Exception:
        pass
    
    # Add to chat if in room
    if gift.room_id:
        chat_doc = {
            "id": str(uuid.uuid4()),
            "room_id": gift.room_id,
            "user_id": gift.sender_id,
            "username": sender['username'],
            "avatar": sender['avatar'],
            "text": f"{g['emoji']} {sender['username']} envió {g['name']} a {receiver['username']} {g['emoji']}",
            "type": "gift",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.room_chat.insert_one(chat_doc)
    
    updated_sender = await db.users.find_one({"id": gift.sender_id})
    
    # Notification hook: big gifts
    if gift.gift_type in BIG_GIFTS:
        await create_notification(
            "regalo_global",
            f"{g['emoji']} Regalo Especial",
            f"{sender['username']} envio {g['name']} {g['emoji']} a {receiver['username']}",
            data={"gift_type": gift.gift_type, "sender": sender['username'], "receiver": receiver['username']}
        )
    
    gift_doc.pop('_id', None)
    
    # Accumulate gifts toward room cofres
    if gift.room_id:
        await db.rooms.update_one({"id": gift.room_id}, {"$inc": {"cofre_progress": g['cost']}})
    
    # Check badges for sender and receiver
    from routes.badges import check_and_award_badges
    sender_new = await check_and_award_badges(gift.sender_id)
    receiver_new = await check_and_award_badges(gift.receiver_id)
    
    return {"success": True, "gift": gift_doc, "new_balance": updated_sender['coins'], "new_badges": sender_new}

# ==================== SOBRES (LLUVIA DE ORO) ====================

SOBRE_TIERS = [
    {"id": "sobre_10k", "name": "Sobre 10K", "emoji": "💌", "amount": 10000},
    {"id": "sobre_50k", "name": "Sobre 50K", "emoji": "💝", "amount": 50000},
    {"id": "sobre_100k", "name": "Sobre 100K", "emoji": "🎁", "amount": 100000},
    {"id": "sobre_500k", "name": "Sobre 500K", "emoji": "🎀", "amount": 500000},
    {"id": "sobre_1m", "name": "Sobre 1M", "emoji": "🧧", "amount": 1000000},
    {"id": "sobre_5m", "name": "Sobre 5M", "emoji": "💰", "amount": 5000000},
    {"id": "sobre_10m", "name": "Sobre 10M", "emoji": "💎", "amount": 10000000},
]

class SobreData(BaseModel):
    sender_id: str
    room_id: str
    sobre_id: str

@router.get("/sobres")
async def get_sobres():
    """Get Sobres."""
    return SOBRE_TIERS

@router.post("/sobres/throw")
async def throw_sobre(data: SobreData):
    """Throw Sobre."""
    sobre = next((s for s in SOBRE_TIERS if s['id'] == data.sobre_id), None)
    if not sobre:
        raise HTTPException(status_code=400, detail="Sobre no valido")
    sender = await db.users.find_one({"id": data.sender_id})
    if not sender:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if sender.get('coins', 0) < sobre['amount']:
        raise HTTPException(status_code=400, detail="Monedas insuficientes")
    room = await db.rooms.find_one({"id": data.room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    seated = [s for s in room.get('seats', []) if s and s.get('user_id') != data.sender_id]
    if not seated:
        raise HTTPException(status_code=400, detail="No hay nadie mas en la sala")
    await db.users.update_one({"id": data.sender_id}, {"$inc": {"coins": -sobre['amount'], "total_spent": sobre['amount']}})
    per_person = sobre['amount'] // len(seated)
    recipients = []
    for s in seated:
        await db.users.update_one({"id": s['user_id']}, {"$inc": {"coins": per_person}})
        recipients.append(s['username'])
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": data.room_id,
        "user_id": data.sender_id, "username": sender['username'], "avatar": sender['avatar'],
        "text": f"{sobre['emoji']} LLUVIA DE ORO! {sender['username']} lanzo {sobre['name']}! +{per_person:,} para cada uno! {sobre['emoji']}",
        "type": "gift", "created_at": datetime.now(timezone.utc).isoformat()
    })
    await db.rooms.update_one({"id": data.room_id}, {"$inc": {"cofre_progress": sobre['amount']}})
    updated = await db.users.find_one({"id": data.sender_id})
    return {"success": True, "per_person": per_person, "recipients": recipients, "new_balance": updated['coins']}

# ==================== ROOM BACKGROUND & MUSIC ====================

@router.post("/rooms/{room_id}/background")
async def set_room_background(room_id: str, owner_id: str, file: UploadFile = File(...)):
    """Set Room Background."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    if room.get('owner_id') != owner_id:
        owner = await db.users.find_one({"id": owner_id})
        if not owner or owner.get('role') != 'dueño':
            raise HTTPException(status_code=403, detail="Solo el dueño de la sala")
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
    if ext not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
        raise HTTPException(status_code=400, detail="Solo imagenes")
    fid = str(uuid.uuid4())
    fname = f"bg_{fid}.{ext}"
    content = await file.read()
    with open(UPLOAD_DIR / fname, "wb") as f:
        f.write(content)
    bg_url = f"/api/uploads/{fname}"
    await db.rooms.update_one({"id": room_id}, {"$set": {"background": bg_url}})
    return {"success": True, "background": bg_url}

@router.post("/rooms/{room_id}/music")
async def set_room_music(room_id: str, owner_id: str, file: UploadFile = File(...)):
    """Set Room Music."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    if room.get('owner_id') != owner_id:
        owner = await db.users.find_one({"id": owner_id})
        if not owner or owner.get('role') != 'dueño':
            raise HTTPException(status_code=403, detail="Solo el dueño de la sala")
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'mp3'
    if ext not in ['mp3', 'wav', 'ogg', 'aac', 'm4a']:
        raise HTTPException(status_code=400, detail="Solo audio: mp3, wav, ogg")
    fid = str(uuid.uuid4())
    fname = f"music_{fid}.{ext}"
    content = await file.read()
    with open(UPLOAD_DIR / fname, "wb") as f:
        f.write(content)
    music_url = f"/api/uploads/{fname}"
    await db.rooms.update_one({"id": room_id}, {"$set": {"music_url": music_url}})
    return {"success": True, "music_url": music_url}

@router.delete("/rooms/{room_id}/music")
async def remove_room_music(room_id: str, owner_id: str):
    """Remove Room Music."""
    await db.rooms.update_one({"id": room_id}, {"$unset": {"music_url": ""}})
    return {"success": True}

# ==================== WEEKLY/MONTHLY RANKINGS ====================

@router.get("/rankings/weekly-clans")
async def get_weekly_clans():
    """Get Weekly Clans."""
    clans = await db.clanes.find().sort("weekly_coins", -1).limit(3).to_list(3)
    return [{k: v for k, v in c.items() if k != "_id"} for c in clans]

@router.get("/rankings/monthly-clans")
async def get_monthly_clans():
    """Get Monthly Clans."""
    clans = await db.clanes.find().sort("monthly_coins", -1).limit(3).to_list(3)
    return [{k: v for k, v in c.items() if k != "_id"} for c in clans]

# ==================== COFRES ACUMULATIVOS ====================

COFRE_THRESHOLDS = [
    {"level": 1, "threshold": 300000, "label": "300K", "return_pct": 0.03},
    {"level": 2, "threshold": 500000, "label": "500K", "return_pct": 0.04},
    {"level": 3, "threshold": 1000000, "label": "1M", "return_pct": 0.03},
    {"level": 4, "threshold": 2500000, "label": "2.5M", "return_pct": 0.05},
    {"level": 5, "threshold": 5000000, "label": "5M", "return_pct": 0.06},
    {"level": 6, "threshold": 7000000, "label": "7M", "return_pct": 0.06},
    {"level": 7, "threshold": 10000000, "label": "10M", "return_pct": 0.07},
    {"level": 8, "threshold": 15000000, "label": "15M", "return_pct": 0.08},
    {"level": 9, "threshold": 20000000, "label": "20M", "return_pct": 0.09},
    {"level": 10, "threshold": 20000000, "label": "20M", "return_pct": 0.10},
]

@router.get("/rooms/{room_id}/cofres")
async def get_room_cofres(room_id: str):
    """Get Room Cofres."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    progress = room.get('cofre_progress', 0)
    opened = room.get('cofres_opened', 0)
    return {"progress": progress, "cofres_opened": opened, "thresholds": COFRE_THRESHOLDS}

@router.post("/rooms/{room_id}/open-cofre")
async def try_open_cofre(room_id: str):
    """Try Open Cofre."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    progress = room.get('cofre_progress', 0)
    opened = room.get('cofres_opened', 0)
    if opened >= 10:
        return {"opened": False, "message": "Todos los cofres abiertos"}
    cofre = COFRE_THRESHOLDS[opened]
    accumulated = sum(COFRE_THRESHOLDS[i]['threshold'] for i in range(opened))
    needed = accumulated + cofre['threshold']
    if progress < needed:
        return {"opened": False, "progress": progress, "needed": needed}
    seated = [s for s in room.get('seats', []) if s]
    if not seated:
        return {"opened": False, "message": "Nadie en la sala"}
    pool = int(cofre['threshold'] * cofre['return_pct'])
    prizes_split = [0.4, 0.25, 0.15] + [0.2 / max(len(seated) - 3, 1)] * max(len(seated) - 3, 0)
    results = []
    for i, s in enumerate(seated):
        pct = prizes_split[i] if i < len(prizes_split) else 0.02
        amt = int(pool * pct)
        await db.users.update_one({"id": s['user_id']}, {"$inc": {"coins": amt}})
        results.append(f"{s['username']}: +{amt:,}")
    await db.rooms.update_one({"id": room_id}, {"$set": {"cofres_opened": opened + 1}})
    await db.room_chat.insert_one({        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "system", "username": "Sistema",
        "text": f"COFRE #{opened+1} ABIERTO! " + " | ".join(results),
        "type": "gift", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "results": results, "cofre_level": opened + 1}
