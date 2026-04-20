"""
Auth routes: Register, Login, Firebase Auth (Google + Phone), User profile, Ghost mode.
"""
from fastapi import APIRouter, HTTPException, Request
from database import (
    db, UserRegister, UserLogin, hash_password, verify_password,
    serialize_user, uuid, datetime, timezone
)
import os

# Firebase Admin SDK initialization
try:
    import firebase_admin
    from firebase_admin import credentials, auth as firebase_auth
    if not firebase_admin._apps:
        # Try service account file first, then fall back to project ID
        sa_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT', 'firebase-admin.json')
        if os.path.exists(sa_path):
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred)
        else:
            # Minimal init with project ID for token verification
            project_id = os.environ.get('FIREBASE_PROJECT_ID', '')
            if project_id:
                firebase_admin.initialize_app(options={'projectId': project_id})
    FIREBASE_AVAILABLE = True
except Exception:
    FIREBASE_AVAILABLE = False

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
    # Check device ban
    return {"success": True, "user": serialize_user(user)}


@router.post("/auth/firebase")
async def firebase_login(request: Request):
    """
    Authenticate with Firebase ID token (Google Sign-In or Phone).
    Creates or links user account in MongoDB.
    Registers device_id for ban tracking.
    """
    if not FIREBASE_AVAILABLE:
        raise HTTPException(status_code=500, detail="Firebase no configurado. Agrega FIREBASE_PROJECT_ID o firebase-admin.json")

    body = await request.json()
    id_token = body.get('id_token', '')
    device_id = body.get('device_id', '')

    if not id_token:
        raise HTTPException(status_code=400, detail="Token de Firebase requerido")

    # Verify the Firebase ID token
    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token invalido: {str(e)}")

    firebase_uid = decoded.get('uid', '')
    email = decoded.get('email', '')
    phone = decoded.get('phone_number', '')
    name = decoded.get('name', '') or decoded.get('display_name', '')
    photo = decoded.get('picture', '')
    provider = decoded.get('firebase', {}).get('sign_in_provider', 'unknown')

    # Check if device is banned
    if device_id:
        banned_device = await db.banned_devices.find_one({"device_id": device_id})
        if banned_device:
            raise HTTPException(status_code=403, detail="Este dispositivo ha sido suspendido por fraude")

    # Find existing user by firebase_uid, email, or phone
    existing = await db.users.find_one({"$or": [
        {"firebase_uid": firebase_uid},
        {"email": email} if email else {"_impossible": True},
        {"phone": phone} if phone else {"_impossible": True},
    ]})

    if existing:
        # Update firebase info and device
        update_data = {"firebase_uid": firebase_uid, "is_verified": True}
        if email:
            update_data["email"] = email
        if phone:
            update_data["phone"] = phone
        if photo and not existing.get('avatar', '').startswith('/api'):
            update_data["avatar"] = photo
        if device_id:
            update_data["device_id"] = device_id
        update_data["last_login"] = datetime.now(timezone.utc).isoformat()
        update_data["auth_provider"] = provider

        await db.users.update_one({"id": existing['id']}, {"$set": update_data})
        if existing.get('is_banned'):
            raise HTTPException(status_code=403, detail="Cuenta suspendida")
        updated = await db.users.find_one({"id": existing['id']})
        return {"success": True, "user": serialize_user(updated), "is_new": False}

    # Create new user from Firebase auth
    username = name or email.split('@')[0] if email else f"user_{firebase_uid[:8]}"
    # Ensure unique username
    base_username = username
    counter = 1
    while await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}}):
        username = f"{base_username}{counter}"
        counter += 1

    numeric_id = str(uuid.uuid4().int)[:6]
    while await db.users.find_one({"numeric_id": numeric_id}):
        numeric_id = str(uuid.uuid4().int)[:6]

    user_doc = {
        "id": str(uuid.uuid4()),
        "numeric_id": numeric_id,
        "firebase_uid": firebase_uid,
        "username": username,
        "password": "",
        "email": email,
        "phone": phone,
        "role": "usuario",
        "level": 1,
        "coins": 1500000,
        "diamonds": 0,
        "aristocracy": 0,
        "avatar": photo or f"https://api.dicebear.com/7.x/adventurer/svg?seed={username}",
        "clan": None,
        "cp_partner": None,
        "ghost_mode": False,
        "is_verified": True,
        "is_banned": False,
        "entry_animation": "none",
        "total_spent": 0,
        "auth_provider": provider,
        "device_id": device_id,
        "last_login": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    user_doc.pop('_id', None)

    # Check badges for new user
    from routes.badges import check_and_award_badges
    await check_and_award_badges(user_doc['id'])

    return {"success": True, "user": serialize_user(user_doc), "is_new": True}


@router.post("/auth/link-account")
async def link_firebase_account(request: Request):
    """Link existing username/password account with Firebase (Google/Phone)."""
    body = await request.json()
    user_id = body.get('user_id', '')
    id_token = body.get('id_token', '')

    if not user_id or not id_token:
        raise HTTPException(status_code=400, detail="user_id y id_token requeridos")

    if not FIREBASE_AVAILABLE:
        raise HTTPException(status_code=500, detail="Firebase no configurado")

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalido")

    firebase_uid = decoded.get('uid', '')
    email = decoded.get('email', '')
    phone = decoded.get('phone_number', '')
    photo = decoded.get('picture', '')

    # Check if firebase_uid already linked to another account
    conflict = await db.users.find_one({"firebase_uid": firebase_uid, "id": {"$ne": user_id}})
    if conflict:
        raise HTTPException(status_code=409, detail="Esta cuenta de Google/telefono ya esta vinculada a otro usuario")

    update_data = {"firebase_uid": firebase_uid, "is_verified": True}
    if email:
        update_data["email"] = email
    if phone:
        update_data["phone"] = phone
    if photo:
        update_data["avatar"] = photo

    await db.users.update_one({"id": user_id}, {"$set": update_data})
    updated = await db.users.find_one({"id": user_id})
    return {"success": True, "user": serialize_user(updated)}


@router.post("/admin/ban-device")
async def ban_device(device_id: str, admin_id: str, reason: str = "Fraude"):
    """Ban a device by device_id. Admin only."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="No autorizado")

    await db.banned_devices.update_one(
        {"device_id": device_id},
        {"$set": {"device_id": device_id, "banned_by": admin_id, "reason": reason, "banned_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    # Also ban any user linked to this device
    await db.users.update_many({"device_id": device_id}, {"$set": {"is_banned": True}})

    return {"success": True, "message": f"Dispositivo {device_id} baneado"}


@router.post("/admin/unban-device")
async def unban_device(device_id: str, admin_id: str):
    """Unban a device."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="No autorizado")
    await db.banned_devices.delete_one({"device_id": device_id})
    return {"success": True}

@router.get("/admin/device-accounts/{device_id}")
async def device_accounts(device_id: str, admin_id: str):
    """List all user accounts registered from a specific device. Detects fake/multi-accounts."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="No autorizado")
    users = await db.users.find(
        {"device_id": device_id},
        {"_id": 0, "id": 1, "username": 1, "role": 1, "coins": 1, "level": 1, "created_at": 1, "is_banned": 1, "avatar": 1, "last_seen": 1}
    ).sort("created_at", -1).to_list(100)
    banned_info = await db.banned_devices.find_one({"device_id": device_id}) or {}
    return {
        "device_id": device_id,
        "account_count": len(users),
        "is_device_banned": bool(banned_info.get("banned_at")),
        "ban_reason": banned_info.get("reason"),
        "accounts": users,
    }


@router.get("/admin/banned-devices")
async def list_banned_devices(admin_id: str):
    """List all banned devices with their linked accounts count."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="No autorizado")
    devices = await db.banned_devices.find({}, {"_id": 0}).sort("banned_at", -1).to_list(200)
    for d in devices:
        d["account_count"] = await db.users.count_documents({"device_id": d["device_id"]})
    return devices


@router.post("/admin/ban-ip")
async def ban_ip(ip_address: str, admin_id: str, reason: str = "Fraude"):
    """Ban an IP address. Any user registering or logging in from this IP is rejected."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="No autorizado")
    await db.banned_ips.update_one(
        {"ip_address": ip_address},
        {"$set": {"ip_address": ip_address, "banned_by": admin_id, "reason": reason, "banned_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    await db.users.update_many({"last_ip": ip_address}, {"$set": {"is_banned": True}})
    return {"success": True, "message": f"IP {ip_address} baneada"}


@router.post("/admin/unban-ip")
async def unban_ip(ip_address: str, admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="No autorizado")
    await db.banned_ips.delete_one({"ip_address": ip_address})
    return {"success": True}


@router.get("/admin/banned-ips")
async def list_banned_ips(admin_id: str):
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="No autorizado")
    ips = await db.banned_ips.find({}, {"_id": 0}).sort("banned_at", -1).to_list(200)
    for ip in ips:
        ip["account_count"] = await db.users.count_documents({"last_ip": ip["ip_address"]})
    return ips


@router.get("/admin/duplicate-devices")
async def duplicate_devices(admin_id: str, min_accounts: int = 2):
    """List devices that have multiple accounts registered — detects potential fake accounts."""
    admin = await db.users.find_one({"id": admin_id})
    if not admin or admin.get('role') not in ('dueño', 'admin'):
        raise HTTPException(status_code=403, detail="No autorizado")
    pipeline = [
        {"$match": {"device_id": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$device_id", "count": {"$sum": 1}, "usernames": {"$push": "$username"}, "user_ids": {"$push": "$id"}}},
        {"$match": {"count": {"$gte": min_accounts}}},
        {"$sort": {"count": -1}},
        {"$limit": 100},
    ]
    raw = await db.users.aggregate(pipeline).to_list(100)
    return [{"device_id": r["_id"], "account_count": r["count"], "usernames": r["usernames"], "user_ids": r["user_ids"]} for r in raw]


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
