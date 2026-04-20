"""
Room routes: CRUD, join/leave, seats, chat, music, photos.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from database import (
    db, RoomCreate, ChatMessage, serialize_room, serialize_user,
    uuid, datetime, timezone, UPLOAD_DIR, create_notification
)
import os
import shutil

router = APIRouter()


# ==================== AUTHORITY HELPERS ====================

async def _get_authority(user_id: str, room: dict) -> dict:
    """
    Returns the authority level of `user_id` over `room`.

    Result:
      { "level": "super" | "owner" | "moderator" | "none",
        "user": <user doc> }

    - "super"     → dueño de la plataforma o is_super_admin (puede todo en cualquier sala)
    - "owner"     → dueño de la sala (puede todo en su sala)
    - "moderator" → admin/moderador del rol (puede kick/ban/mute)
    - "none"      → usuario normal
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        return {"level": "none", "user": None}
    role = user.get("role", "usuario")
    if role == "dueño" or user.get("is_super_admin"):
        return {"level": "super", "user": user}
    if room and room.get("owner_id") == user_id:
        return {"level": "owner", "user": user}
    if role in ("admin", "moderador"):
        return {"level": "moderator", "user": user}
    return {"level": "none", "user": user}


def _authority_can_manage_room(authority_level: str) -> bool:
    return authority_level in ("super", "owner", "moderator")


# ==================== ROOM CRUD ====================

