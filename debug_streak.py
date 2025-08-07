#!/usr/bin/env python3
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import User, UserTaskLog
from datetime import date, timedelta

def debug_streak_logic():
    """Debug and test streak logic step by step"""
    try:
        user = User.objects.first()
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        print("=== BEFORE RESET ===")
        print(f"Current streak: {user.current_streak}")
        print(f"Last activity date: {user.last_activity_date}")
        
        # Clear today's task logs
        UserTaskLog.objects.filter(user=user, completed_at__date=today).delete()
        
        # Reset user to yesterday's state
        user.last_activity_date = yesterday
        user.current_streak = 2
        user.save()
        
        print(f"\\n=== AFTER RESET ===")
        print(f"Current streak: {user.current_streak}")
        print(f"Last activity date: {user.last_activity_date}")
        print(f"Today's completed tasks: {UserTaskLog.objects.filter(user=user, completed_at__date=today).count()}")
        
        # Test update_streak manually
        print(f"\\n=== TESTING update_streak() ===")
        print("Calling user.update_streak() with no tasks completed...")
        user.update_streak()
        print(f"After update_streak(): streak={user.current_streak}, last_activity={user.last_activity_date}")
        
        # Now simulate completing a task
        from backend.models import Task
        from django.utils import timezone
        
        task = Task.objects.filter(user=user).first()
        UserTaskLog.objects.create(
            user=user,
            task=task,
            status='completed',
            completed_at=timezone.now(),
            earned_points=task.reward_point
        )
        
        print(f"\\n=== AFTER COMPLETING ONE TASK ===")
        print(f"Today's completed tasks: {UserTaskLog.objects.filter(user=user, completed_at__date=today).count()}")
        print("Calling user.update_streak()...")
        user.update_streak()
        print(f"After update_streak(): streak={user.current_streak}, last_activity={user.last_activity_date}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_streak_logic()
