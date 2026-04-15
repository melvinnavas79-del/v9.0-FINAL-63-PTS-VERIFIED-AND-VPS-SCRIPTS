"""
Lluvia Live - API Test Suite
=============================
Comprehensive tests for all route modules.
Run: cd /app/backend && pytest tests/ -v
"""
import pytest
import httpx
import os

BASE = os.environ.get('TEST_API_URL', 'http://localhost:8001/api')
ADMIN_ID = None  # Set after login
TEST_USER = "TestBot_" + str(os.getpid())

# ==================== FIXTURES ====================

@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE, timeout=15) as c:
        yield c

@pytest.fixture(scope="session")
def admin_token(client):
    """Login as admin and return user data."""
    r = client.post("/login", json={"username": "Melvin_Live", "password": "test123"})
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    return data["user"]

@pytest.fixture(scope="session")
def test_user(client):
    """Register a test user."""
    r = client.post("/register", json={"username": TEST_USER, "password": "test123"})
    if r.status_code == 400:  # Already exists
        r = client.post("/login", json={"username": TEST_USER, "password": "test123"})
    data = r.json()
    return data.get("user", data)

# ==================== AUTH TESTS ====================

class TestAuth:
    def test_register(self, client):
        """New user registration creates account with coins."""
        uname = f"pytest_{os.getpid()}"
        r = client.post("/register", json={"username": uname, "password": "pass123"})
        if r.status_code == 200:
            d = r.json()
            assert d["success"] is True
            assert d["user"]["username"] == uname
            assert d["user"]["coins"] == 1500000
            assert d["user"]["role"] == "usuario"

    def test_login_case_insensitive(self, client):
        """Login works regardless of username case."""
        r = client.post("/login", json={"username": "melvin_live", "password": "test123"})
        assert r.status_code == 200
        assert r.json()["user"]["username"] == "Melvin_Live"

    def test_login_wrong_password(self, client):
        """Wrong password returns 401."""
        r = client.post("/login", json={"username": "Melvin_Live", "password": "wrong"})
        assert r.status_code == 401

    def test_get_user(self, client, admin_token):
        """Get user by ID returns profile."""
        r = client.get(f"/users/{admin_token['id']}")
        assert r.status_code == 200
        assert r.json()["username"] == "Melvin_Live"

    def test_search_user(self, client):
        """Search by username returns user."""
        r = client.get("/users/search/Melvin_Live")
        # May be hidden by ghost mode
        assert r.status_code in (200, 404)

    def test_rankings_coins(self, client):
        """Rankings returns list of users sorted by coins."""
        r = client.get("/rankings/coins")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if len(data) > 1:
            assert data[0]["coins"] >= data[1]["coins"]

    def test_rankings_level(self, client):
        """Level rankings returns sorted list."""
        r = client.get("/rankings/level")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

# ==================== ROOM TESTS ====================

class TestRooms:
    def test_get_rooms(self, client):
        """List all rooms."""
        r = client.get("/rooms")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_my_room(self, client, admin_token):
        """Get or create user's room."""
        r = client.post(f"/rooms/my-room?user_id={admin_token['id']}")
        assert r.status_code == 200
        room = r.json()
        assert room["owner_id"] == admin_token["id"]
        assert len(room.get("seats", [])) == 9

    def test_get_room(self, client):
        """Get room by ID."""
        rooms = client.get("/rooms").json()
        if rooms:
            r = client.get(f"/rooms/{rooms[0]['id']}")
            assert r.status_code == 200
            assert "seats" in r.json()

    def test_join_leave_seat(self, client, admin_token):
        """Join and leave a seat in a room."""
        room = client.post(f"/rooms/my-room?user_id={admin_token['id']}").json()
        rid = room["id"]
        uid = admin_token["id"]
        # Join seat 0
        r = client.post(f"/rooms/{rid}/join?user_id={uid}&seat_index=0")
        assert r.status_code == 200
        # Leave
        r = client.post(f"/rooms/{rid}/leave?user_id={uid}")
        assert r.status_code == 200

    def test_chat_send_get(self, client, admin_token):
        """Send and retrieve chat messages."""
        room = client.post(f"/rooms/my-room?user_id={admin_token['id']}").json()
        rid = room["id"]
        # Send
        r = client.post(f"/rooms/{rid}/chat", json={"user_id": admin_token["id"], "text": "pytest msg"})
        assert r.status_code == 200
        # Get
        r = client.get(f"/rooms/{rid}/chat?limit=5")
        assert r.status_code == 200
        msgs = r.json()
        assert any("pytest msg" in m.get("text", "") for m in msgs)

# ==================== GAME TESTS ====================

