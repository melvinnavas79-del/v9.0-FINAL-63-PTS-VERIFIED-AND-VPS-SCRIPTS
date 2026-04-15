"""
Admin routes: Console commands, role management, user admin, config.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from database import db, serialize_user, serialize_room, has_permission, ROLE_HIERARCHY, uuid, datetime, timezone, create_notification, IDChange
from typing import Dict, Any

router = APIRouter()

ROLE_BADGES = {
    "dueno": ["Crown Dueno", "Fundador", "Admin", "VIP"],
    "admin": ["Admin", "VIP", "Verificado"],
    "moderador": ["Moderador", "Verificado"],
    "supervisor": ["Supervisor"],
}

@router.post("/admin/set-owner")
async def set_owner(user_id: str, owner_key: str):
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
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$inc": {"coins": amount}})
    user = await db.users.find_one({"id": target_id})
    return {"success": True, "new_coins": user['coins']}

@router.post("/admin/console/set-level")
async def console_set_level(admin_id: str, target_id: str, level: int):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"level": min(level, 99)}})
    return {"success": True}

@router.post("/admin/console/set-aristocracy")
async def console_set_aristocracy(admin_id: str, target_id: str, aristocracy: int):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"aristocracy": min(aristocracy, 10)}})
    return {"success": True}

@router.post("/admin/console/ban")
async def console_ban(admin_id: str, target_id: str):
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
    admin = await db.users.find_one({"id": admin_id})
    if not admin or not has_permission(admin.get('role', 'usuario'), 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    await db.users.update_one({"id": target_id}, {"$set": {"banned": False, "vip_status": "NORMAL"}})
    return {"success": True}

@router.post("/admin/console/broadcast")
async def console_broadcast(admin_id: str, message: str):
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
    msgs = await db.broadcasts.find().sort("created_at", -1).limit(10).to_list(10)
    return [{k: v for k, v in m.items() if k != "_id"} for m in msgs]

@router.delete("/admin/rooms/{room_id}")
async def admin_delete_room(room_id: str, admin_id: str):
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
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    can_gif = user.get('role') == 'dueño' or user.get('aristocracy', 0) >= 6 or user.get('gif_permission', False)
    return {"can_use_gif": can_gif}

@router.post("/admin/grant-gif/{target_id}")
async def grant_gif_permission(target_id: str, admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"gif_permission": True}})
    return {"success": True}

@router.post("/admin/revoke-gif/{target_id}")
async def revoke_gif_permission(target_id: str, admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"gif_permission": False}})
    return {"success": True}

@router.get("/admin/config")
async def get_admin_config():
    config = await db.system.find_one({"key": "admin_config"})
    if config:
        config.pop('_id', None)
        return config
    return {"key": "admin_config", **DEFAULT_CONFIG}

@router.put("/admin/config")
async def update_admin_config(admin_id: str, updates: dict):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.system.update_one(
        {"key": "admin_config"},
        {"$set": {**updates, "key": "admin_config"}},
        upsert=True
    )
    return {"success": True}

# ==================== SETUP ====================

