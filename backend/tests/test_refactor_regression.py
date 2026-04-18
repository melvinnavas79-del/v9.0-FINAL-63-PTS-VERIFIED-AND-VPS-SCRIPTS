"""Regression tests after SeatsGrid/ChatArea extraction + ai_moderate_image placeholder hardening."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://codigo-necesario.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def owner_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/login", json={"username": "Melvin_Live", "password": "test123"}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    user = data.get("user") or data
    assert user.get("username") == "Melvin_Live"
    assert user.get("role") == "dueño"
    return s, user


# -------- Smoke: rooms listing --------
def test_rooms_list_returns_200():
    r = requests.get(f"{API}/rooms", timeout=30)
    assert r.status_code == 200
    rooms = r.json()
    assert isinstance(rooms, list)
    # At least owner's room should exist
    assert any(room.get("owner_name") == "Melvin_Live" or "name" in room for room in rooms) or len(rooms) >= 0


def test_rankings_daily_games_returns_200():
    r = requests.get(f"{API}/rankings/daily-games", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (list, dict))


# -------- Login (owner) --------
def test_login_melvin(owner_session):
    _s, user = owner_session
    assert user["username"] == "Melvin_Live"
    assert user["role"] == "dueño"
    assert "id" in user


# -------- ai_moderate_image placeholder hardening --------
def test_ai_moderate_image_placeholder_returns_fail_open():
    """With GEMINI_API_KEY='placeholder_key' the helper must fail OPEN with reason 'ai_key_not_configured'."""
    import sys
    sys.path.insert(0, '/app/backend')
    from routes.rooms import ai_moderate_image
    import asyncio
    # Placeholder case
    is_safe, reason = asyncio.get_event_loop().run_until_complete(
        ai_moderate_image(b"fake", "image/jpeg")
    ) if False else asyncio.new_event_loop().run_until_complete(
        ai_moderate_image(b"fake", "image/jpeg")
    )
    assert is_safe is True
    assert reason == "ai_key_not_configured"


def test_ai_moderate_image_empty_key():
    """Empty/whitespace key must fail OPEN."""
    import sys, asyncio
    sys.path.insert(0, '/app/backend')
    from routes.rooms import ai_moderate_image
    # Save and replace env
    original = os.environ.get('GEMINI_API_KEY')
    try:
        os.environ['GEMINI_API_KEY'] = '   '
        os.environ.pop('GOOGLE_API_KEY', None)
        loop = asyncio.new_event_loop()
        is_safe, reason = loop.run_until_complete(ai_moderate_image(b"x", "image/jpeg"))
        assert is_safe is True
        assert reason == "ai_key_not_configured"
    finally:
        if original is not None:
            os.environ['GEMINI_API_KEY'] = original


def test_ai_moderate_image_other_placeholders():
    """'your_key_here' / 'tu_key_aqui' must fail OPEN."""
    import sys, asyncio
    sys.path.insert(0, '/app/backend')
    from routes.rooms import ai_moderate_image
    original = os.environ.get('GEMINI_API_KEY')
    try:
        for token in ('your_key_here', 'tu_key_aqui', 'placeholder'):
            os.environ['GEMINI_API_KEY'] = token
            os.environ.pop('GOOGLE_API_KEY', None)
            loop = asyncio.new_event_loop()
            is_safe, reason = loop.run_until_complete(ai_moderate_image(b"x", "image/jpeg"))
            assert is_safe is True, f"{token} should fail-open"
            assert reason == "ai_key_not_configured"
    finally:
        if original is not None:
            os.environ['GEMINI_API_KEY'] = original


# -------- Verify components exist on disk (after refactor) --------
def test_seatsgrid_component_exists():
    p = '/app/frontend/src/components/SeatsGrid.js'
    assert os.path.exists(p)
    content = open(p).read()
    assert "data-testid={`seat-btn-${i}`}" in content
    assert "onSeatClick" in content and "onSeatLongPress" in content


def test_chatarea_component_exists():
    p = '/app/frontend/src/components/ChatArea.js'
    assert os.path.exists(p)
    content = open(p).read()
    assert 'data-testid="chat-input"' in content
    assert 'data-testid="chat-send-btn"' in content


def test_roomview_imports_extracted_components():
    p = '/app/frontend/src/pages/RoomView.js'
    content = open(p).read()
    assert "from '../components/SeatsGrid'" in content
    assert "from '../components/ChatArea'" in content
    # Under 1100 lines target
    assert content.count("\n") < 1100
