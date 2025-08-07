#!/usr/bin/env python3
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import User, UserTaskLog
from datetime import date, timedelta

def prepare_test():
    """Prepare for testing by resetting to yesterday's state"""
    try:
        user = User.objects.first()
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        # Clear today's task logs
        UserTaskLog.objects.filter(user=user, completed_at__date=today).delete()
        
        # Set user to yesterday's state so we can test streak increase
        user.last_activity_date = yesterday
        user.current_streak = 2
        user.save()
        
        print(f"✅ Prepared for testing:")
        print(f"   Current streak: {user.current_streak}")
        print(f"   Last activity date: {user.last_activity_date}")
        print(f"   Today's completed tasks: {UserTaskLog.objects.filter(user=user, completed_at__date=today).count()}")
        print(f"   Ready to test streak increase!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    prepare_test()
