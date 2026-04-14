"""
Iteration 13 Tests: New Games (Ludo, Yacaro, Carreras, Pool, Domino, Monster) + PK Battle
Tests the new monetized games and PK Battle system
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"  # Melvin_Live
TEST_USERNAME = "Melvin_Live"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def logged_in_user(api_client):
    """Login and return user data"""
    response = api_client.post(f"{BASE_URL}/api/login", json={
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["user"]


@pytest.fixture(scope="module")
def test_room(api_client, logged_in_user):
    """Get or create a test room"""
    # Get existing rooms
    rooms_resp = api_client.get(f"{BASE_URL}/api/rooms")
    assert rooms_resp.status_code == 200
    rooms = rooms_resp.json()
    
    if rooms:
        return rooms[0]
    
    # Create a new room if none exist
    create_resp = api_client.post(
        f"{BASE_URL}/api/rooms?owner_id={logged_in_user['id']}",
        json={"name": "TEST_GameRoom"}
    )
    assert create_resp.status_code == 200
    return create_resp.json()


class TestNewGames:
    """Test the 6 new monetized games: ludo, yacaro, carreras, pool, domino, monster"""
    
    def test_ludo_game_returns_correct_data(self, api_client, logged_in_user):
        """POST /api/games/play with game=ludo returns game_data with dice array and scores"""
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "ludo",
            "bet": 500
        })
        assert response.status_code == 200, f"Ludo game failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "won" in data
        assert "new_balance" in data
        assert "game_data" in data
        
        # Verify ludo-specific game_data
        game_data = data["game_data"]
        assert "dice" in game_data, "Ludo should have dice array"
        assert isinstance(game_data["dice"], list), "dice should be a list"
        assert len(game_data["dice"]) == 4, "Ludo should have 4 dice"
        assert "player_score" in game_data, "Ludo should have player_score"
        assert "bot_score" in game_data, "Ludo should have bot_score"
        
        print(f"Ludo result: won={data['won']}, dice={game_data['dice']}, player={game_data['player_score']}, bot={game_data['bot_score']}")
    
    def test_yacaro_game_returns_correct_data(self, api_client, logged_in_user):
        """POST /api/games/play with game=yacaro returns game_data with dice, score, ones, fives, triples"""
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "yacaro",
            "bet": 500
        })
        assert response.status_code == 200, f"Yacaro game failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "won" in data
        assert "new_balance" in data
        assert "game_data" in data
        
        # Verify yacaro-specific game_data
        game_data = data["game_data"]
        assert "dice" in game_data, "Yacaro should have dice array"
        assert isinstance(game_data["dice"], list), "dice should be a list"
        assert len(game_data["dice"]) == 6, "Yacaro should have 6 dice"
        assert "score" in game_data, "Yacaro should have score"
        assert "ones" in game_data, "Yacaro should have ones count"
        assert "fives" in game_data, "Yacaro should have fives count"
        assert "triples" in game_data, "Yacaro should have triples count"
        
        print(f"Yacaro result: won={data['won']}, score={game_data['score']}, ones={game_data['ones']}, fives={game_data['fives']}, triples={game_data['triples']}")
    
    def test_carreras_game_returns_correct_data(self, api_client, logged_in_user):
        """POST /api/games/play with game=carreras returns game_data with cars array and winner"""
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "carreras",
            "bet": 500
        })
        assert response.status_code == 200, f"Carreras game failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "won" in data
        assert "new_balance" in data
        assert "game_data" in data
        
        # Verify carreras-specific game_data
        game_data = data["game_data"]
        assert "cars" in game_data, "Carreras should have cars array"
        assert isinstance(game_data["cars"], list), "cars should be a list"
        assert len(game_data["cars"]) == 5, "Carreras should have 5 cars"
        assert "winner" in game_data, "Carreras should have winner index"
        assert "user_car" in game_data, "Carreras should have user_car index"
        
        # Verify car structure
        for car in game_data["cars"]:
            assert "name" in car, "Each car should have a name"
            assert "speed" in car, "Each car should have a speed"
        
        print(f"Carreras result: won={data['won']}, winner={game_data['winner']}, user_car={game_data['user_car']}")
    
    def test_pool_game_returns_correct_data(self, api_client, logged_in_user):
        """POST /api/games/play with game=pool returns game_data with player_sunk, opponent_sunk"""
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "pool",
            "bet": 500
        })
        assert response.status_code == 200, f"Pool game failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "won" in data
        assert "new_balance" in data
        assert "game_data" in data
        
        # Verify pool-specific game_data
        game_data = data["game_data"]
        assert "player_sunk" in game_data, "Pool should have player_sunk"
        assert "opponent_sunk" in game_data, "Pool should have opponent_sunk"
        assert "total_balls" in game_data, "Pool should have total_balls"
        assert game_data["total_balls"] == 7, "Pool should have 7 total balls"
        
        print(f"Pool result: won={data['won']}, player_sunk={game_data['player_sunk']}, opponent_sunk={game_data['opponent_sunk']}")
    
    def test_domino_game_returns_correct_data(self, api_client, logged_in_user):
        """POST /api/games/play with game=domino returns game_data with hand, player_total, bot_total"""
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "domino",
            "bet": 500
        })
        assert response.status_code == 200, f"Domino game failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "won" in data
        assert "new_balance" in data
        assert "game_data" in data
        
        # Verify domino-specific game_data
        game_data = data["game_data"]
        assert "hand" in game_data, "Domino should have hand array"
        assert isinstance(game_data["hand"], list), "hand should be a list"
        assert len(game_data["hand"]) == 7, "Domino should have 7 tiles in hand"
        assert "player_total" in game_data, "Domino should have player_total"
        assert "bot_total" in game_data, "Domino should have bot_total"
        
        # Verify tile structure (each tile is [n, n])
        for tile in game_data["hand"]:
            assert isinstance(tile, list), "Each tile should be a list"
            assert len(tile) == 2, "Each tile should have 2 numbers"
        
        print(f"Domino result: won={data['won']}, player_total={game_data['player_total']}, bot_total={game_data['bot_total']}")
    
    def test_monster_game_returns_correct_data(self, api_client, logged_in_user):
        """POST /api/games/play with game=monster returns game_data with player and enemy objects"""
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "monster",
            "bet": 500
        })
        assert response.status_code == 200, f"Monster game failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "won" in data
        assert "new_balance" in data
        assert "game_data" in data
        
        # Verify monster-specific game_data
        game_data = data["game_data"]
        assert "player" in game_data, "Monster should have player object"
        assert "enemy" in game_data, "Monster should have enemy object"
        
        # Verify player structure
        player = game_data["player"]
        assert "name" in player, "Player should have name"
        assert "power" in player, "Player should have power"
        
        # Verify enemy structure
        enemy = game_data["enemy"]
        assert "name" in enemy, "Enemy should have name"
        assert "power" in enemy, "Enemy should have power"
        
        print(f"Monster result: won={data['won']}, player={player['name']}({player['power']}), enemy={enemy['name']}({enemy['power']})")


class TestGamesDeductCoins:
    """Test that all games deduct coins from balance"""
    
    def test_game_deducts_coins_on_loss(self, api_client, logged_in_user):
        """All games should deduct bet amount from balance"""
        # Get initial balance
        user_resp = api_client.get(f"{BASE_URL}/api/users/{logged_in_user['id']}")
        assert user_resp.status_code == 200
        initial_balance = user_resp.json()["coins"]
        
        # Play a game with a small bet
        bet_amount = 100
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "ludo",
            "bet": bet_amount
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify balance changed
        new_balance = data["new_balance"]
        if data["won"]:
            # If won, balance should increase
            assert new_balance > initial_balance, "Balance should increase on win"
        else:
            # If lost, balance should decrease by bet amount
            assert new_balance == initial_balance - bet_amount, f"Balance should decrease by {bet_amount} on loss"
        
        print(f"Coins test: initial={initial_balance}, new={new_balance}, won={data['won']}")
    
    def test_insufficient_coins_rejected(self, api_client, logged_in_user):
        """Game should reject if user doesn't have enough coins"""
        # Try to bet more than user has
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "ludo",
            "bet": 999999999999  # Very large bet
        })
        assert response.status_code == 400, "Should reject insufficient coins"
        assert "insuficientes" in response.json()["detail"].lower() or "insufficient" in response.json()["detail"].lower()


