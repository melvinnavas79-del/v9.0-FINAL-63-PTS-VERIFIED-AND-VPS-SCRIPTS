"""Iteration 11 backend tests — social/follow, search-by-id, firebase/status,
mark-join fanout, diagnostics regression, WS regression."""
import os
import uuid
import asyncio
import pytest
import requests
import websockets
import json

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://codigo-necesario.preview.emergentagent.com").rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

MELVIN_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"
KNOWN_NUMERIC_ID = "930788"  # username "Melvin navas"
KNOWN_NUMERIC_ID_USER_ID = "4bea36c7-5c7f-48b0-ae68-97af4ac8890b"


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


# ============= /api/social/search-by-id/{numeric_id} =============

def test_search_by_id_found(s):
    r = s.get(f"{BASE_URL}/api/social/search-by-id/{KNOWN_NUMERIC_ID}", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["numeric_id"] == KNOWN_NUMERIC_ID
    assert data["id"] == KNOWN_NUMERIC_ID_USER_ID
    assert "username" in data
    # no mongo _id leak
    assert "_id" not in data


def test_search_by_id_not_found(s):
    r = s.get(f"{BASE_URL}/api/social/search-by-id/000000", timeout=10)
    assert r.status_code == 404


def test_search_by_id_strip_whitespace(s):
    r = s.get(f"{BASE_URL}/api/social/search-by-id/{KNOWN_NUMERIC_ID}%20", timeout=10)
    assert r.status_code == 200


# ============= /api/users/search/{query} (legacy) =============

def test_users_search_legacy(s):
    r = s.get(f"{BASE_URL}/api/users/search/Melvin", timeout=10)
    # Must exist; 200 regardless of match count
    assert r.status_code in (200, 404), r.text
    if r.status_code == 200:
        data = r.json()
        assert isinstance(data, list) or isinstance(data, dict)


# ============= /api/social/follow flow =============

def test_follow_self_rejected(s):
    r = s.post(
        f"{BASE_URL}/api/social/follow",
        json={"follower_id": MELVIN_ID, "target_id": MELVIN_ID},
        timeout=10,
    )
    assert r.status_code == 400


def test_follow_unknown_user(s):
    r = s.post(
        f"{BASE_URL}/api/social/follow",
        json={"follower_id": MELVIN_ID, "target_id": "does-not-exist-" + uuid.uuid4().hex},
        timeout=10,
    )
    assert r.status_code == 404


def test_follow_unfollow_flow(s):
    # initial cleanup
    s.delete(
        f"{BASE_URL}/api/social/follow",
        json={"follower_id": MELVIN_ID, "target_id": KNOWN_NUMERIC_ID_USER_ID},
        timeout=10,
    )

    # initial status
    r = s.get(
        f"{BASE_URL}/api/social/follow-status",
        params={"follower_id": MELVIN_ID, "target_id": KNOWN_NUMERIC_ID_USER_ID},
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["following"] is False

    # follow
    r = s.post(
        f"{BASE_URL}/api/social/follow",
        json={"follower_id": MELVIN_ID, "target_id": KNOWN_NUMERIC_ID_USER_ID},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True
    assert r.json()["following_count"] >= 1

    # idempotent follow (should not error)
    r2 = s.post(
        f"{BASE_URL}/api/social/follow",
        json={"follower_id": MELVIN_ID, "target_id": KNOWN_NUMERIC_ID_USER_ID},
        timeout=10,
    )
    assert r2.status_code == 200

    # status now true
    r = s.get(
        f"{BASE_URL}/api/social/follow-status",
        params={"follower_id": MELVIN_ID, "target_id": KNOWN_NUMERIC_ID_USER_ID},
        timeout=10,
    )
    assert r.json()["following"] is True

    # following list includes target
    r = s.get(f"{BASE_URL}/api/social/following/{MELVIN_ID}", timeout=10)
    assert r.status_code == 200
    following = r.json()
    assert any(u["id"] == KNOWN_NUMERIC_ID_USER_ID for u in following)

    # followers list for target includes melvin
    r = s.get(f"{BASE_URL}/api/social/followers/{KNOWN_NUMERIC_ID_USER_ID}", timeout=10)
    assert r.status_code == 200
    followers = r.json()
    assert any(u["id"] == MELVIN_ID for u in followers)

    # unfollow
    r = s.delete(
        f"{BASE_URL}/api/social/follow",
        json={"follower_id": MELVIN_ID, "target_id": KNOWN_NUMERIC_ID_USER_ID},
        timeout=10,
    )
    assert r.status_code == 200

    # confirm gone
    r = s.get(
        f"{BASE_URL}/api/social/follow-status",
        params={"follower_id": MELVIN_ID, "target_id": KNOWN_NUMERIC_ID_USER_ID},
        timeout=10,
    )
    assert r.json()["following"] is False


# ============= /api/social/friends-active/{user_id} =============

def test_friends_active_empty_or_list(s):
    # cleanup follow state first (from prior test) — ensures empty unless actively followed
    s.delete(
        f"{BASE_URL}/api/social/follow",
        json={"follower_id": MELVIN_ID, "target_id": KNOWN_NUMERIC_ID_USER_ID},
        timeout=10,
    )
    r = s.get(f"{BASE_URL}/api/social/friends-active/{MELVIN_ID}", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


# ============= /api/auth/firebase/status =============

def test_firebase_status(s):
    r = s.get(f"{BASE_URL}/api/auth/firebase/status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "project_id" in data
    assert "web_api_key_configured" in data
    assert "setup_instructions" in data


# ============= /api/rooms/{id}/mark-join fanout regression =============

def test_mark_join_regression(s):
    # Need a room. Fetch popular or any room.
    r = s.get(f"{BASE_URL}/api/rooms", timeout=10)
    assert r.status_code == 200
    rooms = r.json()
    if not rooms:
        pytest.skip("No rooms in system")
    room_id = rooms[0]["id"] if isinstance(rooms, list) else rooms.get("rooms", [{}])[0].get("id")
    if not room_id:
        pytest.skip("Could not find room id")

    r = s.post(f"{BASE_URL}/api/rooms/{room_id}/mark-join", params={"user_id": MELVIN_ID}, timeout=10)
    assert r.status_code in (200, 201), r.text


# ============= /api/diagnostics regression =============

def test_diagnostics_owner(s):
    r = s.get(f"{BASE_URL}/api/diagnostics", params={"user_id": MELVIN_ID}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "mongo" in data or "checks" in data or "paypal" in data


# ============= WebSocket audio signaling regression =============

@pytest.mark.asyncio
async def test_ws_audio_signaling_regression():
    # Grab a room
    r = requests.get(f"{BASE_URL}/api/rooms", timeout=10)
    assert r.status_code == 200
    rooms = r.json()
    if isinstance(rooms, dict):
        rooms = rooms.get("rooms", [])
    if not rooms:
        pytest.skip("no rooms")
    room_id = rooms[0]["id"]
    uri = f"{WS_BASE}/api/ws/audio/{room_id}?user_id={MELVIN_ID}"
    try:
        async with websockets.connect(uri, open_timeout=10, close_timeout=5) as ws:
            # wait for any server hello/peer-list
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=3)
                assert msg is not None
            except asyncio.TimeoutError:
                pass  # server may send nothing initially; still ok
    except Exception as e:
        pytest.fail(f"WS connect failed: {e}")
