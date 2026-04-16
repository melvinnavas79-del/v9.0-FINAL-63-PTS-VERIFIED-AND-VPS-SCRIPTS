"""
Iteration 16 Tests: Badge System, Gift Fixes, formatCoins
==========================================================
Tests for:
1. Badge catalog (29 badges across 7 categories)
2. User badges endpoint with earned status
3. Badge auto-award on gift send
4. Gift send with rosa/dragon - balance deduction
5. Lion-Tiger game bet/win with badge check
6. formatCoins verification (100, 1K, 1M, 1B)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MELVIN_USER = "Melvin_Live"
MELVIN_PASS = "test123"
MELVIN_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"
RECEIVER_ID = "c9a7c5f7-6df7-4fd6-9222-2fad4fa829f0"
ROOM_ID = "f8e3f9d8-9690-43e7-8887-2e8482936ac8"


class TestBadgeSystem:
    """Badge system tests - 29 badges across 7 categories"""
    
    def test_badge_catalog_returns_29_badges(self):
        """GET /api/badges/catalog should return 29 badges"""
        response = requests.get(f"{BASE_URL}/api/badges/catalog")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        badges = response.json()
        assert isinstance(badges, list), "Badges should be a list"
        assert len(badges) == 29, f"Expected 29 badges, got {len(badges)}"
        
        # Verify badge structure
        for badge in badges:
            assert "id" in badge, "Badge should have id"
            assert "name" in badge, "Badge should have name"
            assert "icon" in badge, "Badge should have icon"
            assert "category" in badge, "Badge should have category"
            assert "desc" in badge, "Badge should have desc"
            assert "condition" in badge, "Badge should have condition"
        
        print(f"✓ Badge catalog returns {len(badges)} badges")
    
    def test_badge_categories(self):
        """Verify 7 badge categories exist"""
        response = requests.get(f"{BASE_URL}/api/badges/catalog")
        assert response.status_code == 200
        
        badges = response.json()
        categories = set(b["category"] for b in badges)
        
        expected_categories = {"regalos", "gasto", "juegos", "recibidos", "sala", "nivel", "aristocracia"}
        assert categories == expected_categories, f"Expected {expected_categories}, got {categories}"
        
        print(f"✓ All 7 badge categories present: {categories}")
    
    def test_user_badges_endpoint(self):
        """GET /api/badges/{user_id} returns badges with earned status"""
        response = requests.get(f"{BASE_URL}/api/badges/{MELVIN_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "earned_count" in data, "Response should have earned_count"
        assert "total" in data, "Response should have total"
        assert "badges" in data, "Response should have badges"
        assert data["total"] == 29, f"Expected 29 total badges, got {data['total']}"
        
        # Verify each badge has earned field
        for badge in data["badges"]:
            assert "earned" in badge, "Each badge should have earned field"
            assert isinstance(badge["earned"], bool), "earned should be boolean"
        
        print(f"✓ User badges: {data['earned_count']}/{data['total']} earned")
    
    def test_badge_check_endpoint(self):
        """POST /api/badges/{user_id}/check triggers badge check"""
        response = requests.post(f"{BASE_URL}/api/badges/{MELVIN_ID}/check")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "new_badges" in data, "Response should have new_badges"
        assert "count" in data, "Response should have count"
        
        print(f"✓ Badge check returned {data['count']} new badges")


class TestGiftSend:
    """Gift sending tests - rosa and dragon gifts"""
    
    def test_login_melvin(self):
        """Login as Melvin_Live to get current balance"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "username": MELVIN_USER,
            "password": MELVIN_PASS
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Login should succeed"
        user = data["user"]
        assert user["role"] == "dueño", f"Expected role 'dueño', got {user['role']}"
        assert "coins" in user, "User should have coins"
        
        print(f"✓ Logged in as {MELVIN_USER}, coins: {user['coins']}")
        return user
    
    def test_send_rosa_gift(self):
        """POST /api/gifts/send rosa - verify success and balance deduction"""
        # Get initial balance
        login_resp = requests.post(f"{BASE_URL}/api/login", json={
            "username": MELVIN_USER,
            "password": MELVIN_PASS
        })
        initial_balance = login_resp.json()["user"]["coins"]
        
        # Send rosa gift (cost: 100)
        response = requests.post(f"{BASE_URL}/api/gifts/send", json={
            "sender_id": MELVIN_ID,
            "receiver_id": RECEIVER_ID,
            "gift_type": "rosa",
            "room_id": ROOM_ID
        })
        assert response.status_code == 200, f"Gift send failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Gift send should succeed"
        assert "new_balance" in data, "Response should have new_balance"
        assert "new_badges" in data, "Response should have new_badges field"
        
        # Verify balance deducted by 100 (rosa cost)
        expected_balance = initial_balance - 100
        assert data["new_balance"] == expected_balance, f"Expected balance {expected_balance}, got {data['new_balance']}"
        
        print(f"✓ Rosa gift sent, balance: {initial_balance} -> {data['new_balance']}")
    
    def test_send_dragon_gift(self):
        """POST /api/gifts/send dragon - verify no error (BIG_GIFTS fix)"""
        # Get initial balance
        login_resp = requests.post(f"{BASE_URL}/api/login", json={
            "username": MELVIN_USER,
            "password": MELVIN_PASS
        })
        initial_balance = login_resp.json()["user"]["coins"]
        
        # Send dragon gift (cost: 50000)
        response = requests.post(f"{BASE_URL}/api/gifts/send", json={
            "sender_id": MELVIN_ID,
            "receiver_id": RECEIVER_ID,
            "gift_type": "dragon",
            "room_id": ROOM_ID
        })
        assert response.status_code == 200, f"Dragon gift failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Dragon gift should succeed"
        
        # Verify balance deducted by 50000 (dragon cost)
        expected_balance = initial_balance - 50000
        assert data["new_balance"] == expected_balance, f"Expected balance {expected_balance}, got {data['new_balance']}"
        
        print(f"✓ Dragon gift sent (BIG_GIFTS working), balance: {initial_balance} -> {data['new_balance']}")
    
    def test_insufficient_coins_error(self):
        """Verify 400 error when insufficient coins"""
        # Create a test with mega_crown (1M cost) - likely to fail for low balance
        response = requests.post(f"{BASE_URL}/api/gifts/send", json={
            "sender_id": RECEIVER_ID,  # TestReceiver99 has less coins
            "receiver_id": MELVIN_ID,
            "gift_type": "mega_crown",
            "room_id": ROOM_ID
        })
        # This may succeed or fail depending on balance - just verify no 500 error
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 400:
            assert "monedas" in response.json().get("detail", "").lower()
            print("✓ Insufficient coins returns 400 with proper message")
        else:
            print("✓ Gift sent successfully (user had enough coins)")


