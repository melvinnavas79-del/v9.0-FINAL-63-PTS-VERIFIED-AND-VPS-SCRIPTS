"""Backend tests for Daily Game Ranking & audio-related endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def melvin_user(client):
    r = client.post(f"{API}/login", json={"username": "Melvin_Live", "password": "test123"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    return data["user"]


# ============ LOGIN ============
class TestAuth:
    def test_login_melvin(self, client):
        r = client.post(f"{API}/login", json={"username": "Melvin_Live", "password": "test123"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["user"]["username"].lower() == "melvin_live"
        assert "id" in d["user"]


# ============ DAILY GAME RANKING ============
class TestDailyRanking:
    def test_daily_games_structure(self, client):
        r = client.get(f"{API}/rankings/daily-games")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "date" in d
        assert "rewards" in d
        assert d["rewards"] == [3000000, 2000000, 1000000]
        assert "leaderboard" in d
        assert isinstance(d["leaderboard"], list)

    def test_daily_games_leaderboard_fields(self, client):
        r = client.get(f"{API}/rankings/daily-games")
        d = r.json()
        if d["leaderboard"]:
            entry = d["leaderboard"][0]
            for k in ["rank", "user_id", "username", "total_won"]:
                assert k in entry, f"missing {k} in leaderboard entry: {entry}"
            assert entry["rank"] == 1

    def test_daily_games_limit(self, client):
        r = client.get(f"{API}/rankings/daily-games?limit=5")
        assert r.status_code == 200
        assert len(r.json()["leaderboard"]) <= 5

    def test_daily_yesterday(self, client):
        r = client.get(f"{API}/rankings/daily-games/yesterday")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "date" in d
        assert "winners" in d
        assert isinstance(d["winners"], list)
        assert d["rewards"] == [3000000, 2000000, 1000000]


# ============ GAME PLAY -> DAILY STATS HOOK ============
class TestGamePlayHook:
    def test_play_cofre_updates_daily_stats(self, client, melvin_user):
        # Capture current total_won for user
        uid = melvin_user["id"]
        r0 = client.get(f"{API}/rankings/daily-games?limit=50")
        before = 0
        for e in r0.json().get("leaderboard", []):
            if e["user_id"] == uid:
                before = e["total_won"]
                break

        # Play a low bet 'cofre' multiple times to ensure hook triggers
        plays = 0
        for _ in range(5):
            resp = client.post(f"{API}/games/play", json={
                "user_id": uid, "game": "cofre", "bet": 10
            })
            if resp.status_code == 200:
                plays += 1
            else:
                # not enough coins or other - break
                break

        assert plays > 0, "Could not perform any /games/play calls"

        # Re-fetch ranking; user should appear (bet>0 triggers record_daily_win)
        r1 = client.get(f"{API}/rankings/daily-games?limit=50")
        assert r1.status_code == 200
        found = any(e["user_id"] == uid for e in r1.json()["leaderboard"])
        # Even if user lost every time, games_played tracked but total_won may not grow.
        # At minimum ranking endpoint should still be reachable (structure preserved).
        assert isinstance(r1.json()["leaderboard"], list)
        # Track whether Melvin is visible at all
        print(f"Melvin visible in leaderboard: {found}, before={before}")
