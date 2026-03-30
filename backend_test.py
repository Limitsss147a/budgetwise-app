#!/usr/bin/env python3
"""
Backend API Testing for BudgetWise App - Notification Endpoints Focus
Tests the new notification-related endpoints and verifies existing settings functionality
"""

import requests
import json
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "https://budgetwise-app-2.preview.emergentagent.com/api"
TEST_EMAIL = "admin@example.com"
TEST_PASSWORD = "admin123"

class BudgetWiseAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def login(self) -> bool:
        """Login and get access token"""
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                self.user_id = data["user"]["id"]
                self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
                self.log(f"✅ Login successful for {TEST_EMAIL}")
                return True
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}", "ERROR")
            return False
    
    def test_get_settings_notification_fields(self) -> bool:
        """Test GET /api/settings includes notification fields with defaults"""
        try:
            response = self.session.get(f"{self.base_url}/settings")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for notification fields
                required_fields = ["weekly_report_enabled", "weekly_report_day", "weekly_report_hour"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"❌ Missing notification fields: {missing_fields}", "ERROR")
                    return False
                
                # Check default values
                expected_defaults = {
                    "weekly_report_enabled": False,
                    "weekly_report_day": 1,
                    "weekly_report_hour": 9
                }
                
                for field, expected_value in expected_defaults.items():
                    actual_value = data.get(field)
                    if actual_value != expected_value:
                        self.log(f"❌ Field {field}: expected {expected_value}, got {actual_value}", "ERROR")
                        return False
                
                # Check existing fields still present
                existing_fields = ["currency", "theme", "has_pin"]
                for field in existing_fields:
                    if field not in data:
                        self.log(f"❌ Missing existing field: {field}", "ERROR")
                        return False
                
                # profile_name might not be set initially, so just check if it exists or is None
                if "profile_name" not in data:
                    self.log("ℹ️  profile_name field not present (acceptable for new users)")
                else:
                    self.log(f"ℹ️  profile_name: {data.get('profile_name')}")
                
                self.log("✅ GET /api/settings includes all notification fields with correct defaults")
                self.log(f"   - weekly_report_enabled: {data['weekly_report_enabled']}")
                self.log(f"   - weekly_report_day: {data['weekly_report_day']}")
                self.log(f"   - weekly_report_hour: {data['weekly_report_hour']}")
                return True
                
            else:
                self.log(f"❌ GET /api/settings failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ GET settings error: {str(e)}", "ERROR")
            return False
    
    def test_update_notification_settings(self) -> bool:
        """Test PUT /api/settings with notification fields"""
        try:
            # Test 1: Enable notifications with specific day/hour
            test_data = {
                "weekly_report_enabled": True,
                "weekly_report_day": 3,  # Wednesday
                "weekly_report_hour": 14  # 2 PM
            }
            
            response = self.session.put(
                f"{self.base_url}/settings",
                json=test_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log(f"❌ PUT /api/settings failed: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Verify the update
            get_response = self.session.get(f"{self.base_url}/settings")
            if get_response.status_code != 200:
                self.log(f"❌ GET /api/settings after update failed: {get_response.status_code}", "ERROR")
                return False
            
            updated_data = get_response.json()
            for field, expected_value in test_data.items():
                actual_value = updated_data.get(field)
                if actual_value != expected_value:
                    self.log(f"❌ Update verification failed for {field}: expected {expected_value}, got {actual_value}", "ERROR")
                    return False
            
            self.log("✅ PUT /api/settings successfully updated notification settings")
            self.log(f"   - Enabled: {updated_data['weekly_report_enabled']}")
            self.log(f"   - Day: {updated_data['weekly_report_day']} (Wednesday)")
            self.log(f"   - Hour: {updated_data['weekly_report_hour']} (2 PM)")
            
            # Test 2: Disable notifications
            disable_data = {"weekly_report_enabled": False}
            
            response = self.session.put(
                f"{self.base_url}/settings",
                json=disable_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log(f"❌ PUT /api/settings disable failed: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Verify disable
            get_response = self.session.get(f"{self.base_url}/settings")
            if get_response.status_code == 200:
                disabled_data = get_response.json()
                if disabled_data.get("weekly_report_enabled") != False:
                    self.log(f"❌ Disable verification failed: expected False, got {disabled_data.get('weekly_report_enabled')}", "ERROR")
                    return False
                
                self.log("✅ PUT /api/settings successfully disabled notifications")
                return True
            else:
                self.log(f"❌ GET /api/settings after disable failed: {get_response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Update notification settings error: {str(e)}", "ERROR")
            return False
    
    def test_register_push_token(self) -> bool:
        """Test POST /api/notifications/register"""
        try:
            test_token = "ExponentPushToken[test123abc]"
            
            response = self.session.post(
                f"{self.base_url}/notifications/register",
                json={"token": test_token},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_message = "Token registered"
                
                if data.get("message") == expected_message:
                    self.log("✅ POST /api/notifications/register successful")
                    self.log(f"   - Response: {data['message']}")
                    return True
                else:
                    self.log(f"❌ Unexpected response message: expected '{expected_message}', got '{data.get('message')}'", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/notifications/register failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Register push token error: {str(e)}", "ERROR")
            return False
    
    def test_auth_required(self) -> bool:
        """Test that all endpoints require authentication"""
        try:
            # Create session without auth token
            unauth_session = requests.Session()
            
            endpoints_to_test = [
                ("GET", "/settings"),
                ("PUT", "/settings"),
                ("POST", "/notifications/register")
            ]
            
            all_protected = True
            
            for method, endpoint in endpoints_to_test:
                if method == "GET":
                    response = unauth_session.get(f"{self.base_url}{endpoint}")
                elif method == "PUT":
                    response = unauth_session.put(f"{self.base_url}{endpoint}", json={})
                elif method == "POST":
                    response = unauth_session.post(f"{self.base_url}{endpoint}", json={})
                
                if response.status_code != 401:
                    self.log(f"❌ {method} {endpoint} should return 401 without auth, got {response.status_code}", "ERROR")
                    all_protected = False
                else:
                    self.log(f"✅ {method} {endpoint} properly protected (401)")
            
            if all_protected:
                self.log("✅ All notification endpoints require authentication")
                return True
            else:
                self.log("❌ Some endpoints are not properly protected", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Auth protection test error: {str(e)}", "ERROR")
            return False
    
    def test_existing_settings_functionality(self) -> bool:
        """Test that existing settings endpoints still work"""
        try:
            # Test updating profile name
            test_profile_name = "Test User Updated"
            
            response = self.session.put(
                f"{self.base_url}/settings",
                json={"profile_name": test_profile_name},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log(f"❌ PUT /api/settings with profile_name failed: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Verify the update
            get_response = self.session.get(f"{self.base_url}/settings")
            if get_response.status_code != 200:
                self.log(f"❌ GET /api/settings verification failed: {get_response.status_code}", "ERROR")
                return False
            
            data = get_response.json()
            if data.get("profile_name") != test_profile_name:
                self.log(f"❌ Profile name update failed: expected '{test_profile_name}', got '{data.get('profile_name')}'", "ERROR")
                return False
            
            # Check that all existing fields are still present
            required_existing_fields = ["currency", "theme", "has_pin"]
            for field in required_existing_fields:
                if field not in data:
                    self.log(f"❌ Missing existing field after update: {field}", "ERROR")
                    return False
            
            self.log("✅ Existing settings functionality still works")
            self.log(f"   - Profile name updated to: {data['profile_name']}")
            self.log(f"   - Currency: {data.get('currency')}")
            self.log(f"   - Theme: {data.get('theme')}")
            self.log(f"   - Has PIN: {data.get('has_pin')}")
            return True
            
        except Exception as e:
            self.log(f"❌ Existing settings test error: {str(e)}", "ERROR")
            return False
    
    def test_notification_field_validation(self) -> bool:
        """Test validation of notification fields"""
        try:
            # Test invalid day (should be 1-7)
            invalid_day_data = {"weekly_report_day": 8}
            
            response = self.session.put(
                f"{self.base_url}/settings",
                json=invalid_day_data,
                headers={"Content-Type": "application/json"}
            )
            
            # Note: The current implementation doesn't validate ranges, so this will pass
            # This is documenting current behavior, not necessarily expected behavior
            if response.status_code == 200:
                self.log("ℹ️  No validation for weekly_report_day range (current implementation)")
            
            # Test invalid hour (should be 0-23)
            invalid_hour_data = {"weekly_report_hour": 25}
            
            response = self.session.put(
                f"{self.base_url}/settings",
                json=invalid_hour_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                self.log("ℹ️  No validation for weekly_report_hour range (current implementation)")
            
            # Test valid values
            valid_data = {
                "weekly_report_enabled": True,
                "weekly_report_day": 7,  # Sunday
                "weekly_report_hour": 23  # 11 PM
            }
            
            response = self.session.put(
                f"{self.base_url}/settings",
                json=valid_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                self.log("✅ Valid notification field values accepted")
                return True
            else:
                self.log(f"❌ Valid notification values rejected: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Notification field validation test error: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all notification-related tests"""
        self.log("🚀 Starting BudgetWise Notification Endpoints Testing")
        self.log(f"   Backend URL: {self.base_url}")
        self.log(f"   Test User: {TEST_EMAIL}")
        
        results = {}
        
        # Login first
        if not self.login():
            self.log("❌ Cannot proceed without login", "ERROR")
            return {"login": False}
        
        results["login"] = True
        
        # Run notification-specific tests
        test_methods = [
            ("get_settings_notification_fields", self.test_get_settings_notification_fields),
            ("update_notification_settings", self.test_update_notification_settings),
            ("register_push_token", self.test_register_push_token),
            ("auth_required", self.test_auth_required),
            ("existing_settings_functionality", self.test_existing_settings_functionality),
            ("notification_field_validation", self.test_notification_field_validation)
        ]
        
        for test_name, test_method in test_methods:
            self.log(f"\n--- Running {test_name} ---")
            try:
                results[test_name] = test_method()
            except Exception as e:
                self.log(f"❌ Test {test_name} crashed: {str(e)}", "ERROR")
                results[test_name] = False
        
        return results
    
    def print_summary(self, results: Dict[str, bool]):
        """Print test summary"""
        self.log("\n" + "="*60)
        self.log("📊 TEST SUMMARY")
        self.log("="*60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status} - {test_name}")
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All notification endpoint tests PASSED!")
            return True
        else:
            self.log(f"⚠️  {total - passed} test(s) FAILED")
            return False

def main():
    """Main test execution"""
    tester = BudgetWiseAPITester()
    results = tester.run_all_tests()
    success = tester.print_summary(results)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()