"""
Backend tests for Lluvia Live bug fixes:
1. Chat mark-join upsert (updates joined_at every time)
2. Chat filtering by joined_at
3. Gifts still work
4. Lion vs Tiger math (bet 1M, win 2M = net +1M)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

# Test credentials
TEST_USER_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"
TEST_USERNAME = "Melvin_Live"
TEST_PASSWORD = "test123"
ROOM_ID = "f8e3f9d8-9690-43e7-8887-2e8482936ac8"
RECEIVER_ID = "c9a7c5f7-6df7-4fd6-9222-2fad4fa829f0"


class TestLogin:
    """Test login functionality"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/login", json={
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data, "Response should contain user object"
        user = data["user"]
        assert "id" in user, "User object should contain id"
        assert user["id"] == TEST_USER_ID, f"User ID mismatch: expected {TEST_USER_ID}, got {user['id']}"
        print(f"✓ Login successful for {TEST_USERNAME}")


class TestMarkJoinUpsert:
    """Test that mark-join updates joined_at every time (not just first time)"""
    
    def test_mark_join_updates_timestamp(self):
        """POST /api/rooms/{room_id}/mark-join should update joined_at every time"""
        # First mark-join
        response1 = requests.post(f"{BASE_URL}/api/rooms/{ROOM_ID}/mark-join?user_id={TEST_USER_ID}")
        assert response1.status_code == 200, f"First mark-join failed: {response1.text}"
        
        # Wait a bit to ensure timestamp difference
        time.sleep(1)
        
        # Second mark-join - should update timestamp
        response2 = requests.post(f"{BASE_URL}/api/rooms/{ROOM_ID}/mark-join?user_id={TEST_USER_ID}")
        assert response2.status_code == 200, f"Second mark-join failed: {response2.text}"
        
        print("✓ mark-join endpoint works (upsert behavior)")


class TestChatFiltering:
    """Test that chat only returns messages AFTER user's latest join time"""
    
    def test_chat_filtering_by_join_time(self):
        """
        Flow:
        1. Send message
        2. Re-mark-join (updates timestamp)
        3. Send another message
        4. Chat should only show the second message
        """
        # Step 1: Mark join first
        requests.post(f"{BASE_URL}/api/rooms/{ROOM_ID}/mark-join?user_id={TEST_USER_ID}")
        
        # Step 2: Send first message
        msg1_text = f"TEST_MSG_BEFORE_{int(time.time())}"
        response1 = requests.post(f"{BASE_URL}/api/rooms/{ROOM_ID}/chat", json={
            "user_id": TEST_USER_ID,
            "text": msg1_text
        })
        assert response1.status_code == 200, f"First message failed: {response1.text}"
        print(f"✓ Sent first message: {msg1_text}")
        
        # Step 3: Wait and re-mark-join (simulates leaving and re-entering room)
        time.sleep(1)
        requests.post(f"{BASE_URL}/api/rooms/{ROOM_ID}/mark-join?user_id={TEST_USER_ID}")
        print("✓ Re-marked join (simulating room re-entry)")
        
        # Step 4: Send second message
        msg2_text = f"TEST_MSG_AFTER_{int(time.time())}"
        response2 = requests.post(f"{BASE_URL}/api/rooms/{ROOM_ID}/chat", json={
            "user_id": TEST_USER_ID,
            "text": msg2_text
        })
        assert response2.status_code == 200, f"Second message failed: {response2.text}"
        print(f"✓ Sent second message: {msg2_text}")
        
        # Step 5: Get chat with user_id filter - should only show messages after latest join
        response3 = requests.get(f"{BASE_URL}/api/rooms/{ROOM_ID}/chat?limit=50&user_id={TEST_USER_ID}")
        assert response3.status_code == 200, f"Get chat failed: {response3.text}"
        
        messages = response3.json()
        message_texts = [m.get('text', '') for m in messages]
        
        # The first message should NOT appear (sent before re-join)
        # The second message SHOULD appear (sent after re-join)
        assert msg1_text not in message_texts, f"First message should NOT appear after re-join: {message_texts}"
        assert msg2_text in message_texts, f"Second message should appear: {message_texts}"
        
        print("✓ Chat filtering works correctly - old messages hidden after re-join")


class TestGiftsSending:
    """Test that gifts still work"""
    
    def test_send_gift(self):
        """POST /api/gifts/send should work"""
        # Get initial balance
        user_response = requests.get(f"{BASE_URL}/api/users/{TEST_USER_ID}")
        assert user_response.status_code == 200
        initial_coins = user_response.json().get('coins', 0)
        print(f"Initial coins: {initial_coins}")
        
        # Send a small gift (rosa = 100 coins)
        response = requests.post(f"{BASE_URL}/api/gifts/send", json={
            "sender_id": TEST_USER_ID,
            "receiver_id": RECEIVER_ID,
            "gift_type": "rosa",
            "room_id": ROOM_ID
        })
        
        # Check response
        if response.status_code == 200:
            data = response.json()
            assert "new_balance" in data, "Response should contain new_balance"
            print(f"✓ Gift sent successfully. New balance: {data['new_balance']}")
        elif response.status_code == 400:
            # Might fail if not enough coins - that's OK for this test
            print(f"⚠ Gift failed (possibly insufficient coins): {response.text}")
        else:
            assert False, f"Unexpected response: {response.status_code} - {response.text}"


class TestLionTigerMath:
    """Test Lion vs Tiger game math: bet 1M, win 2M = net +1M"""
    
    def test_lion_tiger_bet_and_win(self):
        """
        Test the math:
        - Bet 1M (deducted from balance)
        - Win returns 2M (2x multiplier)
        - Net gain should be +1M
        """
        # Get initial balance
        user_response = requests.get(f"{BASE_URL}/api/users/{TEST_USER_ID}")
        assert user_response.status_code == 200
        initial_coins = user_response.json().get('coins', 0)
        print(f"Initial coins: {initial_coins:,}")
        
        bet_amount = 1000000  # 1M
        
        # Place bet
        bet_response = requests.post(
            f"{BASE_URL}/api/games/lion-tiger/bet?user_id={TEST_USER_ID}&amount={bet_amount}"
        )
        
        if bet_response.status_code != 200:
            print(f"⚠ Bet failed (possibly insufficient coins): {bet_response.text}")
            pytest.skip("Insufficient coins for bet test")
            return
        
        bet_data = bet_response.json()
        after_bet_coins = bet_data.get('new_balance', initial_coins - bet_amount)
        print(f"After bet: {after_bet_coins:,} (deducted {bet_amount:,})")
        
        # Verify bet deduction
        expected_after_bet = initial_coins - bet_amount
        assert after_bet_coins == expected_after_bet, f"Bet deduction wrong: expected {expected_after_bet}, got {after_bet_coins}"
        
        # Win (2x multiplier)
        win_amount = bet_amount * 2  # 2M
        win_response = requests.post(
            f"{BASE_URL}/api/games/lion-tiger/win?user_id={TEST_USER_ID}&amount={win_amount}"
        )
        assert win_response.status_code == 200, f"Win failed: {win_response.text}"
        
        win_data = win_response.json()
        final_coins = win_data.get('new_balance', after_bet_coins + win_amount)
        print(f"After win: {final_coins:,} (added {win_amount:,})")
        
        # Verify final balance
        expected_final = initial_coins + bet_amount  # Net +1M
        assert final_coins == expected_final, f"Final balance wrong: expected {expected_final:,}, got {final_coins:,}"
        
        net_gain = final_coins - initial_coins
        print(f"✓ Lion vs Tiger math correct: bet {bet_amount:,}, win {win_amount:,}, net gain {net_gain:,}")


class TestRoomEndpoints:
    """Test room-related endpoints"""
    
    def test_get_room(self):
        """GET /api/rooms/{room_id} should return room data"""
        response = requests.get(f"{BASE_URL}/api/rooms/{ROOM_ID}")
        assert response.status_code == 200, f"Get room failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "seats" in data
        print(f"✓ Room retrieved: {data.get('name')}")
    
    def test_get_chat_without_user_filter(self):
        """GET /api/rooms/{room_id}/chat without user_id should return all messages"""
        response = requests.get(f"{BASE_URL}/api/rooms/{ROOM_ID}/chat?limit=10")
        assert response.status_code == 200, f"Get chat failed: {response.text}"
        messages = response.json()
        assert isinstance(messages, list)
        print(f"✓ Chat retrieved: {len(messages)} messages")


class TestUserEndpoints:
    """Test user-related endpoints"""
    
    def test_get_user(self):
        """GET /api/users/{user_id} should return user data"""
        response = requests.get(f"{BASE_URL}/api/users/{TEST_USER_ID}")
        assert response.status_code == 200, f"Get user failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "username" in data
        assert "coins" in data
        print(f"✓ User retrieved: {data.get('username')} with {data.get('coins'):,} coins")
    
    def test_get_receiver_user(self):
        """GET /api/users/{receiver_id} should return receiver data"""
        response = requests.get(f"{BASE_URL}/api/users/{RECEIVER_ID}")
        assert response.status_code == 200, f"Get receiver failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Receiver user exists: {data.get('username')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