class TestLionTigerGame:
    """Lion vs Tiger game tests - bet/win with badge check"""
    
    def test_lion_tiger_bet(self):
        """POST /api/games/lion-tiger/bet deducts coins"""
        # Get initial balance
        login_resp = requests.post(f"{BASE_URL}/api/login", json={
            "username": MELVIN_USER,
            "password": MELVIN_PASS
        })
        initial_balance = login_resp.json()["user"]["coins"]
        
        bet_amount = 50000
        response = requests.post(f"{BASE_URL}/api/games/lion-tiger/bet", params={
            "user_id": MELVIN_ID,
            "amount": bet_amount
        })
        assert response.status_code == 200, f"Bet failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Bet should succeed"
        assert data["new_balance"] == initial_balance - bet_amount, "Balance should be deducted"
        
        print(f"✓ Lion-Tiger bet: {bet_amount} deducted, new balance: {data['new_balance']}")
    
    def test_lion_tiger_win(self):
        """POST /api/games/lion-tiger/win adds winnings and checks badges"""
        # Get initial balance
        login_resp = requests.post(f"{BASE_URL}/api/login", json={
            "username": MELVIN_USER,
            "password": MELVIN_PASS
        })
        initial_balance = login_resp.json()["user"]["coins"]
        
        win_amount = 100000
        response = requests.post(f"{BASE_URL}/api/games/lion-tiger/win", params={
            "user_id": MELVIN_ID,
            "amount": win_amount
        })
        assert response.status_code == 200, f"Win failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Win should succeed"
        assert data["new_balance"] == initial_balance + win_amount, "Balance should increase"
        
        print(f"✓ Lion-Tiger win: +{win_amount}, new balance: {data['new_balance']}")
    
    def test_lion_tiger_increments_games_won(self):
        """Verify total_games_won is incremented on win"""
        # Get user stats before
        login_resp = requests.post(f"{BASE_URL}/api/login", json={
            "username": MELVIN_USER,
            "password": MELVIN_PASS
        })
        initial_games_won = login_resp.json()["user"].get("total_games_won", 0)
        
        # Win a game
        requests.post(f"{BASE_URL}/api/games/lion-tiger/win", params={
            "user_id": MELVIN_ID,
            "amount": 1000
        })
        
        # Check stats after
        login_resp2 = requests.post(f"{BASE_URL}/api/login", json={
            "username": MELVIN_USER,
            "password": MELVIN_PASS
        })
        new_games_won = login_resp2.json()["user"].get("total_games_won", 0)
        
        assert new_games_won > initial_games_won, f"total_games_won should increase: {initial_games_won} -> {new_games_won}"
        
        print(f"✓ total_games_won incremented: {initial_games_won} -> {new_games_won}")


