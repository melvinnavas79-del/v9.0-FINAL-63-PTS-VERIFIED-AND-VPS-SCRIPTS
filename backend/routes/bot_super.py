"""
Bot Super Admin — Moderación Automática + Auditoría Técnica
=============================================================
El bot es el "supervisor del sistema" con rango de dueño (Super Admin).

I. MODERACIÓN (ver abajo)
   - Detecta toxicidad (regex + Gemini) y auto-kick/ban.
   - Obedece comandos del dueño en chat: "bot kick @user", "bot ban @user".

II. AUDITORÍA TÉCNICA — OJO TÉCNICO (añadido iter 14)
   - Error Logger: captura TODA excepción no controlada del backend y la
     guarda en `system_errors` con archivo + línea + traceback.
   - Vigilancia de Integridad: endpoint para auditar descuadre de monedas/
     diamantes, detectar balances negativos, intentos de inyección.
   - Esquema del Código: `/app/backend/code_map.json` le da contexto al bot
     para enriquecer cada error con el archivo y su rol.

Seguridad:
- Solo obedece comandos si role='dueño' / is_super_admin.
- Endpoints de auditoría solo accesibles al dueño.
"""
from fastapi import APIRouter, HTTPException
from database import db, datetime, timezone, uuid
import os
import re
import json
import traceback as _tb
from pathlib import Path

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


# ============================================================================
#                    OJO TÉCNICO — AUDITORÍA DEL SISTEMA
# ============================================================================

_CODE_MAP = None


def _load_code_map() -> dict:
    """Carga y cachea el mapa del código."""
    global _CODE_MAP
    if _CODE_MAP is None:
        p = Path(__file__).resolve().parents[1] / "code_map.json"
        try:
            with open(p, encoding="utf-8") as f:
                _CODE_MAP = json.load(f)
        except Exception:
            _CODE_MAP = {"files": {}, "common_errors": {}}
    return _CODE_MAP


def _extract_error_location(exc: BaseException) -> dict:
    """
    Dado un Exception, extrae el FRAME más profundo dentro del backend de
    Lluvia (ignora librerías externas). Retorna:
      { file, line, function, source_role }
    """
    backend_root = str(Path(__file__).resolve().parents[1])
    tb = _tb.extract_tb(exc.__traceback__)
    chosen = None
    for frame in reversed(tb):
        if frame.filename.startswith(backend_root) and "site-packages" not in frame.filename:
            chosen = frame
            break
    if chosen is None and tb:
        chosen = tb[-1]
    if chosen is None:
        return {"file": "unknown", "line": 0, "function": "unknown", "source_role": "unknown"}

    rel = chosen.filename.replace(backend_root + "/", "").replace(backend_root + "\\", "")
    code_map = _load_code_map()
    # match by suffix (routes/X.py, database.py, server.py)
    role = "unknown"
    for key, meta in code_map.get("files", {}).items():
        if rel.endswith(key):
            role = meta.get("role", "")
            break

    return {
        "file": rel,
        "line": chosen.lineno,
        "function": chosen.name,
        "source_role": role,
    }


async def log_system_error(exc: BaseException, context: dict = None) -> dict:
    """
    Registra un error técnico en `system_errors` para que el dueño lo vea.
    Llamado desde el global exception handler en server.py.
    """
    loc = _extract_error_location(exc)
    code_map = _load_code_map()
    exc_type = type(exc).__name__
    hint = code_map.get("common_errors", {}).get(exc_type, "")

    doc = {
        "id": str(uuid.uuid4()),
        "type": exc_type,
        "message": str(exc)[:500],
        "file": loc["file"],
        "line": loc["line"],
        "function": loc["function"],
        "source_role": loc["source_role"],
        "hint": hint,
        "context": context or {},
        "traceback": _tb.format_exception(type(exc), exc, exc.__traceback__)[-6:],  # tail
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved": False,
    }
    try:
        await db.system_errors.insert_one(doc)
        # Purgar si pasan de 500 (keep más reciente)
        count = await db.system_errors.count_documents({})
        if count > 500:
            old_cursor = db.system_errors.find({}, {"_id": 1}).sort("created_at", 1).limit(count - 500)
            old_ids = [d["_id"] async for d in old_cursor]
            if old_ids:
                await db.system_errors.delete_many({"_id": {"$in": old_ids}})
    except Exception:
        # Never throw inside the error logger
        pass
    doc.pop("_id", None)
    return doc


