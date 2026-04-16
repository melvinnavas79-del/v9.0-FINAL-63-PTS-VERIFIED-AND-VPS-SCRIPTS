"""
Auth routes: Register, Login, User profile, Ghost mode.
"""
from fastapi import APIRouter, HTTPException
from database import (
    db, UserRegister, UserLogin, hash_password, verify_password,
    serialize_user, uuid, datetime, timezone
)

router = APIRouter()

@router.post("/register")
async def register(user_data: UserRegister):
    """Register a new user with unique username and numeric ID."""
    existing = await db.users.find_one({"username": {"$regex": f"^{user_data.username}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Usuario ya existe")
    
    numeric_id = str(uuid.uuid4().int)[:6]
    while await db.users.find_one({"numeric_id": numeric_id}):
        numeric_id = str(uuid.uuid4().int)[:6]
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "numeric_id": numeric_id,
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "role": "usuario",
        "level": 1,
        "coins": 1500000,
        "diamonds": 0,
        "aristocracy": 0,
        "avatar": f"https://api.dicebear.com/7.x/adventurer/svg?seed={user_data.username}",
        "clan": None,
        "cp_partner": None,
        "ghost_mode": False,
        "is_verified": False,
        "is_banned": False,
        "entry_animation": "none",
        "total_spent": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    user_doc.pop('_id', None)
    return {"success": True, "user": serialize_user(user_doc)}

@router.post("/login")
async def login(credentials: UserLogin):
    """Login with case-insensitive username."""
    user = await db.users.find_one({"username": {"$regex": f"^{credentials.username}$", "$options": "i"}})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")
    if user.get('is_banned'):
        raise HTTPException(status_code=403, detail="Cuenta suspendida")
    return {"success": True, "user": serialize_user(user)}

@router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user profile by ID."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)

@router.get("/users/search/{query}")
async def search_user(query: str):
    """Search user by username or numeric ID. Hidden if ghost mode active."""
    user = await db.users.find_one({"$or": [{"numeric_id": query}, {"username": {"$regex": query, "$options": "i"}}]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get('ghost_mode'):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)

@router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict):
    """Update user profile fields (name, avatar, entry_animation, etc)."""
    allowed = {'username', 'avatar', 'entry_animation', 'bio'}
    safe = {k: v for k, v in updates.items() if k in allowed}
    if safe:
        await db.users.update_one({"id": user_id}, {"$set": safe})
    user = await db.users.find_one({"id": user_id})
    return serialize_user(user) if user else {}

@router.post("/users/{user_id}/ghost-mode")
async def toggle_ghost_mode(user_id: str):
    """Toggle ghost mode - hides user from rankings and searches."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get('role', 'usuario') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="Solo admin o dueno puede usar Modo Fantasma")
    new_mode = not user.get('ghost_mode', False)
    await db.users.update_one({"id": user_id}, {"$set": {"ghost_mode": new_mode}})
    return {"success": True, "ghost_mode": new_mode}

@router.get("/users/{user_id}/entry-animation")
async def get_entry_animation(user_id: str):
    """Get entry animation data based on user role and aristocracy level."""
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

@router.get("/rankings/coins")
async def get_coins_ranking():
    """Top 50 users by coins (excludes ghost mode users)."""
    users = await db.users.find({"ghost_mode": {"$ne": True}}).sort("coins", -1).limit(50).to_list(50)
    return [serialize_user(u) for u in users]

@router.get("/rankings/level")
async def get_level_ranking():
    """Top 50 users by level (excludes ghost mode users)."""
    users = await db.users.find({"ghost_mode": {"$ne": True}}).sort("level", -1).limit(50).to_list(50)
    return [serialize_user(u) for u in users]
