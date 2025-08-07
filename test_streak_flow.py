#!/usr/bin/env python3

import os
import django
import sys
from datetime import date, timedelta

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'levelup_project.settings')
django.setup()

from backend.models import User, Task, UserTaskLog

def test_streak_flow():
    """Test the complete streak flow: clear today's tasks, complete all tasks, check streak increase"""
    
    user = User.objects.first()
    if not user:
        print("❌ No user found!")
        return
    
    print("=== Testing Streak Flow ===")
    print(f"Initial state:")
    print(f"  Current Streak: {user.current_streak}")
    print(f"  Last Activity: {user.last_activity_date}")
    print(f"  All Tasks Completed Today: {user.all_tasks_completed_today}")
    
    # Step 1: Clear today's task logs to simulate fresh day
    today = date.today()
    deleted_count = UserTaskLog.objects.filter(user=user, completed_at__date=today).count()
    UserTaskLog.objects.filter(user=user, completed_at__date=today).delete()
    
    print(f"\n🧹 Cleared {deleted_count} task logs for today")
    
    # Step 2: Set last_activity_date to yesterday to simulate consecutive day
    yesterday = today - timedelta(days=1)
    user.last_activity_date = yesterday
    user.last_all_tasks_completed_date = yesterday
    user.all_tasks_completed_today = False
    user.save()
    
    print(f"📅 Set last activity to yesterday: {yesterday}")
    print(f"   Current Streak: {user.current_streak}")
    
    # Step 3: Complete all tasks one by one (simulating API calls)
    tasks = Task.objects.filter(user=user)
    print(f"\n📝 Completing {len(tasks)} tasks...")
    
    for i, task in enumerate(tasks, 1):
        # Create task log
        UserTaskLog.objects.create(
            user=user,
            task=task,
            status='completed',
            completed_at=django.utils.timezone.now(),
            earned_points=task.reward_point
        )
        
        # Update streak after each task
        user.update_streak()
        
        print(f"  ✅ Task {i}/{len(tasks)}: {task.title}")
        print(f"     Streak: {user.current_streak}, All completed: {user.all_tasks_completed_today}")
        
        if i == len(tasks):
            print(f"\n🔥 Final Result:")
            print(f"   Current Streak: {user.current_streak}")
            print(f"   Max Streak: {user.max_streak}")
            print(f"   All Tasks Completed Today: {user.all_tasks_completed_today}")
            print(f"   Last Activity Date: {user.last_activity_date}")

if __name__ == "__main__":
    test_streak_flow()
