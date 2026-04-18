"""
Admin routes: Console commands, role management, user admin, config.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from database import db, serialize_user, serialize_room, has_permission, ROLE_HIERARCHY, uuid, datetime, timezone, create_notification, IDChange
from datetime import timedelta
from typing import Dict, Any

router = APIRouter()

DEFAULT_CONFIG = {
    "coin_price_1000": 1.0,
    "coin_price_5000": 4.5,
    "coin_price_10000": 8.0,
    "diamond_price": 10.0,
    "entry_animation_price": 50000,
    "vip_entry_price": 100000,
}

@router.get("/admin/stats")
async def admin_stats(admin_id: str):
    """Dashboard stats for admin panel."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or not has_permission(admin.get('role', 'usuario'), 'moderador'):
        raise HTTPException(status_code=403, detail="Sin permiso")
    total_users = await db.users.count_documents({})
    total_rooms = await db.rooms.count_documents({})
    total_clanes = await db.clanes.count_documents({})
    total_events = await db.events.count_documents({})
    return {"total_users": total_users, "total_rooms": total_rooms, "total_clanes": total_clanes, "total_events": total_events}

ROLE_BADGES = {
    "dueno": ["Crown Dueno", "Fundador", "Admin", "VIP"],
    "admin": ["Admin", "VIP", "Verificado"],
    "moderador": ["Moderador", "Verificado"],
    "supervisor": ["Supervisor"],
}

@router.post("/admin/set-owner")
async def set_owner(user_id: str, owner_key: str):
    """Set Owner."""
    if owner_key != "lluvia_owner_melvin":
        raise HTTPException(status_code=403, detail="Clave inválida")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "role": "dueño",
            "is_admin": True,
            "vip_status": "DUEÑO",
            "aristocracy": 9,
            "level": 99,
            "coins": 999999,
            "diamonds": 50000,
            "badges": ROLE_BADGES["dueño"],
            "ghost_mode": False
        }}
    )
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)

@router.post("/admin/set-admin")
async def set_admin(user_id: str, admin_key: str):
    """Set Admin."""
    if admin_key != "lluvia_admin_2024":
        raise HTTPException(status_code=403, detail="Clave inválida")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_admin": True, "role": "admin", "vip_status": "ADMIN", "badges": ROLE_BADGES["admin"]}}
    )
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)

@router.post("/admin/set-role")
async def set_role(user_id: str, admin_id: str, role: str):
    """Set Role."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin no encontrado")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'admin'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    if role not in ROLE_HIERARCHY:
        raise HTTPException(status_code=400, detail="Rol inválido")
    
    # Can't assign role equal or higher than yours (except dueño can do anything)
    if admin_role != "dueño" and ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY.get(admin_role, 0):
        raise HTTPException(status_code=403, detail="No puedes asignar un rol igual o mayor al tuyo")
    
    is_admin = role in ["dueño", "admin"]
    vip_map = {"dueño": "DUEÑO", "admin": "ADMIN", "moderador": "MODERADOR", "supervisor": "SUPERVISOR", "usuario": "NORMAL"}
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "role": role,
            "is_admin": is_admin,
            "vip_status": vip_map.get(role, "NORMAL"),
            "badges": ROLE_BADGES.get(role, ROLE_BADGES["usuario"])
        }}
    )
    
    user = await db.users.find_one({"id": user_id})
    return serialize_user(user)

@router.get("/admin/users")
async def admin_get_users(admin_id: str):
    """Admin Get Users."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'supervisor'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    users = await db.users.find().to_list(500)
    return [serialize_user(u) for u in users]

@router.get("/admin/staff")
async def get_staff(admin_id: str):
    """Get Staff."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    staff = await db.users.find({"role": {"$in": ["dueño", "admin", "moderador", "supervisor"]}}).to_list(100)
    return [serialize_user(s) for s in staff]

@router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, admin_id: str, updates: Dict[str, Any]):
    """Admin Update User."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    updates.pop('password', None)
    updates.pop('_id', None)
    updates.pop('id', None)
    
    # Only dueño/admin can change roles
    if 'role' in updates and not has_permission(admin_role, 'admin'):
        updates.pop('role', None)
    
    await db.users.update_one({"id": user_id}, {"$set": updates})
    user = await db.users.find_one({"id": user_id})
    return serialize_user(user)

