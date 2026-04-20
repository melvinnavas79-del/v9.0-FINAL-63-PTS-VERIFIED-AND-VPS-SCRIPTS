"""
Notification routes: Get, mark read, preferences.
"""
from fastapi import APIRouter, HTTPException
from database import db, NotifPreferences, uuid, datetime, timezone

router = APIRouter()

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

# NotifPreferences imported from database

@router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, limit: int = 30):
    """Get Notifications."""
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
    # Siempre activas (no-opcionales para la mayoría de usuarios)
    active_cats.extend(["invitacion", "social_follow", "social_friend_active", "system_alert", "badge"])
    query = {
        "category": {"$in": active_cats},
        "$or": [{"target_user_id": None}, {"target_user_id": user_id}]
    }
    notifs = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [{k: v for k, v in n.items() if k != "_id"} for n in notifs]

@router.get("/notifications/{user_id}/unread-count")
async def get_unread_count(user_id: str):
    """Get Unread Count."""
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
    active_cats.extend(["invitacion", "social_follow", "social_friend_active", "system_alert", "badge"])
    count = await db.notifications.count_documents({
        "category": {"$in": active_cats},
        "$or": [{"target_user_id": None}, {"target_user_id": user_id}],
        "created_at": {"$gt": last_read}
    })
    return {"count": min(count, 99)}

@router.post("/notifications/{user_id}/mark-read")
async def mark_notifications_read(user_id: str):
    """Mark Notifications Read."""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"notif_last_read": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}

@router.get("/notifications/{user_id}/preferences")
async def get_notif_preferences(user_id: str):
    """Get Notif Preferences."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user.get("notif_prefs", {"regalos_globales": True, "eventos_cp": True, "alertas_conexion": True})

@router.put("/notifications/{user_id}/preferences")
async def update_notif_preferences(user_id: str, prefs: NotifPreferences):
    """Update Notif Preferences."""
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

