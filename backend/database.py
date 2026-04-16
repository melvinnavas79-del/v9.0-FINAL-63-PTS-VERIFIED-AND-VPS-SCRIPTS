"""
Lluvia Live - Shared database connection and helpers.
=====================================================
Central module for MongoDB connection, Pydantic models, 
security utilities, and shared helper functions.

All route modules import from here to maintain a single 
source of truth for data access and validation.

Collections:
    users          - User accounts, profiles, coins, roles
    rooms          - Audio rooms with seats and settings
    room_chat      - Chat messages per room
    clanes         - Clan groups with members
    parejas        - CP (couple) partnerships
    events         - Event history log
    event_requests - Event request/approval workflow
    bot_sessions   - Bot memory per user session
    bot_active_rooms - Rooms where bot is active
    pk_battles     - PK battle state
    notifications  - User notifications
    gifts_log      - Gift transaction history
"""
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from pathlib import Path
from dotenv import load_dotenv
import os
import uuid
import bcrypt
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

# ==================== DATABASE ====================
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ==================== MODELS ====================

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class RoomCreate(BaseModel):
    name: str

class ClanCreate(BaseModel):
    name: str
    badge: str = ""

class ChatMessage(BaseModel):
    user_id: str
    text: str

class GameBet(BaseModel):
    user_id: str
    bet: int = 0
    bet_amount: int = 0

class RPSBet(BaseModel):
    user_id: str
    choice: str
    bet_amount: int = 500

class TriviaBet(BaseModel):
    user_id: str
    answer: int
    bet_amount: int = 500

class CardBet(BaseModel):
    user_id: str
    bet_amount: int
    guess: str = "mayor"

class GenericPlay(BaseModel):
    user_id: str
    game: str
    bet: int = 500

class PKBattleStart(BaseModel):
    room_id: str
    challenger_id: str
    opponent_id: str
    bet_amount: int

class BotMessage(BaseModel):
    admin_id: str
    message: str

class WatchMission(BaseModel):
    room_id: str
    keywords: List[str]
    action: str = "alert"

class EventRequest(BaseModel):
    user_id: str
    event_type: str

class NotifPreferences(BaseModel):
    global_notifs: bool = True
    cp_notifs: bool = True
    connection_notifs: bool = True
    invite_notifs: bool = True


class GiftSend(BaseModel):
    sender_id: str
    receiver_id: str
    gift_type: str
    room_id: str = ""

class IDChange(BaseModel):
    user_id: str
    new_numeric_id: str

# ==================== HELPERS ====================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def serialize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a MongoDB user document to a safe JSON-serializable dict."""
    if not user:
        return {}
    return {
        "id": user.get("id", ""),
        "numeric_id": user.get("numeric_id", ""),
        "username": user.get("username", ""),
        "role": user.get("role", "usuario"),
        "level": user.get("level", 1),
        "coins": user.get("coins", 0),
        "diamonds": user.get("diamonds", 0),
        "aristocracy": user.get("aristocracy", 0),
        "avatar": user.get("avatar", f"https://api.dicebear.com/7.x/adventurer/svg?seed={user.get('username', 'default')}"),
        "clan": user.get("clan"),
        "cp_partner": user.get("cp_partner"),
        "ghost_mode": user.get("ghost_mode", False),
        "is_verified": user.get("is_verified", False),
        "is_banned": user.get("is_banned", False),
        "entry_animation": user.get("entry_animation", "none"),
        "total_spent": user.get("total_spent", 0),
        "total_gifts_sent": user.get("total_gifts_sent", 0),
        "total_gifts_received": user.get("total_gifts_received", 0),
        "total_games_won": user.get("total_games_won", 0),
        "badges_earned": user.get("badges_earned", []),
        "created_at": user.get("created_at", ""),
    }

def serialize_room(room: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a MongoDB room document to a safe JSON-serializable dict."""
    if not room:
        return {}
    return {
        "id": room.get("id", ""),
        "name": room.get("name", ""),
        "owner_id": room.get("owner_id", ""),
        "owner_name": room.get("owner_name", ""),
        "active_users": room.get("active_users", 0),
        "seats": room.get("seats", [None]*9),
        "background": room.get("background"),
        "music_url": room.get("music_url"),
        "created_at": room.get("created_at", ""),
    }

# Role hierarchy for permission checks
ROLE_HIERARCHY = {
    'usuario': 0,
    'vip': 1,
    'supervisor': 2,
    'moderador': 3,
    'admin': 4,
    'dueño': 5
}

def has_permission(user_role: str, required_role: str) -> bool:
    """Check if a user's role meets the required permission level."""
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(required_role, 0)

async def create_notification(category: str, title: str, message: str, target_user_id: str = None, data: dict = None):
    """Create a notification. target_user_id=None means global notification."""
    notif_doc = {
        "id": str(uuid.uuid4()),
        "category": category,
        "title": title,
        "message": message,
        "target_user_id": target_user_id,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif_doc)
    return notif_doc