@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin_id: str):
    """Admin Delete User."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'admin'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    target = await db.users.find_one({"id": user_id})
    if target and target.get('role') == 'dueño':
        raise HTTPException(status_code=403, detail="No puedes eliminar al dueño")
    
    await db.users.delete_one({"id": user_id})
    return {"success": True}

# ==================== VERIFICATION ====================

@router.post("/admin/verify-user")
async def verify_user(user_id: str, admin_id: str):
    """Verify User."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or not has_permission(admin.get('role', 'usuario'), 'admin'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    badges = list(user.get('badges', []))
    if '✅ Verificado' not in badges:
        badges.append('✅ Verificado')
    
    await db.users.update_one({"id": user_id}, {"$set": {"verified": True, "badges": badges}})
    return {"success": True}

@router.post("/admin/unverify-user")
async def unverify_user(user_id: str, admin_id: str):
    """Unverify User."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or not has_permission(admin.get('role', 'usuario'), 'admin'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    badges = [b for b in user.get('badges', []) if b != '✅ Verificado']
    await db.users.update_one({"id": user_id}, {"$set": {"verified": False, "badges": badges}})
    return {"success": True}

# ==================== CONSOLE (Bulk Actions) ====================

@router.post("/admin/console/give-coins")
async def console_give_coins(admin_id: str, target_id: str, amount: int):
    """Console Give Coins."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$inc": {"coins": amount}})
    user = await db.users.find_one({"id": target_id})
    return {"success": True, "new_coins": user['coins']}

@router.post("/admin/console/set-level")
async def console_set_level(admin_id: str, target_id: str, level: int):
    """Console Set Level."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"level": min(level, 99)}})
    return {"success": True}

@router.post("/admin/console/set-aristocracy")
async def console_set_aristocracy(admin_id: str, target_id: str, aristocracy: int):
    """Console Set Aristocracy."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"aristocracy": min(aristocracy, 10)}})
    return {"success": True}

@router.post("/admin/console/ban")
async def console_ban(admin_id: str, target_id: str):
    """Console Ban."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or not has_permission(admin.get('role', 'usuario'), 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    target = await db.users.find_one({"id": target_id})
    if target and target.get('role') == 'dueño':
        raise HTTPException(status_code=403, detail="No puedes banear al dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"banned": True, "vip_status": "BANNED"}})
    return {"success": True}

@router.post("/admin/console/unban")
async def console_unban(admin_id: str, target_id: str):
    """Console Unban."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or not has_permission(admin.get('role', 'usuario'), 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    await db.users.update_one({"id": target_id}, {"$set": {"banned": False, "vip_status": "NORMAL"}})
    return {"success": True}

@router.post("/admin/console/broadcast")
async def console_broadcast(admin_id: str, message: str):
    """Console Broadcast."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    broadcast = {
        "id": str(uuid.uuid4()),
        "message": message,
        "sender": admin['username'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.broadcasts.insert_one(broadcast)
    broadcast.pop('_id', None)
    return {"success": True, "broadcast": broadcast}

@router.post("/admin/console/expand-room")
async def expand_room_seats(admin_id: str, room_id: str, max_seats: int):
    """Expand Room Seats."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    if max_seats < 9 or max_seats > 24:
        raise HTTPException(status_code=400, detail="Mínimo 9, máximo 24 micros")
    
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    current_seats = room.get('seats', [])
    if max_seats > len(current_seats):
        current_seats.extend([None] * (max_seats - len(current_seats)))
    else:
        current_seats = current_seats[:max_seats]
    
    await db.rooms.update_one({"id": room_id}, {"$set": {"seats": current_seats, "max_seats": max_seats}})
    return {"success": True, "max_seats": max_seats}

@router.post("/admin/console/update-store")
async def update_store_package(admin_id: str, package_id: str, coins: int, diamonds: int, price: float, name: str):
    """Update Store Package."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    
    await db.store_config.update_one(
        {"package_id": package_id},
        {"$set": {"package_id": package_id, "coins": coins, "diamonds": diamonds, "price": price, "name": name}},
        upsert=True
    )
    return {"success": True}

@router.get("/broadcasts")
async def get_broadcasts():
    """Get Broadcasts."""
    msgs = await db.broadcasts.find().sort("created_at", -1).limit(10).to_list(10)
    return [{k: v for k, v in m.items() if k != "_id"} for m in msgs]

@router.delete("/admin/rooms/{room_id}")
async def admin_delete_room(room_id: str, admin_id: str):
    """Admin Delete Room."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    await db.rooms.delete_one({"id": room_id})
    return {"success": True}

    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "system", "username": "COFRE", "avatar": "",
        "text": f"📦✨ COFRE #{opened + 1} ({cofre['label']}) ABIERTO! {' | '.join(results)}",
        "type": "gift", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"opened": True, "level": opened + 1, "label": cofre['label'], "results": results}

