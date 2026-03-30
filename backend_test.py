#!/usr/bin/env python3
"""
BudgetWise Backend API Test Suite
Tests all backend endpoints with authentication and user isolation
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Backend URL from frontend env
BACKEND_URL = "https://budgetwise-app-2.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "test1234"

class BudgetWiseAPITester:
    def __init__(self):
        self.admin_token = None
        self.test_token = None
        self.admin_refresh_token = None
        self.test_refresh_token = None
        self.test_results = []
        self.failed_tests = []
        
    def log_result(self, test_name, success, message="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test_name}"
        if message:
            result += f" - {message}"
        if response_data and not success:
            result += f" | Response: {response_data}"
        
        self.test_results.append(result)
        if not success:
            self.failed_tests.append(test_name)
        print(result)
        
    def test_health_endpoint(self):
        """Test health endpoint (no auth required)"""
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    self.log_result("Health Check", True)
                    return True
                else:
                    self.log_result("Health Check", False, f"Unexpected response: {data}")
            else:
                self.log_result("Health Check", False, f"Status {response.status_code}")
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
        return False
        
    def test_auth_register(self):
        """Test user registration"""
        try:
            # Test new user registration
            new_user_data = {
                "name": "Test User",
                "email": "newuser@test.com",
                "password": "test1234"
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/register", 
                                   json=new_user_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data and "access_token" in data and "refresh_token" in data:
                    user = data["user"]
                    if (user["email"] == new_user_data["email"] and 
                        user["name"] == new_user_data["name"] and
                        user["role"] == "user"):
                        self.log_result("Auth Register - New User", True)
                        
                        # Test duplicate email registration
                        dup_response = requests.post(f"{BACKEND_URL}/auth/register", 
                                                   json=new_user_data, timeout=10)
                        if dup_response.status_code == 400:
                            self.log_result("Auth Register - Duplicate Email", True, "Correctly rejected duplicate")
                            return True
                        else:
                            self.log_result("Auth Register - Duplicate Email", False, f"Should return 400, got {dup_response.status_code}")
                    else:
                        self.log_result("Auth Register - New User", False, "Invalid user data in response")
                else:
                    self.log_result("Auth Register - New User", False, "Missing required fields in response")
            else:
                self.log_result("Auth Register - New User", False, f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Auth Register", False, f"Exception: {str(e)}")
        return False
        
    def test_auth_login(self):
        """Test user login"""
        try:
            # Test admin login
            admin_login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", 
                                   json=admin_login_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data and "access_token" in data and "refresh_token" in data:
                    self.admin_token = data["access_token"]
                    self.admin_refresh_token = data["refresh_token"]
                    user = data["user"]
                    if user["email"] == ADMIN_EMAIL and user["role"] == "admin":
                        self.log_result("Auth Login - Admin", True)
                        
                        # Test test user login
                        test_login_data = {
                            "email": TEST_EMAIL,
                            "password": TEST_PASSWORD
                        }
                        
                        test_response = requests.post(f"{BACKEND_URL}/auth/login", 
                                                    json=test_login_data, timeout=10)
                        
                        if test_response.status_code == 200:
                            test_data = test_response.json()
                            if "access_token" in test_data:
                                self.test_token = test_data["access_token"]
                                self.test_refresh_token = test_data["refresh_token"]
                                self.log_result("Auth Login - Test User", True)
                                
                                # Test invalid login
                                invalid_login = {
                                    "email": ADMIN_EMAIL,
                                    "password": "wrongpassword"
                                }
                                
                                invalid_response = requests.post(f"{BACKEND_URL}/auth/login", 
                                                               json=invalid_login, timeout=10)
                                
                                if invalid_response.status_code == 401:
                                    self.log_result("Auth Login - Invalid Password", True, "Correctly rejected invalid password")
                                    return True
                                else:
                                    self.log_result("Auth Login - Invalid Password", False, f"Should return 401, got {invalid_response.status_code}")
                            else:
                                self.log_result("Auth Login - Test User", False, "Missing access_token")
                        else:
                            self.log_result("Auth Login - Test User", False, f"Status {test_response.status_code}")
                    else:
                        self.log_result("Auth Login - Admin", False, "Invalid user data")
                else:
                    self.log_result("Auth Login - Admin", False, "Missing required fields")
            else:
                self.log_result("Auth Login - Admin", False, f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Auth Login", False, f"Exception: {str(e)}")
        return False
        
    def test_auth_me(self):
        """Test get current user endpoint"""
        if not self.admin_token:
            self.log_result("Auth Me", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data:
                    user = data["user"]
                    if user["email"] == ADMIN_EMAIL:
                        self.log_result("Auth Me", True)
                        return True
                    else:
                        self.log_result("Auth Me", False, "Wrong user returned")
                else:
                    self.log_result("Auth Me", False, "No user in response")
            else:
                self.log_result("Auth Me", False, f"Status {response.status_code}")
                
        except Exception as e:
            self.log_result("Auth Me", False, f"Exception: {str(e)}")
        return False
        
    def test_auth_refresh(self):
        """Test token refresh"""
        if not self.admin_refresh_token:
            self.log_result("Auth Refresh", False, "No refresh token available")
            return False
            
        try:
            refresh_data = {"refresh_token": self.admin_refresh_token}
            response = requests.post(f"{BACKEND_URL}/auth/refresh", 
                                   json=refresh_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    # Update admin token with new one
                    self.admin_token = data["access_token"]
                    self.log_result("Auth Refresh", True)
                    return True
                else:
                    self.log_result("Auth Refresh", False, "No access_token in response")
            else:
                self.log_result("Auth Refresh", False, f"Status {response.status_code}")
                
        except Exception as e:
            self.log_result("Auth Refresh", False, f"Exception: {str(e)}")
        return False
        
    def test_categories_crud(self):
        """Test categories CRUD operations"""
        if not self.admin_token:
            self.log_result("Categories CRUD", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test GET categories
            response = requests.get(f"{BACKEND_URL}/categories", headers=headers, timeout=10)
            if response.status_code == 200:
                categories = response.json()
                if isinstance(categories, list) and len(categories) > 0:
                    self.log_result("Categories GET", True, f"Found {len(categories)} categories")
                    
                    # Test POST category
                    new_category = {
                        "name": "Test Category",
                        "type": "expense",
                        "icon": "test-icon",
                        "color": "#FF0000"
                    }
                    
                    post_response = requests.post(f"{BACKEND_URL}/categories", 
                                                json=new_category, headers=headers, timeout=10)
                    
                    if post_response.status_code == 200:
                        created_cat = post_response.json()
                        if "id" in created_cat and created_cat["name"] == new_category["name"]:
                            self.log_result("Categories POST", True)
                            cat_id = created_cat["id"]
                            
                            # Test PUT category
                            updated_category = {
                                "name": "Updated Test Category",
                                "type": "expense",
                                "icon": "updated-icon",
                                "color": "#00FF00"
                            }
                            
                            put_response = requests.put(f"{BACKEND_URL}/categories/{cat_id}", 
                                                      json=updated_category, headers=headers, timeout=10)
                            
                            if put_response.status_code == 200:
                                self.log_result("Categories PUT", True)
                                
                                # Test DELETE category
                                delete_response = requests.delete(f"{BACKEND_URL}/categories/{cat_id}", 
                                                                 headers=headers, timeout=10)
                                
                                if delete_response.status_code == 200:
                                    self.log_result("Categories DELETE", True)
                                    return True
                                else:
                                    self.log_result("Categories DELETE", False, f"Status {delete_response.status_code}")
                            else:
                                self.log_result("Categories PUT", False, f"Status {put_response.status_code}")
                        else:
                            self.log_result("Categories POST", False, "Invalid created category data")
                    else:
                        self.log_result("Categories POST", False, f"Status {post_response.status_code}")
                else:
                    self.log_result("Categories GET", False, "No categories returned")
            else:
                self.log_result("Categories GET", False, f"Status {response.status_code}")
                
        except Exception as e:
            self.log_result("Categories CRUD", False, f"Exception: {str(e)}")
        return False
        
    def test_user_isolation(self):
        """Test user isolation - users should only see their own data"""
        if not self.admin_token or not self.test_token:
            self.log_result("User Isolation", False, "Missing tokens for isolation test")
            return False
            
        try:
            admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
            test_headers = {"Authorization": f"Bearer {self.test_token}"}
            
            # Create a transaction as admin
            admin_transaction = {
                "type": "expense",
                "amount": 100.0,
                "category_id": "test-category-id",
                "description": "Admin test transaction",
                "date": datetime.now().strftime("%Y-%m-%d")
            }
            
            admin_tx_response = requests.post(f"{BACKEND_URL}/transactions", 
                                            json=admin_transaction, headers=admin_headers, timeout=10)
            
            if admin_tx_response.status_code == 200:
                admin_tx = admin_tx_response.json()
                admin_tx_id = admin_tx["id"]
                
                # Try to access admin's transaction as test user
                test_access_response = requests.get(f"{BACKEND_URL}/transactions/{admin_tx_id}", 
                                                  headers=test_headers, timeout=10)
                
                if test_access_response.status_code == 404:
                    self.log_result("User Isolation - Transaction Access", True, "Test user correctly cannot access admin transaction")
                    
                    # Get transactions as test user - should be empty or not include admin's
                    test_txs_response = requests.get(f"{BACKEND_URL}/transactions", 
                                                   headers=test_headers, timeout=10)
                    
                    if test_txs_response.status_code == 200:
                        test_txs = test_txs_response.json()
                        admin_tx_found = False
                        if "transactions" in test_txs:
                            for tx in test_txs["transactions"]:
                                if tx["id"] == admin_tx_id:
                                    admin_tx_found = True
                                    break
                        
                        if not admin_tx_found:
                            self.log_result("User Isolation - Transaction List", True, "Admin transaction not visible in test user's list")
                            
                            # Clean up - delete admin transaction
                            requests.delete(f"{BACKEND_URL}/transactions/{admin_tx_id}", 
                                          headers=admin_headers, timeout=10)
                            return True
                        else:
                            self.log_result("User Isolation - Transaction List", False, "Admin transaction visible in test user's list")
                    else:
                        self.log_result("User Isolation - Transaction List", False, f"Status {test_txs_response.status_code}")
                else:
                    self.log_result("User Isolation - Transaction Access", False, f"Test user can access admin transaction (status {test_access_response.status_code})")
            else:
                self.log_result("User Isolation", False, f"Failed to create admin transaction: {admin_tx_response.status_code}")
                
        except Exception as e:
            self.log_result("User Isolation", False, f"Exception: {str(e)}")
        return False
        
    def test_transactions_crud(self):
        """Test transactions CRUD operations"""
        if not self.admin_token:
            self.log_result("Transactions CRUD", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test GET transactions
            response = requests.get(f"{BACKEND_URL}/transactions", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "transactions" in data:
                    self.log_result("Transactions GET", True, f"Found {len(data['transactions'])} transactions")
                    
                    # Test POST transaction
                    new_transaction = {
                        "type": "expense",
                        "amount": 50.0,
                        "category_id": "test-category",
                        "description": "Test transaction",
                        "date": datetime.now().strftime("%Y-%m-%d")
                    }
                    
                    post_response = requests.post(f"{BACKEND_URL}/transactions", 
                                                json=new_transaction, headers=headers, timeout=10)
                    
                    if post_response.status_code == 200:
                        created_tx = post_response.json()
                        if "id" in created_tx:
                            self.log_result("Transactions POST", True)
                            tx_id = created_tx["id"]
                            
                            # Test PUT transaction
                            updated_transaction = {
                                "amount": 75.0,
                                "description": "Updated test transaction"
                            }
                            
                            put_response = requests.put(f"{BACKEND_URL}/transactions/{tx_id}", 
                                                      json=updated_transaction, headers=headers, timeout=10)
                            
                            if put_response.status_code == 200:
                                self.log_result("Transactions PUT", True)
                                
                                # Test DELETE transaction
                                delete_response = requests.delete(f"{BACKEND_URL}/transactions/{tx_id}", 
                                                                 headers=headers, timeout=10)
                                
                                if delete_response.status_code == 200:
                                    self.log_result("Transactions DELETE", True)
                                    return True
                                else:
                                    self.log_result("Transactions DELETE", False, f"Status {delete_response.status_code}")
                            else:
                                self.log_result("Transactions PUT", False, f"Status {put_response.status_code}")
                        else:
                            self.log_result("Transactions POST", False, "No ID in created transaction")
                    else:
                        self.log_result("Transactions POST", False, f"Status {post_response.status_code}")
                else:
                    self.log_result("Transactions GET", False, "No transactions field in response")
            else:
                self.log_result("Transactions GET", False, f"Status {response.status_code}")
                
        except Exception as e:
            self.log_result("Transactions CRUD", False, f"Exception: {str(e)}")
        return False
        
    def test_budgets_crud(self):
        """Test budgets CRUD operations"""
        if not self.admin_token:
            self.log_result("Budgets CRUD", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test GET budgets
            response = requests.get(f"{BACKEND_URL}/budgets", headers=headers, timeout=10)
            if response.status_code == 200:
                budgets = response.json()
                self.log_result("Budgets GET", True, f"Found {len(budgets)} budgets")
                
                # Test POST budget
                new_budget = {
                    "category_id": "test-category",
                    "amount": 1000.0,
                    "month": datetime.now().strftime("%Y-%m")
                }
                
                post_response = requests.post(f"{BACKEND_URL}/budgets", 
                                            json=new_budget, headers=headers, timeout=10)
                
                if post_response.status_code == 200:
                    created_budget = post_response.json()
                    if "id" in created_budget:
                        self.log_result("Budgets POST", True)
                        budget_id = created_budget["id"]
                        
                        # Test DELETE budget
                        delete_response = requests.delete(f"{BACKEND_URL}/budgets/{budget_id}", 
                                                         headers=headers, timeout=10)
                        
                        if delete_response.status_code == 200:
                            self.log_result("Budgets DELETE", True)
                            return True
                        else:
                            self.log_result("Budgets DELETE", False, f"Status {delete_response.status_code}")
                    else:
                        self.log_result("Budgets POST", False, "No ID in created budget")
                else:
                    self.log_result("Budgets POST", False, f"Status {post_response.status_code}")
            else:
                self.log_result("Budgets GET", False, f"Status {response.status_code}")
                
        except Exception as e:
            self.log_result("Budgets CRUD", False, f"Exception: {str(e)}")
        return False
        
    def test_analytics_endpoints(self):
        """Test analytics endpoints"""
        if not self.admin_token:
            self.log_result("Analytics", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test summary
            response = requests.get(f"{BACKEND_URL}/analytics/summary", headers=headers, timeout=10)
            if response.status_code == 200:
                self.log_result("Analytics Summary", True)
            else:
                self.log_result("Analytics Summary", False, f"Status {response.status_code}")
                
            # Test category breakdown
            response = requests.get(f"{BACKEND_URL}/analytics/category-breakdown", headers=headers, timeout=10)
            if response.status_code == 200:
                self.log_result("Analytics Category Breakdown", True)
            else:
                self.log_result("Analytics Category Breakdown", False, f"Status {response.status_code}")
                
            # Test daily trend
            response = requests.get(f"{BACKEND_URL}/analytics/daily-trend", headers=headers, timeout=10)
            if response.status_code == 200:
                self.log_result("Analytics Daily Trend", True)
            else:
                self.log_result("Analytics Daily Trend", False, f"Status {response.status_code}")
                
            # Test monthly trend
            response = requests.get(f"{BACKEND_URL}/analytics/monthly-trend", headers=headers, timeout=10)
            if response.status_code == 200:
                self.log_result("Analytics Monthly Trend", True)
            else:
                self.log_result("Analytics Monthly Trend", False, f"Status {response.status_code}")
                
            # Test stats
            response = requests.get(f"{BACKEND_URL}/analytics/stats", headers=headers, timeout=10)
            if response.status_code == 200:
                self.log_result("Analytics Stats", True)
                return True
            else:
                self.log_result("Analytics Stats", False, f"Status {response.status_code}")
                
        except Exception as e:
            self.log_result("Analytics", False, f"Exception: {str(e)}")
        return False
        
    def test_settings_endpoints(self):
        """Test settings endpoints"""
        if not self.admin_token:
            self.log_result("Settings", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test GET settings
            response = requests.get(f"{BACKEND_URL}/settings", headers=headers, timeout=10)
            if response.status_code == 200:
                settings = response.json()
                self.log_result("Settings GET", True)
                
                # Test PUT settings
                updated_settings = {
                    "currency": "USD",
                    "theme": "dark"
                }
                
                put_response = requests.put(f"{BACKEND_URL}/settings", 
                                          json=updated_settings, headers=headers, timeout=10)
                
                if put_response.status_code == 200:
                    self.log_result("Settings PUT", True)
                    
                    # Test PIN operations
                    pin_data = {"pin": "123456"}
                    
                    # Set PIN
                    pin_response = requests.post(f"{BACKEND_URL}/settings/pin/set", 
                                               json=pin_data, headers=headers, timeout=10)
                    
                    if pin_response.status_code == 200:
                        self.log_result("Settings PIN Set", True)
                        
                        # Verify PIN
                        verify_response = requests.post(f"{BACKEND_URL}/settings/pin/verify", 
                                                      json=pin_data, headers=headers, timeout=10)
                        
                        if verify_response.status_code == 200:
                            self.log_result("Settings PIN Verify", True)
                            
                            # Remove PIN
                            remove_response = requests.delete(f"{BACKEND_URL}/settings/pin", 
                                                            headers=headers, timeout=10)
                            
                            if remove_response.status_code == 200:
                                self.log_result("Settings PIN Remove", True)
                                return True
                            else:
                                self.log_result("Settings PIN Remove", False, f"Status {remove_response.status_code}")
                        else:
                            self.log_result("Settings PIN Verify", False, f"Status {verify_response.status_code}")
                    else:
                        self.log_result("Settings PIN Set", False, f"Status {pin_response.status_code}")
                else:
                    self.log_result("Settings PUT", False, f"Status {put_response.status_code}")
            else:
                self.log_result("Settings GET", False, f"Status {response.status_code}")
                
        except Exception as e:
            self.log_result("Settings", False, f"Exception: {str(e)}")
        return False
        
    def test_weekly_report(self):
        """Test weekly report endpoint"""
        if not self.admin_token:
            self.log_result("Weekly Report", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BACKEND_URL}/reports/weekly", headers=headers, timeout=10)
            
            if response.status_code == 200:
                report = response.json()
                if "period_start" in report and "period_end" in report:
                    self.log_result("Weekly Report", True)
                    return True
                else:
                    self.log_result("Weekly Report", False, "Missing required fields in report")
            else:
                self.log_result("Weekly Report", False, f"Status {response.status_code}")
                
        except Exception as e:
            self.log_result("Weekly Report", False, f"Exception: {str(e)}")
        return False
        
    def test_export_endpoints(self):
        """Test export/backup endpoints"""
        if not self.admin_token:
            self.log_result("Export/Backup", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test CSV export
            csv_response = requests.get(f"{BACKEND_URL}/export/csv", headers=headers, timeout=10)
            if csv_response.status_code == 200:
                self.log_result("Export CSV", True)
            else:
                self.log_result("Export CSV", False, f"Status {csv_response.status_code}")
                
            # Test backup
            backup_response = requests.get(f"{BACKEND_URL}/export/backup", headers=headers, timeout=10)
            if backup_response.status_code == 200:
                backup_data = backup_response.json()
                if "transactions" in backup_data and "categories" in backup_data:
                    self.log_result("Export Backup", True)
                    
                    # Test import backup
                    import_data = {
                        "transactions": [],
                        "categories": [],
                        "budgets": []
                    }
                    
                    import_response = requests.post(f"{BACKEND_URL}/import/backup", 
                                                  json=import_data, headers=headers, timeout=10)
                    
                    if import_response.status_code == 200:
                        self.log_result("Import Backup", True)
                        
                        # Test data reset
                        reset_response = requests.delete(f"{BACKEND_URL}/data/reset", 
                                                       headers=headers, timeout=10)
                        
                        if reset_response.status_code == 200:
                            self.log_result("Data Reset", True)
                            return True
                        else:
                            self.log_result("Data Reset", False, f"Status {reset_response.status_code}")
                    else:
                        self.log_result("Import Backup", False, f"Status {import_response.status_code}")
                else:
                    self.log_result("Export Backup", False, "Missing required fields in backup")
            else:
                self.log_result("Export Backup", False, f"Status {backup_response.status_code}")
                
        except Exception as e:
            self.log_result("Export/Backup", False, f"Exception: {str(e)}")
        return False
        
    def run_all_tests(self):
        """Run all tests in order"""
        print(f"🚀 Starting BudgetWise Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Health check first
        if not self.test_health_endpoint():
            print("❌ Health check failed - aborting tests")
            return False
            
        # Auth tests
        self.test_auth_register()
        self.test_auth_login()
        self.test_auth_me()
        self.test_auth_refresh()
        
        # User isolation test
        self.test_user_isolation()
        
        # CRUD tests
        self.test_categories_crud()
        self.test_transactions_crud()
        self.test_budgets_crud()
        
        # Analytics tests
        self.test_analytics_endpoints()
        
        # Settings tests
        self.test_settings_endpoints()
        
        # Report tests
        self.test_weekly_report()
        
        # Export tests
        self.test_export_endpoints()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        failed_count = len(self.failed_tests)
        passed_count = total_tests - failed_count
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_count}")
        print(f"Failed: {failed_count}")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        print("\n📋 ALL TEST RESULTS:")
        for result in self.test_results:
            print(f"  {result}")
            
        return failed_count == 0

if __name__ == "__main__":
    tester = BudgetWiseAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)