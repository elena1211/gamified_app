#!/usr/bin/env python3
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import User, UserTaskLog
from datetime import date

def reset_and_test():
    """Reset today's tasks and test new streak logic"""
    try:
        user = User.objects.first()
        today = date.today()
        
        # Clear today's task logs
        deleted_count = UserTaskLog.objects.filter(user=user, completed_at__date=today).count()
        UserTaskLog.objects.filter(user=user, completed_at__date=today).delete()
        
        # Reset user's last_activity_date to yesterday to test consecutive day logic
        from datetime import timedelta
        yesterday = today - timedelta(days=1)
        user.last_activity_date = yesterday
        user.current_streak = 2  # Set to 2 so we can see it increase to 3
        user.save()
        
        print(f"✅ Reset complete:")
        print(f"   Cleared {deleted_count} task logs")
        print(f"   Set last_activity_date to: {yesterday}")
        print(f"   Set current_streak to: {user.current_streak}")
        print(f"   Ready to test new logic!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    reset_and_test()
