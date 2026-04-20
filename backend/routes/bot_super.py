"""
Bot Super Admin — Moderación Automática con Poder de Dueño
===========================================================
El bot patrulla salas con rango SUPER ADMIN. Puede:
- Detectar toxicidad (insultos, spam, amenazas) usando Gemini + lista de palabras
- Auto-kick del micrófono al usuario ofensivo
- Auto-ban de sala tras N infracciones (default 3 dentro de 10 min)
- Ejecutar órdenes en chat del dueño: "bot kick @username", "bot ban @username",
  "bot mute @username", "bot limpiar"

Identidad del bot:
  BOT_USER_ID = "system_bot_lluvia"
  role = "dueño" (pasa el check _get_authority como "super")

Seguridad:
- Solo obedece comandos de chat si el emisor es rol="dueño" o is_super_admin.
- Las acciones quedan registradas en `bot_actions` para auditoría.
"""
from fastapi import APIRouter, HTTPException
from database import db, datetime, timezone, uuid, create_notification
import os
import re

try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

router = APIRouter()

BOT_USER_ID = "system_bot_lluvia"
BOT_USERNAME = "🤖 Bot Seguridad"
BOT_AVATAR = ""

# Palabras/patrones tóxicos: primera línea de defensa (rápido, sin IA).
TOXIC_PATTERNS = [
    # Insultos graves (ES)
    r"\bputo?s?\b", r"\bmaricon", r"\bpendej", r"\bmierda\b", r"\bcoño\b",
    r"\bcabr[oó]n", r"\bperra\b", r"\bzorra\b", r"\bhijo\s+de\s+puta",
    # Amenazas
    r"te\s+(mato|voy\s+a\s+matar)", r"viol(ar|ador)",
    # Spam/scam evidente
    r"compra\s+mi", r"onlyfans", r"telegra?m?\s*:", r"whatsapp\s*:",
    r"https?://\S+", r"www\.\S+",
]
TOXIC_RE = re.compile("|".join(TOXIC_PATTERNS), re.IGNORECASE)

# Ventana de reincidencia: N infracciones dentro de X minutos → auto-ban
BAN_THRESHOLD = 3
BAN_WINDOW_MIN = 10


# =================== Helpers ===================

async def _ensure_bot_user():
    """Garantiza que el usuario del bot exista en DB con role=dueño."""
    existing = await db.users.find_one({"id": BOT_USER_ID})
    if existing:
        # Idempotente — refresca role si alguna vez lo cambiaron
        if existing.get("role") != "dueño" or not existing.get("is_super_admin"):
            await db.users.update_one(
                {"id": BOT_USER_ID},
                {"$set": {"role": "dueño", "is_super_admin": True}},
            )
        return
    await db.users.insert_one({
        "id": BOT_USER_ID,
        "numeric_id": "000001",
        "username": BOT_USERNAME,
        "avatar": BOT_AVATAR,
        "role": "dueño",
        "is_super_admin": True,
        "level": 999,
        "svip_level": 10,
        "coins": 0,
        "diamonds": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "bot": True,
    })