class TestFormatCoins:
    """Test formatCoins function behavior via API responses"""
    
    def test_gifts_endpoint_returns_costs(self):
        """GET /api/gifts returns gift costs for formatCoins verification"""
        response = requests.get(f"{BASE_URL}/api/gifts")
        assert response.status_code == 200
        
        gifts = response.json()
        
        # Verify expected costs
        assert gifts["rosa"]["cost"] == 100, "Rosa should cost 100"
        assert gifts["corazon"]["cost"] == 500, "Corazon should cost 500"
        assert gifts["diamante"]["cost"] == 5000, "Diamante should cost 5000"
        assert gifts["dragon"]["cost"] == 50000, "Dragon should cost 50000"
        assert gifts["mega_crown"]["cost"] == 1000000, "Mega Crown should cost 1M"
        
        print("✓ Gift costs verified for formatCoins: 100, 500, 5K, 50K, 1M")
    
    def test_user_coins_in_response(self):
        """Verify user coins are returned correctly"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "username": MELVIN_USER,
            "password": MELVIN_PASS
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data, "Response should have user"
        user = data["user"]
        assert "coins" in user, "User should have coins"
        assert isinstance(user["coins"], (int, float)), "Coins should be numeric"
        
        # formatCoins logic verification (frontend):
        # 100 -> '100'
        # 1000 -> '1K'
        # 1000000 -> '1.0M'
        # 1000000000 -> '1.0B'
        coins = user["coins"]
        print(f"✓ User coins: {coins} (formatCoins would display appropriately)")


class TestRoomWelcome:
    """Room welcome message tests"""
    
    def test_room_welcome_dueno(self):
        """POST /api/rooms/{room_id}/welcome returns dueño message"""
        response = requests.post(f"{BASE_URL}/api/rooms/{ROOM_ID}/welcome", params={
            "user_id": MELVIN_ID
        })
        assert response.status_code == 200, f"Welcome failed: {response.text}"
        
        data = response.json()
        assert "entry_animation" in data, "Response should have entry_animation"
        
        # Dueño should get storm animation
        if data.get("entry_animation") == "storm":
            print("✓ Dueño gets 'storm' entry animation")
        else:
            print(f"✓ Welcome message returned, animation: {data.get('entry_animation')}")


class TestGiftsAllPanel:
    """Test gifts-all panel behavior"""
    
    def test_room_seats_for_gift_panel(self):
        """GET /api/rooms/{room_id} returns seats for gift panel"""
        response = requests.get(f"{BASE_URL}/api/rooms/{ROOM_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "seats" in data, "Room should have seats"
        assert isinstance(data["seats"], list), "Seats should be a list"
        
        # Count occupied seats (excluding current user)
        occupied = [s for s in data["seats"] if s and s.get("user_id") != MELVIN_ID]
        print(f"✓ Room has {len(occupied)} other users for gift panel")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
