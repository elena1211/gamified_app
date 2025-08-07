#!/usr/bin/env python3
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import User
from datetime import date, timedelta

def test_tomorrow_login():
    """Test tomorrow's login to see consecutive day streak"""
    try:
        user = User.objects.first()
        
        print(f"Current state:")
        print(f"   Streak: {user.current_streak}")
        print(f"   Last activity: {user.last_activity_date}")
        
        # Simulate tomorrow by setting last_activity to today
        # and current date in update_streak will be tomorrow
        today = date.today()
        user.last_activity_date = today
        user.current_streak = 3
        user.save()
        
        # Now manually call update_streak with "tomorrow" logic
        tomorrow = today + timedelta(days=1)
        
        # Temporarily modify the logic for testing
        from unittest.mock import patch
        with patch('backend.models.date') as mock_date:
            mock_date.today.return_value = tomorrow
            user.update_streak()
        
        print(f"\\nAfter 'tomorrow' login:")
        print(f"   Streak: {user.current_streak}")
        print(f"   Last activity: {user.last_activity_date}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_tomorrow_login()
