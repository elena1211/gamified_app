#!/usr/bin/env python3
"""
Diagnose streak calculation issue
"""
import os
import sys
import django
from datetime import date

# Add the project root to Python path
sys.path.append('/Users/Elena/Desktop/LevelUp_Project')

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import User, UserTaskLog, Task

def diagnose_streak():
    try:
        user = User.objects.get(username='elena')
        today = date.today()
        
        # Get all tasks
        all_tasks = Task.objects.filter(user=user)
        total_tasks = all_tasks.count()
        
        # Get completed tasks today
        completed_today = UserTaskLog.objects.filter(
            user=user,
            status='completed',
            completed_at__date=today
        )
        completed_task_ids = completed_today.values_list('task_id', flat=True)
        completed_count = completed_today.count()
        
        print(f"📊 Streak Diagnosis:")
        print(f"   Current streak: {user.current_streak}")
        print(f"   Max streak: {user.max_streak}")
        print(f"   Last activity date: {user.last_activity_date}")
        print(f"   All tasks completed today: {user.all_tasks_completed_today}")
        print(f"   Last all tasks completed date: {user.last_all_tasks_completed_date}")
        print()
        print(f"📋 Task Status:")
        print(f"   Total tasks: {total_tasks}")
        print(f"   Completed today: {completed_count}")
        print(f"   Completed task IDs: {list(completed_task_ids)}")
        print()
        
        # Check if all tasks are completed
        all_completed = total_tasks > 0 and completed_count == total_tasks
        print(f"✅ All tasks completed: {all_completed}")
        
        if all_completed and user.last_all_tasks_completed_date != today:
            print("🔧 Issue found: All tasks completed but streak not updated!")
            print("   Running manual streak update...")
            user.update_streak()
            print(f"   New streak: {user.current_streak}")
        elif all_completed and user.last_all_tasks_completed_date == today:
            print("✅ Streak already updated for today")
        else:
            print(f"⏳ Still need to complete {total_tasks - completed_count} more tasks")
        
    except User.DoesNotExist:
        print("User 'elena' not found")

if __name__ == "__main__":
    diagnose_streak()
