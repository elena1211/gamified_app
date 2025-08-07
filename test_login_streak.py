#!/usr/bin/env python3
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import User
from datetime import date, timedelta

def test_login_streak():
    """Test the simplified login-based streak system"""
    try:
        user = User.objects.first()
        
        # Reset to yesterday to test consecutive day login
        yesterday = date.today() - timedelta(days=1)
        user.last_activity_date = yesterday
        user.current_streak = 2
        user.save()
        
        print(f"✅ Reset user for testing:")
        print(f"   Current streak: {user.current_streak}")
        print(f"   Last activity date: {user.last_activity_date}")
        print(f"   Ready to test login streak!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_login_streak()