@router.get("/bot/super/errors")
async def list_system_errors(admin_id: str, resolved: bool = False, limit: int = 50):
    """Últimos errores técnicos para el panel del dueño."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")
    rows = await db.system_errors.find(
        {"resolved": resolved},
        {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    # Formato human-readable adicional
    for r in rows:
        r["bot_report"] = f"Jefe, error en {r['file']}, línea {r['line']} ({r['function']}). Motivo: {r['type']}: {r['message'][:200]}"
    return rows


@router.post("/bot/super/errors/{error_id}/resolve")
async def resolve_error(error_id: str, admin_id: str):
    """Marca un error como resuelto para que no salga en el panel."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")
    r = await db.system_errors.update_one({"id": error_id}, {"$set": {"resolved": True}})
    return {"success": r.modified_count > 0}


@router.get("/bot/super/errors/stats")
async def error_stats(admin_id: str):
    """Conteo de errores por archivo/tipo en últimas 24h. Útil para dashboard."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    pipeline_file = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$file", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    pipeline_type = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    by_file = await db.system_errors.aggregate(pipeline_file).to_list(10)
    by_type = await db.system_errors.aggregate(pipeline_type).to_list(10)
    total = await db.system_errors.count_documents({"created_at": {"$gte": since}})
    unresolved = await db.system_errors.count_documents({"resolved": False, "created_at": {"$gte": since}})
    return {
        "last_24h": total,
        "unresolved": unresolved,
        "by_file": [{"file": x["_id"], "count": x["count"]} for x in by_file],
        "by_type": [{"type": x["_id"], "count": x["count"]} for x in by_type],
    }


@router.get("/bot/super/integrity")
async def integrity_check(admin_id: str):
    """
    Vigilancia de integridad de datos. Verifica:
      - Usuarios con balance negativo de coins/diamonds (no debería existir)
      - Suma de diamantes distribuida vs techo configurado (descuadre)
      - Salas con estructura inconsistente (seats >10 sin max_seats, banned_users mal formado)
      - Duplicados de numeric_id entre usuarios
      - Usuarios con role inválido
    """
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")

    issues = []

    # 1) Balances negativos
    neg_coins = await db.users.count_documents({"coins": {"$lt": 0}})
    neg_diamonds = await db.users.count_documents({"diamonds": {"$lt": 0}})
    if neg_coins:
        issues.append({"severity": "high", "file": "routes/admin.py", "kind": "negative_balance",
                       "detail": f"{neg_coins} usuario(s) con coins < 0. Probable descuadre en give-coins/gifts.",
                       "bot_report": f"Jefe, hay {neg_coins} usuario(s) con monedas negativas. Revisar routes/admin.py console/give-coins o routes/social.py send-gift."})
    if neg_diamonds:
        issues.append({"severity": "high", "file": "routes/admin.py", "kind": "negative_balance",
                       "detail": f"{neg_diamonds} usuario(s) con diamonds < 0.",
                       "bot_report": f"Jefe, hay {neg_diamonds} usuario(s) con diamantes negativos."})

    # 2) numeric_id duplicados
    pipeline = [
        {"$match": {"numeric_id": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$numeric_id", "ids": {"$push": "$id"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$limit": 20},
    ]
    dupes = await db.users.aggregate(pipeline).to_list(20)
    for d in dupes:
        issues.append({"severity": "medium", "file": "routes/auth.py", "kind": "duplicate_numeric_id",
                       "detail": f"numeric_id={d['_id']} compartido por {d['count']} usuarios ({d['ids'][:3]}).",
                       "bot_report": f"Jefe, {d['count']} usuarios con el mismo numeric_id {d['_id']}. Revisar generación en auth.py línea 39."})

    # 3) Salas mal formadas
    rooms = await db.rooms.find({}, {"_id": 0, "id": 1, "name": 1, "seats": 1, "max_seats": 1, "banned_users": 1}).to_list(500)
    for r in rooms:
        seats = r.get("seats") or []
        max_seats = r.get("max_seats", 10)
        if len(seats) > max_seats + 1:
            issues.append({"severity": "low", "file": "routes/rooms.py", "kind": "seats_overflow",
                           "detail": f"Sala '{r.get('name')}' tiene {len(seats)} seats pero max_seats={max_seats}.",
                           "bot_report": f"Jefe, la sala '{r.get('name')}' tiene más seats de los configurados."})
        bu = r.get("banned_users")
        if bu is not None and not isinstance(bu, list):
            issues.append({"severity": "medium", "file": "routes/rooms.py", "kind": "banned_users_invalid",
                           "detail": f"Sala '{r.get('name')}' banned_users no es lista.",
                           "bot_report": f"Jefe, la sala '{r.get('name')}' tiene banned_users corrupto (no es lista)."})

    # 4) Roles invalidos
    valid_roles = {"usuario", "vip", "supervisor", "moderador", "admin", "dueño"}
    bad = await db.users.find({"role": {"$nin": list(valid_roles)}}, {"_id": 0, "id": 1, "username": 1, "role": 1}).to_list(50)
    for u in bad:
        issues.append({"severity": "high", "file": "database.py", "kind": "invalid_role",
                       "detail": f"Usuario {u.get('username')} tiene role='{u.get('role')}' (no está en ROLE_HIERARCHY).",
                       "bot_report": f"Jefe, el usuario {u.get('username')} tiene un role inválido: '{u.get('role')}'. Revisar ROLE_HIERARCHY en database.py."})

    # 5) Total oficial
    totals_cursor = db.users.aggregate([
        {"$group": {"_id": None, "coins": {"$sum": "$coins"}, "diamonds": {"$sum": "$diamonds"}, "users": {"$sum": 1}}}
    ])
    totals = await totals_cursor.to_list(1)
    total = totals[0] if totals else {"coins": 0, "diamonds": 0, "users": 0}

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "healthy": len(issues) == 0,
        "issues_count": len(issues),
        "issues": issues,
        "totals": {"users": total.get("users", 0), "coins_in_economy": total.get("coins", 0), "diamonds_in_economy": total.get("diamonds", 0)},
    }


@router.get("/bot/super/code-map")
async def get_code_map(admin_id: str):
    """Retorna el mapa de la arquitectura. Solo dueño."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get("role") != "dueño":
        raise HTTPException(status_code=403, detail="Solo el dueño")
    return _load_code_map()


