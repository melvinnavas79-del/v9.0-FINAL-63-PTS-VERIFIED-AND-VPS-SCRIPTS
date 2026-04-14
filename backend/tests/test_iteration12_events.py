"""
Iteration 12 Tests - Event Request/Approval System
Tests for:
- POST /api/events/request - creates event request with correct fields
- Monthly limit - second request in same month returns 400
- GET /api/events/requests?admin_id=X&status=pending - returns pending requests
- POST /api/events/approve/{id}?admin_id=X - approves event
- POST /api/events/reject/{id}?admin_id=X - rejects event
- GET /api/events/my-events/{user_id} - returns events with goal/reward/progress
- Only dueño can approve/reject events (403 for others)
- Game play (POST /api/games/play) tracks progress toward King event goal
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "Melvin_Live"
ADMIN_PASSWORD = "test123"
ADMIN_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"


class TestEventRequestSystem:
    """Tests for the new event request/approval system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_user_id = None
        self.test_request_id = None
        yield
        # Cleanup: delete test user if created
        if self.test_user_id:
            try:
                self.session.delete(f"{BASE_URL}/api/admin/users/{self.test_user_id}?admin_id={ADMIN_ID}")
            except:
                pass
    
    def test_01_admin_login(self):
        """Verify admin (dueño) can login"""
        response = self.session.post(f"{BASE_URL}/api/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("user", {}).get("role") == "dueño"
        print(f"✓ Admin login successful, role: {data['user']['role']}")
    
    def test_02_create_test_user_for_event_request(self):
        """Create a fresh test user to request events"""
        unique_id = str(uuid.uuid4())[:8]
        username = f"TEST_eventuser_{unique_id}"
        
        response = self.session.post(f"{BASE_URL}/api/register", json={
            "username": username,
            "password": "test123"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        self.test_user_id = data["user"]["id"]
        print(f"✓ Created test user: {username} (ID: {self.test_user_id})")
        return self.test_user_id
    
    def test_03_request_king_event(self):
        """Test POST /api/events/request creates event request with correct fields"""
        # First create a test user
        unique_id = str(uuid.uuid4())[:8]
        username = f"TEST_kingreq_{unique_id}"
        
        reg_response = self.session.post(f"{BASE_URL}/api/register", json={
            "username": username,
            "password": "test123"
        })
        assert reg_response.status_code == 200
        user_id = reg_response.json()["user"]["id"]
        self.test_user_id = user_id
        
        # Request a King event
        response = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king"
        })
        assert response.status_code == 200, f"Event request failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        request_data = data.get("request", {})
        assert "id" in request_data
        assert request_data.get("user_id") == user_id
        assert request_data.get("event_type") == "king"
        assert request_data.get("status") == "pending"
        assert request_data.get("game_progress") == 0
        assert "created_at" in request_data
        
        self.test_request_id = request_data["id"]
        print(f"✓ King event request created: {self.test_request_id}")
        print(f"  - Status: {request_data['status']}")
        print(f"  - Event type: {request_data['event_type']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_04_monthly_limit_enforcement(self):
        """Test that second request in same month returns 400"""
        # Create a test user
        unique_id = str(uuid.uuid4())[:8]
        username = f"TEST_monthlimit_{unique_id}"
        
        reg_response = self.session.post(f"{BASE_URL}/api/register", json={
            "username": username,
            "password": "test123"
        })
        assert reg_response.status_code == 200
        user_id = reg_response.json()["user"]["id"]
        self.test_user_id = user_id
        
        # First request should succeed
        response1 = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king"
        })
        assert response1.status_code == 200, f"First request failed: {response1.text}"
        print(f"✓ First event request succeeded")
        
        # Second request should fail with 400
        response2 = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king_1"
        })
        assert response2.status_code == 400, f"Expected 400, got {response2.status_code}: {response2.text}"
        assert "1 evento al mes" in response2.json().get("detail", "").lower() or "solo puedes" in response2.json().get("detail", "").lower()
        print(f"✓ Monthly limit enforced: {response2.json().get('detail')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_05_get_pending_requests_as_admin(self):
        """Test GET /api/events/requests?admin_id=X&status=pending returns pending requests"""
        response = self.session.get(f"{BASE_URL}/api/events/requests?admin_id={ADMIN_ID}&status=pending")
        assert response.status_code == 200, f"Failed to get pending requests: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} pending requests")
        
        # Verify structure of requests if any exist
        if len(data) > 0:
            req = data[0]
            assert "id" in req
            assert "user_id" in req
            assert "event_type" in req
            assert req.get("status") == "pending"
            print(f"  - First request: {req.get('username')} - {req.get('event_type')}")
    
    def test_06_non_admin_cannot_get_requests(self):
        """Test that non-dueño cannot access pending requests"""
        # Create a regular user
        unique_id = str(uuid.uuid4())[:8]
        username = f"TEST_nonadmin_{unique_id}"
        
        reg_response = self.session.post(f"{BASE_URL}/api/register", json={
            "username": username,
            "password": "test123"
        })
        assert reg_response.status_code == 200
        user_id = reg_response.json()["user"]["id"]
        self.test_user_id = user_id
        
        # Try to get pending requests as non-admin
        response = self.session.get(f"{BASE_URL}/api/events/requests?admin_id={user_id}&status=pending")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Non-admin correctly denied access (403)")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_07_approve_event_request(self):
        """Test POST /api/events/approve/{id}?admin_id=X approves event"""
        # Create a test user and request
        unique_id = str(uuid.uuid4())[:8]
        username = f"TEST_approve_{unique_id}"
        
        reg_response = self.session.post(f"{BASE_URL}/api/register", json={
            "username": username,
            "password": "test123"
        })
        assert reg_response.status_code == 200
        user_id = reg_response.json()["user"]["id"]
        self.test_user_id = user_id
        
        # Create event request
        req_response = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king"
        })
        assert req_response.status_code == 200
        request_id = req_response.json()["request"]["id"]
        
        # Approve the request as admin
        approve_response = self.session.post(f"{BASE_URL}/api/events/approve/{request_id}?admin_id={ADMIN_ID}")
        assert approve_response.status_code == 200, f"Approve failed: {approve_response.text}"
        data = approve_response.json()
        assert data.get("success") == True
        print(f"✓ Event request approved successfully")
        
        # Verify the event is now approved
        my_events = self.session.get(f"{BASE_URL}/api/events/my-events/{user_id}")
        assert my_events.status_code == 200
        events = my_events.json()
        approved_event = next((e for e in events if e["id"] == request_id), None)
        assert approved_event is not None
        assert approved_event["status"] == "approved"
        print(f"  - Event status verified: {approved_event['status']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_08_reject_event_request(self):
        """Test POST /api/events/reject/{id}?admin_id=X rejects event"""
        # Create a test user and request
        unique_id = str(uuid.uuid4())[:8]
        username = f"TEST_reject_{unique_id}"
        
        reg_response = self.session.post(f"{BASE_URL}/api/register", json={
            "username": username,
            "password": "test123"
        })
        assert reg_response.status_code == 200
        user_id = reg_response.json()["user"]["id"]
        self.test_user_id = user_id
        
        # Create event request
        req_response = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king_1"
        })
        assert req_response.status_code == 200
        request_id = req_response.json()["request"]["id"]
        
        # Reject the request as admin
        reject_response = self.session.post(f"{BASE_URL}/api/events/reject/{request_id}?admin_id={ADMIN_ID}")
        assert reject_response.status_code == 200, f"Reject failed: {reject_response.text}"
        data = reject_response.json()
        assert data.get("success") == True
        print(f"✓ Event request rejected successfully")
        
        # Verify the event is now rejected
        my_events = self.session.get(f"{BASE_URL}/api/events/my-events/{user_id}")
        assert my_events.status_code == 200
        events = my_events.json()
        rejected_event = next((e for e in events if e["id"] == request_id), None)
        assert rejected_event is not None
        assert rejected_event["status"] == "rejected"
        print(f"  - Event status verified: {rejected_event['status']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_09_non_admin_cannot_approve(self):
        """Test that only dueño can approve events (403 for others)"""
        # Create two users - one to request, one to try approving
        unique_id = str(uuid.uuid4())[:8]
        
        # Requester
        reg1 = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_req_{unique_id}",
            "password": "test123"
        })
        requester_id = reg1.json()["user"]["id"]
        
        # Non-admin user
        reg2 = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_nonadm_{unique_id}",
            "password": "test123"
        })
        non_admin_id = reg2.json()["user"]["id"]
        
        # Create event request
        req_response = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": requester_id,
            "event_type": "king"
        })
        request_id = req_response.json()["request"]["id"]
        
        # Try to approve as non-admin
        approve_response = self.session.post(f"{BASE_URL}/api/events/approve/{request_id}?admin_id={non_admin_id}")
        assert approve_response.status_code == 403, f"Expected 403, got {approve_response.status_code}"
        print(f"✓ Non-admin correctly denied approval (403)")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{requester_id}?admin_id={ADMIN_ID}")
        self.session.delete(f"{BASE_URL}/api/admin/users/{non_admin_id}?admin_id={ADMIN_ID}")
    
    def test_10_non_admin_cannot_reject(self):
        """Test that only dueño can reject events (403 for others)"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Requester
        reg1 = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_reqrej_{unique_id}",
            "password": "test123"
        })
        requester_id = reg1.json()["user"]["id"]
        
        # Non-admin user
        reg2 = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_nonadmrej_{unique_id}",
            "password": "test123"
        })
        non_admin_id = reg2.json()["user"]["id"]
        
        # Create event request
        req_response = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": requester_id,
            "event_type": "king_3"
        })
        request_id = req_response.json()["request"]["id"]
        
        # Try to reject as non-admin
        reject_response = self.session.post(f"{BASE_URL}/api/events/reject/{request_id}?admin_id={non_admin_id}")
        assert reject_response.status_code == 403, f"Expected 403, got {reject_response.status_code}"
        print(f"✓ Non-admin correctly denied rejection (403)")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{requester_id}?admin_id={ADMIN_ID}")
        self.session.delete(f"{BASE_URL}/api/admin/users/{non_admin_id}?admin_id={ADMIN_ID}")
    
    def test_11_my_events_returns_goal_reward_progress(self):
        """Test GET /api/events/my-events/{user_id} returns events with goal/reward/progress"""
        unique_id = str(uuid.uuid4())[:8]
        username = f"TEST_myevents_{unique_id}"
        
        reg_response = self.session.post(f"{BASE_URL}/api/register", json={
            "username": username,
            "password": "test123"
        })
        user_id = reg_response.json()["user"]["id"]
        self.test_user_id = user_id
        
        # Create and approve an event
        req_response = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king"
        })
        request_id = req_response.json()["request"]["id"]
        
        # Approve it
        self.session.post(f"{BASE_URL}/api/events/approve/{request_id}?admin_id={ADMIN_ID}")
        
        # Get my events
        response = self.session.get(f"{BASE_URL}/api/events/my-events/{user_id}")
        assert response.status_code == 200
        events = response.json()
        
        assert len(events) > 0
        event = events[0]
        
        # Verify goal, reward, progress fields
        assert "goal" in event, "Missing 'goal' field"
        assert "reward" in event, "Missing 'reward' field"
        assert "game_progress" in event, "Missing 'game_progress' field"
        assert "label" in event, "Missing 'label' field"
        
        # Verify King event values (200M goal, 3M reward)
        assert event["goal"] == 200000000, f"Expected goal 200M, got {event['goal']}"
        assert event["reward"] == 3000000, f"Expected reward 3M, got {event['reward']}"
        assert event["label"] == "King"
        
        print(f"✓ My events returns correct fields:")
        print(f"  - Goal: {event['goal']} (200M)")
        print(f"  - Reward: {event['reward']} (3M)")
        print(f"  - Progress: {event['game_progress']}")
        print(f"  - Label: {event['label']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_12_game_play_tracks_progress(self):
        """Test that POST /api/games/play tracks progress toward King event goal"""
        unique_id = str(uuid.uuid4())[:8]
        username = f"TEST_gameprog_{unique_id}"
        
        # Create user with coins
        reg_response = self.session.post(f"{BASE_URL}/api/register", json={
            "username": username,
            "password": "test123"
        })
        user_id = reg_response.json()["user"]["id"]
        self.test_user_id = user_id
        
        # Give user coins to play
        self.session.post(f"{BASE_URL}/api/admin/console/give-coins?admin_id={ADMIN_ID}&target_id={user_id}&amount=100000")
        
        # Create and approve a King event
        req_response = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king"
        })
        request_id = req_response.json()["request"]["id"]
        self.session.post(f"{BASE_URL}/api/events/approve/{request_id}?admin_id={ADMIN_ID}")
        
        # Get initial progress
        events_before = self.session.get(f"{BASE_URL}/api/events/my-events/{user_id}").json()
        initial_progress = events_before[0].get("game_progress", 0)
        
        # Play a game
        bet_amount = 1000
        game_response = self.session.post(f"{BASE_URL}/api/games/play", json={
            "user_id": user_id,
            "game": "ruleta",
            "bet": bet_amount
        })
        assert game_response.status_code == 200, f"Game play failed: {game_response.text}"
        
        # Check progress increased
        events_after = self.session.get(f"{BASE_URL}/api/events/my-events/{user_id}").json()
        new_progress = events_after[0].get("game_progress", 0)
        
        assert new_progress > initial_progress, f"Progress should increase. Before: {initial_progress}, After: {new_progress}"
        assert new_progress == initial_progress + bet_amount, f"Progress should increase by bet amount ({bet_amount})"
        
        print(f"✓ Game play tracks progress:")
        print(f"  - Initial progress: {initial_progress}")
        print(f"  - Bet amount: {bet_amount}")
        print(f"  - New progress: {new_progress}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_13_king_levels_correct_values(self):
        """Verify KING_LEVELS have correct goal/reward values"""
        # Test King (200M/3M)
        unique_id = str(uuid.uuid4())[:8]
        
        reg = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_kinglevel_{unique_id}",
            "password": "test123"
        })
        user_id = reg.json()["user"]["id"]
        
        # Request King
        req = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king"
        })
        self.session.post(f"{BASE_URL}/api/events/approve/{req.json()['request']['id']}?admin_id={ADMIN_ID}")
        
        events = self.session.get(f"{BASE_URL}/api/events/my-events/{user_id}").json()
        king_event = events[0]
        
        assert king_event["goal"] == 200000000, "King goal should be 200M"
        assert king_event["reward"] == 3000000, "King reward should be 3M"
        print(f"✓ King: Goal=200M, Reward=3M")
        
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_14_king1_levels_correct_values(self):
        """Verify King 1 has correct goal/reward (300M/4M)"""
        unique_id = str(uuid.uuid4())[:8]
        
        reg = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_king1level_{unique_id}",
            "password": "test123"
        })
        user_id = reg.json()["user"]["id"]
        
        req = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king_1"
        })
        self.session.post(f"{BASE_URL}/api/events/approve/{req.json()['request']['id']}?admin_id={ADMIN_ID}")
        
        events = self.session.get(f"{BASE_URL}/api/events/my-events/{user_id}").json()
        king1_event = events[0]
        
        assert king1_event["goal"] == 300000000, "King 1 goal should be 300M"
        assert king1_event["reward"] == 4000000, "King 1 reward should be 4M"
        print(f"✓ King 1: Goal=300M, Reward=4M")
        
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_15_king3_levels_correct_values(self):
        """Verify King 3 has correct goal/reward (500M/5M)"""
        unique_id = str(uuid.uuid4())[:8]
        
        reg = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_king3level_{unique_id}",
            "password": "test123"
        })
        user_id = reg.json()["user"]["id"]
        
        req = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "king_3"
        })
        self.session.post(f"{BASE_URL}/api/events/approve/{req.json()['request']['id']}?admin_id={ADMIN_ID}")
        
        events = self.session.get(f"{BASE_URL}/api/events/my-events/{user_id}").json()
        king3_event = events[0]
        
        assert king3_event["goal"] == 500000000, "King 3 goal should be 500M"
        assert king3_event["reward"] == 5000000, "King 3 reward should be 5M"
        print(f"✓ King 3: Goal=500M, Reward=5M")
        
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_16_cp_event_requires_partner(self):
        """Test that CP event request requires a CP partner"""
        unique_id = str(uuid.uuid4())[:8]
        
        reg = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_cpnopartner_{unique_id}",
            "password": "test123"
        })
        user_id = reg.json()["user"]["id"]
        
        # Try to request CP event without a partner
        req = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "cp_6"
        })
        assert req.status_code == 400, f"Expected 400, got {req.status_code}"
        assert "pareja" in req.json().get("detail", "").lower()
        print(f"✓ CP event requires partner: {req.json().get('detail')}")
        
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")
    
    def test_17_invalid_event_type_rejected(self):
        """Test that invalid event types are rejected"""
        unique_id = str(uuid.uuid4())[:8]
        
        reg = self.session.post(f"{BASE_URL}/api/register", json={
            "username": f"TEST_invalidevent_{unique_id}",
            "password": "test123"
        })
        user_id = reg.json()["user"]["id"]
        
        req = self.session.post(f"{BASE_URL}/api/events/request", json={
            "user_id": user_id,
            "event_type": "invalid_type"
        })
        assert req.status_code == 400, f"Expected 400, got {req.status_code}"
        print(f"✓ Invalid event type rejected: {req.json().get('detail')}")
        
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}?admin_id={ADMIN_ID}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
