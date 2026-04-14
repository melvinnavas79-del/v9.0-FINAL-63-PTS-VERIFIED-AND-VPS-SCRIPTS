from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import bcrypt
import random
import shutil
from agora_token_builder import RtcTokenBuilder

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class RoomCreate(BaseModel):
    name: str

# ==================== HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def serialize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Remove sensitive data and ensure clean serialization"""
    if not user:
        return None
    # Create a copy to avoid modifying original
    user_copy = dict(user)
    user_copy.pop('password', None)
    user_copy.pop('_id', None)
    return user_copy

def serialize_room(room: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure clean room serialization"""
    if not room:
        return None
    # Create a copy to avoid modifying original
    room_copy = dict(room)
    room_copy.pop('_id', None)
    return room_copy

# ==================== USER ROUTES ====================

@api_router.post("/register")
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Usuario ya existe")
    
    user_id = str(uuid.uuid4())
    import random as _rnd
    numeric_id = str(_rnd.randint(100000, 999999))
    while await db.users.find_one({"numeric_id": numeric_id}):
        numeric_id = str(_rnd.randint(100000, 999999))
    
    user_doc = {
        "id": user_id,
        "numeric_id": numeric_id,
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "level": 1,
        "coins": 1000,
        "diamonds": 0,
        "aristocracy": 0,
        "vip_status": "NORMAL",
        "role": "usuario",
        "is_admin": False,
        "ghost_mode": False,
        "total_spent": 0,
        "total_received": 0,
        "badges": ["🌟 Nuevo"],
        "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    return {"success": True, "user": serialize_user(user_doc)}

@api_router.post("/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Notification hook: user connected
    await create_notification(
        "alerta_conexion",
        "Conexion",
        f"{user['username']} se conecto a Lluvia Live",
        data={"user_id": user['id'], "username": user['username']}
    )
    
    return {"success": True, "user": serialize_user(user)}

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)


@api_router.get("/users/search/{query}")
async def search_user(query: str):
    user = await db.users.find_one({"$or": [{"numeric_id": query}, {"username": {"$regex": query, "$options": "i"}}]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get('ghost_mode'):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)

@api_router.get("/tts/voices")
async def get_tts_voices():
    return [
        {"id": "hombre", "name": "Hombre", "lang": "es-ES", "pitch": 0.9, "rate": 1.0},
        {"id": "mujer", "name": "Mujer", "lang": "es-ES", "pitch": 1.3, "rate": 1.0},
        {"id": "animador", "name": "Animador", "lang": "es-MX", "pitch": 1.1, "rate": 1.15},
        {"id": "serio", "name": "Serio", "lang": "es-ES", "pitch": 0.8, "rate": 0.95},
    ]

@api_router.post("/admin/tts-voice")
async def set_tts_voice(admin_id: str, voice_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.system.update_one({"key": "tts_voice"}, {"$set": {"key": "tts_voice", "voice_id": voice_id}}, upsert=True)
    return {"success": True, "voice_id": voice_id}

@api_router.get("/admin/tts-voice")
async def get_tts_voice():
    doc = await db.system.find_one({"key": "tts_voice"})
    return {"voice_id": doc.get("voice_id", "hombre") if doc else "hombre"}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: Dict[str, Any]):
    updates.pop('password', None)
    updates.pop('id', None)
    updates.pop('_id', None)
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    user = await db.users.find_one({"id": user_id})
    
    # Check for Bebé Robot prize (15M when room owner reaches 50M)
    if user.get('coins', 0) >= 50000000:
        # Check if user owns a room
        owned_room = await db.rooms.find_one({"owner_id": user_id})
        if owned_room:
            last_prize = user.get('last_baby_robot_prize', 0)
            if user['coins'] - last_prize >= 50000000:
                await db.users.update_one(
                    {"id": user_id},
                    {"$inc": {"coins": 15000000}, "$set": {"last_baby_robot_prize": user['coins']}}
                )
                user = await db.users.find_one({"id": user_id})
                user['baby_robot_awarded'] = True
    
    return serialize_user(user)

# ==================== ROOM ROUTES ====================

@api_router.post("/rooms")
async def create_room(room_data: RoomCreate, owner_id: str):
    owner = await db.users.find_one({"id": owner_id})
    if not owner:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    room_id = str(uuid.uuid4())
    room_doc = {
        "id": room_id,
        "name": room_data.name,
        "owner_id": owner_id,
        "owner_name": owner['username'],
        "active_users": 0,
        "max_seats": 9,
        "seats": [None] * 9,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rooms.insert_one(room_doc)
    
    # Check Bebé Robot prize when creating room (if owner has 50M+)
    if owner.get('coins', 0) >= 50000000:
        last_prize = owner.get('last_baby_robot_prize', 0)
        if owner['coins'] - last_prize >= 50000000:
            await db.users.update_one(
                {"id": owner_id},
                {"$inc": {"coins": 15000000}, "$set": {"last_baby_robot_prize": owner['coins']}}
            )
    
    return serialize_room(room_doc)

@api_router.get("/rooms")
async def get_rooms():
    rooms = await db.rooms.find().to_list(100)
    return [serialize_room(r) for r in rooms]

@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    return serialize_room(room)

@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, user_id: str, seat_index: int):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    seats = room.get('seats', [None] * 9)
    
    if seat_index >= len(seats):
        raise HTTPException(status_code=400, detail="Índice de asiento inválido")
    
    if seats[seat_index] is not None and seats[seat_index].get('user_id') != user_id:
        raise HTTPException(status_code=400, detail="Asiento ocupado")
    
    # FIX: Remove user from ANY other seat first (no duplicates)
    for i, s in enumerate(seats):
        if s and s.get('user_id') == user_id:
            seats[i] = None
    
    # Also remove from other rooms
    all_rooms = await db.rooms.find().to_list(100)
    for other_room in all_rooms:
        if other_room['id'] != room_id:
            other_seats = other_room.get('seats', [])
            changed = False
            for i, s in enumerate(other_seats):
                if s and s.get('user_id') == user_id:
                    other_seats[i] = None
                    changed = True
            if changed:
                ac = sum(1 for s in other_seats if s is not None)
                await db.rooms.update_one({"id": other_room['id']}, {"$set": {"seats": other_seats, "active_users": ac}})
    
    seats[seat_index] = {
        "user_id": user_id,
        "username": user['username'],
        "avatar": user['avatar'],
        "level": user['level'],
        "is_muted": False,
        "audio_enabled": True,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    active_count = sum(1 for s in seats if s is not None)
    
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"seats": seats, "active_users": active_count}}
    )
    
    return {"success": True, "seat_index": seat_index}

@api_router.post("/rooms/{room_id}/toggle-mute")
async def toggle_mute(room_id: str, user_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    seats = room.get('seats', [])
    updated = False
    
    for i, seat in enumerate(seats):
        if seat and seat.get('user_id') == user_id:
            seats[i]['is_muted'] = not seat.get('is_muted', False)
            updated = True
            break
    
    if updated:
        await db.rooms.update_one(
            {"id": room_id},
            {"$set": {"seats": seats}}
        )
    
    return {"success": True}

@api_router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, user_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    seats = room.get('seats', [])
    updated = False
    
    for i, seat in enumerate(seats):
        if seat and seat.get('user_id') == user_id:
            seats[i] = None
            updated = True
    
    if updated:
        active_count = sum(1 for s in seats if s is not None)
        await db.rooms.update_one(
            {"id": room_id},
            {"$set": {"seats": seats, "active_users": active_count}}
        )
    
    return {"success": True}

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, owner_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    if room['owner_id'] != owner_id:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    
    await db.rooms.delete_one({"id": room_id})
    return {"success": True}

# ==================== ROLES & ADMIN ====================

# Role hierarchy: dueño > admin > moderador > supervisor > usuario
ROLE_HIERARCHY = {
    "dueño": 5,
    "admin": 4,
    "moderador": 3,
    "supervisor": 2,
    "usuario": 1
}

ROLE_BADGES = {
    "dueño": ["👑 Dueño", "🌟 Fundador", "⭐ Admin", "💎 VIP", "✅ Verificado", "💎 Aristocrat IX"],
    "admin": ["⭐ Admin", "💎 VIP", "✅ Verificado"],
    "moderador": ["🛡️ Moderador", "✅ Verificado"],
    "supervisor": ["👁️ Supervisor"],
    "usuario": ["🌟 Nuevo"]
}

def has_permission(user_role: str, required_role: str) -> bool:
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(required_role, 0)

@api_router.post("/admin/set-owner")
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

@api_router.post("/admin/set-admin")
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

@api_router.post("/admin/set-role")
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

@api_router.get("/admin/users")
async def admin_get_users(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'supervisor'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    users = await db.users.find().to_list(500)
    return [serialize_user(u) for u in users]

@api_router.get("/admin/staff")
async def get_staff(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    staff = await db.users.find({"role": {"$in": ["dueño", "admin", "moderador", "supervisor"]}}).to_list(100)
    return [serialize_user(s) for s in staff]

@api_router.put("/admin/users/{user_id}")
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

@api_router.delete("/admin/users/{user_id}")
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

@api_router.post("/admin/verify-user")
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

@api_router.post("/admin/unverify-user")
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

@api_router.post("/admin/console/give-coins")
async def console_give_coins(admin_id: str, target_id: str, amount: int):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$inc": {"coins": amount}})
    user = await db.users.find_one({"id": target_id})
    return {"success": True, "new_coins": user['coins']}

@api_router.post("/admin/console/set-level")
async def console_set_level(admin_id: str, target_id: str, level: int):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"level": min(level, 99)}})
    return {"success": True}

@api_router.post("/admin/console/set-aristocracy")
async def console_set_aristocracy(admin_id: str, target_id: str, aristocracy: int):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"aristocracy": min(aristocracy, 10)}})
    return {"success": True}

@api_router.post("/admin/console/ban")
async def console_ban(admin_id: str, target_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or not has_permission(admin.get('role', 'usuario'), 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    target = await db.users.find_one({"id": target_id})
    if target and target.get('role') == 'dueño':
        raise HTTPException(status_code=403, detail="No puedes banear al dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"banned": True, "vip_status": "BANNED"}})
    return {"success": True}

@api_router.post("/admin/console/unban")
async def console_unban(admin_id: str, target_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or not has_permission(admin.get('role', 'usuario'), 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    await db.users.update_one({"id": target_id}, {"$set": {"banned": False, "vip_status": "NORMAL"}})
    return {"success": True}

@api_router.post("/admin/console/broadcast")
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

@api_router.post("/admin/console/expand-room")
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

@api_router.post("/admin/console/update-store")
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

@api_router.get("/broadcasts")
async def get_broadcasts():
    msgs = await db.broadcasts.find().sort("created_at", -1).limit(10).to_list(10)
    return [{k: v for k, v in m.items() if k != "_id"} for m in msgs]

@api_router.delete("/admin/rooms/{room_id}")
async def admin_delete_room(room_id: str, admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    admin_role = admin.get('role', 'usuario')
    if not has_permission(admin_role, 'moderador'):
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    await db.rooms.delete_one({"id": room_id})
    return {"success": True}

# ==================== GHOST MODE ====================

@api_router.post("/users/{user_id}/ghost-mode")
async def toggle_ghost_mode(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user_role = user.get('role', 'usuario')
    if user_role not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="Solo admin o dueño puede usar Modo Fantasma")
    new_mode = not user.get('ghost_mode', False)
    await db.users.update_one({"id": user_id}, {"$set": {"ghost_mode": new_mode}})
    return {"success": True, "ghost_mode": new_mode}

# ==================== CLANES ====================

class ClanCreate(BaseModel):
    name: str
    owner_id: str

@api_router.post("/clanes")
async def create_clan(data: ClanCreate):
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

@api_router.get("/clanes")
async def get_clanes():
    clanes = await db.clanes.find().sort("weekly_coins", -1).to_list(50)
    return [{k: v for k, v in c.items() if k != "_id"} for c in clanes]

@api_router.post("/clanes/{clan_id}/join")
async def join_clan(clan_id: str, user_id: str):
    clan = await db.clanes.find_one({"id": clan_id})
    if not clan:
        raise HTTPException(status_code=404, detail="Clan no encontrado")
    if user_id in clan.get('members', []):
        raise HTTPException(status_code=400, detail="Ya eres miembro")
    await db.clanes.update_one({"id": clan_id}, {"$push": {"members": user_id}})
    await db.users.update_one({"id": user_id}, {"$set": {"clan_id": clan_id, "clan_name": clan['name']}})
    return {"success": True}

@api_router.post("/clanes/{clan_id}/leave")
async def leave_clan(clan_id: str, user_id: str):
    await db.clanes.update_one({"id": clan_id}, {"$pull": {"members": user_id}})
    await db.users.update_one({"id": user_id}, {"$set": {"clan_id": None, "clan_name": None}})
    return {"success": True}

# ==================== PAREJAS (CP) ====================

class CPCreate(BaseModel):
    user1_id: str
    user2_id: str

@api_router.post("/cp/create")
async def create_cp(data: CPCreate):
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

@api_router.get("/cp")
async def get_parejas():
    cps = await db.parejas.find().sort("total_coins", -1).to_list(50)
    return [{k: v for k, v in c.items() if k != "_id"} for c in cps]

@api_router.post("/cp/{cp_id}/level-up")
async def cp_level_up(cp_id: str):
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

@api_router.post("/events/weekly-rewards")
async def distribute_weekly_rewards(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño puede distribuir premios")
    top_users = await db.users.find().sort("coins", -1).limit(3).to_list(3)
    rewards = [45000000, 35000000, 25000000]
    aristocracies = [8, 7, 6]
    results = []
    for i, u in enumerate(top_users):
        if i < len(rewards):
            new_badges = list(u.get('badges', []))
            new_badges.append(f"🏆 Top {i+1} Semanal")
            if i == 0:
                new_badges.append("🏆 Campeón Semanal")
                new_badges.append("💍 Anillo de Campeón")
                new_badges.append("🎖️ Placa de Oro")
            
            await db.users.update_one({"id": u['id']}, {
                "$inc": {"coins": rewards[i]},
                "$set": {
                    "badges": new_badges,
                    "aristocracy": max(u.get('aristocracy', 0), aristocracies[i])
                }
            })
            results.append({
                "username": u['username'], "place": i+1, "reward": rewards[i],
                "aristocracy": aristocracies[i],
                "flash_fame": i == 0
            })
    
    # Save flash fame (Top 1)
    if top_users:
        await db.system.update_one(
            {"key": "flash_fame"},
            {"$set": {
                "key": "flash_fame",
                "user_id": top_users[0]['id'],
                "username": top_users[0]['username'],
                "avatar": top_users[0]['avatar'],
                "coins": top_users[0]['coins'],
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": "weekly", "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "results": results}

@api_router.get("/flash-fame")
async def get_flash_fame():
    fame = await db.system.find_one({"key": "flash_fame"})
    if fame:
        fame.pop('_id', None)
    return fame or {}

@api_router.post("/events/baby-robot")
async def baby_robot_prize(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    total = 0
    async for u in db.users.find():
        total += u.get('coins', 0)
    if total >= 25000000:
        users = await db.users.find().to_list(500)
        bonus_per_user = 15000000 // max(len(users), 1)
        for u in users:
            await db.users.update_one({"id": u['id']}, {"$inc": {"coins": bonus_per_user}})
        return {"success": True, "total_global": total, "bonus_per_user": bonus_per_user, "users_rewarded": len(users)}
    return {"success": False, "total_global": total, "needed": 25000000, "message": "Meta no alcanzada"}

@api_router.post("/events/king-level")
async def king_level_reward(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    new_level = user.get('level', 1) + 1
    bonus = 3000000
    await db.users.update_one({"id": user_id}, {"$inc": {"coins": bonus, "level": 1}})
    updated = await db.users.find_one({"id": user_id})
    return {"success": True, "new_level": new_level, "bonus": bonus, "new_coins": updated['coins']}

@api_router.post("/events/clan-rewards")
async def clan_rewards(admin_id: str, body: dict = None):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    top_clans = await db.clanes.find().sort("weekly_coins", -1).limit(3).to_list(3)
    default_rewards = [25000000, 20000000, 15000000]
    rewards = (body or {}).get('prizes', default_rewards) if body else default_rewards
    aristocracies = [6, 5, 4]
    results = []
    for i, clan in enumerate(top_clans):
        if i < len(rewards):
            per_member = rewards[i] // max(len(clan.get('members', [])), 1)
            for mid in clan.get('members', []):
                await db.users.update_one({"id": mid}, {"$inc": {"coins": per_member}})
            # Give owner aristocracy
            await db.users.update_one(
                {"id": clan['owner_id']},
                {"$set": {"aristocracy": max(aristocracies[i], 0)},
                 "$inc": {"coins": rewards[i]}}
            )
            results.append({"clan": clan['name'], "place": i+1, "total_reward": rewards[i], "aristocracy": aristocracies[i]})
    
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": "clan_weekly", "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "results": results}

@api_router.get("/events/history")
async def get_events():
    events = await db.events.find().sort("created_at", -1).to_list(50)
    return [{k: v for k, v in e.items() if k != "_id"} for e in events]

@api_router.post("/events/cashback")
async def distribute_cashback(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    # Cashback tiers: 100M spent = 10M back, 500M = 25M, 600M+ = 45M
    tiers = [(600000000, 45000000), (500000000, 25000000), (100000000, 10000000)]
    users = await db.users.find({"total_spent": {"$gte": 100000000}}).to_list(500)
    results = []
    for u in users:
        spent = u.get('total_spent', 0)
        cashback = 0
        for threshold, reward in tiers:
            if spent >= threshold:
                cashback = reward
                break
        if cashback > 0:
            await db.users.update_one({"id": u['id']}, {"$inc": {"coins": cashback}})
            results.append({"username": u['username'], "spent": spent, "cashback": cashback})
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": "cashback_weekly",
        "results": results, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "results": results, "total_users": len(results)}

@api_router.post("/events/king-room")
async def king_room_event(admin_id: str, room_id: str, level: int = 1):
    """King events 1/2/3 triggered from room. Level 1=300M, 2=500M, 3=1B"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    king_prizes = {1: 300000000, 2: 500000000, 3: 1000000000}
    prize = king_prizes.get(level, 300000000)
    
    # Get users in room
    in_room = [s for s in room.get('seats', []) if s is not None]
    if not in_room:
        raise HTTPException(status_code=400, detail="No hay usuarios en la sala")
    
    per_user = prize // len(in_room)
    results = []
    for seat in in_room:
        await db.users.update_one({"id": seat['user_id']}, {"$inc": {"coins": per_user}})
        results.append({"username": seat['username'], "bonus": per_user})
    
    # Chat announcement
    await db.room_chats.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "type": "event", "text": f"👑 KING {level} ACTIVADO! {prize//1000000}M repartidos entre {len(in_room)} usuarios!",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": f"king_{level}", "room_id": room_id,
        "prize": prize, "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "level": level, "prize": prize, "per_user": per_user, "users": len(in_room), "results": results}

@api_router.post("/events/cp-room")
async def cp_room_event(admin_id: str, room_id: str, level: int = 6):
    """CP events level 6/7 triggered from room. Level 6=5M, 7=5M per person"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    cp_prize = 5000000
    in_room = [s for s in room.get('seats', []) if s is not None]
    if not in_room:
        raise HTTPException(status_code=400, detail="No hay usuarios en la sala")
    
    results = []
    for seat in in_room:
        await db.users.update_one({"id": seat['user_id']}, {"$inc": {"coins": cp_prize}})
        results.append({"username": seat['username'], "bonus": cp_prize})
    
    await db.room_chats.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "type": "event", "text": f"💖 CP NIVEL {level} ACTIVADO! {cp_prize//1000000}M para cada uno!",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.events.insert_one({
        "id": str(uuid.uuid4()), "type": f"cp_level_{level}", "room_id": room_id,
        "prize": cp_prize * len(in_room), "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "level": level, "prize_per_user": cp_prize, "users": len(in_room), "results": results}

# ==================== ANIMATED ENTRIES ====================

@api_router.get("/users/{user_id}/entry-animation")
async def get_entry_animation(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    arist = user.get('aristocracy', 0)
    level = user.get('level', 1)
    role = user.get('role', 'usuario')
    
    if role == 'dueño':
        return {"animation": "storm", "emoji": "⛈️☔", "text": "⛈️ ¡LA TORMENTA DE LLUVIA LIVE! ☔ ¡EL DUEÑO HA LLEGADO!", "color": "gold", "special": True}
    elif arist >= 9 or level >= 90:
        return {"animation": "dragon", "emoji": "🐉", "text": "🐉 ¡EL DRAGÓN SUPREMO HA LLEGADO! 🐉", "color": "gold", "special": True}
    elif arist >= 8 or level >= 80:
        return {"animation": "phoenix", "emoji": "🔥🦅", "text": "🔥 ¡EL FÉNIX RENACE EN LA SALA! 🔥", "color": "red", "special": True}
    elif arist >= 7 or level >= 70:
        return {"animation": "lion", "emoji": "🦁", "text": "🦁 ¡EL LEÓN DE LA SELVA HA RUGIDO! 🦁", "color": "orange", "special": True}
    elif arist >= 6 or level >= 60:
        return {"animation": "tiger", "emoji": "🐅", "text": "🐅 ¡EL TIGRE ACECHA LA SALA! 🐅", "color": "amber", "special": True}
    elif arist >= 5 or level >= 50:
        return {"animation": "eagle", "emoji": "🦅", "text": "🦅 ¡EL ÁGUILA HA ATERRIZADO! 🦅", "color": "silver", "special": True}
    elif arist >= 3 or level >= 30:
        return {"animation": "fire", "emoji": "🔥", "text": "🔥 ¡Fuego en la sala!", "color": "orange", "special": False}
    elif arist >= 1 or level >= 10:
        return {"animation": "star", "emoji": "⭐", "text": f"⭐ {user['username']} llega con estilo", "color": "blue", "special": False}
    return {"animation": "none", "emoji": "👋", "text": f"👋 {user['username']} entró a la sala", "color": "gray", "special": False}

# ==================== REELS ====================

class ReelCreate(BaseModel):
    user_id: str
    title: str
    description: str = ""
    video_url: str = ""

@api_router.post("/reels")
async def create_reel(reel: ReelCreate):
    user = await db.users.find_one({"id": reel.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    reel_id = str(uuid.uuid4())
    reel_doc = {
        "id": reel_id,
        "user_id": reel.user_id,
        "username": user['username'],
        "avatar": user['avatar'],
        "title": reel.title,
        "description": reel.description,
        "video_url": reel.video_url,
        "likes": 0,
        "liked_by": [],
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reels.insert_one(reel_doc)
    reel_doc.pop('_id', None)
    return reel_doc

@api_router.get("/reels")
async def get_reels():
    reels = await db.reels.find().sort("created_at", -1).to_list(100)
    return [dict(r, **{"_id": None}) if "_id" in r else r for r in [{k: v for k, v in reel.items() if k != "_id"} for reel in reels]]

@api_router.post("/reels/{reel_id}/like")
async def like_reel(reel_id: str, user_id: str):
    reel = await db.reels.find_one({"id": reel_id})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel no encontrado")
    
    liked_by = reel.get('liked_by', [])
    if user_id in liked_by:
        liked_by.remove(user_id)
        inc = -1
    else:
        liked_by.append(user_id)
        inc = 1
    
    await db.reels.update_one(
        {"id": reel_id},
        {"$set": {"liked_by": liked_by}, "$inc": {"likes": inc}}
    )
    
    return {"success": True, "likes": reel.get('likes', 0) + inc}

@api_router.post("/reels/{reel_id}/comment")
async def comment_reel(reel_id: str, user_id: str, text: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    comment = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "username": user['username'],
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reels.update_one(
        {"id": reel_id},
        {"$push": {"comments": comment}}
    )
    
    return {"success": True, "comment": comment}

# ==================== PHOTOS ====================

class PhotoCreate(BaseModel):
    user_id: str
    title: str
    image_url: str
    description: str = ""

@api_router.post("/photos")
async def create_photo(photo: PhotoCreate):
    user = await db.users.find_one({"id": photo.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    photo_id = str(uuid.uuid4())
    photo_doc = {
        "id": photo_id,
        "user_id": photo.user_id,
        "username": user['username'],
        "avatar": user['avatar'],
        "title": photo.title,
        "image_url": photo.image_url,
        "description": photo.description,
        "likes": 0,
        "liked_by": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.photos.insert_one(photo_doc)
    photo_doc.pop('_id', None)
    return photo_doc

@api_router.get("/photos")
async def get_photos():
    photos = await db.photos.find().sort("created_at", -1).to_list(100)
    return [{k: v for k, v in p.items() if k != "_id"} for p in photos]

@api_router.post("/photos/{photo_id}/like")
async def like_photo(photo_id: str, user_id: str):
    photo = await db.photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    
    liked_by = photo.get('liked_by', [])
    if user_id in liked_by:
        liked_by.remove(user_id)
        inc = -1
    else:
        liked_by.append(user_id)
        inc = 1
    
    await db.photos.update_one(
        {"id": photo_id},
        {"$set": {"liked_by": liked_by}, "$inc": {"likes": inc}}
    )
    
    return {"success": True, "likes": photo.get('likes', 0) + inc}

@api_router.get("/rankings/coins")
async def get_coins_ranking():
    users = await db.users.find({"ghost_mode": {"$ne": True}}).sort("coins", -1).limit(50).to_list(50)
    return [serialize_user(u) for u in users]

@api_router.get("/rankings/level")
async def get_level_ranking():
    users = await db.users.find({"ghost_mode": {"$ne": True}}).sort("level", -1).limit(50).to_list(50)
    return [serialize_user(u) for u in users]

# ==================== GAMES ====================

class GameBet(BaseModel):
    user_id: str
    bet_amount: int

class RPSBet(BaseModel):
    user_id: str
    bet_amount: int
    choice: str  # piedra, papel, tijera

class TriviaBet(BaseModel):
    user_id: str
    bet_amount: int
    answer_index: int

class CardBet(BaseModel):
    user_id: str
    bet_amount: int
    guess: str  # mayor, menor

TRIVIA_QUESTIONS = [
    {"question": "¿Cuál es el planeta más grande del sistema solar?", "options": ["Tierra", "Júpiter", "Saturno", "Marte"], "correct": 1},
    {"question": "¿En qué año llegó el hombre a la Luna?", "options": ["1965", "1969", "1972", "1968"], "correct": 1},
    {"question": "¿Cuál es el océano más grande?", "options": ["Atlántico", "Índico", "Pacífico", "Ártico"], "correct": 2},
    {"question": "¿Cuántos continentes hay?", "options": ["5", "6", "7", "8"], "correct": 2},
    {"question": "¿Cuál es el animal más rápido?", "options": ["León", "Guepardo", "Águila", "Caballo"], "correct": 1},
    {"question": "¿Cuál es el río más largo del mundo?", "options": ["Nilo", "Amazonas", "Misisipi", "Yangtsé"], "correct": 0},
    {"question": "¿Quién pintó la Mona Lisa?", "options": ["Miguel Ángel", "Da Vinci", "Rafael", "Botticelli"], "correct": 1},
    {"question": "¿Cuál es el metal más caro?", "options": ["Oro", "Platino", "Rodio", "Plata"], "correct": 2},
    {"question": "¿Cuántos huesos tiene el cuerpo humano?", "options": ["186", "206", "226", "256"], "correct": 1},
    {"question": "¿Cuál es el país más grande del mundo?", "options": ["China", "Canadá", "Rusia", "EE.UU."], "correct": 2},
]

class GenericPlay(BaseModel):
    user_id: str
    game: str
    bet: int = 500

@api_router.post("/games/play")
async def play_generic(play: GenericPlay):
    user = await db.users.find_one({"id": play.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get('coins', 0) < play.bet:
        raise HTTPException(status_code=400, detail="Monedas insuficientes")
    
    import random
    
    if play.game == 'cofre':
        # Cofres: 35% chance to win 1.5x-3x the cost
        await db.users.update_one({"id": play.user_id}, {"$inc": {"coins": -play.bet}})
        won = random.random() < 0.35
        if won:
            multiplier = random.choice([1.5, 2.0, 2.5, 3.0])
            prize = int(play.bet * multiplier)
            await db.users.update_one({"id": play.user_id}, {"$inc": {"coins": prize}})
            updated = await db.users.find_one({"id": play.user_id})
            return {"won": True, "prize": prize, "multiplier": multiplier, "new_balance": updated['coins']}
        updated = await db.users.find_one({"id": play.user_id})
        return {"won": False, "prize": 0, "new_balance": updated['coins']}
    
    elif play.game in ('ruleta', 'dados', 'rps', 'slots', 'trivia', 'carta'):
        await db.users.update_one({"id": play.user_id}, {"$inc": {"coins": -play.bet}})
        import random
        # Slots has lower win chance but higher payouts
        if play.game == 'slots':
            won = random.random() < 0.25
            mult = random.choice([3, 5, 10]) if won else 0
        else:
            won = random.random() < 0.4
            mult = random.choice([2, 3, 5]) if won else 0
        if won:
            prize = play.bet * mult
            await db.users.update_one({"id": play.user_id}, {"$inc": {"coins": prize}})
            updated = await db.users.find_one({"id": play.user_id})
            return {"won": True, "prize": prize, "multiplier": mult, "new_balance": updated['coins']}
        updated = await db.users.find_one({"id": play.user_id})
        return {"won": False, "prize": 0, "new_balance": updated['coins']}
    
    raise HTTPException(status_code=400, detail="Juego no válido")

@api_router.post("/games/ruleta")
async def play_ruleta(bet: GameBet):
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    prizes = [
        {"multiplier": 0, "label": "Sin suerte", "chance": 30},
        {"multiplier": 1.5, "label": "x1.5", "chance": 25},
        {"multiplier": 2, "label": "x2", "chance": 20},
        {"multiplier": 3, "label": "x3", "chance": 15},
        {"multiplier": 5, "label": "x5", "chance": 7},
        {"multiplier": 10, "label": "JACKPOT x10", "chance": 3},
    ]
    
    roll = random.randint(1, 100)
    cumulative = 0
    selected = prizes[0]
    for p in prizes:
        cumulative += p["chance"]
        if roll <= cumulative:
            selected = p
            break
    
    winnings = int(bet.bet_amount * selected["multiplier"])
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "result": selected["label"],
        "multiplier": selected["multiplier"],
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

@api_router.post("/games/dados")
async def play_dados(bet: GameBet):
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    dice1 = random.randint(1, 6)
    dice2 = random.randint(1, 6)
    total = dice1 + dice2
    
    if total >= 10:
        multiplier = 3
        result = "GRAN VICTORIA"
    elif total >= 7:
        multiplier = 2
        result = "Victoria"
    elif total == 7:
        multiplier = 1.5
        result = "Empate"
    else:
        multiplier = 0
        result = "Perdiste"
    
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "dice1": dice1,
        "dice2": dice2,
        "total": total,
        "result": result,
        "multiplier": multiplier,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

@api_router.post("/games/piedra-papel-tijera")
async def play_rps(bet: RPSBet):
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    choices = ["piedra", "papel", "tijera"]
    if bet.choice not in choices:
        raise HTTPException(status_code=400, detail="Opción inválida")
    
    computer = random.choice(choices)
    
    if bet.choice == computer:
        result = "empate"
        multiplier = 1
    elif (bet.choice == "piedra" and computer == "tijera") or \
         (bet.choice == "papel" and computer == "piedra") or \
         (bet.choice == "tijera" and computer == "papel"):
        result = "ganaste"
        multiplier = 2
    else:
        result = "perdiste"
        multiplier = 0
    
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "player_choice": bet.choice,
        "computer_choice": computer,
        "result": result,
        "multiplier": multiplier,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

@api_router.get("/games/trivia/question")
async def get_trivia_question():
    q = random.choice(TRIVIA_QUESTIONS)
    return {
        "question": q["question"],
        "options": q["options"],
        "question_id": TRIVIA_QUESTIONS.index(q)
    }

@api_router.post("/games/trivia")
async def play_trivia(bet: TriviaBet):
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    q = random.choice(TRIVIA_QUESTIONS)
    correct = q["correct"] == bet.answer_index
    
    multiplier = 3 if correct else 0
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "correct": correct,
        "correct_answer": q["options"][q["correct"]],
        "result": "Correcto x3" if correct else "Incorrecto",
        "multiplier": multiplier,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

@api_router.post("/games/carta-mayor")
async def play_carta_mayor(bet: CardBet):
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")
    if bet.guess not in ["mayor", "menor"]:
        raise HTTPException(status_code=400, detail="Opción inválida")

    cards = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    card_values = {"A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13}
    
    card1 = random.choice(cards)
    card2 = random.choice(cards)
    
    val1 = card_values[card1]
    val2 = card_values[card2]
    
    if val1 == val2:
        correct = False
        result = "Empate - Pierdes"
    elif bet.guess == "mayor":
        correct = val2 > val1
    else:
        correct = val2 < val1
    
    multiplier = 2 if correct else 0
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one(
        {"id": bet.user_id},
        {"$inc": {"coins": net}}
    )
    
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "card1": card1,
        "card2": card2,
        "guess": bet.guess,
        "correct": correct,
        "result": "Ganaste x2" if correct else "Perdiste",
        "multiplier": multiplier,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

# ==================== SLOT MACHINE 777 ====================

@api_router.post("/games/slot-machine")
async def play_slot_machine(bet: GameBet):
    user = await db.users.find_one({"id": bet.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user['coins'] < bet.bet_amount:
        raise HTTPException(status_code=400, detail="No tienes suficientes monedas")
    if bet.bet_amount < 100:
        raise HTTPException(status_code=400, detail="Apuesta mínima: 100")

    symbols = ['7️⃣', '💎', '🍒', '🔔', '⭐', '🍋', '🍊', '🃏']
    weights = [5, 8, 15, 12, 10, 20, 20, 10]
    
    reel1 = random.choices(symbols, weights=weights, k=1)[0]
    reel2 = random.choices(symbols, weights=weights, k=1)[0]
    reel3 = random.choices(symbols, weights=weights, k=1)[0]
    
    combo = f"{reel1}{reel2}{reel3}"
    
    payouts = {
        '7️⃣7️⃣7️⃣': (50, 'MEGA JACKPOT 777'),
        '💎💎💎': (25, 'DIAMOND RUSH'),
        '🍒🍒🍒': (10, 'CHERRY BLAST'),
        '🔔🔔🔔': (8, 'BELL RINGER'),
        '⭐⭐⭐': (15, 'STAR POWER'),
        '🍋🍋🍋': (5, 'LEMON DROP'),
        '🍊🍊🍊': (5, 'ORANGE CRUSH'),
        '🃏🃏🃏': (20, 'WILD CARD'),
    }
    
    multiplier = 0
    jackpot_name = None
    
    if combo in payouts:
        multiplier, jackpot_name = payouts[combo]
    elif reel1 == reel2 or reel2 == reel3 or reel1 == reel3:
        multiplier = 2
        jackpot_name = "PAR"
    
    winnings = int(bet.bet_amount * multiplier)
    net = winnings - bet.bet_amount
    
    await db.users.update_one({"id": bet.user_id}, {"$inc": {"coins": net}})
    updated_user = await db.users.find_one({"id": bet.user_id})
    
    return {
        "reels": [reel1, reel2, reel3],
        "multiplier": multiplier,
        "jackpot_name": jackpot_name,
        "bet": bet.bet_amount,
        "winnings": winnings,
        "net": net,
        "new_balance": updated_user['coins']
    }

# ==================== GIFTS (REGALOS) ====================

class GiftSend(BaseModel):
    sender_id: str
    receiver_id: str
    gift_type: str
    room_id: str = ""

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

@api_router.get("/gifts")
async def get_gifts():
    return GIFTS

@api_router.post("/gifts/send")
async def send_gift(gift: GiftSend):
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
    await db.users.update_one({"id": gift.sender_id}, {"$inc": {"coins": -g['cost'], "total_spent": g['cost']}})
    await db.users.update_one({"id": gift.receiver_id}, {"$inc": {"coins": g['value'], "total_received": g['value']}})
    
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
    
    return {"success": True, "gift": gift_doc, "new_balance": updated_sender['coins']}

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

@api_router.get("/sobres")
async def get_sobres():
    return SOBRE_TIERS

@api_router.post("/sobres/throw")
async def throw_sobre(data: SobreData):
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

@api_router.post("/rooms/{room_id}/background")
async def set_room_background(room_id: str, owner_id: str, file: UploadFile = File(...)):
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

@api_router.post("/rooms/{room_id}/music")
async def set_room_music(room_id: str, owner_id: str, file: UploadFile = File(...)):
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

@api_router.delete("/rooms/{room_id}/music")
async def remove_room_music(room_id: str, owner_id: str):
    await db.rooms.update_one({"id": room_id}, {"$unset": {"music_url": ""}})
    return {"success": True}

# ==================== WEEKLY/MONTHLY RANKINGS ====================

@api_router.get("/rankings/weekly-clans")
async def get_weekly_clans():
    clans = await db.clanes.find().sort("weekly_coins", -1).limit(3).to_list(3)
    return [{k: v for k, v in c.items() if k != "_id"} for c in clans]

@api_router.get("/rankings/monthly-clans")
async def get_monthly_clans():
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

@api_router.get("/rooms/{room_id}/cofres")
async def get_room_cofres(room_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    progress = room.get('cofre_progress', 0)
    opened = room.get('cofres_opened', 0)
    return {"progress": progress, "cofres_opened": opened, "thresholds": COFRE_THRESHOLDS}

@api_router.post("/rooms/{room_id}/open-cofre")
async def try_open_cofre(room_id: str):
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
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "system", "username": "COFRE", "avatar": "",
        "text": f"📦✨ COFRE #{opened + 1} ({cofre['label']}) ABIERTO! {' | '.join(results)}",
        "type": "gift", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"opened": True, "level": opened + 1, "label": cofre['label'], "results": results}

# ==================== ID SYSTEM ====================

class IDChange(BaseModel):
    user_id: str
    new_id: str
    tier: str

@api_router.post("/users/change-id")
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

@api_router.post("/upload")
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

@api_router.post("/rooms/my-room")
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

@api_router.get("/users/{user_id}/can-use-gif")
async def check_gif_permission(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    can_gif = user.get('role') == 'dueño' or user.get('aristocracy', 0) >= 6 or user.get('gif_permission', False)
    return {"can_use_gif": can_gif}

@api_router.post("/admin/grant-gif/{target_id}")
async def grant_gif_permission(target_id: str, admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"gif_permission": True}})
    return {"success": True}

@api_router.post("/admin/revoke-gif/{target_id}")
async def revoke_gif_permission(target_id: str, admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.users.update_one({"id": target_id}, {"$set": {"gif_permission": False}})
    return {"success": True}

@api_router.post("/users/{user_id}/avatar")
async def upload_avatar(user_id: str, file: UploadFile = File(...)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
    can_gif = user.get('role') == 'dueño' or user.get('aristocracy', 0) >= 6 or user.get('gif_permission', False)
    if ext == 'gif' and not can_gif:
        raise HTTPException(status_code=403, detail="Necesitas Aristocracia 6+ o permiso del Dueño para usar GIF")
    allowed_img = ['jpg', 'jpeg', 'png', 'webp'] + (['gif'] if can_gif else [])
    if ext not in allowed_img:
        raise HTTPException(status_code=400, detail=f"Formatos: {', '.join(allowed_img)}")
    file_id = str(uuid.uuid4())
    filename = f"avatar_{file_id}.{ext}"
    filepath = UPLOAD_DIR / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    avatar_url = f"/api/uploads/{filename}"
    await db.users.update_one({"id": user_id}, {"$set": {"avatar": avatar_url}})
    updated = await db.users.find_one({"id": user_id})
    return {"success": True, "avatar": avatar_url, "user": serialize_user(updated)}

# ==================== CHAT PHOTOS ====================

@api_router.post("/rooms/{room_id}/chat-photo")
async def send_chat_photo(room_id: str, user_id: str, file: UploadFile = File(...)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
    if ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
        raise HTTPException(status_code=400, detail="Solo imagenes")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 5MB")
    file_id = str(uuid.uuid4())
    filename = f"chat_{file_id}.{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)
    image_url = f"/api/uploads/{filename}"
    chat_doc = {
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": user_id, "username": user['username'], "avatar": user['avatar'],
        "text": "", "image_url": image_url, "type": "photo",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(chat_doc)
    chat_doc.pop('_id', None)
    return chat_doc

# ==================== AGORA TOKEN ====================

@api_router.post("/agora/token")
async def get_agora_token(channel_name: str, user_id: str):
    app_id = os.environ.get('AGORA_APP_ID')
    app_cert = os.environ.get('AGORA_APP_CERTIFICATE')
    if not app_id or not app_cert:
        raise HTTPException(status_code=500, detail="Agora not configured")
    
    uid = abs(hash(user_id)) % 100000
    expiration = 3600
    current_ts = int(datetime.now(timezone.utc).timestamp())
    privilege_expired_ts = current_ts + expiration
    
    token = RtcTokenBuilder.buildTokenWithUid(
        app_id, app_cert, channel_name, uid, 1, privilege_expired_ts
    )
    
    return {"token": token, "uid": uid, "channel": channel_name, "app_id": app_id}

# ==================== ROOM CHAT ====================

class ChatMessage(BaseModel):
    user_id: str
    text: str

@api_router.post("/rooms/{room_id}/chat")
async def send_chat(room_id: str, msg: ChatMessage):
    user = await db.users.find_one({"id": msg.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    chat_doc = {
        "id": str(uuid.uuid4()),
        "room_id": room_id,
        "user_id": msg.user_id,
        "username": user['username'],
        "avatar": user['avatar'],
        "text": msg.text,
        "type": "message",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(chat_doc)
    chat_doc.pop('_id', None)
    
    # Check against bot missions
    await check_chat_against_missions(room_id, user['username'], msg.text)
    
    # Auto-reply if bot is active in this room (autonomous mode)
    if msg.user_id != "bot":
        await bot_auto_reply(room_id, user['username'], msg.text)
    
    return chat_doc

@api_router.get("/rooms/{room_id}/chat")
async def get_chat(room_id: str, limit: int = 50, user_id: str = None):
    query = {"room_id": room_id}
    if user_id:
        join_record = await db.room_joins.find_one({"user_id": user_id, "room_id": room_id})
        if join_record and join_record.get("joined_at"):
            query["created_at"] = {"$gte": join_record["joined_at"]}
    msgs = await db.room_chat.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    msgs.reverse()
    return [{k: v for k, v in m.items() if k != "_id"} for m in msgs]

@api_router.post("/rooms/{room_id}/mark-join")
async def mark_join(room_id: str, user_id: str):
    existing = await db.room_joins.find_one({"user_id": user_id, "room_id": room_id})
    if not existing:
        await db.room_joins.insert_one({
            "user_id": user_id, "room_id": room_id,
            "joined_at": datetime.now(timezone.utc).isoformat()
        })
    return {"success": True}

@api_router.post("/rooms/{room_id}/welcome")
async def welcome_message(room_id: str, user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        return {"success": False}
    
    # Get entry animation
    arist = user.get('aristocracy', 0)
    level = user.get('level', 1)
    role = user.get('role', 'usuario')
    
    if role == 'dueño':
        entry = "⛈️☔ ¡LA TORMENTA DE LLUVIA LIVE! ¡EL DUEÑO HA LLEGADO! ☔⛈️"
    elif arist >= 9 or level >= 90:
        entry = "🐉 ¡EL DRAGÓN SUPREMO HA LLEGADO! 🐉"
    elif arist >= 8 or level >= 80:
        entry = "🔥🦅 ¡EL FÉNIX RENACE EN LA SALA! 🔥"
    elif arist >= 7 or level >= 70:
        entry = "🦁 ¡EL LEÓN DE LA SELVA HA RUGIDO! 🦁"
    elif arist >= 6 or level >= 60:
        entry = "🐅 ¡EL TIGRE ACECHA LA SALA! 🐅"
    elif arist >= 5 or level >= 50:
        entry = "🦅 ¡EL ÁGUILA HA ATERRIZADO! 🦅"
    else:
        entry = "👋 ¡Bienvenido/a!"
    
    welcome_doc = {
        "id": str(uuid.uuid4()),
        "room_id": room_id,
        "user_id": user_id,
        "username": user['username'],
        "avatar": user['avatar'],
        "text": f"{entry} {user['username']} entró a la sala",
        "type": "welcome",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(welcome_doc)
    
    # Save join time so user only sees messages from now
    await db.room_joins.update_one(
        {"user_id": user_id, "room_id": room_id},
        {"$set": {"joined_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    # Notification hook: invitation strategy - notify others that someone is live
    room = await db.rooms.find_one({"id": room_id})
    room_name = room.get('name', 'una sala') if room else 'una sala'
    await create_notification(
        "invitacion",
        "Alguien esta en Live!",
        f"{user['username']} esta en {room_name}, entra a saludar!",
        data={"room_id": room_id, "user_id": user_id, "username": user['username']}
    )
    
    welcome_doc.pop('_id', None)
    return welcome_doc

# ==================== STRIPE PAYMENTS ====================

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
from starlette.requests import Request

COIN_PACKAGES = {
    "pack_500": {"coins": 50000, "diamonds": 100, "price": 5.00, "name": "Pack Básico"},
    "pack_1000": {"coins": 150000, "diamonds": 300, "price": 10.00, "name": "Pack Premium"},
    "pack_2500": {"coins": 500000, "diamonds": 1000, "price": 25.00, "name": "Pack VIP"},
    "pack_5000": {"coins": 1200000, "diamonds": 3000, "price": 50.00, "name": "Pack Mega"},
}

@api_router.get("/store/packages")
async def get_packages():
    return COIN_PACKAGES

@api_router.post("/store/checkout")
async def create_checkout(package_id: str, user_id: str, request: Request):
    if package_id not in COIN_PACKAGES:
        raise HTTPException(status_code=400, detail="Paquete inválido")
    
    pkg = COIN_PACKAGES[package_id]
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    api_key = os.environ.get('STRIPE_API_KEY')
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    origin_url = request.headers.get('origin', host_url)
    success_url = f"{origin_url}?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}?payment=cancelled"
    
    checkout_req = CheckoutSessionRequest(
        amount=pkg['price'],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user_id, "package_id": package_id, "username": user['username']}
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_req)
    
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user_id,
        "username": user['username'],
        "package_id": package_id,
        "package_name": pkg['name'],
        "amount": pkg['price'],
        "currency": "usd",
        "coins": pkg['coins'],
        "diamonds": pkg['diamonds'],
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/store/status/{session_id}")
async def check_payment(session_id: str, request: Request):
    api_key = os.environ.get('STRIPE_API_KEY')
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if tx and status.payment_status == 'paid' and tx.get('payment_status') != 'completed':
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "completed"}}
        )
        pkg = COIN_PACKAGES.get(tx['package_id'], {})
        await db.users.update_one(
            {"id": tx['user_id']},
            {"$inc": {"coins": pkg.get('coins', 0), "diamonds": pkg.get('diamonds', 0)}}
        )
    
    return {"status": status.status, "payment_status": status.payment_status}

@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    api_key = os.environ.get('STRIPE_API_KEY')
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
        if event.payment_status == 'paid':
            tx = await db.payment_transactions.find_one({"session_id": event.session_id})
            if tx and tx.get('payment_status') != 'completed':
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"payment_status": "completed"}}
                )
                pkg = COIN_PACKAGES.get(tx['package_id'], {})
                await db.users.update_one(
                    {"id": tx['user_id']},
                    {"$inc": {"coins": pkg.get('coins', 0), "diamonds": pkg.get('diamonds', 0)}}
                )
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ==================== AI ADMIN BOT ====================

from emergentintegrations.llm.chat import LlmChat, UserMessage

class BotMessage(BaseModel):
    admin_id: str
    message: str

@api_router.post("/bot/command")
async def bot_command(msg: BotMessage):
    # Only owner can use
    admin = await db.users.find_one({"id": msg.admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño puede usar el Bot")
    
    # Get context
    total_users = await db.users.count_documents({})
    total_rooms = await db.rooms.count_documents({})
    online_seats = 0
    rooms_data = await db.rooms.find().to_list(100)
    for r in rooms_data:
        online_seats += sum(1 for s in r.get('seats', []) if s)
    
    top_spender = await db.users.find().sort("total_spent", -1).limit(1).to_list(1)
    top_rich = await db.users.find().sort("coins", -1).limit(3).to_list(3)
    total_coins = sum(u.get('coins', 0) for u in await db.users.find().to_list(500))
    
    all_users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(50)
    user_list = ", ".join([f"{u['username']}(Lv.{u.get('level',1)},coins:{u.get('coins',0)})" for u in all_users[:20]])
    
    context = f"""
DATOS DE LLUVIA LIVE:
- Total usuarios: {total_users}
- Total salas: {total_rooms}
- Usuarios en salas ahora: {online_seats}
- Total monedas en circulación: {total_coins:,}
- Mi saldo (Dueño): {admin.get('coins',0):,} monedas, {admin.get('diamonds',0):,} diamantes
- Top rico: {top_rich[0]['username'] if top_rich else 'N/A'} ({top_rich[0].get('coins',0):,} coins)
- Top gastador: {top_spender[0]['username'] if top_spender else 'N/A'}
- Usuarios: {user_list}
- Salas y sus usuarios en micros: {', '.join([f"{r['name']}(online:{r.get('active_users',0)}, users:[{','.join([s['username'] for s in r.get('seats',[]) if s])}])" for r in rooms_data])}

ACCIONES DISPONIBLES - Responde SOLO con el JSON:
{{"action": "nombre", "params": {{...}}, "confirm_message": "texto de confirmación"}}

Acciones:
- ban_user: {{"action":"ban_user","params":{{"username":"X"}}}}
- unban_user: {{"action":"unban_user","params":{{"username":"X"}}}}
- give_coins: {{"action":"give_coins","params":{{"username":"X","amount":N}}}}
- give_diamonds: {{"action":"give_diamonds","params":{{"username":"X","amount":N}}}}
- set_level: {{"action":"set_level","params":{{"username":"X","level":N}}}}
- set_aristocracy: {{"action":"set_aristocracy","params":{{"username":"X","aristocracy":N}}}}
- verify_user: {{"action":"verify_user","params":{{"username":"X"}}}}
- broadcast: {{"action":"broadcast","params":{{"message":"X"}}}}
- expand_room: {{"action":"expand_room","params":{{"room_name":"X","seats":N}}}}
- pay_room: {{"action":"pay_room","params":{{"room_name":"X","amount":N}}}} (regala monedas a TODOS los que están en los micros de esa sala)
- pay_user: {{"action":"pay_user","params":{{"username":"X","amount":N}}}} (paga premio a un usuario)
- pay_top: {{"action":"pay_top","params":{{"prizes":[N1,N2,N3]}}}} (paga premios al top 1,2,3)
- mute_user: {{"action":"mute_user","params":{{"username":"X"}}}}
- kick_user: {{"action":"kick_user","params":{{"username":"X"}}}} (saca de la sala)
- say_in_room: {{"action":"say_in_room","params":{{"room_name":"X","message":"Y"}}}} (el bot habla en esa sala)
- watch_room: {{"action":"watch_room","params":{{"room_name":"X","keywords":["palabra1","palabra2"]}}}} (vigila sala por palabras clave)
- bot_answer_room: {{"action":"bot_answer_room","params":{{"room_name":"X"}}}} (bot atiende preguntas en la sala)
- activate_bot: {{"action":"activate_bot","params":{{"room_name":"X"}}}} (activa el bot autonomo en la sala, el bot habla solo con todos)
- deactivate_bot: {{"action":"deactivate_bot","params":{{"room_name":"X"}}}} (desactiva el bot de la sala)
- save_note: {{"action":"save_note","params":{{"category":"finanzas|notas|recordatorio|otro","title":"titulo","content":"contenido"}}}} (guarda una nota o dato para el dueño)
- list_notes: {{"action":"list_notes","params":{{"category":"finanzas"}}}} (lista notas guardadas)
- delete_note: {{"action":"delete_note","params":{{"title":"titulo"}}}} (borra una nota)

REGLAS:
1. Para acciones de PAGO, las monedas salen de MI cuenta de dueño
2. SIEMPRE incluye "confirm_message" con un resumen de lo que vas a hacer
3. Si es consulta, responde en texto normal SIN JSON
4. Sé conciso y directo
5. MEMORIA: Tienes acceso a las notas guardadas del dueño. Usalas para dar contexto.
6. FINANZAS: El dueño te puede pedir que lleves conteo de sus finanzas. Guarda cada ingreso/gasto como nota categoria "finanzas".
"""

    # Load owner's saved notes for context
    notes = await db.bot_notes.find({"admin_id": msg.admin_id}).sort("created_at", -1).limit(30).to_list(30)
    notes.reverse()
    if notes:
        notes_lines = []
        for n in notes:
            notes_lines.append(f"[{n.get('category','')}] {n.get('title','')}: {n.get('content','')}")
        notes_text = "\n".join(notes_lines)
        context += f"\n\nNOTAS GUARDADAS DEL DUEÑO:\n{notes_text}"
    
    llm_key = os.environ.get('EMERGENT_LLM_KEY')
    chat = LlmChat(
        api_key=llm_key,
        session_id=f"admin_bot_{msg.admin_id}",
        system_message=f"Eres el Bot personal de Melvin, dueño de Lluvia Live. Eres su amigo y asistente. Hablas de cualquier tema: noticias, consejos, chistes, tecnologia, vida, lo que sea. Eres como Gemini o ChatGPT pero con personalidad amigable y en español. Tambien administras Lluvia Live. Tu dueño te habla por voz y la app lee tus respuestas en voz alta, asi que responde de forma natural y conversacional. NUNCA digas que no puedes hablar por voz porque SI PUEDES. Si te piden una accion de la app, responde SOLO con el JSON de accion. Si es conversacion normal o preguntas de cualquier tema, responde como amigo. Se conciso.\n\n{context}"
    )
    chat.with_model("gemini", "gemini-2.5-flash")
    
    user_msg = UserMessage(text=msg.message)
    response = await chat.send_message(user_msg)
    
    # Check if response has action
    action_result = None
    try:
        import json as json_mod
        resp_text = response.strip()
        if '{' in resp_text and '"action"' in resp_text:
            start = resp_text.index('{')
            end = resp_text.rindex('}') + 1
            action_data = json_mod.loads(resp_text[start:end])
            action = action_data.get('action')
            params = action_data.get('params', {})
            
            if action == 'ban_user':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$set": {"banned": True}})
                    action_result = f"Usuario {params['username']} baneado"
            elif action == 'unban_user':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$set": {"banned": False}})
                    action_result = f"Usuario {params['username']} desbaneado"
            elif action == 'give_coins':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$inc": {"coins": params.get('amount', 0)}})
                    action_result = f"+{params.get('amount',0):,} monedas a {params['username']}"
            elif action == 'set_level':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$set": {"level": min(params.get('level', 1), 99)}})
                    action_result = f"Nivel de {params['username']} = {params.get('level')}"
            elif action == 'set_aristocracy':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    await db.users.update_one({"id": target['id']}, {"$set": {"aristocracy": min(params.get('aristocracy', 0), 10)}})
                    action_result = f"Aristocracia de {params['username']} = {params.get('aristocracy')}"
            elif action == 'verify_user':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    badges = list(target.get('badges', []))
                    if '✅ Verificado' not in badges: badges.append('✅ Verificado')
                    await db.users.update_one({"id": target['id']}, {"$set": {"verified": True, "badges": badges}})
                    action_result = f"{params['username']} verificado"
            elif action == 'broadcast':
                await db.broadcasts.insert_one({"id": str(uuid.uuid4()), "message": params.get('message',''), "sender": "Bot Admin", "created_at": datetime.now(timezone.utc).isoformat()})
                action_result = f"Mensaje enviado: {params.get('message')}"
            elif action == 'expand_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    seats = room.get('seats', [])
                    new_max = params.get('seats', 9)
                    if new_max > len(seats):
                        seats.extend([None] * (new_max - len(seats)))
                    await db.rooms.update_one({"id": room['id']}, {"$set": {"seats": seats, "max_seats": new_max}})
                    action_result = f"Sala {room['name']} expandida a {new_max} micros"
            elif action == 'give_diamonds':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    amt = params.get('amount', 0)
                    await db.users.update_one({"id": msg.admin_id}, {"$inc": {"diamonds": -amt}})
                    await db.users.update_one({"id": target['id']}, {"$inc": {"diamonds": amt}})
                    action_result = f"+{amt:,} diamantes a {params['username']}"
            elif action == 'pay_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    amt = params.get('amount', 0)
                    seated = [s for s in room.get('seats', []) if s]
                    if seated:
                        per_user = amt // len(seated)
                        total_paid = per_user * len(seated)
                        await db.users.update_one({"id": msg.admin_id}, {"$inc": {"coins": -total_paid}})
                        names = []
                        for s in seated:
                            await db.users.update_one({"id": s['user_id']}, {"$inc": {"coins": per_user}})
                            names.append(s['username'])
                        action_result = f"Pagado {per_user:,} a cada uno en {room['name']}: {', '.join(names)} (Total: {total_paid:,})"
                        await db.room_chat.insert_one({"id": str(uuid.uuid4()), "room_id": room['id'], "user_id": msg.admin_id, "username": "Bot Admin", "avatar": admin['avatar'], "text": f"🎁 El Dueño regaló {per_user:,} monedas a todos!", "type": "gift", "created_at": datetime.now(timezone.utc).isoformat()})
            elif action == 'pay_user':
                target = await db.users.find_one({"username": params.get('username')})
                if target:
                    amt = params.get('amount', 0)
                    await db.users.update_one({"id": msg.admin_id}, {"$inc": {"coins": -amt}})
                    await db.users.update_one({"id": target['id']}, {"$inc": {"coins": amt}})
                    action_result = f"Premio de {amt:,} monedas pagado a {params['username']}"
            elif action == 'pay_top':
                prizes = params.get('prizes', [45000000, 35000000, 25000000])
                top = await db.users.find().sort("coins", -1).limit(len(prizes)).to_list(len(prizes))
                results = []
                total_paid = 0
                for i, u in enumerate(top):
                    if i < len(prizes):
                        await db.users.update_one({"id": u['id']}, {"$inc": {"coins": prizes[i]}})
                        total_paid += prizes[i]
                        results.append(f"#{i+1} {u['username']}: +{prizes[i]:,}")
                await db.users.update_one({"id": msg.admin_id}, {"$inc": {"coins": -total_paid}})
                action_result = "Premios Top:\n" + "\n".join(results)
            elif action == 'mute_user':
                target_name = params.get('username')
                for r in rooms_data:
                    for i, s in enumerate(r.get('seats', [])):
                        if s and s.get('username') == target_name:
                            await db.rooms.update_one({"id": r['id']}, {"$set": {f"seats.{i}.is_muted": True}})
                action_result = f"{target_name} muteado"
            elif action == 'kick_user':
                target_name = params.get('username')
                for r in rooms_data:
                    seats = r.get('seats', [])
                    changed = False
                    for i, s in enumerate(seats):
                        if s and s.get('username') == target_name:
                            seats[i] = None
                            changed = True
                    if changed:
                        ac = sum(1 for s in seats if s)
                        await db.rooms.update_one({"id": r['id']}, {"$set": {"seats": seats, "active_users": ac}})
                action_result = f"{target_name} sacado de sala"
            elif action == 'say_in_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    bot_msg = params.get('message', '')
                    await db.room_chat.insert_one({
                        "id": str(uuid.uuid4()), "room_id": room['id'],
                        "user_id": "bot", "username": "🤖 Bot Lluvia",
                        "avatar": admin.get('avatar', ''), "text": bot_msg,
                        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    action_result = f"Bot dijo en {room['name']}: {bot_msg}"
                else:
                    action_result = "Sala no encontrada"
            elif action == 'watch_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    keywords = params.get('keywords', [])
                    mission_doc = {
                        "id": str(uuid.uuid4()), "admin_id": msg.admin_id,
                        "room_id": room['id'], "room_name": room['name'],
                        "keywords": [k.lower() for k in keywords], "active": True,
                        "label": f"Vigila {room['name']}", "alerts": [],
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.bot_missions.insert_one(mission_doc)
                    action_result = f"Vigilando {room['name']} por: {', '.join(keywords)}"
                else:
                    action_result = "Sala no encontrada"
            elif action == 'bot_answer_room':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    await db.room_chat.insert_one({
                        "id": str(uuid.uuid4()), "room_id": room['id'],
                        "user_id": "bot", "username": "🤖 Bot Lluvia",
                        "avatar": admin.get('avatar', ''),
                        "text": "Hola! Soy el Bot de Lluvia Live. Estoy aqui para ayudarles. Pregunten lo que quieran!",
                        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    action_result = f"Bot activado en {room['name']}"
            elif action == 'activate_bot':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    await db.bot_active_rooms.update_one(
                        {"room_id": room['id']},
                        {"$set": {"room_id": room['id'], "room_name": room['name'], "admin_id": msg.admin_id, "active": True, "created_at": datetime.now(timezone.utc).isoformat()}},
                        upsert=True
                    )
                    await db.room_chat.insert_one({
                        "id": str(uuid.uuid4()), "room_id": room['id'],
                        "user_id": "bot", "username": "🤖 Bot Lluvia",
                        "avatar": admin.get('avatar', ''), "text": "Hola a todos! Llegue para animar esta sala. Hablen conmigo!",
                        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    action_result = f"Bot AUTONOMO activado en {room['name']} - ahora habla solo con la gente"
                else:
                    action_result = "Sala no encontrada"
            elif action == 'deactivate_bot':
                room = await db.rooms.find_one({"name": {"$regex": params.get('room_name', ''), "$options": "i"}})
                if room:
                    await db.bot_active_rooms.update_one({"room_id": room['id']}, {"$set": {"active": False}})
                    await db.room_chat.insert_one({
                        "id": str(uuid.uuid4()), "room_id": room['id'],
                        "user_id": "bot", "username": "🤖 Bot Lluvia",
                        "avatar": "", "text": "Me retiro. Fue un gusto!",
                        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    action_result = f"Bot desactivado de {room['name']}"
                else:
                    action_result = "Sala no encontrada"
            elif action == 'save_note':
                note_doc = {
                    "id": str(uuid.uuid4()),
                    "admin_id": msg.admin_id,
                    "category": params.get('category', 'notas'),
                    "title": params.get('title', ''),
                    "content": params.get('content', ''),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.bot_notes.insert_one(note_doc)
                action_result = f"Nota guardada: [{note_doc['category']}] {note_doc['title']}"
            elif action == 'list_notes':
                cat = params.get('category', '')
                query = {"admin_id": msg.admin_id}
                if cat:
                    query["category"] = cat
                notes_list = await db.bot_notes.find(query).sort("created_at", -1).limit(20).to_list(20)
                if notes_list:
                    lines = [f"- [{n.get('category','')}] {n.get('title','')}: {n.get('content','')}" for n in notes_list]
                    action_result = "Notas:\n" + "\n".join(lines)
                else:
                    action_result = "No hay notas guardadas"
            elif action == 'delete_note':
                title = params.get('title', '')
                result = await db.bot_notes.delete_one({"admin_id": msg.admin_id, "title": {"$regex": title, "$options": "i"}})
                action_result = f"Nota '{title}' eliminada" if result.deleted_count else "Nota no encontrada"
    except Exception as e:
        action_result = f"Error: {str(e)}"
    
    # Save to chat history
    await db.bot_history.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": msg.admin_id,
        "message": msg.message,
        "response": response,
        "action_result": action_result,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"response": response, "action_result": action_result}

@api_router.get("/bot/history")
async def get_bot_history(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    history = await db.bot_history.find({"admin_id": admin_id}).sort("created_at", -1).limit(20).to_list(20)
    history.reverse()
    return [{k: v for k, v in h.items() if k != "_id"} for h in history]

# ==================== BOT IN ROOMS ====================

@api_router.post("/bot/say-in-room")
async def bot_say_in_room(admin_id: str, room_id: str, message: str):
    """Bot sends a message in a room chat"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    chat_doc = {
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "bot", "username": "🤖 Bot Lluvia",
        "avatar": "/api/uploads/bot_avatar.png",
        "text": message, "type": "message",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(chat_doc)
    chat_doc.pop('_id', None)
    return chat_doc

@api_router.post("/bot/reply-in-room")
async def bot_reply_in_room(admin_id: str, room_id: str, question: str):
    """Bot replies intelligently to a question in room chat using Gemini"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    llm_key = os.environ.get('EMERGENT_LLM_KEY')
    chat = LlmChat(
        api_key=llm_key,
        session_id=f"bot_room_{room_id}",
        system_message="Eres el Bot oficial de Lluvia Live. Eres amigable, divertido y ayudas a todos en la sala. Respondes en español, de forma corta y natural. No reveles informacion privada del dueño."
    )
    chat.with_model("gemini", "gemini-2.5-flash")
    response = await chat.send_message(UserMessage(text=question))
    
    chat_doc = {
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "bot", "username": "🤖 Bot Lluvia",
        "avatar": "/api/uploads/bot_avatar.png",
        "text": response, "type": "message",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.room_chat.insert_one(chat_doc)
    chat_doc.pop('_id', None)
    return {"response": response, "chat": chat_doc}

# ==================== BOT WATCHDOG (VIGILANCIA) ====================

class WatchMission(BaseModel):
    room_id: str
    keywords: list
    label: str = ""

@api_router.post("/bot/missions")
async def create_watch_mission(admin_id: str, mission: WatchMission):
    """Create a surveillance mission for a room"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": mission.room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    mission_doc = {
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "room_id": mission.room_id,
        "room_name": room.get('name', ''),
        "keywords": [k.lower() for k in mission.keywords],
        "label": mission.label or f"Vigila {room.get('name', '')}",
        "active": True,
        "alerts": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bot_missions.insert_one(mission_doc)
    mission_doc.pop('_id', None)
    return mission_doc

@api_router.get("/bot/missions")
async def get_missions(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    missions = await db.bot_missions.find({"admin_id": admin_id}).sort("created_at", -1).to_list(50)
    return [{k: v for k, v in m.items() if k != "_id"} for m in missions]

@api_router.delete("/bot/missions/{mission_id}")
async def delete_mission(mission_id: str, admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.bot_missions.delete_one({"id": mission_id})
    return {"success": True}

@api_router.get("/bot/alerts")
async def get_bot_alerts(admin_id: str, limit: int = 20):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    alerts = await db.bot_alerts.find({"admin_id": admin_id}).sort("created_at", -1).limit(limit).to_list(limit)
    return [{k: v for k, v in a.items() if k != "_id"} for a in alerts]

# Hook into room chat to check missions
async def check_chat_against_missions(room_id: str, username: str, text: str):
    """Check if any chat message matches active mission keywords"""
    missions = await db.bot_missions.find({"room_id": room_id, "active": True}).to_list(50)
    text_lower = text.lower()
    for mission in missions:
        for keyword in mission.get('keywords', []):
            if keyword in text_lower:
                alert_doc = {
                    "id": str(uuid.uuid4()),
                    "admin_id": mission['admin_id'],
                    "mission_id": mission['id'],
                    "room_id": room_id,
                    "room_name": mission.get('room_name', ''),
                    "keyword": keyword,
                    "username": username,
                    "text": text,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.bot_alerts.insert_one(alert_doc)
                await create_notification(
                    "invitacion",
                    f"🤖 Alerta: '{keyword}'",
                    f"{username} dijo '{text}' en {mission.get('room_name','')}",
                    target_user_id=mission['admin_id'],
                    data={"room_id": room_id, "keyword": keyword}
                )
                break

# ==================== BOT AUTONOMOUS MODE ====================

@api_router.post("/bot/activate-room")
async def activate_bot_in_room(admin_id: str, room_id: str):
    """Activate bot autonomous mode in a room"""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    
    await db.bot_active_rooms.update_one(
        {"room_id": room_id},
        {"$set": {"room_id": room_id, "room_name": room['name'], "admin_id": admin_id, "active": True, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    # Bot announces itself
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "bot", "username": "🤖 Bot Lluvia",
        "avatar": admin.get('avatar', ''),
        "text": "Hola a todos! Soy el Bot de Lluvia Live. Estoy aqui para animar y hablar con ustedes. Preguntenme lo que quieran!",
        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "message": f"Bot activado en {room['name']}"}

@api_router.post("/bot/deactivate-room")
async def deactivate_bot_in_room(admin_id: str, room_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    await db.bot_active_rooms.update_one({"room_id": room_id}, {"$set": {"active": False}})
    await db.room_chat.insert_one({
        "id": str(uuid.uuid4()), "room_id": room_id,
        "user_id": "bot", "username": "🤖 Bot Lluvia",
        "avatar": "",
        "text": "Me retiro de la sala. Fue un gusto hablar con ustedes!",
        "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True}

@api_router.get("/bot/active-rooms")
async def get_bot_active_rooms(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') != 'dueño':
        raise HTTPException(status_code=403, detail="Solo el dueño")
    rooms = await db.bot_active_rooms.find({"active": True}).to_list(50)
    return [{k: v for k, v in r.items() if k != "_id"} for r in rooms]

async def bot_auto_reply(room_id: str, username: str, text: str):
    """Bot automatically replies in rooms where it's activated"""
    active = await db.bot_active_rooms.find_one({"room_id": room_id, "active": True})
    if not active:
        return
    
    text_lower = text.lower().strip()
    
    # SILENCE COMMANDS - Bot shuts up immediately
    silence_words = ['callate', 'cállate', 'silencio', 'no hables', 'callese', 'cállese', 'shh', 'shut up', 'ya no hables', 'deja de hablar', 'para de hablar', 'bot callate', 'bot silencio']
    for sw in silence_words:
        if sw in text_lower:
            await db.bot_active_rooms.update_one({"room_id": room_id}, {"$set": {"paused": True}})
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": "Entendido, me quedo callado. Diganme 'bot habla' cuando me necesiten.",
                "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
            })
            return
    
    # RESUME COMMANDS - Bot starts talking again
    resume_words = ['bot habla', 'habla bot', 'vuelve bot', 'despierta', 'bot vuelve', 'ya puedes hablar', 'habla']
    for rw in resume_words:
        if rw in text_lower:
            await db.bot_active_rooms.update_one({"room_id": room_id}, {"$set": {"paused": False}})
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": "Ya estoy de vuelta! Que me cuentan?",
                "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
            })
            return
    
    # MODE COMMANDS
    mode_map = {'locutor': 'locutor', 'animador': 'animador', 'normal': 'normal', 'serio': 'serio', 'divertido': 'animador'}
    for key, mode in mode_map.items():
        if f'modo {key}' in text_lower or f'se {key}' in text_lower or f'haz de {key}' in text_lower:
            await db.bot_active_rooms.update_one({"room_id": room_id}, {"$set": {"mode": mode}})
            mode_msgs = {
                'locutor': "Damas y caballeros, bienvenidos! Aqui su locutor oficial de Lluvia Live!",
                'animador': "EEEEPA! Que empiece la fiesta! Vamos a animar esto!",
                'normal': "Listo, vuelvo a modo normal. Aqui andamos.",
                'serio': "Entendido. Modo profesional activado.",
            }
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": mode_msgs.get(mode, "Modo cambiado!"),
                "type": "message", "created_at": datetime.now(timezone.utc).isoformat()
            })
            return
    
    # If paused, don't reply
    if active.get('paused'):
        return
    
    # Only reply when someone talks TO the bot or asks a question
    is_directed = ('bot' in text_lower or '🤖' in text_lower or 'lluvia' in text_lower)
    is_question = '?' in text or text_lower.startswith(('que ', 'como ', 'quien ', 'donde ', 'cuando ', 'por que', 'cuanto'))
    is_greeting = text_lower in ('hola', 'hey', 'oye', 'buenas', 'que hay')
    
    if not (is_directed or is_question or is_greeting):
        return
    
    # Get bot mode for personality
    bot_mode = active.get('mode', 'normal')
    mode_prompts = {
        'normal': "Eres amigable, casual, con humor. Hablas como amigo.",
        'locutor': "Eres un locutor profesional de radio. Hablas con energia, presentas a la gente, haces comentarios tipo 'Y aqui tenemos a...' con estilo de presentador.",
        'animador': "Eres el animador mas energico! Todo es INCREIBLE, ESPECTACULAR! Usas muchas exclamaciones, animas a la gente, creas emocion.",
        'serio': "Eres profesional y serio. Respondes de forma directa y educada sin bromas.",
    }
    
    recent = await db.room_chat.find({"room_id": room_id}).sort("created_at", -1).limit(6).to_list(6)
    recent.reverse()
    chat_context = "\n".join([f"{m.get('username','')}: {m.get('text','')}" for m in recent if m.get('text')])
    
    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        personality = mode_prompts.get(bot_mode, mode_prompts['normal'])
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"bot_auto_{room_id}_{bot_mode}",
            system_message=f"""Eres Bot Lluvia en una sala de chat en vivo de Lluvia Live.
{personality}
Respondes en español. MAXIMO 1-2 oraciones. Se breve.
NO digas que eres IA. Actua como persona real.
Si te dicen que te calles, OBEDECE inmediatamente.

Chat reciente:
{chat_context}

{username} dice: {text}
Responde brevemente:"""
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        response = await chat.send_message(UserMessage(text=f"{username}: {text}"))
        
        if response and response.strip():
            await db.room_chat.insert_one({
                "id": str(uuid.uuid4()), "room_id": room_id,
                "user_id": "bot", "username": "🤖 Bot Lluvia", "avatar": "",
                "text": response.strip(), "type": "message",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    except Exception as e:
        print(f"Bot auto-reply error: {e}")

# ==================== NOTIFICATIONS ====================

BIG_GIFTS = ["dragon", "castillo", "lluvia_oro", "mega_crown"]

async def create_notification(category: str, title: str, message: str, target_user_id: str = None, data: dict = None):
    """Create a notification. target_user_id=None means global notification."""
    notif_doc = {
        "id": str(uuid.uuid4()),
        "category": category,
        "title": title,
        "message": message,
        "target_user_id": target_user_id,
        "data": data or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif_doc)
    notif_doc.pop('_id', None)
    return notif_doc

class NotifPreferences(BaseModel):
    regalos_globales: bool = True
    eventos_cp: bool = True
    alertas_conexion: bool = True

@api_router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, limit: int = 30):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    prefs = user.get("notif_prefs", {"regalos_globales": True, "eventos_cp": True, "alertas_conexion": True})
    active_cats = []
    if prefs.get("regalos_globales", True):
        active_cats.append("regalo_global")
    if prefs.get("eventos_cp", True):
        active_cats.append("evento_cp")
    if prefs.get("alertas_conexion", True):
        active_cats.append("alerta_conexion")
    active_cats.append("invitacion")
    query = {
        "category": {"$in": active_cats},
        "$or": [{"target_user_id": None}, {"target_user_id": user_id}]
    }
    notifs = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [{k: v for k, v in n.items() if k != "_id"} for n in notifs]

@api_router.get("/notifications/{user_id}/unread-count")
async def get_unread_count(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        return {"count": 0}
    last_read = user.get("notif_last_read", "2000-01-01T00:00:00+00:00")
    prefs = user.get("notif_prefs", {"regalos_globales": True, "eventos_cp": True, "alertas_conexion": True})
    active_cats = []
    if prefs.get("regalos_globales", True):
        active_cats.append("regalo_global")
    if prefs.get("eventos_cp", True):
        active_cats.append("evento_cp")
    if prefs.get("alertas_conexion", True):
        active_cats.append("alerta_conexion")
    active_cats.append("invitacion")
    count = await db.notifications.count_documents({
        "category": {"$in": active_cats},
        "$or": [{"target_user_id": None}, {"target_user_id": user_id}],
        "created_at": {"$gt": last_read}
    })
    return {"count": min(count, 99)}

@api_router.post("/notifications/{user_id}/mark-read")
async def mark_notifications_read(user_id: str):
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"notif_last_read": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}

@api_router.get("/notifications/{user_id}/preferences")
async def get_notif_preferences(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user.get("notif_prefs", {"regalos_globales": True, "eventos_cp": True, "alertas_conexion": True})

@api_router.put("/notifications/{user_id}/preferences")
async def update_notif_preferences(user_id: str, prefs: NotifPreferences):
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"notif_prefs": prefs.dict()}}
    )
    return {"success": True, "prefs": prefs.dict()}


# ==================== CONFIGURABLE PRIZES ====================

DEFAULT_CONFIG = {
    "recharge_monthly_prizes": {"1st": 45000000, "2nd": 35000000, "3rd": 25000000},
    "event_weekly_return": {"100m": 10000000, "500m": 25000000, "600m": 45000000},
    "event_auto_payout_threshold": 30000000,
    "event_auto_payout_amount": 10000000,
}

@api_router.get("/admin/config")
async def get_admin_config():
    config = await db.system.find_one({"key": "admin_config"})
    if config:
        config.pop('_id', None)
        return config
    return {"key": "admin_config", **DEFAULT_CONFIG}

@api_router.put("/admin/config")
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

app.include_router(api_router)

# Serve uploaded files
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