@router.post("/rooms")
async def create_room(room_data: RoomCreate, owner_id: str):
    """Create a new audio room."""
    owner = await db.users.find_one({"id": owner_id})
    if not owner:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    room_doc = {
        "id": str(uuid.uuid4()), "name": room_data.name,
        "owner_id": owner_id, "owner_name": owner['username'],
        "active_users": 0, "max_seats": 9, "seats": [None] * 9,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.rooms.insert_one(room_doc)
    if owner.get('coins', 0) >= 50000000:
        last_prize = owner.get('last_baby_robot_prize', 0)
        if owner['coins'] - last_prize >= 50000000:
            await db.users.update_one({"id": owner_id}, {"$inc": {"coins": 15000000}, "$set": {"last_baby_robot_prize": owner['coins']}})
    return serialize_room(room_doc)

@router.get("/rooms")
async def get_rooms():
    """Get Rooms sorted by owner SVIP level (highest first), then active users."""
    rooms = await db.rooms.find().to_list(200)
    serialized = [serialize_room(r) for r in rooms]
    serialized.sort(key=lambda r: (r.get('owner_svip', 0), r.get('active_users', 0)), reverse=True)
    return serialized

@router.get("/rooms/{room_id}")
async def get_room(room_id: str):
    """Get Room."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    return serialize_room(room)

@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, owner_id: str):
    """Delete Room."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    if room['owner_id'] != owner_id:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    await db.rooms.delete_one({"id": room_id})
    return {"success": True}

@router.post("/rooms/my-room")
async def get_or_create_my_room(user_id: str):
    """Get user's room or create one automatically."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    room = await db.rooms.find_one({"owner_id": user_id})
    if room:
        return serialize_room(room)
    room_doc = {
        "id": str(uuid.uuid4()), "name": f"Sala de {user['username']}",
        "owner_id": user_id, "owner_name": user['username'],
        "owner_svip": user.get('svip_level', 0),
        "active_users": 0, "max_seats": 10, "seats": [None] * 10,
        "seat_locks": [False] * 10,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.rooms.insert_one(room_doc)
    # Track room creation for badges
    await db.users.update_one({"id": user_id}, {"$inc": {"rooms_created": 1}})
    from routes.badges import check_and_award_badges
    await check_and_award_badges(user_id)
    return serialize_room(room_doc)

# ==================== SEAT MANAGEMENT ====================

@router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, user_id: str, seat_index: int):
    """Join a seat in a room. Removes user from other rooms first."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Si el usuario está baneado de esta sala (kick/ban-user previo), rechazar
    # A menos que sea Super Admin (role=dueño / is_super_admin).
    banned = room.get("banned_users", [])
    is_super = user.get("role") == "dueño" or user.get("is_super_admin")
    if user_id in banned and not is_super:
        raise HTTPException(status_code=403, detail="Has sido expulsado de esta sala")
    seats = room.get('seats', [None] * 10)
    seat_locks = room.get('seat_locks', [False] * 10)
    # Extend if needed
    while len(seats) < 10:
        seats.append(None)
    while len(seat_locks) < 10:
        seat_locks.append(False)
    if seat_index >= len(seats):
        raise HTTPException(status_code=400, detail="Indice de asiento invalido")
    # Check seat lock
    if seat_locks[seat_index] and room.get('owner_id') != user_id:
        raise HTTPException(status_code=403, detail="Este asiento esta bloqueado")
    if seats[seat_index] is not None and seats[seat_index].get('user_id') != user_id:
        raise HTTPException(status_code=400, detail="Asiento ocupado")
    # Remove from current seat in this room
    for i, s in enumerate(seats):
        if s and s.get('user_id') == user_id:
            seats[i] = None
    # Remove from other rooms
    all_rooms = await db.rooms.find().to_list(100)
    for other in all_rooms:
        if other['id'] != room_id:
            other_seats = other.get('seats', [])
            changed = False
            for i, s in enumerate(other_seats):
                if s and s.get('user_id') == user_id:
                    other_seats[i] = None
                    changed = True
            if changed:
                ac = sum(1 for s in other_seats if s is not None)
                await db.rooms.update_one({"id": other['id']}, {"$set": {"seats": other_seats, "active_users": ac}})
    seats[seat_index] = {
        "user_id": user_id, "username": user['username'],
        "avatar": user.get('avatar', ''), "level": user.get('level', 1),
        "aristocracy": user.get('aristocracy', 0),
        "svip_level": user.get('svip_level', 0),
        "country_flag": user.get('country_flag', ''),
        "country": user.get('country', ''),
        "role": user.get('role', 'usuario'),
        "coins": user.get('coins', 0),
        "diamonds": user.get('diamonds', 0),
        "device_id": user.get('device_id', ''),
        "is_muted": False, "audio_enabled": True,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    active_count = sum(1 for s in seats if s is not None)
    await db.rooms.update_one({"id": room_id}, {"$set": {"seats": seats, "active_users": active_count}})
    return {"success": True, "seat_index": seat_index}

@router.post("/rooms/{room_id}/toggle-mute")
async def toggle_mute(room_id: str, user_id: str):
    """Toggle Mute."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    seats = room.get('seats', [])
    for i, seat in enumerate(seats):
        if seat and seat.get('user_id') == user_id:
            seats[i]['is_muted'] = not seat.get('is_muted', False)
            await db.rooms.update_one({"id": room_id}, {"$set": {"seats": seats}})
            break
    return {"success": True}

@router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, user_id: str):
    """Leave Room. If owner leaves, clear music state."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    seats = room.get('seats', [])
    changed = False
    for i, seat in enumerate(seats):
        if seat and seat.get('user_id') == user_id:
            seats[i] = None
            changed = True
    if changed:
        ac = sum(1 for s in seats if s is not None)
        update_fields = {"seats": seats, "active_users": ac}
        # Clear music when owner leaves
        if room.get('owner_id') == user_id:
            update_fields["music_url"] = None
        await db.rooms.update_one({"id": room_id}, {"$set": update_fields})
    return {"success": True}

# ==================== CHAT ====================

@router.post("/rooms/{room_id}/chat")
async def send_chat(room_id: str, msg: ChatMessage):
    """Send a message in room chat. Triggers bot auto-reply if active."""
    user = await db.users.find_one({"id": msg.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    chat_doc = {
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": msg.user_id, "username": user['username'],
        "avatar": user.get('avatar', ''), "text": msg.text,
        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Bot Super Admin: detección de inyección (BLOQUEA si match) + moderación
    try:
        from routes.bot_super import process_chat_for_bot, BOT_USER_ID, log_suspicious_input
        # Scan input for injection attempts (XSS/NoSQL/SQL). Si detecta, reemplaza
        # el texto por un marcador seguro antes de persistir. Alerta al dueño.
        blocked = await log_suspicious_input(source="routes/rooms.py:send_chat", text=msg.text, user_id=msg.user_id)
        if blocked:
            msg.text = "[mensaje bloqueado por el sistema de seguridad]"
            chat_doc["text"] = msg.text
    except Exception:
        pass
    # Persist chat only after security scan
    await db.room_chat.insert_one(chat_doc)
    # Check missions and bot auto-reply
    from routes.bot import check_chat_against_missions, bot_auto_reply
    await check_chat_against_missions(room_id, user['username'], msg.text)
    if msg.user_id != "bot":
        await bot_auto_reply(room_id, user['username'], msg.text)
    # Bot Super Admin: moderación automática + comandos del dueño
    try:
        from routes.bot_super import process_chat_for_bot, BOT_USER_ID
        if msg.user_id != BOT_USER_ID:
            await process_chat_for_bot(room_id, {"user_id": msg.user_id, "username": user['username']}, msg.text)
    except Exception:
        pass
    chat_doc.pop('_id', None)
    return chat_doc

@router.get("/rooms/{room_id}/chat")
async def get_chat(room_id: str, limit: int = 50, user_id: str = None):
    """Get Chat."""
    query = {"room_id": room_id}
    if user_id:
        join_record = await db.room_joins.find_one({"user_id": user_id, "room_id": room_id})
        if join_record and join_record.get("joined_at"):
            query["created_at"] = {"$gte": join_record["joined_at"]}
    msgs = await db.room_chat.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    msgs.reverse()
    return [{k: v for k, v in m.items() if k != "_id"} for m in msgs]

@router.post("/rooms/{room_id}/mark-join")
async def mark_join(room_id: str, user_id: str):
    """Mark user join time. Updates every time user enters the room so old messages don't reappear.
    Also fan-out notifications to the user's followers ('amigo activo en sala')."""
    now = datetime.now(timezone.utc).isoformat()
    await db.room_joins.update_one(
        {"user_id": user_id, "room_id": room_id},
        {"$set": {"joined_at": now}},
        upsert=True
    )
    # Notify followers (dedupe inside 60s implemented in friends.notify_followers_of_room_entry)
    try:
        user = await db.users.find_one({"id": user_id})
        room = await db.rooms.find_one({"id": room_id})
        if user and room:
            minute_bucket = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
            dedupe_key = f"roomentry:{user_id}:{room_id}:{minute_bucket}"
            existing = await db.notification_dedupe.find_one({"key": dedupe_key})
            if not existing:
                await db.notification_dedupe.insert_one({
                    "key": dedupe_key,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                follower_rows = await db.follows.find({"target_id": user_id}, {"_id": 0}).to_list(2000)
                for row in follower_rows:
                    await create_notification(
                        category="social_friend_active",
                        title=f"{user['username']} está en una sala",
                        message=f"{user['username']} entró a {room.get('name', 'una sala')} — entra a acompañarlo",
                        target_user_id=row["follower_id"],
                        data={
                            "user_id": user_id,
                            "username": user["username"],
                            "avatar": user.get("avatar"),
                            "room_id": room_id,
                            "room_name": room.get("name"),
                        },
                    )
    except Exception:
        # Never block mark-join on notification errors
        pass
    return {"success": True}

@router.post("/rooms/{room_id}/welcome")
async def welcome_message(room_id: str, user_id: str):
    """Generate welcome message and entry animation for user joining room."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return {"success": False}
    role = user.get('role', 'usuario')
    aristocracy = user.get('aristocracy', 0)
    username = user['username']

    # Role-based welcome messages
    if role == 'dueño':
        welcome_text = f"⛈️ {username}, el dueño de Lluvia Live, acaba de ingresar ☔"
        entry_anim = 'storm'
    elif role == 'admin':
        welcome_text = f"⚡ {username}, Administrador de Lluvia Live, ha entrado"
        entry_anim = 'dragon'
    elif role == 'moderador':
        welcome_text = f"🛡️ {username}, Moderador, ha entrado a la sala"
        entry_anim = 'eagle'
    elif role == 'vip':
        welcome_text = f"⭐ {username}, VIP, ha entrado a la sala"
        entry_anim = 'lion'
    else:
        welcome_text = f"👋 {username} entro a la sala"
        entry_anim = 'none'

    # Aristocracy overrides for higher ranks
    if aristocracy >= 9:
        entry_anim = 'dragon'
        if role not in ('dueño',):
            welcome_text = f"🐉 {username}, Aristocracia {aristocracy}, ha entrado"
    elif aristocracy >= 7:
        entry_anim = 'phoenix' if role != 'dueño' else entry_anim
        if role not in ('dueño', 'admin'):
            welcome_text = f"🔥 {username}, Aristocracia {aristocracy}, ha entrado"
    elif aristocracy >= 5:
        if entry_anim == 'none':
            entry_anim = 'tiger'
        if role not in ('dueño', 'admin', 'moderador'):
            welcome_text = f"🐅 {username}, Aristocracia {aristocracy}, ha entrado"
    elif aristocracy >= 3:
        if entry_anim == 'none':
            entry_anim = 'eagle'

    msg_doc = {
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "system", "username": "Sistema",
        "avatar": "", "text": welcome_text,
        "type": "welcome", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(msg_doc)
    msg_doc.pop('_id', None)
    return {"success": True, "entry_animation": entry_anim, "username": username}

# ==================== CHAT PHOTOS ====================

@router.post("/rooms/{room_id}/chat-photo")
async def send_chat_photo(room_id: str, user_id: str, file: UploadFile = File(...)):
    """Send a photo in room chat."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    filename = f"chat_{room_id}_{uuid.uuid4().hex[:8]}{os.path.splitext(file.filename)[1]}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    image_url = f"/api/uploads/{filename}"
    chat_doc = {
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": user_id, "username": user['username'],
        "avatar": user.get('avatar', ''), "text": "",
        "image_url": image_url, "type": "photo",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(chat_doc)
    chat_doc.pop('_id', None)
    return chat_doc


# ==================== BACKGROUND UPLOAD WITH SAFETY FILTER ====================

UNSAFE_KEYWORDS = ['nude', 'nsfw', 'porn', 'sex', 'weapon', 'gun', 'knife', 'blood', 'gore', 'violence']

async def ai_moderate_image(image_bytes: bytes, mime_type: str = 'image/jpeg') -> tuple[bool, str]:
    """Use Gemini Vision to detect unsafe content (nudity, weapons, violence, blood, gore).
    Returns (is_safe, reason). Fails OPEN (allows upload) if AI unavailable, to not block the product.
    Owner debe configurar GEMINI_API_KEY con su propia key de Google AI Studio.
    """
    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    # Detect placeholder / empty / obviously invalid keys and skip (fail-open)
    if not api_key or api_key.strip().lower() in ('placeholder_key', 'placeholder', 'your_key_here', 'tu_key_aqui', ''):
        return True, "ai_key_not_configured"
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        prompt = (
            "Eres un moderador de contenido para una app social. Analiza esta imagen y responde SOLO con "
            "'SAFE' si es completamente apta como fondo de sala pública, o 'UNSAFE: <razon breve>' si contiene "
            "cualquiera de: desnudez, contenido sexual/erotico, armas (pistolas, cuchillos, rifles), violencia, "
            "sangre, gore, drogas, odio, o simbolos extremistas. Sé estricto."
        )
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(role="user", parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    types.Part.from_text(text=prompt),
                ])
            ],
            config=types.GenerateContentConfig(max_output_tokens=50),
        )
        text = (resp.text or "").strip().upper()
        if text.startswith("UNSAFE"):
            reason = text.split(":", 1)[1].strip() if ":" in text else "contenido no permitido"
            return False, reason
        return True, "ok"
    except Exception as e:
        # Fail open but log — don't block uploads on API outage
        print(f"[ai_moderate_image] falla: {e}")
        return True, "ai_error"

@router.post("/rooms/{room_id}/background")
async def set_room_background(room_id: str, owner_id: str, file: UploadFile = File(...)):
    """Upload room background image with AI content safety check (Gemini Vision)."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    # Dueño de la sala O super admin global (dueño/admin del role)
    requester = await db.users.find_one({"id": owner_id})
    is_super = requester and requester.get('role') in ('dueño', 'admin')
    if room['owner_id'] != owner_id and not is_super:
        raise HTTPException(status_code=403, detail="Solo el dueno de la sala puede cambiar el fondo")
    # Check file type
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
        raise HTTPException(status_code=400, detail="Solo imagenes JPG, PNG, WEBP o GIF")
    # Check file size (max 5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagen muy grande (max 5MB)")
    # Basic filename safety check (fast path)
    fname_lower = file.filename.lower()
    for kw in UNSAFE_KEYWORDS:
        if kw in fname_lower:
            raise HTTPException(status_code=400, detail="Imagen rechazada por politica de seguridad")
    # AI vision moderation (Gemini) — blocks nudity, weapons, blood, gore, violence, drugs, hate
    mime_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif'}
    is_safe, reason = await ai_moderate_image(content, mime_map.get(ext, 'image/jpeg'))
    if not is_safe:
        raise HTTPException(status_code=400, detail=f"Imagen rechazada por IA: {reason}")
    # Save
    filename = f"bg_{room_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)
    bg_url = f"/api/uploads/{filename}"
    await db.rooms.update_one({"id": room_id}, {"$set": {"background": bg_url}})
    return {"success": True, "background": bg_url}

@router.delete("/rooms/{room_id}/background")
async def remove_room_background(room_id: str, owner_id: str):
    """Remove room background."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    if room['owner_id'] != owner_id:
        raise HTTPException(status_code=403, detail="Solo el dueno de la sala")
    await db.rooms.update_one({"id": room_id}, {"$unset": {"background": 1}})
    return {"success": True}

# ==================== SEAT LOCKS ====================

@router.post("/rooms/{room_id}/lock-seat")
async def lock_seat(room_id: str, owner_id: str, seat_index: int):
    """Lock/unlock a seat. Allowed: room owner OR platform super admin (dueño/is_super_admin)."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    auth = await _get_authority(owner_id, room)
    if auth["level"] not in ("super", "owner"):
        raise HTTPException(status_code=403, detail="Solo el dueño de la sala o Super Admin")
    locks = room.get('seat_locks', [False] * 10)
    while len(locks) < 10:
        locks.append(False)
    if seat_index < 0 or seat_index >= len(locks):
        raise HTTPException(status_code=400, detail="Asiento invalido")
    locks[seat_index] = not locks[seat_index]
    # If locking an occupied seat, kick the user
    seats = room.get('seats', [])
    if locks[seat_index] and seat_index < len(seats) and seats[seat_index]:
        seats[seat_index] = None
    await db.rooms.update_one({"id": room_id}, {"$set": {"seat_locks": locks, "seats": seats}})
    return {"success": True, "seat_locks": locks, "authority": auth["level"]}

@router.post("/rooms/{room_id}/lock-all")
async def lock_all_seats(room_id: str, owner_id: str):
    """Lock all empty seats. Owner or Super Admin."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    auth = await _get_authority(owner_id, room)
    if auth["level"] not in ("super", "owner"):
        raise HTTPException(status_code=403, detail="Solo el dueño de la sala o Super Admin")
    seats = room.get('seats', [])
    locks = [seats[i] is None for i in range(10)] if len(seats) >= 10 else [True] * 10
    await db.rooms.update_one({"id": room_id}, {"$set": {"seat_locks": locks}})
    return {"success": True, "seat_locks": locks}

@router.post("/rooms/{room_id}/unlock-all")
async def unlock_all_seats(room_id: str, owner_id: str):
    """Unlock all seats. Owner or Super Admin."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    auth = await _get_authority(owner_id, room)
    if auth["level"] not in ("super", "owner"):
        raise HTTPException(status_code=403, detail="Solo el dueño de la sala o Super Admin")
    max_seats = room.get('max_seats', 10)
    locks = [False] * max_seats
    await db.rooms.update_one({"id": room_id}, {"$set": {"seat_locks": locks}})
    return {"success": True, "seat_locks": locks}


# ==================== ROOM MODERATION (kick / ban-from-room) ====================

@router.post("/rooms/{room_id}/kick-from-seat")
async def kick_user_from_seat(room_id: str, admin_id: str, target_user_id: str):
    """
    Bajar a un usuario del micrófono (libera su asiento). No lo expulsa de la sala.
    Allowed: Super Admin (dueño/is_super_admin), room owner, or moderator role.
    Super Admin puede ejecutar en cualquier sala; dueño de sala en la suya;
    moderador en cualquiera salvo cuando el target es el dueño de la sala.
    """
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    auth = await _get_authority(admin_id, room)
    if not _authority_can_manage_room(auth["level"]):
        raise HTTPException(status_code=403, detail="No tienes autoridad en esta sala")

    target = await db.users.find_one({"id": target_user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Jerarquía: solo el super puede tocar a otro dueño de la plataforma
    if target.get("role") == "dueño" and auth["level"] != "super":
        raise HTTPException(status_code=403, detail="Solo un Super Admin puede mover a otro dueño")
    # Un moderator no puede kickear al dueño de la sala
    if auth["level"] == "moderator" and room.get("owner_id") == target_user_id:
        raise HTTPException(status_code=403, detail="No puedes bajar al dueño de la sala")

    seats = room.get("seats", [])
    changed = False
    for i, s in enumerate(seats):
        if s and s.get("user_id") == target_user_id:
            seats[i] = None
            changed = True
    if not changed:
        return {"success": True, "kicked": False, "message": "El usuario no estaba en ningún asiento"}

    await db.rooms.update_one({"id": room_id}, {"$set": {"seats": seats}})
    # Chat marker
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "system", "username": "🛡️ Moderación", "avatar": "",
        "text": f"{target.get('username','Usuario')} fue bajado del micro por {auth['user'].get('username','admin')}",
        "type": "system", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "kicked": True, "authority": auth["level"]}


@router.post("/rooms/{room_id}/ban-user")
async def ban_user_from_room(room_id: str, admin_id: str, target_user_id: str):
    """
    Banear usuario de ESTA sala específicamente. Añade a `room.banned_users`
    (lista) y bajamos su asiento. Al intentar join será rechazado.
    Authority: Super Admin (any room), room owner (own room), moderator.
    """
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    auth = await _get_authority(admin_id, room)
    if not _authority_can_manage_room(auth["level"]):
        raise HTTPException(status_code=403, detail="No tienes autoridad en esta sala")

    target = await db.users.find_one({"id": target_user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.get("role") == "dueño" and auth["level"] != "super":
        raise HTTPException(status_code=403, detail="Solo un Super Admin puede banear a otro dueño")

    seats = room.get("seats", [])
    for i, s in enumerate(seats):
        if s and s.get("user_id") == target_user_id:
            seats[i] = None

    banned = list(room.get("banned_users", []))
    if target_user_id not in banned:
        banned.append(target_user_id)

    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"seats": seats, "banned_users": banned}},
    )
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "system", "username": "🛡️ Moderación", "avatar": "",
        "text": f"{target.get('username','Usuario')} fue expulsado de la sala por {auth['user'].get('username','admin')}",
        "type": "system", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "banned": True, "authority": auth["level"]}


@router.post("/rooms/{room_id}/unban-user")
async def unban_user_from_room(room_id: str, admin_id: str, target_user_id: str):
    """Retira a `target_user_id` de la lista de expulsados de la sala."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    auth = await _get_authority(admin_id, room)
    if not _authority_can_manage_room(auth["level"]):
        raise HTTPException(status_code=403, detail="No tienes autoridad")
    banned = [uid for uid in room.get("banned_users", []) if uid != target_user_id]
    await db.rooms.update_one({"id": room_id}, {"$set": {"banned_users": banned}})
    return {"success": True}


@router.get("/rooms/{room_id}/authority/{user_id}")
async def room_authority(room_id: str, user_id: str):
    """Frontend helper: devuelve si `user_id` es super/owner/moderator/none en la sala."""
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    auth = await _get_authority(user_id, room)
    return {
        "level": auth["level"],
        "is_room_owner": room.get("owner_id") == user_id,
        "is_super_admin": auth["level"] == "super",
        "can_manage": _authority_can_manage_room(auth["level"]),
    }

@router.post("/rooms/{room_id}/expand-seats")
async def expand_seats(room_id: str, admin_id: str, max_seats: int = 24):
    """Expand room to 24 seats (Modo Evento). Only dueño can activate."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueno de Lluvia Live puede activar Modo Evento")
    if max_seats not in (10, 24):
        raise HTTPException(status_code=400, detail="Solo 10 o 24 asientos permitidos")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    current_seats = room.get('seats', [])
    current_locks = room.get('seat_locks', [])
    if max_seats > len(current_seats):
        current_seats.extend([None] * (max_seats - len(current_seats)))
        current_locks.extend([False] * (max_seats - len(current_locks)))
    elif max_seats < len(current_seats):
        current_seats = current_seats[:max_seats]
        current_locks = current_locks[:max_seats]
    await db.rooms.update_one({"id": room_id}, {"$set": {"max_seats": max_seats, "seats": current_seats, "seat_locks": current_locks}})
    return {"success": True, "max_seats": max_seats}

# ==================== AGORA TOKEN ====================

@router.post("/agora/token")
async def get_agora_token(channel_name: str, user_id: str):
    """Generate Agora RTC token for audio rooms."""
    app_id = os.environ.get('AGORA_APP_ID', '')
    app_cert = os.environ.get('AGORA_APP_CERTIFICATE', '')
    if not app_id or not app_cert:
        return {"token": "", "app_id": app_id}
    try:
        from agora_token_builder import RtcTokenBuilder
        import time
        uid = abs(hash(user_id)) % (10**9)
        expiration = int(time.time()) + 3600 * 24
        token = RtcTokenBuilder.buildTokenWithUid(app_id, app_cert, channel_name, uid, 1, expiration)
        return {"token": token, "app_id": app_id, "uid": uid}
    except Exception:
        return {"token": "", "app_id": app_id}

# ==================== FILE UPLOADS ====================

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload File."""
    filename = f"{uuid.uuid4().hex[:12]}{os.path.splitext(file.filename)[1]}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/api/uploads/{filename}"}

@router.post("/users/{user_id}/avatar")
async def upload_avatar(user_id: str, file: UploadFile = File(...)):
    """Upload user avatar image."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    filename = f"avatar_{user_id}_{uuid.uuid4().hex[:8]}{os.path.splitext(file.filename)[1]}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    avatar_url = f"/api/uploads/{filename}"
    await db.users.update_one({"id": user_id}, {"$set": {"avatar": avatar_url}})
    return {"success": True, "avatar": avatar_url}
