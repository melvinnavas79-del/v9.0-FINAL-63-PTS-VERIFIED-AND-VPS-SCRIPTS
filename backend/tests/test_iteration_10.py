"""
Iteration 10 tests — WebRTC signaling + /api/diagnostics + regressions.
Covers:
  - POST /api/login (Melvin_Live/test123)
  - GET  /api/webrtc/config
  - GET  /api/webrtc/rooms/{room_id}/peers
  - WS   /api/ws/audio/{room_id}?user_id=X  (2 peers, offer/answer/ice relay, peer-joined/left)
  - GET  /api/diagnostics (auth + 200 OK for owner, 403 for non-owner, 404 missing user)
  - POST /api/diagnostics/paypal/test-order (LIVE order creation returns http_status 201)
  - Regression smokes: /api/rooms, /api/gifts
"""
import asyncio
import json
import os

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://codigo-necesario.preview.emergentagent.com").rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

MELVIN_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"


# ============================= Auth =============================
class TestAuth:
    def test_login_melvin(self):
        r = requests.post(f"{BASE_URL}/api/login",
                          json={"username": "Melvin_Live", "password": "test123"},
                          timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data["user"]["id"] == MELVIN_ID
        assert data["user"]["role"] == "dueño"

    def test_login_bad_password(self):
        r = requests.post(f"{BASE_URL}/api/login",
                          json={"username": "Melvin_Live", "password": "wrongpass"},
                          timeout=15)
        assert r.status_code in (400, 401, 403), r.text


# ============================= WebRTC HTTP =============================
class TestWebRTCConfig:
    def test_config_returns_ice_servers(self):
        r = requests.get(f"{BASE_URL}/api/webrtc/config", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "iceServers" in data
        assert isinstance(data["iceServers"], list) and len(data["iceServers"]) >= 1
        urls = data["iceServers"][0].get("urls")
        assert urls, "first ice server must have urls"
        joined = " ".join(urls) if isinstance(urls, list) else str(urls)
        assert "stun:" in joined, f"expected a STUN server, got {urls}"

    def test_empty_room_peers(self):
        rid = "test-empty-room-xyz-iter10"
        r = requests.get(f"{BASE_URL}/api/webrtc/rooms/{rid}/peers", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["room_id"] == rid
        assert d["peers"] == []


# ============================= WebSocket signaling =============================
@pytest.mark.asyncio
async def test_ws_two_peers_relay_and_lifecycle():
    """
    Connect 2 peers to the same room, verify:
      - both receive initial 'peers' list
      - peer2 joining triggers 'peer-joined' on peer1
      - offer/answer/ice messages are relayed correctly with 'from' field
      - REST /peers endpoint lists both user_ids
      - on disconnect, remaining peer receives 'peer-left'
    """
    room_id = "iter10-ws-room"
    u1, u2 = "iter10-peerA", "iter10-peerB"
    url1 = f"{WS_BASE}/api/ws/audio/{room_id}?user_id={u1}"
    url2 = f"{WS_BASE}/api/ws/audio/{room_id}?user_id={u2}"

    async def recv_json(ws, timeout=5.0):
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        return json.loads(raw)

    ws1 = await websockets.connect(url1, open_timeout=10)
    try:
        # peer1 receives initial peers list (just itself)
        m = await recv_json(ws1)
        assert m["type"] == "peers"
        assert u1 in m["peers"]

        ws2 = await websockets.connect(url2, open_timeout=10)
        try:
            # peer2 receives initial peers list (should include both)
            got_peer_list_for_u2 = False
            for _ in range(4):
                m2 = await recv_json(ws2, timeout=3)
                if m2["type"] == "peers":
                    assert u1 in m2["peers"] and u2 in m2["peers"]
                    got_peer_list_for_u2 = True
                    break
            assert got_peer_list_for_u2, "peer2 did not receive 'peers' list"

            # peer1 should have received peer-joined and updated peers list
            seen_joined = False
            for _ in range(4):
                try:
                    m1 = await recv_json(ws1, timeout=3)
                except asyncio.TimeoutError:
                    break
                if m1["type"] == "peer-joined" and m1["user_id"] == u2:
                    seen_joined = True
                elif m1["type"] == "peers" and u2 in m1["peers"]:
                    seen_joined = True or seen_joined
            assert seen_joined, "peer1 did not get peer-joined/peers update for peer2"

            # REST peers listing
            r = requests.get(f"{BASE_URL}/api/webrtc/rooms/{room_id}/peers", timeout=10)
            assert r.status_code == 200
            peers = r.json()["peers"]
            assert u1 in peers and u2 in peers

            # offer from u1 -> u2
            await ws1.send(json.dumps({"type": "offer", "to": u2, "sdp": {"type": "offer", "sdp": "v=0"}}))
            m2 = await recv_json(ws2, timeout=5)
            assert m2["type"] == "offer"
            assert m2["from"] == u1
            assert m2["sdp"]["sdp"] == "v=0"

            # answer from u2 -> u1
            await ws2.send(json.dumps({"type": "answer", "to": u1, "sdp": {"type": "answer", "sdp": "v=0b"}}))
            m1 = await recv_json(ws1, timeout=5)
            assert m1["type"] == "answer"
            assert m1["from"] == u2

            # ice from u1 -> u2
            await ws1.send(json.dumps({"type": "ice", "to": u2, "candidate": {"candidate": "x"}}))
            m2 = await recv_json(ws2, timeout=5)
            assert m2["type"] == "ice"
            assert m2["from"] == u1
            assert m2["candidate"]["candidate"] == "x"

            # ping/pong
            await ws1.send(json.dumps({"type": "ping"}))
            mp = await recv_json(ws1, timeout=5)
            assert mp["type"] == "pong"

        finally:
            await ws2.close()

        # After ws2 closes, ws1 should see peer-left
        seen_left = False
        for _ in range(4):
            try:
                m1 = await recv_json(ws1, timeout=3)
            except asyncio.TimeoutError:
                break
            if m1["type"] == "peer-left" and m1["user_id"] == u2:
                seen_left = True
                break
        assert seen_left, "peer1 did not receive peer-left"
    finally:
        await ws1.close()

    # Give server a beat to cleanup, then verify room is empty
    await asyncio.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/webrtc/rooms/{room_id}/peers", timeout=10)
    assert r.status_code == 200
    assert r.json()["peers"] == []


# ============================= Diagnostics =============================
class TestDiagnostics:
    def test_diagnostics_requires_owner_403_for_non_owner(self):
        # Create a dummy non-owner user via register
        uname = "TEST_diag_nonowner_iter10"
        # Try to register, ignore failure if exists
        requests.post(f"{BASE_URL}/api/register",
                      json={"username": uname, "password": "pass1234", "country": "US"},
                      timeout=15)
        r = requests.post(f"{BASE_URL}/api/login",
                          json={"username": uname, "password": "pass1234"}, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"Could not create/login test user, got {r.status_code}: {r.text[:100]}")
        non_owner_id = r.json()["user"]["id"]
        r2 = requests.get(f"{BASE_URL}/api/diagnostics", params={"user_id": non_owner_id}, timeout=15)
        assert r2.status_code == 403, r2.text

    def test_diagnostics_404_for_missing_user(self):
        r = requests.get(f"{BASE_URL}/api/diagnostics",
                         params={"user_id": "ffffffff-dead-beef-0000-000000000000"}, timeout=15)
        assert r.status_code == 404, r.text

    def test_diagnostics_ok_for_owner(self):
        r = requests.get(f"{BASE_URL}/api/diagnostics",
                         params={"user_id": MELVIN_ID}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["requested_by"] == "Melvin_Live"
        assert d["paypal"]["status"] == "ok", f"paypal check failed: {d.get('paypal')}"
        assert d["paypal"]["mode"] == "live"
        assert d["paypal"]["http_status"] == 200
        assert d["uploads"]["status"] == "ok", f"uploads failed: {d.get('uploads')}"
        assert d["uploads"]["writable"] is True
        assert d["mongo"]["status"] == "ok"
        assert isinstance(d["mongo"]["users"], int) and d["mongo"]["users"] >= 1
        assert d["disk"]["status"] == "ok"
        assert d["env"]["MONGO_URL"]["set"] is True
        assert d["env"]["PAYPAL_CLIENT_ID"]["set"] is True

    def test_diagnostics_paypal_test_order_live_201(self):
        r = requests.post(f"{BASE_URL}/api/diagnostics/paypal/test-order",
                          params={"user_id": MELVIN_ID, "amount": 1.00}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["http_status"] == 201, f"PayPal create order did not return 201: {d}"
        assert d["status"] == "ok"
        # order has id + status
        resp = d["response"]
        assert "id" in resp
        assert resp.get("status") in ("CREATED", "PAYER_ACTION_REQUIRED")

    def test_diagnostics_paypal_test_order_requires_owner(self):
        r = requests.post(f"{BASE_URL}/api/diagnostics/paypal/test-order",
                          params={"user_id": "ffffffff-dead-beef-0000-000000000000"}, timeout=15)
        assert r.status_code in (403, 404), r.text


# ============================= Regression smokes =============================
class TestRegressions:
    def test_rooms_list(self):
        r = requests.get(f"{BASE_URL}/api/rooms", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_gifts_catalog(self):
        # Common path - try /api/gifts
        r = requests.get(f"{BASE_URL}/api/gifts", timeout=15)
        # tolerate either 200 or 404 (depends on router mount); just ensure not 500
        assert r.status_code < 500, r.text