# ==================== ID SYSTEM ====================

# IDChange imported from database
    user_id: str
    new_id: str
    tier: str

@router.post("/users/change-id")
async def change_user_id(data: IDChange):
    """Change User Id."""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    tiers = {
        "basic": {"cost": 30, "min_len": 6, "max_len": 7, "type": "numbers"},
        "lindo": {"cost": 1500, "min_len": 5, "max_len": 5, "type": "numbers"},
        "letras": {"cost": 3000, "min_len": 4, "max_len": 5, "type": "letters"},
        "custom": {"cost": 5000, "min_len": 1, "max_len": 20, "type": "any"},
    }
    
    if data.tier not in tiers:
        raise HTTPException(status_code=400, detail="Tier inválido")
    
    tier = tiers[data.tier]
    
    if user.get('diamonds', 0) < tier['cost']:
        raise HTTPException(status_code=400, detail=f"Necesitas {tier['cost']} diamantes")
    
    if len(data.new_id) < tier['min_len'] or len(data.new_id) > tier['max_len']:
        raise HTTPException(status_code=400, detail=f"ID debe tener {tier['min_len']}-{tier['max_len']} caracteres")
    
    existing = await db.users.find_one({"custom_id": data.new_id})
    if existing:
        raise HTTPException(status_code=400, detail="ID ya está en uso")
    
    await db.users.update_one(
        {"id": data.user_id},
        {"$inc": {"diamonds": -tier['cost']}, "$set": {"custom_id": data.new_id}}
    )
    
    return {"success": True, "new_custom_id": data.new_id, "cost": tier['cost']}

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload File."""
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'bin'
    allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'mp3', 'wav']
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Formato no soportado. Usa: {', '.join(allowed)}")
    
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    filepath = UPLOAD_DIR / filename
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    file_url = f"/api/uploads/{filename}"
    return {"success": True, "url": file_url, "filename": filename}

# ==================== MY ROOM (Personal Room) ====================

@router.post("/rooms/my-room")
async def get_or_create_my_room(user_id: str):
    """Get Or Create My Room."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    existing = await db.rooms.find_one({"owner_id": user_id})
    if existing:
        return serialize_room(existing)
    room_id = str(uuid.uuid4())
    room_doc = {
        "id": room_id, "name": f"Sala de {user['username']}",
        "owner_id": user_id, "owner_name": user['username'],
        "active_users": 0, "max_seats": 9, "seats": [None] * 9,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.rooms.insert_one(room_doc)
    return serialize_room(room_doc)

# ==================== GIF PROFILE PERMISSIONS ====================

@router.get("/users/{user_id}/can-use-gif")
async def check_gif_permission(user_id: str):
    """Check Gif Permission."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    can_gif = user.get('role') == 'dueño' or user.get('aristocracy', 0) >= 6 or user.get('gif_permission', False)
    return {"can_use_gif": can_gif}

@router.post("/admin/grant-gif/{target_id}")
async def grant_gif_permission(target_id: str, admin_id: str):
    """Grant Gif Permission."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"gif_permission": True}})
    return {"success": True}

@router.post("/admin/revoke-gif/{target_id}")
async def revoke_gif_permission(target_id: str, admin_id: str):
    """Revoke Gif Permission."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"gif_permission": False}})
    return {"success": True}

@router.get("/admin/config")
async def get_admin_config():
    """Get Admin Config."""
    config = await db.system.find_one({"key": "admin_config"})
    if config:
        config.pop('_id', None)
        return config
    return {"key": "admin_config", **DEFAULT_CONFIG}

@router.put("/admin/config")
async def update_admin_config(admin_id: str, updates: dict):
    """Update Admin Config."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.system.update_one(
        {"key": "admin_config"},
        {"$set": {**updates, "key": "admin_config"}},
        upsert=True
    )
    return {"success": True}

