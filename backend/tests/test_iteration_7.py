"""
Iteration 7 tests:
- Melvin_Live restoration (dueño, 500T coins, level 50, svip_level 10, diamonds 10M)
- Admin security endpoints: duplicate-devices, banned-devices, banned-ips, ban-device/unban-device, ban-ip/unban-ip, device-accounts
- Non-admin 403 check
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://codigo-necesario.preview.emergentagent.com').rstrip('/')
OWNER_ID = "b45958bc-2c6b-49ea-8102-a11197001e53"
TEST_DEVICE = "TEST_DEV_ITER7_123"
TEST_IP = "203.0.113.77"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ----- Melvin_Live restoration -----
class TestMelvinLiveRestore:
    def test_login_melvin(self, api):
        r = api.post(f"{BASE_URL}/api/login", json={"username": "Melvin_Live", "password": "test123"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        user = data["user"]
        assert user["role"] == "dueño", f"role should be dueño, got {user.get('role')}"
        assert user["coins"] == 500_000_000_000_000, f"coins should be 500T, got {user.get('coins')}"
        assert user["diamonds"] == 10_000_000, f"diamonds should be 10M, got {user.get('diamonds')}"
        assert user["level"] == 50, f"level should be 50, got {user.get('level')}"
        assert user.get("svip_level") == 10, f"svip_level should be 10, got {user.get('svip_level')}"
        assert user["id"] == OWNER_ID


# ----- Admin security endpoints (authorized) -----
class TestAdminSecurity:
    def test_duplicate_devices(self, api):
        r = api.get(f"{BASE_URL}/api/admin/duplicate-devices", params={"admin_id": OWNER_ID})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_banned_devices_list(self, api):
        r = api.get(f"{BASE_URL}/api/admin/banned-devices", params={"admin_id": OWNER_ID})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_banned_ips_list(self, api):
        r = api.get(f"{BASE_URL}/api/admin/banned-ips", params={"admin_id": OWNER_ID})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_ban_unban_device_full_cycle(self, api):
        # ban
        r = api.post(f"{BASE_URL}/api/admin/ban-device",
                     params={"device_id": TEST_DEVICE, "admin_id": OWNER_ID, "reason": "pytest"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True

        # verify it shows up in banned list
        r_list = api.get(f"{BASE_URL}/api/admin/banned-devices", params={"admin_id": OWNER_ID})
        assert r_list.status_code == 200
        assert any(d.get("device_id") == TEST_DEVICE for d in r_list.json()), "device not in banned list"

        # device-accounts returns structure
        r_acc = api.get(f"{BASE_URL}/api/admin/device-accounts/{TEST_DEVICE}", params={"admin_id": OWNER_ID})
        assert r_acc.status_code == 200, r_acc.text
        acc = r_acc.json()
        assert acc["device_id"] == TEST_DEVICE
        assert "account_count" in acc and isinstance(acc["account_count"], int)
        assert acc.get("is_device_banned") is True
        assert "accounts" in acc and isinstance(acc["accounts"], list)

        # unban
        r_ub = api.post(f"{BASE_URL}/api/admin/unban-device",
                        params={"device_id": TEST_DEVICE, "admin_id": OWNER_ID})
        assert r_ub.status_code == 200, r_ub.text
        assert r_ub.json().get("success") is True

        # verify removed
        r_list2 = api.get(f"{BASE_URL}/api/admin/banned-devices", params={"admin_id": OWNER_ID})
        assert not any(d.get("device_id") == TEST_DEVICE for d in r_list2.json()), "device still in banned list"

    def test_ban_unban_ip_full_cycle(self, api):
        r = api.post(f"{BASE_URL}/api/admin/ban-ip",
                     params={"ip_address": TEST_IP, "admin_id": OWNER_ID, "reason": "pytest"})
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        r_list = api.get(f"{BASE_URL}/api/admin/banned-ips", params={"admin_id": OWNER_ID})
        assert r_list.status_code == 200
        assert any(x.get("ip_address") == TEST_IP for x in r_list.json())

        r_ub = api.post(f"{BASE_URL}/api/admin/unban-ip",
                        params={"ip_address": TEST_IP, "admin_id": OWNER_ID})
        assert r_ub.status_code == 200
        assert r_ub.json().get("success") is True

        r_list2 = api.get(f"{BASE_URL}/api/admin/banned-ips", params={"admin_id": OWNER_ID})
        assert not any(x.get("ip_address") == TEST_IP for x in r_list2.json())


# ----- Non-admin 403 -----
class TestNonAdminForbidden:
    @pytest.fixture(scope="class")
    def non_admin_id(self, api):
        # Create a temporary regular user
        username = "TEST_nonadmin_iter7"
        # Try login first (in case exists)
        r = api.post(f"{BASE_URL}/api/login", json={"username": username, "password": "test123"})
        if r.status_code == 200:
            return r.json()["user"]["id"]
        r = api.post(f"{BASE_URL}/api/register", json={"username": username, "password": "test123"})
        if r.status_code == 200:
            return r.json()["user"]["id"]
        # Fallback: use a random UUID (should also 403 as not found -> role check fails)
        pytest.skip(f"Could not create non-admin user: {r.status_code} {r.text}")

    def test_duplicate_devices_forbidden(self, api, non_admin_id):
        r = api.get(f"{BASE_URL}/api/admin/duplicate-devices", params={"admin_id": non_admin_id})
        assert r.status_code == 403, r.text

    def test_banned_devices_forbidden(self, api, non_admin_id):
        r = api.get(f"{BASE_URL}/api/admin/banned-devices", params={"admin_id": non_admin_id})
        assert r.status_code == 403

    def test_banned_ips_forbidden(self, api, non_admin_id):
        r = api.get(f"{BASE_URL}/api/admin/banned-ips", params={"admin_id": non_admin_id})
        assert r.status_code == 403

    def test_ban_device_forbidden(self, api, non_admin_id):
        r = api.post(f"{BASE_URL}/api/admin/ban-device",
                     params={"device_id": "X", "admin_id": non_admin_id, "reason": "x"})
        assert r.status_code == 403

    def test_ban_ip_forbidden(self, api, non_admin_id):
        r = api.post(f"{BASE_URL}/api/admin/ban-ip",
                     params={"ip_address": "1.2.3.4", "admin_id": non_admin_id, "reason": "x"})
        assert r.status_code == 403

    def test_device_accounts_forbidden(self, api, non_admin_id):
        r = api.get(f"{BASE_URL}/api/admin/device-accounts/TEST_DEV", params={"admin_id": non_admin_id})
        assert r.status_code == 403