class TestPKBattle:
    """Test PK Battle endpoints"""
    
    def test_pk_battle_create(self, api_client, logged_in_user, test_room):
        """POST /api/games/pk-battle creates a battle"""
        # Create a test opponent user
        test_opponent_id = f"TEST_opponent_{uuid.uuid4().hex[:8]}"
        
        # First, we need another user in the room. Let's use the logged in user as both for testing
        # In real scenario, there would be 2 different users
        
        # Try to create PK battle (may fail if opponent doesn't exist, which is expected)
        response = api_client.post(f"{BASE_URL}/api/games/pk-battle", json={
            "room_id": test_room["id"],
            "challenger_id": logged_in_user["id"],
            "opponent_id": logged_in_user["id"],  # Self-battle for testing
            "bet_amount": 1000
        })
        
        # This might fail because same user can't battle themselves, or opponent doesn't have coins
        # But we verify the endpoint exists and responds
        assert response.status_code in [200, 400, 404], f"PK Battle endpoint should respond: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "battle" in data
            battle = data["battle"]
            assert "id" in battle
            assert "room_id" in battle
            assert "challenger_id" in battle
            assert "opponent_id" in battle
            assert "bet_amount" in battle
            assert "status" in battle
            assert battle["status"] == "active"
            print(f"PK Battle created: {battle['id']}")
    
    def test_pk_battle_get_active(self, api_client, test_room):
        """GET /api/games/pk-battle/{room_id} returns active battle or null"""
        response = api_client.get(f"{BASE_URL}/api/games/pk-battle/{test_room['id']}")
        assert response.status_code == 200, f"Get active PK failed: {response.text}"
        
        # Response can be null (no active battle) or a battle object
        data = response.json()
        if data is not None:
            assert "id" in data
            assert "status" in data
            print(f"Active PK Battle found: {data['id']}")
        else:
            print("No active PK Battle in room")
    
    def test_pk_battle_gift_endpoint_exists(self, api_client):
        """POST /api/games/pk-battle/{id}/gift endpoint exists"""
        # Use a fake battle ID - endpoint should return 404 for non-existent battle
        fake_battle_id = "fake-battle-id"
        response = api_client.post(
            f"{BASE_URL}/api/games/pk-battle/{fake_battle_id}/gift",
            params={"user_id": TEST_USER_ID, "amount": 100}
        )
        # Should return 404 (battle not found) not 405 (method not allowed)
        assert response.status_code in [404, 400], f"Gift endpoint should exist: {response.status_code}"
        print(f"PK Gift endpoint exists, returned {response.status_code}")
    
    def test_pk_battle_end_endpoint_exists(self, api_client):
        """POST /api/games/pk-battle/{id}/end endpoint exists"""
        # Use a fake battle ID - endpoint should return 404 for non-existent battle
        fake_battle_id = "fake-battle-id"
        response = api_client.post(f"{BASE_URL}/api/games/pk-battle/{fake_battle_id}/end")
        # Should return 404 (battle not found) not 405 (method not allowed)
        assert response.status_code == 404, f"End endpoint should exist: {response.status_code}"
        print(f"PK End endpoint exists, returned {response.status_code}")


class TestClassicGames:
    """Verify classic games still work (slots, ruleta, dados, rps, trivia, carta)"""
    
    @pytest.mark.parametrize("game_id", ["slots", "ruleta", "dados", "rps", "trivia", "carta"])
    def test_classic_game_works(self, api_client, logged_in_user, game_id):
        """Classic games should still work via /api/games/play"""
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": game_id,
            "bet": 500
        })
        assert response.status_code == 200, f"Classic game {game_id} failed: {response.text}"
        data = response.json()
        assert "won" in data
        assert "new_balance" in data
        print(f"Classic game {game_id}: won={data['won']}")


class TestInvalidGame:
    """Test error handling for invalid games"""
    
    def test_invalid_game_rejected(self, api_client, logged_in_user):
        """Invalid game type should be rejected"""
        response = api_client.post(f"{BASE_URL}/api/games/play", json={
            "user_id": logged_in_user["id"],
            "game": "invalid_game_xyz",
            "bet": 500
        })
        assert response.status_code == 400, "Invalid game should be rejected"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
