"""
Backend API Tests for BudgetWise Personal Finance App
Tests: Health, Categories, Transactions CRUD, Analytics, Budgets CRUD, Settings & PIN
"""
import pytest
import requests
import os
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Load frontend .env for EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in environment")
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

class TestHealth:
    """Health check endpoint"""
    
    def test_health_check(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data

class TestCategories:
    """Category endpoints - should have 14 default categories"""
    
    def test_get_all_categories(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) == 14, f"Expected 14 default categories, got {len(categories)}"
        
        # Verify structure
        for cat in categories:
            assert "id" in cat
            assert "name" in cat
            assert "type" in cat
            assert cat["type"] in ["income", "expense"]
            assert "icon" in cat
            assert "color" in cat
            assert "is_default" in cat
    
    def test_get_expense_categories(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/categories?type=expense")
        assert response.status_code == 200
        categories = response.json()
        assert len(categories) == 9, f"Expected 9 expense categories, got {len(categories)}"
        for cat in categories:
            assert cat["type"] == "expense"
    
    def test_get_income_categories(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/categories?type=income")
        assert response.status_code == 200
        categories = response.json()
        assert len(categories) == 5, f"Expected 5 income categories, got {len(categories)}"
        for cat in categories:
            assert cat["type"] == "income"
    
    def test_create_custom_category(self, api_client):
        # Create custom category
        create_payload = {
            "name": "TEST_Custom Category",
            "type": "expense",
            "icon": "star",
            "color": "#FF0000"
        }
        create_response = api_client.post(f"{BASE_URL}/api/categories", json=create_payload)
        assert create_response.status_code == 200
        
        created_cat = create_response.json()
        assert created_cat["name"] == create_payload["name"]
        assert created_cat["is_default"] == False
        assert "id" in created_cat
        
        # Verify persistence with GET
        all_cats = api_client.get(f"{BASE_URL}/api/categories").json()
        assert len(all_cats) == 15  # 14 default + 1 custom

class TestTransactions:
    """Transaction CRUD operations"""
    
    def test_create_transaction_and_verify(self, api_client):
        # Get a category first
        categories = api_client.get(f"{BASE_URL}/api/categories?type=expense").json()
        assert len(categories) > 0
        category_id = categories[0]["id"]
        
        # Create transaction
        create_payload = {
            "type": "expense",
            "amount": 50000,
            "category_id": category_id,
            "description": "TEST_Transaction for testing",
            "date": datetime.now().isoformat()
        }
        create_response = api_client.post(f"{BASE_URL}/api/transactions", json=create_payload)
        assert create_response.status_code == 200
        
        created_tx = create_response.json()
        assert created_tx["amount"] == create_payload["amount"]
        assert created_tx["type"] == "expense"
        assert "id" in created_tx
        tx_id = created_tx["id"]
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/transactions/{tx_id}")
        assert get_response.status_code == 200
        fetched_tx = get_response.json()
        assert fetched_tx["id"] == tx_id
        assert fetched_tx["amount"] == 50000
    
    def test_get_transactions_list(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/transactions?page=1&limit=20")
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "pages" in data
        assert isinstance(data["transactions"], list)
    
    def test_update_transaction_and_verify(self, api_client):
        # Create transaction first
        categories = api_client.get(f"{BASE_URL}/api/categories?type=income").json()
        category_id = categories[0]["id"]
        
        create_payload = {
            "type": "income",
            "amount": 100000,
            "category_id": category_id,
            "description": "TEST_Original description",
            "date": datetime.now().isoformat()
        }
        created_tx = api_client.post(f"{BASE_URL}/api/transactions", json=create_payload).json()
        tx_id = created_tx["id"]
        
        # Update transaction
        update_payload = {
            "amount": 150000,
            "description": "TEST_Updated description"
        }
        update_response = api_client.put(f"{BASE_URL}/api/transactions/{tx_id}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify update persisted
        get_response = api_client.get(f"{BASE_URL}/api/transactions/{tx_id}")
        updated_tx = get_response.json()
        assert updated_tx["amount"] == 150000
        assert updated_tx["description"] == "TEST_Updated description"
    
    def test_delete_transaction_and_verify(self, api_client):
        # Create transaction first
        categories = api_client.get(f"{BASE_URL}/api/categories?type=expense").json()
        category_id = categories[0]["id"]
        
        create_payload = {
            "type": "expense",
            "amount": 25000,
            "category_id": category_id,
            "description": "TEST_To be deleted",
            "date": datetime.now().isoformat()
        }
        created_tx = api_client.post(f"{BASE_URL}/api/transactions", json=create_payload).json()
        tx_id = created_tx["id"]
        
        # Delete transaction
        delete_response = api_client.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion - should return 404
        get_response = api_client.get(f"{BASE_URL}/api/transactions/{tx_id}")
        assert get_response.status_code == 404

class TestAnalytics:
    """Analytics endpoints"""
    
    def test_get_summary(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/analytics/summary")
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
        assert "month_income" in data
        assert "month_expense" in data
        assert "month_net" in data
        assert "transaction_count" in data
        assert isinstance(data["balance"], (int, float))
    
    def test_get_summary_with_month(self, api_client):
        current_month = datetime.now().strftime("%Y-%m")
        response = api_client.get(f"{BASE_URL}/api/analytics/summary?month={current_month}")
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
    
    def test_get_category_breakdown(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/analytics/category-breakdown")
        assert response.status_code == 200
        data = response.json()
        assert "breakdown" in data
        assert "total" in data
        assert isinstance(data["breakdown"], list)
    
    def test_get_daily_trend(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/analytics/daily-trend?days=7")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 7
        for day in data:
            assert "date" in day
            assert "income" in day
            assert "expense" in day
    
    def test_get_monthly_trend(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/analytics/monthly-trend?months=6")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 6
        for month in data:
            assert "month" in month
            assert "income" in month
            assert "expense" in month
            assert "net" in month

class TestBudgets:
    """Budget CRUD operations"""
    
    def test_create_budget_and_verify(self, api_client):
        # Get expense category
        categories = api_client.get(f"{BASE_URL}/api/categories?type=expense").json()
        category_id = categories[0]["id"]
        current_month = datetime.now().strftime("%Y-%m")
        
        # Create budget
        create_payload = {
            "category_id": category_id,
            "amount": 500000,
            "month": current_month
        }
        create_response = api_client.post(f"{BASE_URL}/api/budgets", json=create_payload)
        assert create_response.status_code == 200
        
        created_budget = create_response.json()
        assert created_budget["amount"] == 500000
        assert created_budget["category_id"] == category_id
        assert "id" in created_budget
        
        # Verify persistence
        get_response = api_client.get(f"{BASE_URL}/api/budgets?month={current_month}")
        budgets = get_response.json()
        assert any(b["id"] == created_budget["id"] for b in budgets)
    
    def test_get_budgets(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/budgets")
        assert response.status_code == 200
        budgets = response.json()
        assert isinstance(budgets, list)
    
    def test_delete_budget_and_verify(self, api_client):
        # Create budget first
        categories = api_client.get(f"{BASE_URL}/api/categories?type=expense").json()
        category_id = categories[1]["id"]  # Use different category
        current_month = datetime.now().strftime("%Y-%m")
        
        create_payload = {
            "category_id": category_id,
            "amount": 300000,
            "month": current_month
        }
        created_budget = api_client.post(f"{BASE_URL}/api/budgets", json=create_payload).json()
        budget_id = created_budget["id"]
        
        # Delete budget
        delete_response = api_client.delete(f"{BASE_URL}/api/budgets/{budget_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/budgets?month={current_month}")
        budgets = get_response.json()
        assert not any(b["id"] == budget_id for b in budgets)

class TestSettings:
    """Settings and PIN management"""
    
    def test_get_settings(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        settings = response.json()
        assert "id" in settings
        assert "currency" in settings
        assert "date_format" in settings
        assert "theme" in settings
        assert "has_pin" in settings
        assert isinstance(settings["has_pin"], bool)
    
    def test_update_settings(self, api_client):
        update_payload = {
            "profile_name": "TEST_User"
        }
        response = api_client.put(f"{BASE_URL}/api/settings", json=update_payload)
        assert response.status_code == 200
        updated_settings = response.json()
        assert updated_settings["profile_name"] == "TEST_User"
    
    def test_pin_set_verify_remove_flow(self, api_client):
        # Set PIN
        set_payload = {"pin": "123456"}
        set_response = api_client.post(f"{BASE_URL}/api/settings/pin/set", json=set_payload)
        assert set_response.status_code == 200
        assert set_response.json()["has_pin"] == True
        
        # Verify correct PIN
        verify_payload = {"pin": "123456"}
        verify_response = api_client.post(f"{BASE_URL}/api/settings/pin/verify", json=verify_payload)
        assert verify_response.status_code == 200
        assert verify_response.json()["valid"] == True
        
        # Verify wrong PIN
        wrong_payload = {"pin": "999999"}
        wrong_response = api_client.post(f"{BASE_URL}/api/settings/pin/verify", json=wrong_payload)
        assert wrong_response.status_code == 401
        
        # Remove PIN
        remove_response = api_client.delete(f"{BASE_URL}/api/settings/pin")
        assert remove_response.status_code == 200
        assert remove_response.json()["has_pin"] == False
        
        # Verify settings updated
        settings = api_client.get(f"{BASE_URL}/api/settings").json()
        assert settings["has_pin"] == False
    
    def test_pin_validation(self, api_client):
        # Test invalid PIN (not 6 digits)
        invalid_payload = {"pin": "12345"}
        response = api_client.post(f"{BASE_URL}/api/settings/pin/set", json=invalid_payload)
        assert response.status_code == 400
        
        # Test non-numeric PIN
        invalid_payload2 = {"pin": "abcdef"}
        response2 = api_client.post(f"{BASE_URL}/api/settings/pin/set", json=invalid_payload2)
        assert response2.status_code == 400
