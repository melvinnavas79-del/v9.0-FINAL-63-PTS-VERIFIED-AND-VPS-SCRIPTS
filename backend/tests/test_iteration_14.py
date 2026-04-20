"""
Iteration 14 — Ojo Técnico (Error Logger + Integrity + Code Map).
Tests for /api/bot/super/errors, /errors/stats, /errors/{id}/resolve,
/integrity, /code-map, and global exception handlers.

Also regression sanity on iter 10-13 critical endpoints.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"  # Melvin_Live (dueño)
NON_OWNER_ID = "4bea36c7-5c7f-48b0-ae68-97af4ac8890b"  # Melvin navas (usuario)


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ============================================================
# 1) /bot/super/errors — Auth + shape
# ============================================================
class TestErrorsEndpoint:

    def test_errors_requires_owner_403_for_non_owner(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/errors",
                  params={"admin_id": NON_OWNER_ID, "limit": 5})
        assert r.status_code == 403, r.text

    def test_errors_requires_owner_403_for_unknown(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/errors",
                  params={"admin_id": "nonexistent-xyz", "limit": 5})
        assert r.status_code == 403

    def test_errors_owner_returns_list(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/errors",
                  params={"admin_id": OWNER_ID, "limit": 5})
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # If any errors exist, check shape
        if data:
            e = data[0]
            for k in ("type", "message", "file", "line", "function",
                      "source_role", "hint", "bot_report", "traceback",
                      "created_at", "resolved"):
                assert k in e, f"missing key {k} in error row"
            assert e["bot_report"].startswith("Jefe, error en ")


# ============================================================
# 2) Trigger error via invalid body → expect 422 captured
# ============================================================
class TestGlobalExceptionHandlers:

    def test_validation_error_is_logged(self, s):
        """Send a POST with invalid body to an endpoint requiring JSON body
        so RequestValidationError fires and global handler logs it."""
        # Get baseline count
        r0 = s.get(f"{BASE_URL}/api/bot/super/errors",
                   params={"admin_id": OWNER_ID, "limit": 50})
        baseline = len(r0.json()) if r0.status_code == 200 else 0

        # Trigger 422: /api/register requires username/password
        unique = f"test_it14_{uuid.uuid4().hex[:6]}"
        r1 = s.post(f"{BASE_URL}/api/register",
                    json={"only_invalid_field": unique})
        # Should be 422 (Pydantic validation) OR 400 depending on impl
        assert r1.status_code in (400, 422), f"got {r1.status_code} {r1.text[:200]}"

        # Give a moment for async insert
        time.sleep(1.2)

        r2 = s.get(f"{BASE_URL}/api/bot/super/errors",
                   params={"admin_id": OWNER_ID, "limit": 50})
        assert r2.status_code == 200
        rows = r2.json()
        # If 422 triggered, expect at least 1 validation-type entry OR bigger count
        if r1.status_code == 422:
            # find a validation error logged recently
            types = [row.get("type") for row in rows]
            assert ("RequestValidationError" in types or len(rows) > baseline), (
                f"Expected a logged validation error. types seen={types[:5]}")

    def test_403_is_not_logged(self, s):
        """HTTPException 403/404 should NOT inflate system_errors."""
        r0 = s.get(f"{BASE_URL}/api/bot/super/errors",
                   params={"admin_id": OWNER_ID, "limit": 100})
        before = len(r0.json())

        # Hit the 403 path a few times using a non-owner id
        for _ in range(3):
            s.get(f"{BASE_URL}/api/bot/super/errors",
                  params={"admin_id": NON_OWNER_ID, "limit": 5})

        time.sleep(0.6)
        r1 = s.get(f"{BASE_URL}/api/bot/super/errors",
                   params={"admin_id": OWNER_ID, "limit": 100})
        after = len(r1.json())
        # 403 should NOT add new errors; allow equal (other noise possible but
        # our 3x 403 calls should contribute 0)
        assert after - before < 3, (
            f"403 responses should not be logged. before={before} after={after}")


# ============================================================
# 3) /errors/stats
# ============================================================
class TestErrorsStats:

    def test_stats_requires_owner(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/errors/stats",
                  params={"admin_id": NON_OWNER_ID})
        assert r.status_code == 403

    def test_stats_shape(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/errors/stats",
                  params={"admin_id": OWNER_ID})
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(["last_24h", "unresolved", "by_file", "by_type"]).issubset(d.keys())
        assert isinstance(d["last_24h"], int)
        assert isinstance(d["unresolved"], int)
        assert isinstance(d["by_file"], list)
        assert isinstance(d["by_type"], list)
        if d["by_file"]:
            assert "file" in d["by_file"][0] and "count" in d["by_file"][0]
        if d["by_type"]:
            assert "type" in d["by_type"][0] and "count" in d["by_type"][0]


# ============================================================
# 4) /errors/{id}/resolve
# ============================================================
class TestResolveError:

    def test_resolve_requires_owner(self, s):
        r = s.post(f"{BASE_URL}/api/bot/super/errors/any-id/resolve",
                   params={"admin_id": NON_OWNER_ID})
        assert r.status_code == 403

    def test_resolve_flow(self, s):
        # Ensure we have at least one error (trigger one via 422)
        s.post(f"{BASE_URL}/api/register", json={"bad": True})
        time.sleep(1.0)

        r = s.get(f"{BASE_URL}/api/bot/super/errors",
                  params={"admin_id": OWNER_ID, "limit": 1, "resolved": False})
        assert r.status_code == 200
        rows = r.json()
        if not rows:
            pytest.skip("No unresolved errors available to resolve")
        err_id = rows[0]["id"]

        rr = s.post(f"{BASE_URL}/api/bot/super/errors/{err_id}/resolve",
                    params={"admin_id": OWNER_ID})
        assert rr.status_code == 200, rr.text
        body = rr.json()
        assert body.get("success") is True

        # Verify persistence: should no longer appear in unresolved=False list
        r2 = s.get(f"{BASE_URL}/api/bot/super/errors",
                   params={"admin_id": OWNER_ID, "limit": 200, "resolved": False})
        remaining_ids = [x["id"] for x in r2.json()]
        assert err_id not in remaining_ids

        # Verify appears when resolved=True
        r3 = s.get(f"{BASE_URL}/api/bot/super/errors",
                   params={"admin_id": OWNER_ID, "limit": 200, "resolved": True})
        assert any(x["id"] == err_id for x in r3.json())


# ============================================================
# 5) /integrity
# ============================================================
class TestIntegrity:

    def test_requires_owner(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/integrity",
                  params={"admin_id": NON_OWNER_ID})
        assert r.status_code == 403

    def test_integrity_shape(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/integrity",
                  params={"admin_id": OWNER_ID})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "healthy" in d
        assert "issues_count" in d
        assert "issues" in d and isinstance(d["issues"], list)
        assert "totals" in d
        t = d["totals"]
        for k in ("users", "coins_in_economy", "diamonds_in_economy"):
            assert k in t
        # Each issue shape check
        for i in d["issues"]:
            for k in ("severity", "file", "kind", "detail", "bot_report"):
                assert k in i, f"issue missing key {k}: {i}"


# ============================================================
# 6) /code-map
# ============================================================
class TestCodeMap:

    def test_requires_owner(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/code-map",
                  params={"admin_id": NON_OWNER_ID})
        assert r.status_code == 403

    def test_code_map_content(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/code-map",
                  params={"admin_id": OWNER_ID})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "files" in d and isinstance(d["files"], dict)
        assert "common_errors" in d and isinstance(d["common_errors"], dict)
        # Sanity — known keys
        assert "server.py" in d["files"]
        assert "routes/bot_super.py" in d["files"]
        assert "ValidationError" in d["common_errors"]


# ============================================================
# 7) Regression — iter 13 bot super endpoints
# ============================================================
class TestRegressionIter13:

    def test_bot_super_init(self, s):
        r = s.post(f"{BASE_URL}/api/bot/super/init")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert d["bot"]["role"] == "dueño"
        assert d["bot"]["is_super_admin"] is True

    def test_bot_super_actions(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/actions",
                  params={"admin_id": OWNER_ID, "limit": 5})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_bot_super_actions_forbidden(self, s):
        r = s.get(f"{BASE_URL}/api/bot/super/actions",
                  params={"admin_id": NON_OWNER_ID})
        assert r.status_code == 403


# ============================================================
# 8) Regression — iter 10-12 critical endpoints
# ============================================================
class TestRegressionIter10to12:

    def test_diagnostics_owner(self, s):
        r = s.get(f"{BASE_URL}/api/diagnostics", params={"user_id": OWNER_ID})
        assert r.status_code == 200, r.text

    def test_firebase_status(self, s):
        r = s.get(f"{BASE_URL}/api/auth/firebase/status")
        assert r.status_code == 200
        d = r.json()
        assert "web_api_key_configured" in d

    def test_webrtc_config(self, s):
        r = s.get(f"{BASE_URL}/api/webrtc/config")
        assert r.status_code == 200

    def test_login_melvin(self, s):
        r = s.post(f"{BASE_URL}/api/login",
                   json={"username": "Melvin_Live", "password": "test123"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("user", {}).get("id") == OWNER_ID or d.get("id") == OWNER_ID
