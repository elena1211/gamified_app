#!/usr/bin/env python3
import os
import sys
import django

# Add the project directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Setup Django
django.setup()

from backend.models import User, UserTaskLog
from datetime import date

def reset_daily_tasks():
    """Reset today's task completion status"""
    try:
        user = User.objects.first()
        if not user:
            print("❌ No user found!")
            return
            
        today = date.today()
        
        # Clear today's task logs
        deleted_count = UserTaskLog.objects.filter(user=user, completed_at__date=today).count()
        UserTaskLog.objects.filter(user=user, completed_at__date=today).delete()
        
        # Reset user's daily status
        user.all_tasks_completed_today = False
        user.save()
        
        print(f"✅ Cleared {deleted_count} task completion records for today")
        print(f"✅ Reset user daily status")
        print(f"Current streak: {user.current_streak}")
        print(f"All tasks completed today: {user.all_tasks_completed_today}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    reset_daily_tasks()
