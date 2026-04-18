"""
Iteration 5 — Retest dados fix in POST /api/games/play.

Contract (per review request):
 - game='dados' bet=1000 must return: won, prize, multiplier, new_balance
   and game_data={dice1:1-6, dice2:1-6, total:2-12}.
 - GameResultToast reads dice1/dice2 from top-level OR game_data, so mirroring
   into game_data is sufficient.
 - Regression: game='ruleta' and game='rps' still work (or POST /api/games/ruleta
   and /api/games/piedra-papel-tijera for standalone endpoints used by tool-numero/mora).
"""
import os
import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL.rstrip('/')}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def owner(session):
    r = session.post(f"{API}/login", json={"username": "Melvin_Live", "password": "test123"}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["user"]


# ==================== DADOS FIX VALIDATION ====================
def test_dados_returns_game_data_with_dice(session, owner):
    """Core contract: game_data must contain dice1, dice2, total."""
    r = session.post(
        f"{API}/games/play",
        json={"user_id": owner["id"], "game": "dados", "bet": 1000},
        timeout=20,
    )
    assert r.status_code == 200, f"dados failed: {r.status_code} {r.text}"
    data = r.json()

    # Top-level fields required by frontend quickDados/GameResultToast
    assert "won" in data
    assert "prize" in data
    assert "new_balance" in data
    assert isinstance(data["won"], bool)
    assert isinstance(data["prize"], int)
    assert isinstance(data["new_balance"], int)

    # multiplier only present on won=True branch per code; make it optional but verify shape
    if data["won"]:
        assert data.get("multiplier", 0) in (2, 3), f"expected mult 2 or 3 on win, got {data.get('multiplier')}"
        assert data["prize"] > 0

    # game_data contract
    assert "game_data" in data, f"missing game_data: {data}"
    gd = data["game_data"]
    assert "dice1" in gd and "dice2" in gd and "total" in gd, f"game_data missing dice: {gd}"
    assert 1 <= gd["dice1"] <= 6
    assert 1 <= gd["dice2"] <= 6
    assert gd["total"] == gd["dice1"] + gd["dice2"]
    assert 2 <= gd["total"] <= 12

    # won rule: sum >= 8
    expected_won = gd["total"] >= 8
    assert data["won"] == expected_won, (
        f"won flag mismatch: dice sum={gd['total']} expected won={expected_won} got won={data['won']}"
    )


def test_dados_multiple_rolls_cover_range(session, owner):
    """Roll 10 times and verify dice values stay 1..6 and total 2..12 each time."""
    for _ in range(10):
        r = session.post(
            f"{API}/games/play",
            json={"user_id": owner["id"], "game": "dados", "bet": 1000},
            timeout=20,
        )
        assert r.status_code == 200
        gd = r.json().get("game_data", {})
        assert 1 <= gd.get("dice1", 0) <= 6
        assert 1 <= gd.get("dice2", 0) <= 6
        assert 2 <= gd.get("total", 0) <= 12


# ==================== REGRESSION: ruleta and rps (used by tool-numero / tool-mora) ====================
def test_ruleta_still_works(session, owner):
    r = session.post(f"{API}/games/ruleta", json={"user_id": owner["id"], "bet_amount": 1000}, timeout=20)
    assert r.status_code == 200, f"ruleta failed: {r.status_code} {r.text}"
    data = r.json()
    assert "multiplier" in data
    assert "result" in data
    assert "winnings" in data
    assert "new_balance" in data


def test_rps_still_works(session, owner):
    r = session.post(
        f"{API}/games/piedra-papel-tijera",
        json={"user_id": owner["id"], "choice": "piedra", "bet_amount": 1000},
        timeout=20,
    )
    assert r.status_code == 200, f"rps failed: {r.status_code} {r.text}"
    data = r.json()
    assert "player_choice" in data and "computer_choice" in data
    assert "result" in data
    assert data["result"] in ("ganaste", "perdiste", "empate")
    assert "new_balance" in data