async def _log_bot_action(action: str, room_id: str, target_user_id: str, reason: str, ordered_by: str = None):
    await db.bot_actions.insert_one({
        "id": str(uuid.uuid4()),
        "action": action,
        "room_id": room_id,
        "target_user_id": target_user_id,
        "reason": reason,
        "ordered_by": ordered_by or "auto",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _bot_chat(room_id: str, text: str):
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()),
        "room_id": room_id,
        "user_id": BOT_USER_ID,
        "username": BOT_USERNAME,
        "avatar": BOT_AVATAR,
        "text": text,
        "type": "system",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _kick_seat(room_id: str, target_user_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        return False
    seats = room.get("seats", [])
    changed = False
    for i, s in enumerate(seats):
        if s and s.get("user_id") == target_user_id:
            seats[i] = None
            changed = True
    if changed:
        await db.rooms.update_one({"id": room_id}, {"$set": {"seats": seats}})
    return changed


async def _ban_user(room_id: str, target_user_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        return False
    await _kick_seat(room_id, target_user_id)
    banned = list(room.get("banned_users", []))
    if target_user_id not in banned:
        banned.append(target_user_id)
        await db.rooms.update_one({"id": room_id}, {"$set": {"banned_users": banned}})
    return True


async def _recent_violation_count(user_id: str, room_id: str) -> int:
    from datetime import timedelta
    threshold = (datetime.now(timezone.utc) - timedelta(minutes=BAN_WINDOW_MIN)).isoformat()
    return await db.bot_actions.count_documents({
        "room_id": room_id,
        "target_user_id": user_id,
        "action": {"$in": ["auto_kick", "auto_ban"]},
        "created_at": {"$gte": threshold},
    })


async def _gemini_toxic_check(text: str) -> bool:
    """Segunda línea: IA. Solo si el regex no captó y texto > 12 chars."""
    if not GENAI_AVAILABLE:
        return False
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return False
    try:
        client = genai.Client(api_key=api_key)
        prompt = (
            "Responde unicamente 'YES' o 'NO'. "
            "¿El siguiente mensaje en una sala de chat social contiene "
            "insultos graves, amenazas, contenido sexual explícito, scam, "
            "o ataque personal? Mensaje: "
            f"<<{text[:400]}>>"
        )
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        out = (resp.text or "").strip().upper()
        return out.startswith("YES")
    except Exception:
        return False


# =================== Public API (HTTP) ===================

@router.post("/bot/super/init")
async def init_bot_super_admin():
    """Idempotente: garantiza que el bot exista como dueño/super-admin."""
    await _ensure_bot_user()
    user = await db.users.find_one({"id": BOT_USER_ID}, {"_id": 0})
    return {"success": True, "bot": {
        "id": user.get("id"),
        "username": user.get("username"),
        "role": user.get("role"),
        "is_super_admin": user.get("is_super_admin"),
    }}


@router.post("/bot/super/patrol/{room_id}")
async def patrol_room_now(room_id: str, admin_id: str, lookback: int = 20):
    """
    Patrulla manual: revisa los últimos `lookback` mensajes de la sala,
    detecta tóxicos y actúa (kick/ban). Solo dueño puede ordenar patrulla.
    """
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño puede ordenar patrullaje")

    await _ensure_bot_user()

    msgs = await db.room_chat.find(
        {"room_id": room_id, "type": {"$ne": "system"}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(lookback)

    actions = []
    seen_offenders = set()
    for m in msgs:
        uid = m.get("user_id")
        text = m.get("text", "")
        if not uid or uid in (BOT_USER_ID, "system", "bot"):
            continue
        if uid in seen_offenders:
            continue
        is_toxic = bool(TOXIC_RE.search(text)) or await _gemini_toxic_check(text)
        if not is_toxic:
            continue
        seen_offenders.add(uid)
        violations = await _recent_violation_count(uid, room_id) + 1
        if violations >= BAN_THRESHOLD:
            await _ban_user(room_id, uid)
            await _log_bot_action("auto_ban", room_id, uid, f"Reincidencia ({violations}): {text[:80]}", ordered_by=admin_id)
            await _bot_chat(room_id, f"🛡️ {m.get('username','Usuario')} fue expulsado de la sala por reincidencia.")
            actions.append({"target": uid, "action": "ban", "reason": text[:80]})
        else:
            await _kick_seat(room_id, uid)
            await _log_bot_action("auto_kick", room_id, uid, text[:80], ordered_by=admin_id)
            await _bot_chat(room_id, f"🛡️ {m.get('username','Usuario')} bajado del micro por lenguaje inapropiado. Aviso {violations}/{BAN_THRESHOLD}.")
            actions.append({"target": uid, "action": "kick", "violations": violations})

    return {"success": True, "reviewed": len(msgs), "actions": actions}


@router.get("/bot/super/actions")
async def list_bot_actions(admin_id: str, room_id: str = None, limit: int = 50):
    """Registro de auditoría de las acciones del bot super-admin."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")
    q = {}
    if room_id:
        q["room_id"] = room_id
    rows = await db.bot_actions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return rows


# =================== Chat hook (invocado desde el endpoint de chat de room) ===================

# Mapa username → user_id cache ligero para comandos (@username)
async def _username_to_user_id(username: str) -> str | None:
    u = await db.users.find_one({"username": username}, {"_id": 0, "id": 1})
    return u.get("id") if u else None


async def process_chat_for_bot(room_id: str, sender: dict, text: str) -> dict:
    """
    Hook llamado desde el endpoint /rooms/{id}/chat.
    Retorna dict con `{handled: bool, actions: []}`.
    Realiza:
      1) Detección tóxica automática del mensaje → auto-kick/ban
      2) Comandos del dueño: "bot kick @user", "bot ban @user", "bot mute @user"
    """
    await _ensure_bot_user()
    sender_id = sender.get("user_id") or sender.get("id")
    if not sender_id or sender_id in (BOT_USER_ID, "system", "bot"):
        return {"handled": False, "actions": []}

    actions = []

    # --- Comandos de dueño ---
    m = re.match(r"^bot\s+(kick|ban|mute|expulsar|banear)\s+@?([A-Za-z0-9_\-\. áéíóúñÁÉÍÓÚÑ]+)", text, re.IGNORECASE)
    if m:
        sender_user = await db.users.find_one({"id": sender_id})
        is_super = sender_user and (sender_user.get("role") == "dueño" or sender_user.get("is_super_admin"))
        if not is_super:
            await _bot_chat(room_id, f"Solo el dueño puede darme órdenes, {sender.get('username','amigo')}.")
            return {"handled": True, "actions": []}
        cmd = m.group(1).lower()
        target_name = m.group(2).strip()
        target_id = await _username_to_user_id(target_name)
        if not target_id:
            await _bot_chat(room_id, f"No encontré a @{target_name}.")
            return {"handled": True, "actions": []}
        if cmd in ("kick", "mute"):
            await _kick_seat(room_id, target_id)
            await _log_bot_action(f"owner_{cmd}", room_id, target_id, f"Ordenado por {sender.get('username')}", ordered_by=sender_id)
            await _bot_chat(room_id, f"🛡️ {target_name} bajado del micro por orden del dueño.")
            actions.append({"action": cmd, "target": target_id})
        elif cmd in ("ban", "banear", "expulsar"):
            await _ban_user(room_id, target_id)
            await _log_bot_action("owner_ban", room_id, target_id, f"Ordenado por {sender.get('username')}", ordered_by=sender_id)
            await _bot_chat(room_id, f"🛡️ {target_name} expulsado de la sala por orden del dueño.")
            actions.append({"action": "ban", "target": target_id})
        return {"handled": True, "actions": actions}

    # --- Auto-moderación ---
    if len(text) < 2:
        return {"handled": False, "actions": []}
    is_toxic = bool(TOXIC_RE.search(text))
    if not is_toxic and len(text) > 15:
        is_toxic = await _gemini_toxic_check(text)
    if not is_toxic:
        return {"handled": False, "actions": []}

    violations = await _recent_violation_count(sender_id, room_id) + 1
    if violations >= BAN_THRESHOLD:
        await _ban_user(room_id, sender_id)
        await _log_bot_action("auto_ban", room_id, sender_id, text[:80])
        await _bot_chat(room_id, f"🛡️ {sender.get('username','Usuario')} fue expulsado de la sala por reincidencia. Respeten las reglas.")
        actions.append({"action": "auto_ban", "target": sender_id})
    else:
        await _kick_seat(room_id, sender_id)
        await _log_bot_action("auto_kick", room_id, sender_id, text[:80])
        await _bot_chat(room_id, f"🛡️ {sender.get('username','Usuario')} bajado del micro por lenguaje inapropiado. Aviso {violations}/{BAN_THRESHOLD}.")
        actions.append({"action": "auto_kick", "target": sender_id, "violations": violations})

    return {"handled": True, "actions": actions}
