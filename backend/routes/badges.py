"""
Badges routes: Automatic achievement badges awarded based on user activity.
"""
from fastapi import APIRouter, HTTPException
from database import db, uuid, datetime, timezone, create_notification

router = APIRouter()

# Badge catalog - conditions checked automatically
BADGES = [
    # Gifts
    {"id": "first_gift", "name": "Primer Regalo", "icon": "🎁", "category": "regalos", "desc": "Enviaste tu primer regalo", "condition": {"field": "total_gifts_sent", "min": 1}},
    {"id": "gift_10", "name": "Generoso", "icon": "💝", "category": "regalos", "desc": "Enviaste 10 regalos", "condition": {"field": "total_gifts_sent", "min": 10}},
    {"id": "gift_50", "name": "Lluvia de Amor", "icon": "🌹", "category": "regalos", "desc": "Enviaste 50 regalos", "condition": {"field": "total_gifts_sent", "min": 50}},
    {"id": "gift_100", "name": "Rey de los Regalos", "icon": "👑", "category": "regalos", "desc": "Enviaste 100 regalos", "condition": {"field": "total_gifts_sent", "min": 100}},
    {"id": "gift_500", "name": "Leyenda Generosa", "icon": "🏆", "category": "regalos", "desc": "Enviaste 500 regalos", "condition": {"field": "total_gifts_sent", "min": 500}},
    # Spending
    {"id": "spend_100k", "name": "Primer Gasto", "icon": "🪙", "category": "gasto", "desc": "Gastaste 100K monedas", "condition": {"field": "total_spent", "min": 100000}},
    {"id": "spend_1m", "name": "Millonario", "icon": "💰", "category": "gasto", "desc": "Gastaste 1M monedas", "condition": {"field": "total_spent", "min": 1000000}},
    {"id": "spend_10m", "name": "Gran Inversor", "icon": "💎", "category": "gasto", "desc": "Gastaste 10M monedas", "condition": {"field": "total_spent", "min": 10000000}},
    {"id": "spend_100m", "name": "Magnate", "icon": "🏦", "category": "gasto", "desc": "Gastaste 100M monedas", "condition": {"field": "total_spent", "min": 100000000}},
    {"id": "spend_1b", "name": "Titan del Oro", "icon": "⭐", "category": "gasto", "desc": "Gastaste 1B monedas", "condition": {"field": "total_spent", "min": 1000000000}},
    # Games
    {"id": "first_win", "name": "Primera Victoria", "icon": "🎮", "category": "juegos", "desc": "Ganaste tu primer juego", "condition": {"field": "total_games_won", "min": 1}},
    {"id": "win_10", "name": "Jugador Experto", "icon": "🎲", "category": "juegos", "desc": "Ganaste 10 juegos", "condition": {"field": "total_games_won", "min": 10}},
    {"id": "win_50", "name": "Maestro del Juego", "icon": "🃏", "category": "juegos", "desc": "Ganaste 50 juegos", "condition": {"field": "total_games_won", "min": 50}},
    {"id": "win_100", "name": "Campeon", "icon": "🏅", "category": "juegos", "desc": "Ganaste 100 juegos", "condition": {"field": "total_games_won", "min": 100}},
    {"id": "win_500", "name": "Leyenda del Casino", "icon": "🎰", "category": "juegos", "desc": "Ganaste 500 juegos", "condition": {"field": "total_games_won", "min": 500}},
    # Receiving
    {"id": "first_received", "name": "Primer Fan", "icon": "🌟", "category": "recibidos", "desc": "Recibiste tu primer regalo", "condition": {"field": "total_gifts_received", "min": 1}},
    {"id": "received_50", "name": "Popular", "icon": "🔥", "category": "recibidos", "desc": "Recibiste 50 regalos", "condition": {"field": "total_gifts_received", "min": 50}},
    {"id": "received_100", "name": "Estrella", "icon": "✨", "category": "recibidos", "desc": "Recibiste 100 regalos", "condition": {"field": "total_gifts_received", "min": 100}},
    {"id": "received_500", "name": "Idolo", "icon": "💫", "category": "recibidos", "desc": "Recibiste 500 regalos", "condition": {"field": "total_gifts_received", "min": 500}},
    # Room
    {"id": "first_room", "name": "Anfitrion", "icon": "🏠", "category": "sala", "desc": "Creaste tu primera sala", "condition": {"field": "rooms_created", "min": 1}},
    {"id": "hours_10", "name": "Residente", "icon": "🕐", "category": "sala", "desc": "10 horas en salas", "condition": {"field": "total_hours", "min": 10}},
    {"id": "hours_100", "name": "Veterano", "icon": "🛡️", "category": "sala", "desc": "100 horas en salas", "condition": {"field": "total_hours", "min": 100}},
    # Level
    {"id": "level_10", "name": "Aprendiz", "icon": "📘", "category": "nivel", "desc": "Alcanzaste nivel 10", "condition": {"field": "level", "min": 10}},
    {"id": "level_25", "name": "Avanzado", "icon": "📗", "category": "nivel", "desc": "Alcanzaste nivel 25", "condition": {"field": "level", "min": 25}},
    {"id": "level_50", "name": "Experto", "icon": "📕", "category": "nivel", "desc": "Alcanzaste nivel 50", "condition": {"field": "level", "min": 50}},
    {"id": "level_100", "name": "Maestro", "icon": "📙", "category": "nivel", "desc": "Alcanzaste nivel 100", "condition": {"field": "level", "min": 100}},
    # Aristocracy
    {"id": "arist_1", "name": "Noble", "icon": "🏰", "category": "aristocracia", "desc": "Aristocracia nivel 1", "condition": {"field": "aristocracy", "min": 1}},
    {"id": "arist_5", "name": "Conde", "icon": "🏰", "category": "aristocracia", "desc": "Aristocracia nivel 5", "condition": {"field": "aristocracy", "min": 5}},
    {"id": "arist_10", "name": "Emperador", "icon": "👑", "category": "aristocracia", "desc": "Aristocracia nivel 10", "condition": {"field": "aristocracy", "min": 10}},
]


