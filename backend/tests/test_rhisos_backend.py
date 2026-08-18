"""Rhisos Mobilya CRM backend tests - auth, customers, quotes, transactions, dashboard."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rhisos-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "iskberkan@gmail.com"
ADMIN_PASSWORD = "rhisos2026"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("email") == ADMIN_EMAIL
    assert data.get("role") == "admin"
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-pass-xxx"})
        assert r.status_code == 401

    def test_me_unauthorized(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_new_user(self):
        email = f"test_user_{int(time.time())}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "TEST User"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email


# ---------------- Customers ----------------
class TestCustomers:
    created_id = None

    def test_create_customer(self, admin_session):
        payload = {"name": "TEST_Musteri", "company": "TEST Co", "email": "t@test.com", "phone": "555", "address": "adr", "notes": "n"}
        r = admin_session.post(f"{API}/customers", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_Musteri"
        assert "id" in data
        TestCustomers.created_id = data["id"]

    def test_get_customers(self, admin_session):
        r = admin_session.get(f"{API}/customers")
        assert r.status_code == 200
        assert any(c["id"] == TestCustomers.created_id for c in r.json())

    def test_update_customer(self, admin_session):
        payload = {"name": "TEST_Updated", "company": "X", "email": "", "phone": "", "address": "", "notes": ""}
        r = admin_session.put(f"{API}/customers/{TestCustomers.created_id}", json=payload)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Updated"

    def test_delete_customer_last(self, admin_session):
        # keep customer for quote tests, defer delete
        pass


# ---------------- Quotes ----------------
class TestQuotes:
    customer_id = None
    quote_id = None

    def test_setup_customer(self, admin_session):
        r = admin_session.post(f"{API}/customers", json={"name": "TEST_QCust"})
        assert r.status_code == 200
        TestQuotes.customer_id = r.json()["id"]

    def test_create_quote_totals(self, admin_session):
        payload = {
            "customer_id": TestQuotes.customer_id,
            "customer_name": "TEST_QCust",
            "title": "TEST Teklif",
            "items": [
                {"description": "Koltuk", "quantity": 2, "unit_price": 1000, "vat_rate": 20},
                {"description": "Masa", "quantity": 1, "unit_price": 500, "vat_rate": 20},
            ],
            "currency": "TRY",
            "discount": 100,
        }
        r = admin_session.post(f"{API}/quotes", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        # subtotal = 2500, vat = 500, disc 100 -> grand 2900
        assert d["subtotal"] == 2500.0
        assert d["vat_total"] == 500.0
        assert d["grand_total"] == 2900.0
        assert d["status"] == "pending"
        assert d["quote_number"].startswith("TKF-")
        TestQuotes.quote_id = d["id"]

    def test_get_quote(self, admin_session):
        r = admin_session.get(f"{API}/quotes/{TestQuotes.quote_id}")
        assert r.status_code == 200
        assert r.json()["id"] == TestQuotes.quote_id

    def test_update_quote(self, admin_session):
        payload = {
            "customer_id": TestQuotes.customer_id,
            "customer_name": "TEST_QCust",
            "title": "TEST Teklif V2",
            "items": [{"description": "Sandalye", "quantity": 4, "unit_price": 250, "vat_rate": 10}],
            "currency": "TRY",
            "discount": 0,
        }
        r = admin_session.put(f"{API}/quotes/{TestQuotes.quote_id}", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["subtotal"] == 1000.0
        assert d["vat_total"] == 100.0
        assert d["grand_total"] == 1100.0
        assert d["title"] == "TEST Teklif V2"

    def test_approve_creates_income(self, admin_session):
        r = admin_session.patch(f"{API}/quotes/{TestQuotes.quote_id}/status", json={"status": "approved"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"
        # verify auto income exists
        tx = admin_session.get(f"{API}/transactions", params={"type": "income"}).json()
        auto = [t for t in tx if t.get("quote_id") == TestQuotes.quote_id and t.get("auto")]
        assert len(auto) == 1
        assert auto[0]["amount"] == 1100.0

    def test_revert_removes_income(self, admin_session):
        r = admin_session.patch(f"{API}/quotes/{TestQuotes.quote_id}/status", json={"status": "pending"})
        assert r.status_code == 200
        tx = admin_session.get(f"{API}/transactions").json()
        auto = [t for t in tx if t.get("quote_id") == TestQuotes.quote_id and t.get("auto")]
        assert len(auto) == 0

    def test_delete_quote(self, admin_session):
        # re-approve to ensure auto txn exists, then delete
        admin_session.patch(f"{API}/quotes/{TestQuotes.quote_id}/status", json={"status": "approved"})
        r = admin_session.delete(f"{API}/quotes/{TestQuotes.quote_id}")
        assert r.status_code == 200
        # verify quote gone
        r2 = admin_session.get(f"{API}/quotes/{TestQuotes.quote_id}")
        assert r2.status_code == 404
        # verify auto txn removed
        tx = admin_session.get(f"{API}/transactions").json()
        auto = [t for t in tx if t.get("quote_id") == TestQuotes.quote_id]
        assert len(auto) == 0
        # cleanup customer
        admin_session.delete(f"{API}/customers/{TestQuotes.customer_id}")


# ---------------- Transactions ----------------
class TestTransactions:
    tid = None

    def test_create_income(self, admin_session):
        r = admin_session.post(f"{API}/transactions", json={
            "type": "income", "amount": 500, "category": "TEST_Satis",
            "payment_method": "cash", "date": "2026-01-10", "currency": "TRY",
        })
        assert r.status_code == 200
        TestTransactions.tid = r.json()["id"]

    def test_create_expense(self, admin_session):
        r = admin_session.post(f"{API}/transactions", json={
            "type": "expense", "amount": 200, "category": "TEST_Kira",
            "payment_method": "bank", "date": "2026-01-11", "currency": "TRY",
        })
        assert r.status_code == 200

    def test_filter_type(self, admin_session):
        r = admin_session.get(f"{API}/transactions", params={"type": "income"})
        assert r.status_code == 200
        assert all(t["type"] == "income" for t in r.json())

    def test_filter_date(self, admin_session):
        r = admin_session.get(f"{API}/transactions", params={"start": "2026-01-10", "end": "2026-01-10"})
        assert r.status_code == 200
        for t in r.json():
            assert "2026-01-10" <= t["date"] <= "2026-01-10"

    def test_delete_transaction(self, admin_session):
        r = admin_session.delete(f"{API}/transactions/{TestTransactions.tid}")
        assert r.status_code == 200


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_stats(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_income", "total_expense", "balance", "monthly", "expense_by_category", "quote_counts", "customer_count"]:
            assert k in d
