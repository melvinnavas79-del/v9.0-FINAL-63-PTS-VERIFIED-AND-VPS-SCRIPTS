"""Iteration 12 backend tests — super-admin override, kick/ban-from-room,
give-diamonds, authority endpoint, firebase/status web key configured."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://codigo-necesario.preview.emergentagent.com").rstrip("/")

MELVIN_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"      # role=dueño / super admin
TARGET_USER_ID = "4bea36c7-5c7f-48b0-ae68-97af4ac8890b"  # "Melvin navas", non-owner
NON_OWNED_ROOM = "585e2dbd-f30e-40a7-8441-d896e86c3e30"  # owner != Melvin_Live


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


# ========== Firebase status (web key) ==========

def test_firebase_status_web_key_configured(s):
    r = s.get(f"{BASE_URL}/api/auth/firebase/status", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("project_id") == "lluvia-live-69a05"
    assert data.get("web_api_key_configured") is True


# ========== Authority endpoint ==========

def test_authority_super_in_foreign_room(s):
    r = s.get(f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/authority/{MELVIN_ID}", timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["level"] == "super"
    assert d["is_room_owner"] is False
    assert d["is_super_admin"] is True
    assert d["can_manage"] is True


def test_authority_none_for_random_user(s):
    r = s.get(f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/authority/nobody-{'x'*8}", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["level"] == "none"
    assert d["can_manage"] is False


def test_authority_room_not_found(s):
    r = s.get(f"{BASE_URL}/api/rooms/does-not-exist-xyz/authority/{MELVIN_ID}", timeout=10)
    assert r.status_code == 404


# ========== give-diamonds ==========

def test_give_diamonds_owner_ok(s):
    # baseline
    r0 = s.get(f"{BASE_URL}/api/users/{TARGET_USER_ID}", timeout=10)
    assert r0.status_code == 200
    before = r0.json().get("diamonds", 0)

    r = s.post(
        f"{BASE_URL}/api/admin/console/give-diamonds",
        params={"admin_id": MELVIN_ID, "target_id": TARGET_USER_ID, "amount": 5},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["success"] is True
    assert "new_diamonds" in data
    assert data["new_diamonds"] >= before + 5

    # revert
    r2 = s.post(
        f"{BASE_URL}/api/admin/console/give-diamonds",
        params={"admin_id": MELVIN_ID, "target_id": TARGET_USER_ID, "amount": -5},
        timeout=10,
    )
    assert r2.status_code == 200


def test_give_diamonds_non_owner_denied(s):
    r = s.post(
        f"{BASE_URL}/api/admin/console/give-diamonds",
        params={"admin_id": TARGET_USER_ID, "target_id": MELVIN_ID, "amount": 100},
        timeout=10,
    )
    assert r.status_code == 403


# ========== Lock-seat / lock-all / unlock-all super override ==========

def test_lock_seat_super_override(s):
    # Toggle seat 0 twice so we end in original state
    r1 = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/lock-seat",
        params={"owner_id": MELVIN_ID, "seat_index": 0},
        timeout=10,
    )
    assert r1.status_code == 200, r1.text
    assert r1.json().get("authority") == "super"
    r2 = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/lock-seat",
        params={"owner_id": MELVIN_ID, "seat_index": 0},
        timeout=10,
    )
    assert r2.status_code == 200


def test_lock_seat_non_owner_denied(s):
    r = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/lock-seat",
        params={"owner_id": TARGET_USER_ID, "seat_index": 0},
        timeout=10,
    )
    assert r.status_code == 403


def test_unlock_all_then_lock_all_super(s):
    # unlock first to baseline
    r = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/unlock-all",
        params={"owner_id": MELVIN_ID},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    # lock-all
    r = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/lock-all",
        params={"owner_id": MELVIN_ID},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    # unlock again
    r = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/unlock-all",
        params={"owner_id": MELVIN_ID},
        timeout=10,
    )
    assert r.status_code == 200


# ========== kick-from-seat + ban-user/unban + join rejection ==========

def test_ban_then_join_rejected_then_unban(s):
    # ensure not banned first
    s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/unban-user",
        params={"admin_id": MELVIN_ID, "target_user_id": TARGET_USER_ID},
        timeout=10,
    )
    # ban via super override
    r = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/ban-user",
        params={"admin_id": MELVIN_ID, "target_user_id": TARGET_USER_ID},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json()["banned"] is True

    # NOTE: serialize_room does NOT expose banned_users to clients (minor data-visibility issue).
    # The functional check is join-403, which proves persistence server-side.

    # join now rejected (unless seat occupied by someone else — try a likely empty seat)
    rj = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/join",
        params={"user_id": TARGET_USER_ID, "seat_index": 5},
        timeout=10,
    )
    assert rj.status_code == 403, rj.text

    # unban
    ru = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/unban-user",
        params={"admin_id": MELVIN_ID, "target_user_id": TARGET_USER_ID},
        timeout=10,
    )
    assert ru.status_code == 200


def test_kick_from_seat_nonexistent_target(s):
    r = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/kick-from-seat",
        params={"admin_id": MELVIN_ID, "target_user_id": "does-not-exist-abc"},
        timeout=10,
    )
    assert r.status_code == 404


def test_kick_from_seat_not_seated_returns_ok(s):
    # target not in seat → should return success=true, kicked=false
    r = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/kick-from-seat",
        params={"admin_id": MELVIN_ID, "target_user_id": TARGET_USER_ID},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["success"] is True
    # either kicked=false (not seated) or kicked=true (was seated)
    assert "kicked" in data


def test_kick_without_authority_denied(s):
    r = s.post(
        f"{BASE_URL}/api/rooms/{NON_OWNED_ROOM}/kick-from-seat",
        params={"admin_id": TARGET_USER_ID, "target_user_id": MELVIN_ID},
        timeout=10,
    )
    assert r.status_code == 403


# ========== Regression iter 11 ==========

def test_regression_search_by_id_930788(s):
    r = s.get(f"{BASE_URL}/api/social/search-by-id/930788", timeout=10)
    assert r.status_code == 200
    assert r.json().get("numeric_id") == "930788"


def test_regression_rooms_list(s):
    r = s.get(f"{BASE_URL}/api/rooms", timeout=10)
    assert r.status_code == 200
    data = r.json()
    rooms = data if isinstance(data, list) else data.get("rooms", [])
    assert len(rooms) >= 1