# ==================== CUSTOM GIFTS (ADMIN) ====================

# ==================== EVENT CONTROL PANEL (OWNER ONLY) ====================

@router.get("/admin/traffic-monitor")
async def traffic_monitor(admin_id: str):
    """Get active users by country. Owner only."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    pipeline = [
        {"$match": {"country": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$country", "count": {"$sum": 1}, "flag": {"$first": "$country_flag"}, "name": {"$first": "$country_name"}}},
        {"$sort": {"count": -1}},
        {"$limit": 30}
    ]
    countries = await db.users.aggregate(pipeline).to_list(30)
    total_users = await db.users.count_documents({})
    total_rooms = await db.rooms.count_documents({})
    active_rooms = await db.rooms.count_documents({"active_users": {"$gt": 0}})
    for c in countries:
        c['country'] = c.pop('_id')
    return {
        "total_users": total_users,
        "total_rooms": total_rooms,
        "active_rooms": active_rooms,
        "by_country": countries
    }

@router.get("/admin/event-config")
async def get_event_config(admin_id: str):
    """Get current event broadcast configuration."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    config = await db.event_config.find_one({"id": "global"})
    if not config:
        config = {"id": "global", "broadcast_mode": "global", "active_event": None}
    config.pop('_id', None)
    return config

@router.post("/admin/event-config")
async def set_event_config(admin_id: str, request: Request):
    """Set event broadcast mode (regional/global). Owner only."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    body = await request.json()
    broadcast_mode = body.get('broadcast_mode', 'global')
    if broadcast_mode not in ('regional', 'global'):
        raise HTTPException(status_code=400, detail="Modo invalido. Usa 'regional' o 'global'")
    await db.event_config.update_one(
        {"id": "global"},
        {"$set": {"id": "global", "broadcast_mode": broadcast_mode, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"success": True, "broadcast_mode": broadcast_mode}

@router.post("/admin/flash-event")
async def flash_event(admin_id: str, request: Request):
    """Send a flash event to move traffic to a specific room. Owner only."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    body = await request.json()
    target_room_id = body.get('room_id', '')
    message = body.get('message', '')
    scope = body.get('scope', 'global')
    target_country = body.get('country', '')
    room = await db.rooms.find_one({"id": target_room_id}) if target_room_id else None
    room_name = room.get('name', 'Sala') if room else 'Lluvia Live'
    flash_text = message or f"Evento en {room_name}! Entra ahora!"
    event_doc = {
        "id": str(uuid.uuid4()),
        "type": "flash",
        "text": flash_text,
        "room_id": target_room_id,
        "room_name": room_name,
        "scope": scope,
        "target_country": target_country,
        "created_by": admin_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    }
    await db.flash_events.insert_one(event_doc)
    event_doc.pop('_id', None)
    # Also post as global announcement
    await db.global_announcements.insert_one({
        "id": event_doc['id'], "text": flash_text,
        "room_id": target_room_id, "scope": scope, "target_country": target_country,
        "created_by": admin_id, "created_at": event_doc['created_at']
    })
    return {"success": True, "event": event_doc}

