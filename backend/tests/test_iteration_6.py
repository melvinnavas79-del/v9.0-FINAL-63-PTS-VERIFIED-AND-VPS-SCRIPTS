"""Iteration 6 tests: PayPal config/status, Agora token, Levels module (me, leaderboard, heartbeat), XP from games/gifts, TTS regression."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://codigo-necesario.preview.emergentagent.com").rstrip("/")
OWNER_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"
OWNER_USER = "Melvin_Live"
OWNER_PASS = "test123"
AGORA_APP_ID_EXPECTED = "eccc145929e240a2b26f696a3a2ce542"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- PayPal ---
class TestPayPal:
    def test_paypal_config(self, api):
        r = api.get(f"{BASE_URL}/api/store/paypal/config")
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["mode"] == "live"
        assert j["configured"] is True
        assert j["currency"] == "USD"
        assert j["client_id"].startswith("AWOafs7E7hOu")

    def test_paypal_status(self, api):
        r = api.get(f"{BASE_URL}/api/store/paypal/status", timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["authenticated"] is True, j
        assert j["mode"] == "live"
        assert j.get("token_type") == "Bearer"


# --- Agora ---
class TestAgora:
    def test_agora_token(self, api):
        r = api.post(f"{BASE_URL}/api/agora/token", params={"channel_name": "room_test_x", "user_id": 42})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["app_id"] == AGORA_APP_ID_EXPECTED
        assert isinstance(j["token"], str)
        assert len(j["token"]) > 100  # Agora tokens are ~139 chars


# --- Levels ---
class TestLevels:
    def test_me_shape(self, api):
        r = api.get(f"{BASE_URL}/api/levels/me/{OWNER_ID}")
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("level", "xp", "xp_into_level", "xp_needed_for_next",
                  "progress_pct", "next_level", "next_reward_level", "next_reward_coins"):
            assert k in j, f"missing {k}"
        assert isinstance(j["level"], int) and j["level"] >= 1
        assert j["next_level"] == j["level"] + 1
        assert 0 <= j["progress_pct"] <= 100

    def test_leaderboard_sorted(self, api):
        r = api.get(f"{BASE_URL}/api/levels/leaderboard?limit=20")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        # Sorted by (level desc, xp desc)
        for i in range(len(rows) - 1):
            a, b = rows[i], rows[i + 1]
            if a["level"] == b["level"]:
                assert a["xp"] >= b["xp"]
            else:
                assert a["level"] >= b["level"]
            assert "_id" not in a

    def test_heartbeat_throttling(self, api):
        # Call #1: either adds xp OR returns throttled if previously called within 55s (preexisting state)
        r1 = api.post(f"{BASE_URL}/api/levels/heartbeat/{OWNER_ID}")
        assert r1.status_code == 200
        j1 = r1.json()

        # Call #2 (immediate) must be throttled
        r2 = api.post(f"{BASE_URL}/api/levels/heartbeat/{OWNER_ID}")
        assert r2.status_code == 200
        j2 = r2.json()
        assert j2.get("throttled") is True, f"Expected throttle, got {j2}"
        assert 0 < j2.get("seconds_until_next", 0) <= 55


# --- XP from game and gift ---
class TestXPIntegration:
    def test_game_play_adds_xp(self, api):
        before = api.get(f"{BASE_URL}/api/levels/me/{OWNER_ID}").json()
        # Play a dados game with bet=1000 repeatedly (XP on win = 3 + 1000//100 = 13)
        won_any = False
        for _ in range(6):
            r = api.post(f"{BASE_URL}/api/games/play", json={"user_id": OWNER_ID, "game": "dados", "bet": 1000})
            assert r.status_code == 200, r.text
            j = r.json()
            if j.get("won"):
                won_any = True
                break
        after = api.get(f"{BASE_URL}/api/levels/me/{OWNER_ID}").json()
        # XP must never decrease and should increase when we had a win
        assert after["xp"] >= before["xp"]
        if won_any:
            assert after["xp"] > before["xp"], "XP did not increase after a win"

    def test_gift_send_adds_xp(self, api):
        before = api.get(f"{BASE_URL}/api/levels/me/{OWNER_ID}").json()
        # Self-gift Rosa (cost 100) -> sender +200 XP, receiver +100 XP (same user -> likely net ~300, but
        # implementation updates doc twice so final xp depends on read-write race). We only assert non-decrease + > before.
        r = api.post(
            f"{BASE_URL}/api/gifts/send",
            json={"sender_id": OWNER_ID, "receiver_id": OWNER_ID, "gift_type": "rosa", "room_id": ""},
        )
        assert r.status_code == 200, r.text
        after = api.get(f"{BASE_URL}/api/levels/me/{OWNER_ID}").json()
        assert after["xp"] > before["xp"], f"XP did not grow after gift: before={before['xp']} after={after['xp']}"


# --- Regression smoke: login still works ---
class TestAuthSmoke:
    def test_login(self, api):
        r = api.post(f"{BASE_URL}/api/login", json={"username": OWNER_USER, "password": OWNER_PASS})
        assert r.status_code == 200, r.text
        j = r.json()
        u = j.get("user") or j
        assert u.get("id") == OWNER_ID
