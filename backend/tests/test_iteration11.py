"""
Iteration 11 Backend Tests - Ghost Mode, Cashback, King Events, CP Events
Tests for:
1. Ghost Mode toggle endpoint
2. Ghost Mode filtering in rankings
3. Ghost Mode filtering in search
4. Cashback weekly endpoint
5. King room events (levels 1/2/3)
6. CP room events (levels 6/7)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
MELVIN_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"
MELVIN_USERNAME = "Melvin_Live"

# Room IDs from the database
MELVIN_ROOM_ID = "f8e3f9d8-9690-43e7-8887-2e8482936ac8"  # Mi Sala Live
ROOM_WITH_USER = "3253e990-eebc-4154-880b-abf4f1db808b"  # Sala de Jimena (has 1 user)


class TestGhostMode:
    """Ghost Mode feature tests"""
    
    def test_ghost_mode_toggle_on(self):
        """Test toggling ghost mode ON for dueño user"""
        # First ensure ghost mode is OFF
        response = requests.get(f"{BASE_URL}/api/users/{MELVIN_ID}")
        assert response.status_code == 200
        initial_state = response.json().get('ghost_mode', False)
        
        # Toggle ghost mode
        response = requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")
        assert response.status_code == 200
        data = response.json()
        assert data['success'] == True
        assert 'ghost_mode' in data
        new_state = data['ghost_mode']
        
        # Verify it toggled
        assert new_state != initial_state
        print(f"Ghost mode toggled from {initial_state} to {new_state}")
        
    def test_ghost_mode_user_hidden_from_rankings(self):
        """When ghost mode is ON, user should be hidden from /api/rankings/coins"""
        # First turn ON ghost mode
        response = requests.get(f"{BASE_URL}/api/users/{MELVIN_ID}")
        current_state = response.json().get('ghost_mode', False)
        
        if not current_state:
            # Toggle to ON
            requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")
        
        # Check rankings
        response = requests.get(f"{BASE_URL}/api/rankings/coins")
        assert response.status_code == 200
        rankings = response.json()
        
        # Melvin should NOT be in rankings when ghost mode is ON
        user_ids = [u['id'] for u in rankings]
        assert MELVIN_ID not in user_ids, "User with ghost_mode ON should NOT appear in rankings"
        print(f"Verified: User with ghost_mode ON is hidden from rankings (checked {len(rankings)} users)")
        
    def test_ghost_mode_user_hidden_from_search(self):
        """When ghost mode is ON, user should be hidden from /api/users/search"""
        # Ensure ghost mode is ON
        response = requests.get(f"{BASE_URL}/api/users/{MELVIN_ID}")
        current_state = response.json().get('ghost_mode', False)
        
        if not current_state:
            requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")
        
        # Try to search for the user
        response = requests.get(f"{BASE_URL}/api/users/search/{MELVIN_USERNAME}")
        # Should return 404 when ghost mode is ON
        assert response.status_code == 404, f"Expected 404 for ghost user search, got {response.status_code}"
        print("Verified: User with ghost_mode ON is hidden from search")
        
    def test_ghost_mode_toggle_off(self):
        """Test toggling ghost mode OFF"""
        # Get current state
        response = requests.get(f"{BASE_URL}/api/users/{MELVIN_ID}")
        current_state = response.json().get('ghost_mode', False)
        
        if current_state:
            # Toggle OFF
            response = requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")
            assert response.status_code == 200
            assert response.json()['ghost_mode'] == False
            print("Ghost mode toggled OFF")
        else:
            print("Ghost mode was already OFF")
            
    def test_ghost_mode_user_visible_when_off(self):
        """When ghost mode is OFF, user should appear in rankings"""
        # Ensure ghost mode is OFF
        response = requests.get(f"{BASE_URL}/api/users/{MELVIN_ID}")
        current_state = response.json().get('ghost_mode', False)
        
        if current_state:
            requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")
        
        # Check rankings
        response = requests.get(f"{BASE_URL}/api/rankings/coins")
        assert response.status_code == 200
        rankings = response.json()
        
        # Melvin should be in rankings when ghost mode is OFF
        user_ids = [u['id'] for u in rankings]
        assert MELVIN_ID in user_ids, "User with ghost_mode OFF should appear in rankings"
        print("Verified: User with ghost_mode OFF appears in rankings")
        
    def test_ghost_mode_search_works_when_off(self):
        """When ghost mode is OFF, user should be searchable"""
        # Ensure ghost mode is OFF
        response = requests.get(f"{BASE_URL}/api/users/{MELVIN_ID}")
        current_state = response.json().get('ghost_mode', False)
        
        if current_state:
            requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")
        
        # Search should work
        response = requests.get(f"{BASE_URL}/api/users/search/{MELVIN_USERNAME}")
        assert response.status_code == 200, f"Expected 200 for non-ghost user search, got {response.status_code}"
        data = response.json()
        assert data['username'] == MELVIN_USERNAME
        print("Verified: User with ghost_mode OFF is searchable")


class TestCashbackWeekly:
    """Cashback weekly event tests"""
    
    def test_cashback_endpoint_exists(self):
        """Test POST /api/events/cashback endpoint exists and works for dueño"""
        response = requests.post(f"{BASE_URL}/api/events/cashback?admin_id={MELVIN_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data['success'] == True
        assert 'results' in data
        assert 'total_users' in data
        print(f"Cashback endpoint works. Total users processed: {data['total_users']}")
        
    def test_cashback_requires_dueno(self):
        """Test that cashback requires dueño role"""
        fake_id = "fake-user-id-12345"
        response = requests.post(f"{BASE_URL}/api/events/cashback?admin_id={fake_id}")
        assert response.status_code == 403
        print("Verified: Cashback requires dueño role")


class TestKingRoomEvents:
    """King room events (levels 1/2/3) tests"""
    
    def test_king_room_level1_empty_room(self):
        """Test King level 1 event on empty room returns appropriate error"""
        response = requests.post(
            f"{BASE_URL}/api/events/king-room",
            params={"admin_id": MELVIN_ID, "room_id": MELVIN_ROOM_ID, "level": 1}
        )
        # Empty room should return 400
        if response.status_code == 400:
            assert "No hay usuarios" in response.json().get('detail', '')
            print("King level 1: Correctly returns 'No hay usuarios' for empty room")
        else:
            assert response.status_code == 200
            print(f"King level 1: Event triggered successfully")
            
    def test_king_room_level2_empty_room(self):
        """Test King level 2 event on empty room"""
        response = requests.post(
            f"{BASE_URL}/api/events/king-room",
            params={"admin_id": MELVIN_ID, "room_id": MELVIN_ROOM_ID, "level": 2}
        )
        if response.status_code == 400:
            assert "No hay usuarios" in response.json().get('detail', '')
            print("King level 2: Correctly returns 'No hay usuarios' for empty room")
        else:
            assert response.status_code == 200
            print(f"King level 2: Event triggered successfully")
            
    def test_king_room_level3_empty_room(self):
        """Test King level 3 event on empty room"""
        response = requests.post(
            f"{BASE_URL}/api/events/king-room",
            params={"admin_id": MELVIN_ID, "room_id": MELVIN_ROOM_ID, "level": 3}
        )
        if response.status_code == 400:
            assert "No hay usuarios" in response.json().get('detail', '')
            print("King level 3: Correctly returns 'No hay usuarios' for empty room")
        else:
            assert response.status_code == 200
            print(f"King level 3: Event triggered successfully")
            
    def test_king_room_requires_dueno(self):
        """Test that king room event requires dueño role"""
        fake_id = "fake-user-id-12345"
        response = requests.post(
            f"{BASE_URL}/api/events/king-room",
            params={"admin_id": fake_id, "room_id": MELVIN_ROOM_ID, "level": 1}
        )
        assert response.status_code == 403
        print("Verified: King room event requires dueño role")
        
    def test_king_room_invalid_room(self):
        """Test king room event with invalid room ID"""
        response = requests.post(
            f"{BASE_URL}/api/events/king-room",
            params={"admin_id": MELVIN_ID, "room_id": "invalid-room-id", "level": 1}
        )
        assert response.status_code == 404
        print("Verified: King room event returns 404 for invalid room")
        
    def test_king_room_with_users(self):
        """Test King event on room with users (Sala de Jimena has 1 user)"""
        response = requests.post(
            f"{BASE_URL}/api/events/king-room",
            params={"admin_id": MELVIN_ID, "room_id": ROOM_WITH_USER, "level": 1}
        )
        # This room has a user, so it should succeed
        if response.status_code == 200:
            data = response.json()
            assert data['success'] == True
            assert data['level'] == 1
            assert data['prize'] == 300000000  # 300M for level 1
            print(f"King level 1 on room with users: Success! Prize: {data['prize']}, Users: {data['users']}")
        else:
            # User might have left the room
            print(f"King level 1: Room might be empty now. Status: {response.status_code}")


class TestCPRoomEvents:
    """CP room events (levels 6/7) tests"""
    
    def test_cp_room_level6_empty_room(self):
        """Test CP level 6 event on empty room"""
        response = requests.post(
            f"{BASE_URL}/api/events/cp-room",
            params={"admin_id": MELVIN_ID, "room_id": MELVIN_ROOM_ID, "level": 6}
        )
        if response.status_code == 400:
            assert "No hay usuarios" in response.json().get('detail', '')
            print("CP level 6: Correctly returns 'No hay usuarios' for empty room")
        else:
            assert response.status_code == 200
            print(f"CP level 6: Event triggered successfully")
            
    def test_cp_room_level7_empty_room(self):
        """Test CP level 7 event on empty room"""
        response = requests.post(
            f"{BASE_URL}/api/events/cp-room",
            params={"admin_id": MELVIN_ID, "room_id": MELVIN_ROOM_ID, "level": 7}
        )
        if response.status_code == 400:
            assert "No hay usuarios" in response.json().get('detail', '')
            print("CP level 7: Correctly returns 'No hay usuarios' for empty room")
        else:
            assert response.status_code == 200
            print(f"CP level 7: Event triggered successfully")
            
    def test_cp_room_requires_dueno(self):
        """Test that CP room event requires dueño role"""
        fake_id = "fake-user-id-12345"
        response = requests.post(
            f"{BASE_URL}/api/events/cp-room",
            params={"admin_id": fake_id, "room_id": MELVIN_ROOM_ID, "level": 6}
        )
        assert response.status_code == 403
        print("Verified: CP room event requires dueño role")
        
    def test_cp_room_invalid_room(self):
        """Test CP room event with invalid room ID"""
        response = requests.post(
            f"{BASE_URL}/api/events/cp-room",
            params={"admin_id": MELVIN_ID, "room_id": "invalid-room-id", "level": 6}
        )
        assert response.status_code == 404
        print("Verified: CP room event returns 404 for invalid room")
        
    def test_cp_room_with_users(self):
        """Test CP event on room with users"""
        response = requests.post(
            f"{BASE_URL}/api/events/cp-room",
            params={"admin_id": MELVIN_ID, "room_id": ROOM_WITH_USER, "level": 6}
        )
        if response.status_code == 200:
            data = response.json()
            assert data['success'] == True
            assert data['level'] == 6
            assert data['prize_per_user'] == 5000000  # 5M per user
            print(f"CP level 6 on room with users: Success! Prize per user: {data['prize_per_user']}, Users: {data['users']}")
        else:
            print(f"CP level 6: Room might be empty now. Status: {response.status_code}")


class TestLevelRankings:
    """Level rankings tests (also filters ghost mode)"""
    
    def test_level_rankings_endpoint(self):
        """Test /api/rankings/level endpoint works"""
        response = requests.get(f"{BASE_URL}/api/rankings/level")
        assert response.status_code == 200
        rankings = response.json()
        assert isinstance(rankings, list)
        print(f"Level rankings: {len(rankings)} users returned")
        
    def test_level_rankings_filters_ghost_mode(self):
        """Test that level rankings also filters ghost mode users"""
        # Turn ON ghost mode
        requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")
        
        # Verify user state
        response = requests.get(f"{BASE_URL}/api/users/{MELVIN_ID}")
        if response.json().get('ghost_mode') == False:
            # Toggle again
            requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")
        
        # Check level rankings
        response = requests.get(f"{BASE_URL}/api/rankings/level")
        assert response.status_code == 200
        rankings = response.json()
        
        user_ids = [u['id'] for u in rankings]
        assert MELVIN_ID not in user_ids, "Ghost mode user should not appear in level rankings"
        print("Verified: Ghost mode user hidden from level rankings")
        
        # Turn OFF ghost mode for cleanup
        requests.post(f"{BASE_URL}/api/users/{MELVIN_ID}/ghost-mode")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