@router.post("/admin/activate-cofre")
async def activate_cofre(admin_id: str, room_id: str, level: int = 1):
    """Manually activate a treasure chest in any room. Owner only."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    if level < 1 or level > 10:
        raise HTTPException(status_code=400, detail="Nivel 1-10")
    await db.rooms.update_one({"id": room_id}, {"$set": {"cofre_active": True, "cofre_level": level, "cofre_activated_at": datetime.now(timezone.utc).isoformat()}})
    # Announce
    await db.global_announcements.insert_one({
        "id": str(uuid.uuid4()), "text": f"Cofre Nivel {level} activado en {room.get('name', 'Sala')}! Entra y reclama tu premio!",
        "room_id": room_id, "scope": "global",
        "created_by": admin_id, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "cofre_level": level}

@router.get("/flash-events/active")
async def get_active_flash_events(country: str = ""):
    """Get active flash events, optionally filtered by country."""
    now = datetime.now(timezone.utc).isoformat()
    query = {"expires_at": {"$gt": now}}
    events = await db.flash_events.find(query).sort("created_at", -1).to_list(10)
    result = []
    for e in events:
        e.pop('_id', None)
        if e.get('scope') == 'regional' and country and e.get('target_country') != country:
            continue
        result.append(e)
    return result

# ==================== CUSTOM GIFTS CONTINUED ====================

@router.post("/admin/gifts/create")
async def create_custom_gift(admin_id: str, request: Request):
    """Create a custom gift with effect and sound. Owner only."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    body = await request.json()
    gift_id = body.get('id', str(uuid.uuid4())[:8])
    gift_doc = {
        "id": gift_id,
        "name": body.get('name', 'Regalo'),
        "emoji": body.get('emoji', '🎁'),
        "cost": body.get('cost', 100),
        "value": body.get('value', 80),
        "effect": body.get('effect', 'float'),
        "sound_url": body.get('sound_url', ''),
        "animation": body.get('animation', 'none'),
        "is_premium": body.get('is_premium', False),
        "fullscreen": body.get('fullscreen', False),
        "created_by": admin_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.custom_gifts.update_one({"id": gift_id}, {"$set": gift_doc}, upsert=True)
    return {"success": True, "gift": gift_doc}

@router.get("/admin/gifts/custom")
async def get_custom_gifts():
    """Get all custom gifts."""
    gifts = await db.custom_gifts.find().to_list(100)
    for g in gifts:
        g.pop('_id', None)
    return gifts

@router.delete("/admin/gifts/{gift_id}")
async def delete_custom_gift(gift_id: str, admin_id: str):
    """Delete a custom gift. Owner only."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    await db.custom_gifts.delete_one({"id": gift_id})
    return {"success": True}

# ==================== GLOBAL ANNOUNCEMENTS ====================

@router.post("/admin/global-announce")
async def global_announce(admin_id: str, text: str):
    """Send global announcement to all rooms. Owner/Admin only."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    announce_doc = {
        "id": str(uuid.uuid4()),
        "text": text,
        "created_by": admin_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.global_announcements.insert_one(announce_doc)
    announce_doc.pop('_id', None)
    return {"success": True, "announcement": announce_doc}

@router.get("/announcements/latest")
async def get_latest_announcement():
    """Get the latest global announcement."""
    ann = await db.global_announcements.find_one(sort=[("created_at", -1)])
    if ann:
        ann.pop('_id', None)
    return ann

# ==================== SETUP ====================

# ==================== SVIP SYSTEM ====================

SVIP_BENEFITS = {
    1: {"entry": "sparkle", "label": "SVIP 1"},
    2: {"entry": "sparkle", "label": "SVIP 2"},
    3: {"entry": "fire", "label": "SVIP 3"},
    4: {"entry": "fire", "label": "SVIP 4"},
    5: {"entry": "eagle", "label": "SVIP 5"},
    6: {"entry": "eagle", "label": "SVIP 6"},
    7: {"entry": "tiger", "label": "SVIP 7", "can_mute": True, "can_kick": True},
    8: {"entry": "phoenix", "label": "SVIP 8", "can_mute": True, "can_kick": True},
    9: {"entry": "dragon", "label": "SVIP 9", "can_mute": True, "can_kick": True},
    10: {"entry": "storm", "label": "SVIP 10", "can_mute": True, "can_kick": True},
}

@router.post("/admin/set-svip")
async def set_svip(admin_id: str, target_id: str, svip_level: int):
    """Set SVIP level for a user. Only dueño can set SVIP."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño puede asignar SVIP")
    if svip_level < 0 or svip_level > 10:
        raise HTTPException(status_code=400, detail="SVIP debe ser 0-10")
    benefits = SVIP_BENEFITS.get(svip_level, {})
    update = {"svip_level": svip_level}
    if benefits.get("entry"):
        update["entry_animation"] = benefits["entry"]
    await db.users.update_one({"id": target_id}, {"$set": update})
    user = await db.users.find_one({"id": target_id})
    return {"success": True, "user": serialize_user(user)}

@router.get("/svip/benefits")
async def get_svip_benefits():
    """Get all SVIP level benefits."""
    return SVIP_BENEFITS

@router.get("/svip/permissions/{user_id}")
async def get_svip_permissions(user_id: str):
    """Get moderation permissions for a user based on their SVIP and role."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    role = user.get('role', 'usuario')
    svip = user.get('svip_level', 0)
    can_mute = role in ('dueño', 'admin', 'moderador') or svip >= 7
    can_kick = role in ('dueño', 'admin', 'moderador') or svip >= 7
    can_ban = role in ('dueño', 'admin')
    can_ban_device = role == 'dueño'
    can_give_coins = role == 'dueño'
    can_set_role = role in ('dueño', 'admin')
    can_see_device_info = role == 'dueño'
    return {
        "can_mute": can_mute, "can_kick": can_kick, "can_ban": can_ban,
        "can_ban_device": can_ban_device, "can_give_coins": can_give_coins,
        "can_set_role": can_set_role, "can_see_device_info": can_see_device_info,
        "svip_level": svip, "role": role
    }

# ==================== RANK PROTECTION ====================

@router.post("/rooms/{room_id}/kick")
async def kick_user(room_id: str, kicker_id: str, target_id: str):
    """Kick user from room with rank protection."""
    kicker = await db.users.find_one({"id": kicker_id})
    target = await db.users.find_one({"id": target_id})
    if not kicker or not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Rank protection
    k_power = ROLE_HIERARCHY.get(kicker.get('role', 'usuario'), 0) * 100 + kicker.get('svip_level', 0)
    t_power = ROLE_HIERARCHY.get(target.get('role', 'usuario'), 0) * 100 + target.get('svip_level', 0)
    if t_power >= k_power and kicker.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="No puedes expulsar a alguien con rango igual o mayor")
    # Remove from seat
    room = await db.rooms.find_one({"id": room_id})
    if room:
        seats = room.get('seats', [])
        for i, s in enumerate(seats):
            if s and s.get('user_id') == target_id:
                seats[i] = None
        await db.rooms.update_one({"id": room_id}, {"$set": {"seats": seats}})
    return {"success": True}

