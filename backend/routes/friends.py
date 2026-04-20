"""
Friends / Seguir rutas — sistema de "amigos" (follow) y presencia en salas.
==========================================================================
Un usuario "sigue" a otro. Cuando un seguido entra a una sala, los seguidores
reciben una notificación "activity" (ver create_notification) y pueden ver
en vivo qué amigos están activos desde el Dashboard.

Endpoints:
  POST   /api/social/follow              body: {follower_id, target_id}
  DELETE /api/social/follow              body: {follower_id, target_id}
  GET    /api/social/following/{user_id}            lista a quién sigo
  GET    /api/social/followers/{user_id}            lista quién me sigue
  GET    /api/social/friends-active/{user_id}       amigos actualmente en salas

  POST   /api/social/notify-room-entry   body: {user_id, room_id}
         Llamado cuando el usuario entra a una sala: crea notifs a seguidores.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import db, create_notification, serialize_user, datetime, timezone

router = APIRouter()


class FollowBody(BaseModel):
    follower_id: str
    target_id: str


@router.post("/social/follow")
async def follow_user(body: FollowBody):
    if body.follower_id == body.target_id:
        raise HTTPException(status_code=400, detail="No puedes seguirte a ti mismo")

    follower = await db.users.find_one({"id": body.follower_id})
    target = await db.users.find_one({"id": body.target_id})
    if not follower or not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Upsert idempotente
    await db.follows.update_one(
        {"follower_id": body.follower_id, "target_id": body.target_id},
        {"$setOnInsert": {
            "follower_id": body.follower_id,
            "target_id": body.target_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    # Notificar al que fue seguido
    await create_notification(
        category="social_follow",
        title="Nuevo seguidor",
        message=f"{follower['username']} empezó a seguirte",
        target_user_id=body.target_id,
        data={"follower_id": body.follower_id, "follower_username": follower["username"]},
    )

    count = await db.follows.count_documents({"follower_id": body.follower_id})
    return {"success": True, "following_count": count}


@router.delete("/social/follow")
async def unfollow_user(body: FollowBody):
    await db.follows.delete_one({"follower_id": body.follower_id, "target_id": body.target_id})
    count = await db.follows.count_documents({"follower_id": body.follower_id})
    return {"success": True, "following_count": count}


@router.get("/social/following/{user_id}")
async def list_following(user_id: str, limit: int = 100):
    """IDs y perfiles a los que user_id sigue."""
    rows = await db.follows.find({"follower_id": user_id}, {"_id": 0}).to_list(limit)
    target_ids = [r["target_id"] for r in rows]
    users = await db.users.find({"id": {"$in": target_ids}}, {"_id": 0}).to_list(limit)
    return [serialize_user(u) for u in users]


@router.get("/social/followers/{user_id}")
async def list_followers(user_id: str, limit: int = 100):
    """Quién sigue a user_id."""
    rows = await db.follows.find({"target_id": user_id}, {"_id": 0}).to_list(limit)
    follower_ids = [r["follower_id"] for r in rows]
    users = await db.users.find({"id": {"$in": follower_ids}}, {"_id": 0}).to_list(limit)
    return [serialize_user(u) for u in users]


@router.get("/social/follow-status")
async def follow_status(follower_id: str, target_id: str):
    exists = await db.follows.find_one({"follower_id": follower_id, "target_id": target_id})
    return {"following": bool(exists)}


@router.get("/social/friends-active/{user_id}")
async def friends_currently_in_rooms(user_id: str):
    """
    Retorna los usuarios seguidos que actualmente están sentados en alguna sala
    (i.e., ocupan un asiento en room.seats). Usado por el Dashboard para
    "Mis amigos activos".
    """
    # 1. Obtener a quién sigo
    follows = await db.follows.find({"follower_id": user_id}, {"_id": 0}).to_list(1000)
    target_ids = [f["target_id"] for f in follows]
    if not target_ids:
        return []

    # 2. Buscar salas donde alguno de esos user_ids tiene un seat
    rooms = await db.rooms.find(
        {"seats.user_id": {"$in": target_ids}},
        {"_id": 0, "id": 1, "name": 1, "seats": 1, "active_users": 1}
    ).to_list(200)

    # 3. Mapear user_id -> {user info, room info}
    friend_map = {}
    users = await db.users.find({"id": {"$in": target_ids}}, {"_id": 0}).to_list(1000)
    user_index = {u["id"]: u for u in users}

    for room in rooms:
        for seat in room.get("seats", []):
            if not seat:
                continue
            uid = seat.get("user_id")
            if uid in target_ids and uid not in friend_map:
                u = user_index.get(uid, {})
                friend_map[uid] = {
                    "user_id": uid,
                    "username": u.get("username") or seat.get("username"),
                    "avatar": u.get("avatar") or seat.get("avatar"),
                    "level": u.get("level", 1),
                    "room_id": room["id"],
                    "room_name": room.get("name", ""),
                    "active_users": room.get("active_users", 0),
                }

    return list(friend_map.values())


class RoomEntryBody(BaseModel):
    user_id: str
    room_id: str


@router.post("/social/notify-room-entry")
async def notify_followers_of_room_entry(body: RoomEntryBody):
    """
    Avisa a los seguidores de `user_id` que el usuario entró a `room_id`.
    Idempotente por (user_id, room_id, minuto): no re-notifica dentro del mismo minuto.
    """
    user = await db.users.find_one({"id": body.user_id})
    room = await db.rooms.find_one({"id": body.room_id})
    if not user or not room:
        raise HTTPException(status_code=404, detail="Usuario o sala no encontrada")

    # Idempotencia dentro de 60s
    minute_bucket = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    dedupe_key = f"roomentry:{body.user_id}:{body.room_id}:{minute_bucket}"
    existing = await db.notification_dedupe.find_one({"key": dedupe_key})
    if existing:
        return {"success": True, "notified": 0, "deduped": True}
    await db.notification_dedupe.insert_one({
        "key": dedupe_key,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Obtener seguidores
    follower_rows = await db.follows.find({"target_id": body.user_id}, {"_id": 0}).to_list(2000)
    notified = 0
    for row in follower_rows:
        await create_notification(
            category="social_friend_active",
            title=f"{user['username']} está en una sala",
            message=f"{user['username']} entró a {room.get('name', 'una sala')} — entra a acompañarlo",
            target_user_id=row["follower_id"],
            data={
                "user_id": body.user_id,
                "username": user["username"],
                "avatar": user.get("avatar"),
                "room_id": body.room_id,
                "room_name": room.get("name"),
            },
        )
        notified += 1

    return {"success": True, "notified": notified}


# =============== Search by numeric ID ===============

@router.get("/social/search-by-id/{numeric_id}")
async def search_by_numeric_id(numeric_id: str):
    """Búsqueda exacta por numeric_id (el ID de 6 dígitos de cada usuario)."""
    user = await db.users.find_one({"numeric_id": numeric_id.strip()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get("ghost_mode"):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)


# =============== Firebase Auth status (part of diagnostics, exposed pública con info mínima) ===============

@router.get("/auth/firebase/status")
async def firebase_status():
    """
    Indica si el frontend tiene configurado Firebase como Web App.
    Si el REACT_APP_FIREBASE_APP_ID es de Android (:android:) el login Google/Phone
    fallará. Este endpoint lo detecta desde env del backend y devuelve una guía clara.

    Para production: agregar Web App en Firebase Console → Settings → General →
    "Add app" → Web → pegar el nuevo appId en REACT_APP_FIREBASE_APP_ID y rebuild.
    """
    import os
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "")
    web_api_key = os.environ.get("FIREBASE_WEB_API_KEY", "")
    return {
        "project_id": project_id,
        "web_api_key_configured": bool(web_api_key),
        "authorized_domains_hint": [
            "lluvia-live.com",
            "www.lluvia-live.com",
            "localhost",
        ],
        "setup_instructions": (
            "Si Google/Phone Login falla: 1) Abre Firebase Console → Project Settings "
            "→ Your apps → 'Add app' → Web. 2) Copia el 'appId' (contiene ':web:'). "
            "3) Pégalo en frontend/.env como REACT_APP_FIREBASE_APP_ID. "
            "4) En Authentication → Settings → Authorized domains, agrega tu dominio. "
            "5) Rebuild frontend (yarn build)."
        ),
    }
