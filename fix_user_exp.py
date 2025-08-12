#!/usr/bin/env python
"""
Script to fix negative EXP values in the database
"""
import os
import sys
import django

# Add the project directory to the Python path
sys.path.append('/Users/Elena/Desktop/LevelUp_Project')

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import User

def fix_negative_exp():
    """Reset all users with negative EXP to 0 and recalculate their level"""

    users_with_negative_exp = User.objects.filter(exp__lt=0)
    print(f"Found {users_with_negative_exp.count()} users with negative EXP")

    for user in users_with_negative_exp:
        old_exp = user.exp
        old_level = user.level

        # Reset EXP to 0
        user.exp = 0

        # Reset level to 1 since they have 0 EXP
        user.level = 1

        user.save()
        print(f"Fixed user {user.username}: EXP {old_exp} -> 0, Level {old_level} -> 1")

    print("Fix completed!")

if __name__ == "__main__":
    fix_negative_exp()