@router.post("/rooms/{room_id}/mute")
async def mute_user(room_id: str, muter_id: str, target_id: str):
    """Mute user in room with rank protection."""
    muter = await db.users.find_one({"id": muter_id})
    target = await db.users.find_one({"id": target_id})
    if not muter or not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    m_power = ROLE_HIERARCHY.get(muter.get('role', 'usuario'), 0) * 100 + muter.get('svip_level', 0)
    t_power = ROLE_HIERARCHY.get(target.get('role', 'usuario'), 0) * 100 + target.get('svip_level', 0)
    if t_power >= m_power and muter.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="No puedes silenciar a alguien con rango igual o mayor")
    await db.room_mutes.update_one(
        {"room_id": room_id, "user_id": target_id},
        {"$set": {"room_id": room_id, "user_id": target_id, "muted_by": muter_id, "muted_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"success": True}

# ==================== GIVE COINS (OWNER ONLY) ====================

@router.post("/admin/give-coins")
async def give_coins(admin_id: str, target_id: str, coins: int = 0, diamonds: int = 0):
    """Give coins/diamonds to a user. EXCLUSIVELY for dueño."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    target = await db.users.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    inc = {}
    if coins:
        inc["coins"] = coins
    if diamonds:
        inc["diamonds"] = diamonds
    if inc:
        await db.users.update_one({"id": target_id}, {"$inc": inc})
    updated = await db.users.find_one({"id": target_id})
    return {"success": True, "coins": updated['coins'], "diamonds": updated['diamonds']}

# ==================== DEVICE TRACKING (OWNER ONLY) ====================

@router.get("/admin/device-info/{target_id}")
async def get_device_info(target_id: str, admin_id: str):
    """Get device info and linked accounts. EXCLUSIVELY for dueño."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    target = await db.users.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    device_id = target.get('device_id', '')
    device_model = target.get('device_model', 'Desconocido')
    last_ip = target.get('last_ip', 'Desconocido')
    # Find all accounts linked to same device
    linked = []
    if device_id:
        linked_users = await db.users.find({"device_id": device_id}).to_list(50)
        linked = [{"id": u['id'], "username": u['username'], "created_at": u.get('created_at', ''), "is_banned": u.get('is_banned', False)} for u in linked_users]
    # Find accounts from same IP
    ip_linked = []
    if last_ip:
        ip_users = await db.users.find({"last_ip": last_ip, "id": {"$ne": target_id}}).to_list(50)
        ip_linked = [{"id": u['id'], "username": u['username'], "last_ip": u.get('last_ip', '')} for u in ip_users]
    is_device_banned = False
    if device_id:
        banned = await db.banned_devices.find_one({"device_id": device_id})
        is_device_banned = banned is not None
    return {
        "user_id": target_id,
        "username": target.get('username', ''),
        "device_id": device_id,
        "device_model": device_model,
        "last_ip": last_ip,
        "is_device_banned": is_device_banned,
        "linked_accounts": linked,
        "ip_linked_accounts": ip_linked,
    }

# ==================== COUNTRIES / REGIONS ====================

COUNTRIES = [
    {"code": "MX", "name": "Mexico", "flag": "\U0001f1f2\U0001f1fd"},
    {"code": "US", "name": "Estados Unidos", "flag": "\U0001f1fa\U0001f1f8"},
    {"code": "CO", "name": "Colombia", "flag": "\U0001f1e8\U0001f1f4"},
    {"code": "AR", "name": "Argentina", "flag": "\U0001f1e6\U0001f1f7"},
    {"code": "ES", "name": "Espana", "flag": "\U0001f1ea\U0001f1f8"},
    {"code": "VE", "name": "Venezuela", "flag": "\U0001f1fb\U0001f1ea"},
    {"code": "PE", "name": "Peru", "flag": "\U0001f1f5\U0001f1ea"},
    {"code": "CL", "name": "Chile", "flag": "\U0001f1e8\U0001f1f1"},
    {"code": "EC", "name": "Ecuador", "flag": "\U0001f1ea\U0001f1e8"},
    {"code": "GT", "name": "Guatemala", "flag": "\U0001f1ec\U0001f1f9"},
    {"code": "CU", "name": "Cuba", "flag": "\U0001f1e8\U0001f1fa"},
    {"code": "DO", "name": "Rep. Dominicana", "flag": "\U0001f1e9\U0001f1f4"},
    {"code": "HN", "name": "Honduras", "flag": "\U0001f1ed\U0001f1f3"},
    {"code": "SV", "name": "El Salvador", "flag": "\U0001f1f8\U0001f1fb"},
    {"code": "NI", "name": "Nicaragua", "flag": "\U0001f1f3\U0001f1ee"},
    {"code": "CR", "name": "Costa Rica", "flag": "\U0001f1e8\U0001f1f7"},
    {"code": "PA", "name": "Panama", "flag": "\U0001f1f5\U0001f1e6"},
    {"code": "PR", "name": "Puerto Rico", "flag": "\U0001f1f5\U0001f1f7"},
    {"code": "BO", "name": "Bolivia", "flag": "\U0001f1e7\U0001f1f4"},
    {"code": "PY", "name": "Paraguay", "flag": "\U0001f1f5\U0001f1fe"},
    {"code": "UY", "name": "Uruguay", "flag": "\U0001f1fa\U0001f1fe"},
    {"code": "BR", "name": "Brasil", "flag": "\U0001f1e7\U0001f1f7"},
    {"code": "SA", "name": "Arabia Saudita", "flag": "\U0001f1f8\U0001f1e6"},
    {"code": "AE", "name": "Emiratos Arabes", "flag": "\U0001f1e6\U0001f1ea"},
    {"code": "EG", "name": "Egipto", "flag": "\U0001f1ea\U0001f1ec"},
    {"code": "MA", "name": "Marruecos", "flag": "\U0001f1f2\U0001f1e6"},
    {"code": "TR", "name": "Turquia", "flag": "\U0001f1f9\U0001f1f7"},
    {"code": "IN", "name": "India", "flag": "\U0001f1ee\U0001f1f3"},
    {"code": "PH", "name": "Filipinas", "flag": "\U0001f1f5\U0001f1ed"},
    {"code": "JP", "name": "Japon", "flag": "\U0001f1ef\U0001f1f5"},
    {"code": "KR", "name": "Corea del Sur", "flag": "\U0001f1f0\U0001f1f7"},
    {"code": "CN", "name": "China", "flag": "\U0001f1e8\U0001f1f3"},
    {"code": "TH", "name": "Tailandia", "flag": "\U0001f1f9\U0001f1ed"},
    {"code": "ID", "name": "Indonesia", "flag": "\U0001f1ee\U0001f1e9"},
    {"code": "MY", "name": "Malasia", "flag": "\U0001f1f2\U0001f1fe"},
    {"code": "PK", "name": "Pakistan", "flag": "\U0001f1f5\U0001f1f0"},
    {"code": "BD", "name": "Bangladesh", "flag": "\U0001f1e7\U0001f1e9"},
    {"code": "NG", "name": "Nigeria", "flag": "\U0001f1f3\U0001f1ec"},
    {"code": "GH", "name": "Ghana", "flag": "\U0001f1ec\U0001f1ed"},
    {"code": "KE", "name": "Kenia", "flag": "\U0001f1f0\U0001f1ea"},
    {"code": "ZA", "name": "Sudafrica", "flag": "\U0001f1ff\U0001f1e6"},
    {"code": "RU", "name": "Rusia", "flag": "\U0001f1f7\U0001f1fa"},
    {"code": "DE", "name": "Alemania", "flag": "\U0001f1e9\U0001f1ea"},
    {"code": "FR", "name": "Francia", "flag": "\U0001f1eb\U0001f1f7"},
    {"code": "IT", "name": "Italia", "flag": "\U0001f1ee\U0001f1f9"},
    {"code": "GB", "name": "Reino Unido", "flag": "\U0001f1ec\U0001f1e7"},
    {"code": "PT", "name": "Portugal", "flag": "\U0001f1f5\U0001f1f9"},
    {"code": "NL", "name": "Paises Bajos", "flag": "\U0001f1f3\U0001f1f1"},
    {"code": "PL", "name": "Polonia", "flag": "\U0001f1f5\U0001f1f1"},
    {"code": "SE", "name": "Suecia", "flag": "\U0001f1f8\U0001f1ea"},
    {"code": "CA", "name": "Canada", "flag": "\U0001f1e8\U0001f1e6"},
    {"code": "AU", "name": "Australia", "flag": "\U0001f1e6\U0001f1fa"},
    {"code": "NZ", "name": "Nueva Zelanda", "flag": "\U0001f1f3\U0001f1ff"},
    {"code": "IL", "name": "Israel", "flag": "\U0001f1ee\U0001f1f1"},
    {"code": "IQ", "name": "Irak", "flag": "\U0001f1ee\U0001f1f6"},
    {"code": "JO", "name": "Jordania", "flag": "\U0001f1ef\U0001f1f4"},
    {"code": "LB", "name": "Libano", "flag": "\U0001f1f1\U0001f1e7"},
    {"code": "DZ", "name": "Argelia", "flag": "\U0001f1e9\U0001f1ff"},
    {"code": "TN", "name": "Tunez", "flag": "\U0001f1f9\U0001f1f3"},
    {"code": "LY", "name": "Libia", "flag": "\U0001f1f1\U0001f1fe"},
    {"code": "OTHER", "name": "Otro", "flag": "\U0001f30d"},
]

@router.get("/countries")
async def get_countries():
    """Get list of available countries."""
    return COUNTRIES

@router.post("/users/{user_id}/country")
async def set_user_country(user_id: str, country_code: str):
    """Set user country/region."""
    country = next((c for c in COUNTRIES if c['code'] == country_code), None)
    if not country:
        raise HTTPException(status_code=400, detail="Pais invalido")
    await db.users.update_one({"id": user_id}, {"$set": {"country": country['code'], "country_flag": country['flag'], "country_name": country['name']}})
    return {"success": True, "country": country}

@router.get("/rankings/countries")
async def country_rankings():
    """Get country rankings by total users and top spenders."""
    pipeline = [
        {"$match": {"country": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$country", "count": {"$sum": 1}, "total_spent": {"$sum": "$total_spent"}, "flag": {"$first": "$country_flag"}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    results = await db.users.aggregate(pipeline).to_list(20)
    for r in results:
        r['country'] = r.pop('_id')
    return results

# ==================== TRACK DEVICE INFO ON LOGIN ====================

@router.post("/users/{user_id}/track-device")
async def track_device(user_id: str, request: Request):
    """Track device info and IP on each login/session."""
    body = await request.json()
    device_id = body.get('device_id', '')
    device_model = body.get('device_model', '')
    update = {"last_ip": request.client.host if request.client else ''}
    if device_id:
        update["device_id"] = device_id
    if device_model:
        update["device_model"] = device_model
    update["last_active"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": user_id}, {"$set": update})
    # Check if device is banned
    if device_id:
        banned = await db.banned_devices.find_one({"device_id": device_id})
        if banned:
            return {"banned": True, "message": "Este dispositivo ha sido suspendido"}
    return {"success": True}