async def check_and_award_badges(user_id: str):
    """Check all badge conditions and award new ones automatically."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return []

    current_badges = user.get("badges_earned", [])
    new_badges = []

    for badge in BADGES:
        if badge["id"] in current_badges:
            continue

        cond = badge["condition"]
        field_val = user.get(cond["field"], 0)
        if field_val >= cond["min"]:
            new_badges.append(badge["id"])

    if new_badges:
        await db.users.update_one(
            {"id": user_id},
            {"$addToSet": {"badges_earned": {"$each": new_badges}}}
        )
        # Send notification for each new badge
        for bid in new_badges:
            badge_info = next((b for b in BADGES if b["id"] == bid), None)
            if badge_info:
                await create_notification(
                    "badge",
                    f"{badge_info['icon']} Nueva Medalla!",
                    f"Ganaste: {badge_info['name']} - {badge_info['desc']}",
                    target_user_id=user_id,
                    data={"badge_id": bid}
                )

    return new_badges


@router.get("/badges/catalog")
async def get_badge_catalog():
    """Get the full badge catalog."""
    return BADGES


@router.get("/badges/{user_id}")
async def get_user_badges(user_id: str):
    """Get all badges earned by a user."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    earned = user.get("badges_earned", [])
    result = []
    for badge in BADGES:
        b = {**badge, "earned": badge["id"] in earned}
        result.append(b)

    return {"earned_count": len(earned), "total": len(BADGES), "badges": result}


@router.post("/badges/{user_id}/check")
async def check_badges(user_id: str):
    """Manually trigger badge check for a user."""
    new_badges = await check_and_award_badges(user_id)
    return {"new_badges": new_badges, "count": len(new_badges)}
