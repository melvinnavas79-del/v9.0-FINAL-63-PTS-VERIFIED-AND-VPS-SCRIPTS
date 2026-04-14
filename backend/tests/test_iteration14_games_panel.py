"""
Iteration 14 Tests: Games Panel Redesign
- Tests for the new games panel with 8 games in 4-column grid
- Game IDs: tablita->yacaro, pk->rps, ludo->ludo, uno->carta, domino->domino, monster->monster, corona->pool, jackaroo->yacaro
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_USER_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"  # Melvin_Live

class TestGamesPlayEndpoint:
    """Test POST /api/games/play endpoint for all game types"""
    
    def test_ludo_game(self):
        """Test LUDO game - dice battle"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "ludo",
            "bet": 1000
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "won" in data
        assert "new_balance" in data
        assert "game_data" in data
        
        # Verify LUDO-specific game_data
        gd = data["game_data"]
        assert "dice" in gd, "LUDO should have dice array"
        assert len(gd["dice"]) == 4, "LUDO should have 4 dice"
        assert "player_score" in gd
        assert "bot_score" in gd
        print(f"LUDO: dice={gd['dice']}, player={gd['player_score']}, bot={gd['bot_score']}, won={data['won']}")
    
    def test_yacaro_game(self):
        """Test Yacaro/Tablita game - greedy dice"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "yacaro",
            "bet": 1000
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "game_data" in data
        gd = data["game_data"]
        assert "dice" in gd, "Yacaro should have dice array"
        assert len(gd["dice"]) == 6, "Yacaro should have 6 dice"
        assert "score" in gd
        assert "ones" in gd
        assert "fives" in gd
        print(f"Yacaro: dice={gd['dice']}, score={gd['score']}, won={data['won']}")
    
    def test_domino_game(self):
        """Test Domino game - score comparison"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "domino",
            "bet": 1000
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "game_data" in data
        gd = data["game_data"]
        assert "hand" in gd, "Domino should have hand array"
        assert len(gd["hand"]) == 7, "Domino should have 7 tiles"
        assert "player_total" in gd
        assert "bot_total" in gd
        print(f"Domino: player_total={gd['player_total']}, bot_total={gd['bot_total']}, won={data['won']}")
    
    def test_pool_game(self):
        """Test Pool/Corona game - billiards"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "pool",
            "bet": 1000
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "game_data" in data
        gd = data["game_data"]
        assert "player_sunk" in gd
        assert "opponent_sunk" in gd
        assert "total_balls" in gd
        assert gd["total_balls"] == 7
        print(f"Pool: player_sunk={gd['player_sunk']}, opponent_sunk={gd['opponent_sunk']}, won={data['won']}")
    
    def test_monster_game(self):
        """Test Monster/Eliminacion game - monster battle"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "monster",
            "bet": 1000
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "game_data" in data
        gd = data["game_data"]
        assert "player" in gd
        assert "enemy" in gd
        assert "name" in gd["player"]
        assert "power" in gd["player"]
        assert "name" in gd["enemy"]
        assert "power" in gd["enemy"]
        print(f"Monster: player={gd['player']}, enemy={gd['enemy']}, won={data['won']}")
    
    def test_carta_game(self):
        """Test Carta/UNO game - card game"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "carta",
            "bet": 1000
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "won" in data
        assert "new_balance" in data
        print(f"Carta: won={data['won']}, prize={data.get('prize', 0)}")
    
    def test_rps_game(self):
        """Test RPS/PK game - rock paper scissors"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "rps",
            "bet": 1000
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "won" in data
        assert "new_balance" in data
        print(f"RPS: won={data['won']}, prize={data.get('prize', 0)}")


class TestPKBattleEndpoints:
    """Test PK Battle endpoints"""
    
    def test_get_active_pk_battle(self):
        """Test GET /api/games/pk-battle/{room_id}"""
        room_id = "f8e3f9d8-9690-43e7-8887-2e8482936ac8"  # Mi Sala Live
        response = requests.get(f"{BASE_URL}/api/games/pk-battle/{room_id}")
        # Should return 200 with null or battle object
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"PK Battle status: {response.json()}")


class TestInsufficientCoins:
    """Test error handling for insufficient coins"""
    
    def test_insufficient_coins_error(self):
        """Test that betting more than balance returns 400"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "ludo",
            "bet": 999999999999  # Very high bet
        })
        assert response.status_code == 400, f"Expected 400 for insufficient coins, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"Insufficient coins error: {data['detail']}")


class TestInvalidGame:
    """Test error handling for invalid game type"""
    
    def test_invalid_game_type(self):
        """Test that invalid game type returns 400"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "invalid_game_xyz",
            "bet": 1000
        })
        assert response.status_code == 400, f"Expected 400 for invalid game, got {response.status_code}"
        print(f"Invalid game error: {response.json()}")


class TestClassicGames:
    """Test classic games still work"""
    
    def test_slots_game(self):
        """Test slots game"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "slots",
            "bet": 1000
        })
        assert response.status_code == 200
        data = response.json()
        assert "game_data" in data
        assert "reels" in data["game_data"]
        print(f"Slots: reels={data['game_data']['reels']}, won={data['won']}")
    
    def test_ruleta_game(self):
        """Test ruleta game"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "ruleta",
            "bet": 1000
        })
        assert response.status_code == 200
        data = response.json()
        assert "won" in data
        print(f"Ruleta: won={data['won']}")
    
    def test_dados_game(self):
        """Test dados game"""
        response = requests.post(f"{BASE_URL}/api/games/play", json={
            "user_id": TEST_USER_ID,
            "game": "dados",
            "bet": 1000
        })
        assert response.status_code == 200
        data = response.json()
        assert "won" in data
        print(f"Dados: won={data['won']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