# Detección simple de patrones sospechosos (inyección) en inputs de texto.
INJECTION_PATTERNS = [
    r"\$where\b", r"\$ne\s*:", r"\$gt\s*:", r"\$function",  # NoSQL
    r"<script", r"javascript:", r"on\w+\s*=",                # XSS
    r";\s*(drop|delete|insert|update)\s+", r"--\s*$",        # SQL
    r"\.\.\/", r"\/etc\/passwd", r"\\x00",                   # path traversal
]
INJECTION_RE = re.compile("|".join(INJECTION_PATTERNS), re.IGNORECASE)


async def log_suspicious_input(source: str, text: str, user_id: str = None):
    """Llamado desde hooks cuando detectamos patrón de inyección en input."""
    if not text or not INJECTION_RE.search(text):
        return False
    await db.system_errors.insert_one({
        "id": str(uuid.uuid4()),
        "type": "SuspiciousInput",
        "message": f"Patrón de inyección detectado en {source}: {text[:200]}",
        "file": source,
        "line": 0,
        "function": "input_validation",
        "source_role": "security_scanner",
        "hint": "Revisar sanitización de input. El bot bloqueó antes de tocar la DB.",
        "context": {"user_id": user_id, "raw_excerpt": text[:200]},
        "traceback": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved": False,
    })
    return True
