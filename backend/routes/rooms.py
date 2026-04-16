"""
Room routes: CRUD, join/leave, seats, chat, music, photos, Agora tokens.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from database import (
    db, RoomCreate, ChatMessage, serialize_room, serialize_user,
    uuid, datetime, timezone, UPLOAD_DIR, create_notification
)
import os
import shutil

router = APIRouter()

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
    """Get Rooms."""
    rooms = await db.rooms.find().to_list(100)
    return [serialize_room(r) for r in rooms]

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
        "active_users": 0, "max_seats": 9, "seats": [None] * 9,
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
    seats = room.get('seats', [None] * 9)
    if seat_index >= len(seats):
        raise HTTPException(status_code=400, detail="Indice de asiento invalido")
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
    await db.room_chat.insert_one(chat_doc)
    # Check missions and bot auto-reply
    from routes.bot import check_chat_against_missions, bot_auto_reply
    await check_chat_against_missions(room_id, user['username'], msg.text)
    if msg.user_id != "bot":
        await bot_auto_reply(room_id, user['username'], msg.text)
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
    """Mark user join time. Updates every time user enters the room so old messages don't reappear."""
    now = datetime.now(timezone.utc).isoformat()
    await db.room_joins.update_one(
        {"user_id": user_id, "room_id": room_id},
        {"$set": {"joined_at": now}},
        upsert=True
    )
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
