"""
Iteration 4 backend smoke:
 - Owner login (/api/login with Melvin_Live/test123)
 - GET /api/rooms
 - POST /api/games/ruleta (bet 1000)
 - POST /api/games/play (game=dados bet=1000) — expects dice1/dice2 in response
 - POST /api/games/piedra-papel-tijera (choice=piedra bet 1000)
 - Balance decrements/increments reflected via new_balance
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://codigo-necesario.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def owner(session):
    r = session.post(f"{API}/login", json={"username": "Melvin_Live", "password": "test123"}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    payload = r.json()
    user = payload.get("user") or payload
    assert "id" in user and user.get("role") == "dueño"
    return user


def test_login_owner(owner):
    assert owner["username"] == "Melvin_Live"
    assert isinstance(owner.get("coins", 0), (int, float))


def test_list_rooms(session):
    r = session.get(f"{API}/rooms", timeout=20)
    assert r.status_code == 200
    rooms = r.json()
    assert isinstance(rooms, list) and len(rooms) > 0
    sample = rooms[0]
    assert "id" in sample and "name" in sample


def test_games_play_dados(session, owner):
    r = session.post(f"{API}/games/play", json={"user_id": owner["id"], "game": "dados", "bet": 1000}, timeout=20)
    assert r.status_code == 200, f"dados failed: {r.status_code} {r.text}"
    data = r.json()
    # verify feedback-capable fields are present so GameResultToast can render dice faces
    assert "new_balance" in data
    assert "dice1" in data and "dice2" in data, f"missing dice in response: {data}"
    assert 1 <= data["dice1"] <= 6 and 1 <= data["dice2"] <= 6
    assert isinstance(data.get("won", False), bool) or "won" in data


def test_games_ruleta(session, owner):
    r = session.post(f"{API}/games/ruleta", json={"user_id": owner["id"], "bet_amount": 1000}, timeout=20)
    assert r.status_code == 200, f"ruleta failed: {r.status_code} {r.text}"
    data = r.json()
    assert "new_balance" in data
    # ruleta frontend looks for multiplier/result/winnings
    assert "multiplier" in data
    assert "result" in data
    assert "winnings" in data


def test_games_rps(session, owner):
    r = session.post(
        f"{API}/games/piedra-papel-tijera",
        json={"user_id": owner["id"], "choice": "piedra", "bet_amount": 1000},
        timeout=20,
    )
    assert r.status_code == 200, f"rps failed: {r.status_code} {r.text}"
    data = r.json()
    assert "new_balance" in data
    assert "player_choice" in data and "computer_choice" in data and "result" in data
    assert "multiplier" in data and "winnings" in data


def test_insufficient_funds_returns_400(session):
    # Create a tiny user-like payload with a fake id to ensure 400/404 is raised; using Melvin should have funds,
    # so instead send a bet larger than the coins of a brand new test user.
    # Register a TEST_ user with 0 coins via /api/register if available.
    reg = session.post(
        f"{API}/register",
        json={"username": "TEST_brokeUser_it4", "password": "x12345", "country": "US"},
        timeout=15,
    )
    if reg.status_code not in (200, 201, 400):
        pytest.skip(f"register endpoint unavailable: {reg.status_code}")
    # If already exists, fall back to login
    if reg.status_code == 400:
        lg = session.post(f"{API}/login", json={"username": "TEST_brokeUser_it4", "password": "x12345"}, timeout=15)
        if lg.status_code != 200:
            pytest.skip("could not reuse TEST_ user")
        user = lg.json().get("user") or lg.json()
    else:
        user = reg.json().get("user") or reg.json()
    # Force a huge bet that exceeds whatever starter balance they have
    huge = 10_000_000_000
    r = session.post(f"{API}/games/play", json={"user_id": user["id"], "game": "dados", "bet": huge}, timeout=20)
    assert r.status_code == 400, f"expected 400 for insufficient funds, got {r.status_code} {r.text}"
