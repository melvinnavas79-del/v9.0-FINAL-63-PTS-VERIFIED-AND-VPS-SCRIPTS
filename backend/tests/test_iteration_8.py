"""
Iteration 8 backend tests — Gift Rankings (daily/weekly/monthly) + Crown endpoint.

Covers:
- GET /api/rankings/gifts?window=daily|weekly|monthly with is_crown on rank 1
- starts_at alignment (Monday of week, day 1 of month)
- GET /api/rankings/gifts/crown returns daily/weekly/monthly kings
- Presence of Melvin_Live in the 3 kings
- GET /api/rankings/gifts/room/{room_id}?window=daily
- Invalid window -> 400
"""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MELVIN_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- /rankings/gifts ----------

@pytest.mark.parametrize("window", ["daily", "weekly", "monthly"])
def test_gifts_leaderboard_status_and_shape(api, window):
    r = api.get(f"{BASE_URL}/api/rankings/gifts", params={"window": window, "limit": 5}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["window"] == window
    assert "starts_at" in data and isinstance(data["starts_at"], str)
    assert "leaderboard" in data and isinstance(data["leaderboard"], list)
    if data["leaderboard"]:
        top = data["leaderboard"][0]
        for key in ("rank", "user_id", "username", "total_spent", "gift_count", "is_crown"):
            assert key in top, f"missing {key} in leaderboard item"
        assert top["rank"] == 1
        assert top["is_crown"] is True
        # rank 2+ should not have is_crown True
        for row in data["leaderboard"][1:]:
            assert row["is_crown"] is False


def test_weekly_starts_on_monday_utc(api):
    r = api.get(f"{BASE_URL}/api/rankings/gifts", params={"window": "weekly"}, timeout=20)
    assert r.status_code == 200
    starts_at = r.json()["starts_at"]
    dt = datetime.fromisoformat(starts_at)
    assert dt.weekday() == 0, f"weekly starts_at should be Monday, got weekday={dt.weekday()} ({starts_at})"
    assert dt.hour == 0 and dt.minute == 0 and dt.second == 0


def test_monthly_starts_on_day_one(api):
    r = api.get(f"{BASE_URL}/api/rankings/gifts", params={"window": "monthly"}, timeout=20)
    assert r.status_code == 200
    starts_at = r.json()["starts_at"]
    dt = datetime.fromisoformat(starts_at)
    assert dt.day == 1, f"monthly starts_at should be day 1, got day={dt.day} ({starts_at})"
    assert dt.hour == 0 and dt.minute == 0


def test_daily_starts_today_midnight(api):
    r = api.get(f"{BASE_URL}/api/rankings/gifts", params={"window": "daily"}, timeout=20)
    assert r.status_code == 200
    starts_at = r.json()["starts_at"]
    dt = datetime.fromisoformat(starts_at)
    now_utc = datetime.now(timezone.utc)
    assert dt.year == now_utc.year and dt.month == now_utc.month and dt.day == now_utc.day
    assert dt.hour == 0 and dt.minute == 0


def test_invalid_window_returns_400(api):
    r = api.get(f"{BASE_URL}/api/rankings/gifts", params={"window": "yearly"}, timeout=20)
    assert r.status_code == 400, r.text


def test_limit_is_clamped(api):
    # limit > 100 should be clamped; should not return 500
    r = api.get(f"{BASE_URL}/api/rankings/gifts", params={"window": "daily", "limit": 500}, timeout=20)
    assert r.status_code == 200
    assert len(r.json().get("leaderboard", [])) <= 100


# ---------- /rankings/gifts/crown ----------

def test_crown_endpoint_shape_and_melvin(api):
    r = api.get(f"{BASE_URL}/api/rankings/gifts/crown", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("daily_king", "weekly_king", "monthly_king"):
        assert key in data, f"missing {key} in crown response"
    # Per seed, Melvin_Live should be the king in all 3 windows
    for key in ("daily_king", "weekly_king", "monthly_king"):
        king = data[key]
        assert king is not None, f"{key} should not be None (seed has gifts)"
        assert king["user_id"] == MELVIN_ID, f"{key} expected Melvin ({MELVIN_ID}), got {king}"
        assert king["is_crown"] is True
        assert king["rank"] == 1


# ---------- /rankings/gifts/room/{room_id} ----------

def test_room_ranking_invalid_window(api):
    r = api.get(f"{BASE_URL}/api/rankings/gifts/room/any-room-id", params={"window": "foo"}, timeout=20)
    assert r.status_code == 400


def test_room_ranking_filters_by_room(api):
    # Find any existing room_id from an actual gift document to exercise the filter path.
    # Fallback: use a fake room id which should just return empty leaderboard (200 OK).
    fake = "nonexistent-room-xyz"
    r = api.get(f"{BASE_URL}/api/rankings/gifts/room/{fake}", params={"window": "daily"}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["room_id"] == fake
    assert data["window"] == "daily"
    assert isinstance(data["leaderboard"], list)
    # No gifts for this fake room → empty list
    assert data["leaderboard"] == []


def test_room_ranking_with_real_room_if_any(api):
    """Opportunistically verify room-scoped filter with a real room from GET /rooms."""
    rr = api.get(f"{BASE_URL}/api/rooms", timeout=20)
    if rr.status_code != 200:
        pytest.skip("/api/rooms not reachable")
    rooms = rr.json() if isinstance(rr.json(), list) else rr.json().get("rooms", [])
    if not rooms:
        pytest.skip("No rooms to test with")
    room_id = rooms[0].get("id")
    if not room_id:
        pytest.skip("Room has no id")
    r = api.get(f"{BASE_URL}/api/rankings/gifts/room/{room_id}", params={"window": "monthly"}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["room_id"] == room_id
    if data["leaderboard"]:
        assert data["leaderboard"][0]["is_crown"] is True
        assert data["leaderboard"][0]["rank"] == 1