class TestGames:
    GAME_TYPES = ['ludo', 'yacaro', 'carreras', 'pool', 'domino', 'monster', 'ruleta', 'dados', 'rps', 'slots', 'carta']

    @pytest.mark.parametrize("game", GAME_TYPES)
    def test_play_game(self, client, admin_token, game):
        """Each game type deducts coins and returns result with game_data."""
        r = client.post("/games/play", json={
            "user_id": admin_token["id"], "game": game, "bet": 100
        })
        assert r.status_code == 200
        data = r.json()
        assert "won" in data
        assert "new_balance" in data
        if game in ('ludo', 'yacaro', 'carreras', 'pool', 'domino', 'monster'):
            assert "game_data" in data

    def test_insufficient_coins(self, client, test_user):
        """Playing with insufficient coins fails."""
        r = client.post("/games/play", json={
            "user_id": test_user["id"], "game": "ludo", "bet": 999999999999
        })
        assert r.status_code == 400

# ==================== EVENT TESTS ====================

class TestEvents:
    def test_request_event(self, client, test_user):
        """User can request a King event."""
        r = client.post("/events/request", json={
            "user_id": test_user["id"], "event_type": "king"
        })
        # May succeed or fail if already requested this month
        assert r.status_code in (200, 400)

    def test_get_my_events(self, client, test_user):
        """User can see their event requests."""
        r = client.get(f"/events/my-events/{test_user['id']}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_event_requests_admin(self, client, admin_token):
        """Admin can see pending requests."""
        r = client.get(f"/events/requests?admin_id={admin_token['id']}")
        assert r.status_code == 200

    def test_cashback(self, client, admin_token):
        """Cashback endpoint works."""
        r = client.post(f"/events/cashback?admin_id={admin_token['id']}")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_event_history(self, client):
        """Event history returns list."""
        r = client.get("/events/history")
        assert r.status_code == 200

# ==================== BOT TESTS ====================

class TestBot:
    def test_bot_command(self, client, admin_token):
        """Bot responds to direct commands."""
        r = client.post("/bot/command", json={
            "admin_id": admin_token["id"],
            "message": "Hola bot, como estas?"
        })
        assert r.status_code == 200
        assert "response" in r.json()

    def test_activate_all_rooms(self, client, admin_token):
        """Admin can activate bot in all rooms."""
        r = client.post(f"/bot/activate-all-rooms?admin_id={admin_token['id']}")
        assert r.status_code == 200
        assert r.json()["activated"] > 0

    def test_deactivate_all_rooms(self, client, admin_token):
        """Admin can deactivate bot from all rooms."""
        r = client.post(f"/bot/deactivate-all-rooms?admin_id={admin_token['id']}")
        assert r.status_code == 200

# ==================== ADMIN TESTS ====================

class TestAdmin:
    def test_admin_stats(self, client, admin_token):
        """Admin dashboard shows stats."""
        r = client.get(f"/admin/stats?admin_id={admin_token['id']}")
        assert r.status_code == 200
        stats = r.json()
        assert "total_users" in stats

    def test_admin_users(self, client, admin_token):
        """Admin can list users."""
        r = client.get(f"/admin/users?admin_id={admin_token['id']}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_config(self, client, admin_token):
        """Admin can get config."""
        r = client.get(f"/admin/config?admin_id={admin_token['id']}")
        assert r.status_code == 200

    def test_non_admin_blocked(self, client, test_user):
        """Non-admin users cannot access admin endpoints."""
        r = client.get(f"/admin/stats?admin_id={test_user['id']}")
        assert r.status_code == 403

# ==================== SOCIAL TESTS ====================

class TestSocial:
    def test_get_clanes(self, client):
        """List all clanes."""
        r = client.get("/clanes")
        assert r.status_code == 200

    def test_get_gifts(self, client):
        """List available gifts."""
        r = client.get("/gifts")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)  # Gifts is a dict keyed by type
        assert len(r.json()) > 0

    def test_get_sobres(self, client):
        """List available sobres."""
        r = client.get("/sobres")
        assert r.status_code == 200

    def test_get_cofres(self, client):
        """List cofres status."""
        rooms = client.get("/rooms").json()
        if rooms:
            r = client.get(f"/rooms/{rooms[0]['id']}/cofres")
            assert r.status_code == 200

# ==================== NOTIFICATION TESTS ====================

class TestNotifications:
    def test_get_notifications(self, client, admin_token):
        """Get user notifications."""
        r = client.get(f"/notifications/{admin_token['id']}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

# ==================== STORE TESTS ====================

class TestStore:
    def test_get_packages(self, client):
        """List store packages."""
        r = client.get("/store/packages")
        assert r.status_code == 200
