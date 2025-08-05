#!/usr/bin/env python
import os
import sys
import django

# Set Django environment
sys.path.append('/Users/Elena/Desktop/LevelUp_Project')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import Task

# Update task rewards using correct stats names
task_updates = [
    {
        'title': '🧠 Practice Leetcode Problem',
        'reward': '+2 Knowledge, +1 Discipline'
    },
    {
        'title': '📚 Read 30 pages', 
        'reward': '+3 Knowledge, +1 Discipline'
    },
    {
        'title': '🏃‍♂️ 30-minute workout',
        'reward': '+2 Energy, +1 Discipline'
    }
]

for update in task_updates:
    try:
        task = Task.objects.get(title=update['title'])
        task.reward = update['reward']
        task.save()
        print(f"✅ Updated: {task.title} -> {task.reward}")
    except Task.DoesNotExist:
        print(f"❌ Task not found: {update['title']}")

print("🎉 Task updates completed!")
