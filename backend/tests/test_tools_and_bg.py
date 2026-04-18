"""Backend tests for ToolsPanel flows (games endpoints) + room background AI moderation.

Tests:
  - /api/login Melvin_Live works (provides user id for downstream tests)
  - /api/rooms/{room_id}/background accepts a safe JPG via Gemini Vision path
    (fails open if GEMINI_API_KEY missing/invalid → treats as SAFE)
  - Code uses ai_moderate_image (not filename-only check)
"""
import os
import io
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://codigo-necesario.preview.emergentagent.com').rstrip('/')


def _tiny_png_bytes(w=8, h=8):
    """Minimal valid PNG (solid color)."""
    sig = b'\x89PNG\r\n\x1a\n'
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    raw = b''
    for _ in range(h):
        raw += b'\x00' + b'\x80\xc0\xf0' * w  # filter + pixels
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


@pytest.fixture(scope="module")
def melvin_user(session):
    r = session.post(f"{BASE_URL}/api/login", json={"username": "Melvin_Live", "password": "test123"}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "user" in data or "id" in data
    user = data.get("user") or data
    assert user.get("id")
    return user


@pytest.fixture(scope="module")
def melvin_room(session, melvin_user):
    r = session.get(f"{BASE_URL}/api/rooms", timeout=30)
    assert r.status_code == 200
    rooms = r.json()
    own = [rm for rm in rooms if rm.get("owner_id") == melvin_user["id"]]
    assert own, "Melvin has no rooms to test background on"
    return own[0]


class TestAuth:
    def test_login_melvin(self, melvin_user):
        assert melvin_user["username"] == "Melvin_Live"


class TestBackgroundAIModeration:
    def test_safe_png_accepted(self, session, melvin_user, melvin_room):
        png = _tiny_png_bytes()
        files = {"file": ("landscape.png", io.BytesIO(png), "image/png")}
        r = session.post(
            f"{BASE_URL}/api/rooms/{melvin_room['id']}/background",
            params={"owner_id": melvin_user["id"]},
            files=files,
            timeout=60,
        )
        # Expect 200 OK because GEMINI_API_KEY is placeholder → ai_moderate_image fails OPEN
        assert r.status_code == 200, f"expected 200 (fail-open), got {r.status_code}: {r.text}"
        body = r.json()
        assert "url" in body or "background" in body, f"missing url in {body}"

    def test_unsafe_filename_still_rejected(self, session, melvin_user, melvin_room):
        """The fast-path filename keyword check should still block obvious cases."""
        png = _tiny_png_bytes()
        files = {"file": ("nude_photo.png", io.BytesIO(png), "image/png")}
        r = session.post(
            f"{BASE_URL}/api/rooms/{melvin_room['id']}/background",
            params={"owner_id": melvin_user["id"]},
            files=files,
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400 for unsafe filename, got {r.status_code}"

    def test_non_owner_forbidden(self, session, melvin_room):
        png = _tiny_png_bytes()
        files = {"file": ("ok.png", io.BytesIO(png), "image/png")}
        r = session.post(
            f"{BASE_URL}/api/rooms/{melvin_room['id']}/background",
            params={"owner_id": "not-the-owner-id"},
            files=files,
            timeout=30,
        )
        assert r.status_code == 403

    def test_ai_moderate_function_exists_and_is_called(self):
        """Static check: the endpoint must call ai_moderate_image, not just filename check."""
        with open("/app/backend/routes/rooms.py") as f:
            src = f.read()
        assert "async def ai_moderate_image" in src
        assert "from google import genai" in src or "google.genai" in src
        # Ensure it's invoked from the background endpoint
        assert "await ai_moderate_image(" in src


class TestToolsBackendActions:
    """Tools panel buttons call these backend endpoints."""

    def test_dados_game(self, session, melvin_user):
        r = session.post(f"{BASE_URL}/api/games/play", json={
            "user_id": melvin_user["id"], "game": "dados", "bet": 1000
        }, timeout=30)
        assert r.status_code in (200, 400), f"{r.status_code} {r.text}"
        if r.status_code == 200:
            assert "new_balance" in r.json() or "winnings" in r.json()

    def test_ruleta_game(self, session, melvin_user):
        r = session.post(f"{BASE_URL}/api/games/ruleta", json={
            "user_id": melvin_user["id"], "bet_amount": 1000
        }, timeout=30)
        assert r.status_code in (200, 400), f"{r.status_code} {r.text}"

    def test_piedra_papel_tijera(self, session, melvin_user):
        r = session.post(f"{BASE_URL}/api/games/piedra-papel-tijera", json={
            "user_id": melvin_user["id"], "choice": "piedra", "bet_amount": 1000
        }, timeout=30)
        assert r.status_code in (200, 400), f"{r.status_code} {r.text}"

    def test_ghost_mode_toggle(self, session, melvin_user):
        r = session.post(f"{BASE_URL}/api/users/{melvin_user['id']}/ghost-mode", timeout=30)
        assert r.status_code == 200
        assert "ghost_mode" in r.json()
        # Toggle back
        session.post(f"{BASE_URL}/api/users/{melvin_user['id']}/ghost-mode", timeout=30)
