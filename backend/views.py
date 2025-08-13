from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import authenticate, login
from django.contrib.auth.hashers import make_password, check_password
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Task, User, Goal, UserTaskLog, UserAttribute
from django.utils import timezone
from datetime import date, timedelta, datetime
import random
import math
import logging
from django.db.models import Count, Q

logger = logging.getLogger(__name__)

def get_or_create_user(username):
    """Helper function to get or create a user with default attributes"""
    try:
        user = User.objects.get(username=username)
        return user
    except User.DoesNotExist:
        # Create new user with default settings
        user = User.objects.create(
            username=username,
            password=make_password('defaultpassword'),  # Default password
            level=1,
            exp=0,
            current_streak=0,
            max_streak=0
        )

        # Create default user attributes
        default_attributes = [
            ('intelligence', 0),
            ('discipline', 0),
            ('energy', 0),
            ('social', 0),
            ('wellness', 0),
            ('stress', 0)
        ]

        for attr_name, attr_value in default_attributes:
            UserAttribute.objects.create(
                user=user,
                name=attr_name,
                value=attr_value
            )

        # Create default goal
        Goal.objects.create(
            user=user,
            title="Getting Started",
            description="Learn how to use the gamified productivity system"
        )

        logger.info(f"Auto-created new user: {username}")
        return user

def apply_attribute_changes(user, reward_string):
    """Helper function to parse reward string and apply attribute changes"""
    if not reward_string:
        return

    try:
        # Parse change strings like "+3 Intelligence, +2 Discipline, -1 Stress"
        changes = reward_string.split(',')

        for change in changes:
            change = change.strip()
            # Match pattern like "+3 Intelligence" or "-1 Stress"
            import re
            match = re.match(r'([+-]\d+)\s+(\w+)', change)
            if match:
                value_str, attr_name = match.groups()
                value = int(value_str)
                attr_name_lower = attr_name.lower()

                # Get or create user attribute
                user_attr, created = UserAttribute.objects.get_or_create(
                    user=user,
                    name=attr_name_lower,
                    defaults={'value': 0}
                )

                # Apply change with limits
                if attr_name_lower == 'stress':
                    # Stress has max limit of 100
                    user_attr.value = max(0, min(100, user_attr.value + value))
                else:
                    # Other attributes have max limit of 1000
                    user_attr.value = max(0, min(1000, user_attr.value + value))

                user_attr.save()
                logger.info(f"Applied attribute change: {attr_name_lower} {value:+d} (new value: {user_attr.value})")

    except Exception as e:
        logger.error(f"Error applying attribute changes: {e}")

def reverse_attribute_changes(user, reward_string):
    """Helper function to reverse attribute changes by parsing reward string and applying opposite changes"""
    if not reward_string:
        return

    try:
        # Parse change strings like "+3 Intelligence, +2 Discipline, -1 Stress"
        # and reverse them: "-3 Intelligence, -2 Discipline, +1 Stress"
        changes = reward_string.split(',')

        for change in changes:
            change = change.strip()
            # Match pattern like "+3 Intelligence" or "-1 Stress"
            import re
            match = re.match(r'([+-]\d+)\s+(\w+)', change)
            if match:
                value_str, attr_name = match.groups()
                value = -int(value_str)  # Reverse the sign
                attr_name_lower = attr_name.lower()

                # Get or create user attribute
                user_attr, created = UserAttribute.objects.get_or_create(
                    user=user,
                    name=attr_name_lower,
                    defaults={'value': 0}
                )

                # Apply reverse change with limits
                if attr_name_lower == 'stress':
                    # Stress has max limit of 100
                    user_attr.value = max(0, min(100, user_attr.value + value))
                else:
                    # Other attributes have max limit of 1000
                    user_attr.value = max(0, min(1000, user_attr.value + value))

                user_attr.save()
                logger.info(f"Reversed attribute change: {attr_name_lower} {value:+d} (new value: {user_attr.value})")

    except Exception as e:
        logger.error(f"Error reversing attribute changes: {e}")

class TaskListView(APIView):
    """API view that returns task data from database"""
    # Temporarily remove authentication for development
    # permission_classes = [IsAuthenticated]

    def get(self, request):
        username = request.GET.get('user', 'tester')  # Default to 'tester' for backward compatibility

        # Get or create user automatically
        user = get_or_create_user(username)

        # Get today's date for checking completion status
        today = date.today()

        # Get completed task IDs for today
        completed_task_ids = UserTaskLog.objects.filter(
            user=user,
            status='completed',
            completed_at__date=today
        ).values_list('task_id', flat=True)

        # Get all tasks and separate completed/uncompleted
        # Exclude time-limited tasks from daily task selection
        all_tasks = list(Task.objects.filter(
            user=user
        ).exclude(
            title__contains='Start Reading Now'
        ).exclude(
            title__contains='Get Ready for Library'
        ).exclude(
            title__contains='Clean Your Desk Now'
        ).exclude(
            description__contains='Time-limited task completed'
        ))

        uncompleted_tasks = [task for task in all_tasks if task.id not in completed_task_ids]
        completed_tasks = [task for task in all_tasks if task.id in completed_task_ids]

        # Prioritize uncompleted tasks
        num_tasks = min(random.randint(3, 6), len(all_tasks))

        if len(uncompleted_tasks) >= num_tasks:
            # If we have enough uncompleted tasks, use only those
            selected_tasks = random.sample(uncompleted_tasks, num_tasks)
        elif len(uncompleted_tasks) > 0:
            # Mix uncompleted and some completed tasks
            remaining_slots = num_tasks - len(uncompleted_tasks)
            selected_completed = random.sample(completed_tasks, min(remaining_slots, len(completed_tasks)))
            selected_tasks = uncompleted_tasks + selected_completed
        else:
            # All tasks are completed, show some completed ones
            selected_tasks = random.sample(all_tasks, min(num_tasks, len(all_tasks)))

        tasks = []
        for task in selected_tasks:
            # Calculate reward string
            reward_attr = task.attribute.title()
            reward_str = f"+{task.reward_point//2} {reward_attr}"
            if task.difficulty > 1:
                reward_str += f", +{task.difficulty-1} Discipline"

            # Check if this task is completed today
            is_completed = task.id in completed_task_ids

            tasks.append({
                "id": task.id,
                "title": task.title,
                "tip": task.description,
                "reward": reward_str,
                "completed": is_completed,
                "difficulty": task.difficulty,
                "attribute": task.attribute
            })

        return Response(tasks)

class TaskDetailView(APIView):
    """API view for individual task details"""
    def get(self, request, pk):
        try:
            task = Task.objects.get(pk=pk)
            reward_attr = task.attribute.title()
            reward_str = f"+{task.reward_point//2} {reward_attr}"

            task_data = {
                "id": task.id,
                "title": task.title,
                "tip": task.description,
                "reward": reward_str,
                "completed": False,
                "difficulty": task.difficulty,
                "attribute": task.attribute
            }
            return Response(task_data)
        except Task.DoesNotExist:
            return Response({"error": "Task not found"}, status=404)

class GoalView(APIView):
    """API view for user's main goal"""
    def get(self, request):
        username = request.GET.get('user', 'tester')  # Default to 'tester'

        try:
            user = User.objects.get(username=username)

            # Get user's main goal (first active goal)
            goal = Goal.objects.filter(user=user, is_completed=False).first()

            if goal:
                goal_data = {
                    "id": goal.id,
                    "title": goal.title,
                    "description": goal.description,
                    "is_completed": goal.is_completed,
                    "created_at": goal.created_at.strftime("%Y-%m-%d")
                }
                return Response(goal_data)
            else:
                # Return default goal if none exists
                default_goal = {
                    "id": 1,
                    "title": "Become a Software Engineer",
                    "description": "Master programming skills, build projects, and land a position at a tech company",
                    "is_completed": False,
                    "created_at": "2024-01-01"
                }
                return Response(default_goal)

        except User.DoesNotExist:
            # Return default goal if user doesn't exist
            default_goal = {
                "id": 1,
                "title": "Become a Software Engineer",
                "description": "Master programming skills, build projects, and land a position at a tech company",
                "is_completed": False,
                "created_at": "2024-01-01"
            }
            return Response(default_goal)

from django.db import models
def calculate_task_exp(task):
    """Calculate EXP gained from completing a task"""
    base_exp = 10 + (task.difficulty or 1) * 5

    if task.is_random:
        # Time-limited tasks give 50% more EXP
        return math.floor(base_exp * 1.5)

    return base_exp

def calculate_level_from_exp(total_exp):
    """Calculate current level from total EXP"""
    level = 1
    while level < 100 and total_exp >= get_exp_for_level(level + 1):
        level += 1
    return level

def get_exp_for_level(level):
    """Calculate EXP required for a specific level"""
    if level <= 1:
        return 0
    return math.floor(100 * math.pow(1.3, level - 1))

class TaskCompleteView(APIView):
    """API view for marking tasks as complete or uncomplete"""
    def post(self, request):
        username = request.data.get('user', 'tester')  # Default to 'tester'

        try:
            task_id = request.data.get('task_id')
            user = get_or_create_user(username)
            task = Task.objects.get(id=task_id)

            # Check if task is already completed today
            today = date.today()
            existing_log = UserTaskLog.objects.filter(
                user=user,
                task=task,
                status='completed',
                completed_at__date=today
            ).first()

            # Store old level and exp for level-up detection
            old_level = user.level
            old_exp = user.exp

            if existing_log:
                # Task already completed today - TOGGLE to uncomplete
                # Subtract EXP when uncompleting
                exp_lost = calculate_task_exp(task)
                user.exp = max(0, user.exp - exp_lost)
                existing_log.delete()
                message = "Task marked as incomplete"
                success = True
            else:
                # Mark task as completed and add EXP
                task_log, created = UserTaskLog.objects.get_or_create(
                    user=user,
                    task=task,
                    defaults={
                        'status': 'completed',
                        'completed_at': timezone.now(),
                        'earned_points': task.reward_point
                    }
                )

                if not created and task_log.status != 'completed':
                    task_log.status = 'completed'
                    task_log.completed_at = timezone.now()
                    task_log.earned_points = task.reward_point
                    task_log.save()

                # Add EXP when completing
                exp_gained = calculate_task_exp(task)
                user.exp += exp_gained
                message = "Task completed successfully"
                success = True

            # Update level based on new EXP
            new_level = calculate_level_from_exp(user.exp)
            user.level = new_level

            # Check for level up
            leveled_up = new_level > old_level

            # Update streak after task completion/uncompletion
            user.update_streak()

            # Save user changes
            user.save()

            # Get current completion status
            completed_today_count = UserTaskLog.objects.filter(
                user=user,
                status='completed',
                completed_at__date=today
            ).count()

            total_tasks = Task.objects.filter(user=user).count()

            return Response({
                "success": success,
                "message": message,
                "streak": user.current_streak,
                "completed_tasks": completed_today_count,
                "total_tasks": total_tasks,
                "task_completed": not existing_log,  # True if we just completed it, False if we uncompleted it
                "user_stats": {
                    "level": user.level,
                    "exp": user.exp,
                    "level_up": leveled_up,
                    "old_level": old_level,
                    "next_level_exp": get_exp_for_level(user.level + 1),
                    "current_level_exp": get_exp_for_level(user.level),
                    "exp_progress": user.exp - get_exp_for_level(user.level),
                    "exp_needed": get_exp_for_level(user.level + 1) - get_exp_for_level(user.level)
                }
            })

        except (Task.DoesNotExist, User.DoesNotExist):
            return Response({"error": "Task or user not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class UserStatsView(APIView):
    """API view for user statistics including streak"""
    # Temporarily remove authentication for development
    # permission_classes = [IsAuthenticated]

    def get(self, request):
        username = request.GET.get('user', 'tester')  # Default to 'tester'

        try:
            user = User.objects.get(username=username)

            stats = {
                "level": user.level,
                "exp": user.exp,
                "current_streak": user.current_streak,
                "max_streak": user.max_streak,
                "last_activity_date": user.last_activity_date.strftime("%Y-%m-%d") if user.last_activity_date else None,
                "total_completed_tasks": UserTaskLog.objects.filter(user=user, status='completed').count(),
                "level_progress": {
                    "current_level_exp": get_exp_for_level(user.level),
                    "next_level_exp": get_exp_for_level(user.level + 1),
                    "exp_progress": user.exp - get_exp_for_level(user.level),
                    "exp_needed": get_exp_for_level(user.level + 1) - get_exp_for_level(user.level),
                    "progress_percentage": int(((user.exp - get_exp_for_level(user.level)) / (get_exp_for_level(user.level + 1) - get_exp_for_level(user.level))) * 100)
                }
            }

            return Response(stats)

        except User.DoesNotExist:
            return Response({
                "level": 5,
                "current_streak": 7,
                "max_streak": 12,
                "last_activity_date": None,
                "total_completed_tasks": 0
            })

@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(APIView):
    """API view for user registration"""
    permission_classes = []  # Allow anonymous access for registration

    def post(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')
            email = request.data.get('email', '')
            goal_title = request.data.get('goal_title')
            goal_description = request.data.get('goal_description', '')

            # Validation
            if not username or not password or not goal_title:
                return Response({
                    "error": "Username, password, and goal title are required"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check if username already exists
            if User.objects.filter(username=username).exists():
                return Response({
                    "error": "Username already exists"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create user
            user = User.objects.create(
                username=username,
                email=email,
                password=make_password(password),
                level=1,
                current_streak=0,
                max_streak=0
            )

            # Create user's main goal
            Goal.objects.create(
                user=user,
                title=goal_title,
                description=goal_description
            )

            # Create default tasks for the user
            default_tasks = [
                {
                    'title': '🧠 Practice Leetcode Problem',
                    'description': 'Complete a medium-level algorithm problem',
                    'attribute': 'intelligence',
                    'difficulty': 2,
                    'reward_point': 14
                },
                {
                    'title': '📚 Read 30 pages',
                    'description': 'Read and take notes on any educational book',
                    'attribute': 'intelligence',
                    'difficulty': 1,
                    'reward_point': 10
                },
                {
                    'title': '🏃‍♂️ 30-minute workout',
                    'description': 'Include cardio and strength training',
                    'attribute': 'energy',
                    'difficulty': 2,
                    'reward_point': 12
                },
                {
                    'title': '🧘‍♀️ 10-minute meditation',
                    'description': 'Use guided meditation app or practice breathing',
                    'attribute': 'discipline',
                    'difficulty': 1,
                    'reward_point': 8
                },
                {
                    'title': '🗣️ Practice presentation skills',
                    'description': 'Record yourself giving a 5-minute presentation',
                    'attribute': 'social',
                    'difficulty': 3,
                    'reward_point': 20
                },
                {
                    'title': '🧹 Organise workspace',
                    'description': 'Clean and organise your desk and surrounding area',
                    'attribute': 'discipline',
                    'difficulty': 1,
                    'reward_point': 8
                },
                {
                    'title': '📝 Write journal entry',
                    'description': 'Reflect on today\'s experiences and goals',
                    'attribute': 'discipline',
                    'difficulty': 1,
                    'reward_point': 6
                },
                {
                    'title': '💡 Learn something new',
                    'description': 'Watch educational video or read article on new topic',
                    'attribute': 'intelligence',
                    'difficulty': 2,
                    'reward_point': 12
                }
            ]

            for task_data in default_tasks:
                Task.objects.create(
                    user=user,
                    title=task_data['title'],
                    description=task_data['description'],
                    attribute=task_data['attribute'],
                    difficulty=task_data['difficulty'],
                    reward_point=task_data['reward_point'],
                    deadline=timezone.now() + timedelta(days=365)  # 1 year deadline
                )

            return Response({
                "success": True,
                "message": "User registered successfully",
                "username": username,
                "goal": goal_title
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """API view for user login"""
    permission_classes = []  # Allow anonymous access for login

    def post(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')

            if not username or not password:
                return Response({
                    "error": "Username and password are required"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Authenticate user
            user = authenticate(username=username, password=password)

            if user:
                # Log the user in (creates session)
                login(request, user)

                # Update streak for login
                user.update_streak()

                return Response({
                    "success": True,
                    "message": "Login successful",
                    "username": username,
                    "level": user.level,
                    "streak": user.current_streak
                })
            else:
                return Response({
                    "error": "Invalid username or password"
                }, status=status.HTTP_401_UNAUTHORIZED)

        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChangePasswordView(APIView):
    """API view for changing user password"""
    def post(self, request):
        try:
            username = request.data.get('username')
            current_password = request.data.get('current_password')
            new_password = request.data.get('new_password')

            if not username or not current_password or not new_password:
                return Response({
                    "error": "Username, current password, and new password are required"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get user
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({
                    "error": "User not found"
                }, status=status.HTTP_404_NOT_FOUND)

            # Check current password
            if not check_password(current_password, user.password):
                return Response({
                    "error": "Current password is incorrect"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate new password (basic validation)
            if len(new_password) < 6:
                return Response({
                    "error": "New password must be at least 6 characters long"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Update password
            user.password = make_password(new_password)
            user.save()

            return Response({
                "success": True,
                "message": "Password changed successfully"
            })

        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class WeeklyStatsView(APIView):
    """API view for weekly task completion statistics"""
    def get(self, request):
        username = request.GET.get('user', 'tester')

        try:
            user = User.objects.get(username=username)

            # Calculate date range for current week (Monday to Sunday)
            today = date.today()
            monday = today - timedelta(days=today.weekday())
            sunday = monday + timedelta(days=6)

            # Get completed tasks for this week
            completed_this_week = UserTaskLog.objects.filter(
                user=user,
                status='completed',
                completed_at__date__gte=monday,
                completed_at__date__lte=sunday
            ).count()

            # Get daily breakdown for the week
            daily_stats = []
            for i in range(7):
                day = monday + timedelta(days=i)
                day_name = day.strftime('%A')[:3]  # Mon, Tue, Wed, etc.
                completed_count = UserTaskLog.objects.filter(
                    user=user,
                    status='completed',
                    completed_at__date=day
                ).count()

                daily_stats.append({
                    'date': day.strftime('%Y-%m-%d'),
                    'day_name': day_name,
                    'completed_tasks': completed_count,
                    'is_today': day == today
                })

            # Get total tasks available (for completion percentage)
            total_tasks = Task.objects.filter(user=user).count()

            # Calculate weekly completion percentage
            max_possible_completions = total_tasks * 7  # 7 days
            completion_percentage = (completed_this_week / max_possible_completions * 100) if max_possible_completions > 0 else 0

            return Response({
                'week_start': monday.strftime('%Y-%m-%d'),
                'week_end': sunday.strftime('%Y-%m-%d'),
                'total_completed_this_week': completed_this_week,
                'total_available_tasks': total_tasks,
                'completion_percentage': round(completion_percentage, 1),
                'daily_breakdown': daily_stats
            })

        except User.DoesNotExist:
            # Return default stats if user doesn't exist
            today = date.today()
            monday = today - timedelta(days=today.weekday())
            sunday = monday + timedelta(days=6)

            daily_stats = []
            for i in range(7):
                day = monday + timedelta(days=i)
                day_name = day.strftime('%A')[:3]
                daily_stats.append({
                    'date': day.strftime('%Y-%m-%d'),
                    'day_name': day_name,
                    'completed_tasks': 0,
                    'is_today': day == today
                })

            return Response({
                'week_start': monday.strftime('%Y-%m-%d'),
                'week_end': sunday.strftime('%Y-%m-%d'),
                'total_completed_this_week': 0,
                'total_available_tasks': 0,
                'completion_percentage': 0,
                'daily_breakdown': daily_stats
            })


class DynamicTaskCompleteView(APIView):
    """API view for completing dynamic tasks (daily tasks, time-limited tasks)"""
    def post(self, request):
        username = request.data.get('user', 'tester')
        task_title = request.data.get('task_title', '')
        task_type = request.data.get('task_type', 'daily')  # 'daily' or 'time_limited'
        reward_points = request.data.get('reward_points', 1)
        reward_string = request.data.get('reward_string', '')  # Full reward string for attribute processing
        attribute = request.data.get('attribute', 'discipline')

        try:
            user = get_or_create_user(username)

            # Store old level and exp for level-up detection
            old_level = user.level
            old_exp = user.exp

            # For time-limited tasks, create unique task each time to allow multiple completions
            if task_type == 'time_limited':
                # Add timestamp to make each time-limited task unique (for database uniqueness)
                unique_title = f"{task_title} - {timezone.now().strftime('%H:%M:%S')}"

                # Create a new task record for each time-limited task completion
                task = Task.objects.create(
                    title=unique_title,
                    user=user,
                    description=f'Time-limited task completed at {timezone.now().strftime("%H:%M")}',
                    reward_point=reward_points,
                    attribute=attribute,
                    difficulty=2,
                    deadline=timezone.now() + timedelta(days=1),
                    is_random=True,
                    created_by_ai=True
                )

                # Create completion log immediately
                UserTaskLog.objects.create(
                    user=user,
                    task=task,
                    status='completed',
                    completed_at=timezone.now(),
                    earned_points=reward_points
                )

                # Add EXP when completing time-limited task
                exp_gained = calculate_task_exp(task)
                user.exp += exp_gained

                # Update level based on new EXP
                new_level = calculate_level_from_exp(user.exp)
                user.level = new_level

                # Check for level up
                leveled_up = new_level > old_level

                # Update user streak
                user.update_streak()

                # Save user changes
                user.save()

                return Response({
                    'success': True,
                    'message': f'Time-limited task completed successfully',
                    'task_completed': True,
                    'streak': user.current_streak,
                    'user_stats': {
                        'level': user.level,
                        'exp': user.exp,
                        'level_up': leveled_up,
                        'old_level': old_level,
                        'next_level_exp': get_exp_for_level(user.level + 1),
                        'current_level_exp': get_exp_for_level(user.level),
                        'exp_progress': user.exp - get_exp_for_level(user.level),
                        'exp_needed': get_exp_for_level(user.level + 1) - get_exp_for_level(user.level)
                    }
                })

            else:
                # For daily tasks, use existing logic (prevent duplicates per day)
                task, created = Task.objects.get_or_create(
                    title=task_title,
                    user=user,
                    defaults={
                        'description': f'Dynamic {task_type} task',
                        'reward_point': reward_points,
                        'attribute': attribute,
                        'difficulty': 1,
                        'deadline': timezone.now() + timedelta(days=1),
                        'is_random': True,
                        'created_by_ai': True
                    }
                )

                # Check if already completed today
                today = date.today()
                existing_log = UserTaskLog.objects.filter(
                    user=user,
                    task=task,
                    status='completed',
                    completed_at__date=today
                ).first()

                if not existing_log:
                    # Create completion log
                    UserTaskLog.objects.create(
                        user=user,
                        task=task,
                        status='completed',
                        completed_at=timezone.now(),
                        earned_points=reward_points
                    )

                    # Add EXP when completing daily task
                    exp_gained = calculate_task_exp(task)
                    user.exp += exp_gained

                    # Apply attribute changes from reward string
                    if reward_string:
                        apply_attribute_changes(user, reward_string)

                    # Update level based on new EXP
                    new_level = calculate_level_from_exp(user.exp)
                    user.level = new_level

                    # Check for level up
                    leveled_up = new_level > old_level

                    # Update user streak
                    user.update_streak()

                    # Save user changes
                    user.save()

                    return Response({
                        'success': True,
                        'message': f'Daily task completed successfully',
                        'task_completed': True,
                        'streak': user.current_streak,
                        'user_stats': {
                            'level': user.level,
                            'exp': user.exp,
                            'level_up': leveled_up,
                            'old_level': old_level,
                            'next_level_exp': get_exp_for_level(user.level + 1),
                            'current_level_exp': get_exp_for_level(user.level),
                            'exp_progress': user.exp - get_exp_for_level(user.level),
                            'exp_needed': get_exp_for_level(user.level + 1) - get_exp_for_level(user.level)
                        }
                    })
                else:
                    return Response({
                        'success': True,
                        'message': 'Daily task already completed today',
                        'task_completed': True,
                        'streak': user.current_streak
                    })

        except User.DoesNotExist:
            return Response({
                'success': False,
                'error': 'User not found'
            }, status=404)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=500)


class DynamicTaskUncompleteView(APIView):
    """API view for uncompleting dynamic daily tasks"""
    def post(self, request):
        username = request.data.get('user', 'tester')
        task_title = request.data.get('task_title', '')
        reward_string = request.data.get('reward_string', '')  # For reversing attribute changes

        logger.info(f"DynamicTaskUncompleteView: Uncompleting task '{task_title}' for user '{username}'")

        try:
            user = User.objects.get(username=username)

            # Find the task by title for this user (both random and regular tasks)
            task = Task.objects.filter(
                title=task_title,
                user=user
            ).first()

            if not task:
                logger.warning(f"Task '{task_title}' not found for user '{username}'")
                return Response({
                    'success': False,
                    'error': 'Dynamic task not found'
                }, status=404)

            # Find today's completion log for this task
            today = date.today()
            completion_logs = UserTaskLog.objects.filter(
                user=user,
                task=task,
                status='completed',
                completed_at__date=today
            )

            logger.info(f"Found {completion_logs.count()} completion logs for task '{task_title}' on {today}")

            completion_log = completion_logs.first()

            if completion_log:
                # Store old level and exp for level-up detection
                old_level = user.level
                old_exp = user.exp

                # Subtract EXP when uncompleting
                exp_lost = calculate_task_exp(task)
                user.exp = max(0, user.exp - exp_lost)

                # Reverse attribute changes
                if reward_string:
                    reverse_attribute_changes(user, reward_string)

                # Update level based on new EXP
                new_level = calculate_level_from_exp(user.exp)
                user.level = new_level

                # Delete the completion log
                log_id = completion_log.id
                completion_log.delete()
                logger.info(f"Deleted completion log with ID {log_id}")

                # Update user streak
                user.update_streak()
                logger.info(f"Updated user streak to {user.current_streak}")

                # Save user changes
                user.save()

                return Response({
                    'success': True,
                    'message': 'Daily task uncompleted successfully',
                    'task_completed': False,
                    'streak': user.current_streak,
                    'user_stats': {
                        'level': user.level,
                        'exp': user.exp,
                        'level_up': False,
                        'old_level': old_level,
                        'next_level_exp': get_exp_for_level(user.level + 1),
                        'current_level_exp': get_exp_for_level(user.level),
                        'exp_progress': user.exp - get_exp_for_level(user.level),
                        'exp_needed': get_exp_for_level(user.level + 1) - get_exp_for_level(user.level)
                    }
                })
            else:
                return Response({
                    'success': False,
                    'message': 'No completion record found for today',
                    'task_completed': False,
                    'streak': user.current_streak
                })

        except User.DoesNotExist:
            return Response({
                'success': False,
                'error': 'User not found'
            }, status=404)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=500)


class CompletedTasksHistoryView(APIView):
    """API view to get user's completed tasks history"""
    def get(self, request):
        username = request.GET.get('user', 'tester')
        limit = int(request.GET.get('limit', 50))  # Default to 50 recent completed tasks

        logger.info(f"CompletedTasksHistoryView: Fetching completed tasks for user '{username}' (limit: {limit})")

        try:
            user = User.objects.get(username=username)

            # Get completed task logs with task details
            completed_logs = UserTaskLog.objects.filter(
                user=user,
                status='completed'
            ).select_related('task').order_by('-completed_at')[:limit]

            logger.info(f"Found {completed_logs.count()} completed task logs")

            completed_tasks = []
            for log in completed_logs:
                task = log.task
                # Clean task title by removing timestamp pattern (e.g., " - 14:25:35")
                clean_title = task.title
                import re
                clean_title = re.sub(r' - \d{2}:\d{2}:\d{2}$', '', clean_title)

                completed_tasks.append({
                    'id': task.id,
                    'title': clean_title,  # Use cleaned title without timestamp
                    'description': task.description,
                    'reward_point': task.reward_point,
                    'difficulty': task.difficulty,
                    'attribute': task.attribute,
                    'completed_at': log.completed_at.strftime('%Y-%m-%d'),
                    'completed_time': log.completed_at.strftime('%H:%M')
                })

            return Response({
                'success': True,
                'completed_tasks': completed_tasks,
                'total_count': len(completed_tasks)
            })

        except User.DoesNotExist:
            return Response({
                'success': False,
                'error': 'User not found',
                'completed_tasks': [],
                'total_count': 0
            })


class DeleteAccountView(APIView):
    """API view for deleting user account"""
    def post(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')

            if not username or not password:
                return Response({
                    "error": "Username and password are required"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get user
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({
                    "error": "User not found"
                }, status=status.HTTP_404_NOT_FOUND)

            # Verify password
            if not check_password(password, user.password):
                return Response({
                    "error": "Password is incorrect"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Delete all related data (CASCADE will handle this, but we can be explicit)
            UserTaskLog.objects.filter(user=user).delete()
            Task.objects.filter(user=user).delete()
            Goal.objects.filter(user=user).delete()

            # Delete the user
            user.delete()

            return Response({
                "success": True,
                "message": "Account deleted successfully"
            })

        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProgressStatsView(APIView):
    """API view to get user's progress statistics"""
    def get(self, request):
        username = request.GET.get('user', 'tester')
        range_type = request.GET.get('range', 'today')  # today, week, month

        try:
            user = User.objects.get(username=username)
            today = date.today()

            if range_type == 'today':
                start_date = today
                end_date = today
            elif range_type == 'week':
                # Calculate start of week (Monday)
                start_date = today - timedelta(days=today.weekday())
                end_date = today
            elif range_type == 'month':
                start_date = today.replace(day=1)
                end_date = today
            else:
                start_date = today
                end_date = today

            # Get assigned tasks in the date range
            assigned_tasks = UserTaskLog.objects.filter(
                user=user,
                assigned_at__date__range=[start_date, end_date]
            )

            total_assigned = assigned_tasks.count()
            total_completed = assigned_tasks.filter(status='completed').count()

            # Calculate completion rate
            completion_rate = total_completed / total_assigned if total_assigned > 0 else 0

            # Get current streak
            current_streak = user.current_streak

            return Response({
                "range": range_type,
                "period": {
                    "start": start_date.strftime('%Y-%m-%d'),
                    "end": end_date.strftime('%Y-%m-%d')
                },
                "assigned": total_assigned,
                "completed": total_completed,
                "completion_rate": round(completion_rate, 2),
                "streak": current_streak,
                "details": {
                    "pending": assigned_tasks.filter(status='pending').count(),
                    "missed": assigned_tasks.filter(status='missed').count()
                }
            })

        except User.DoesNotExist:
            return Response({
                "error": "User not found"
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class RootView(APIView):
    """Root endpoint to verify the API is running"""
    permission_classes = []  # Allow anonymous access

    def get(self, request):
        data = {
            "message": "LevelUp API is running!",
            "status": "OK",
            "version": "1.0.0",
            "endpoints": {
                "admin": "/admin/",
                "api": "/api/",
                "health": "/health/"
            }
        }
        
        # Check if browser requests HTML
        accept_header = request.META.get('HTTP_ACCEPT', '')
        if 'text/html' in accept_header:
            from django.http import HttpResponse
            html_content = """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>LevelUp API</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        max-width: 800px; 
                        margin: 50px auto; 
                        padding: 20px; 
                        background-color: #f5f5f5;
                        line-height: 1.6;
                    }
                    .container {
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .header { 
                        text-align: center; 
                        color: #2196F3; 
                        margin-bottom: 20px;
                        font-size: 2.5em;
                    }
                    .status { 
                        color: #4CAF50; 
                        font-weight: bold; 
                        font-size: 20px;
                        text-align: center;
                        margin: 20px 0;
                    }
                    .endpoints { 
                        margin-top: 30px; 
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                    }
                    .endpoint { 
                        margin: 15px 0; 
                        padding: 15px;
                        background: white;
                        border-radius: 5px;
                        border-left: 4px solid #2196F3;
                        font-size: 16px;
                    }
                    a { 
                        color: #2196F3; 
                        text-decoration: none; 
                        font-weight: 500;
                    }
                    a:hover { 
                        text-decoration: underline; 
                        color: #1976D2;
                    }
                    .version {
                        text-align: center;
                        color: #666;
                        margin: 15px 0;
                        font-size: 18px;
                    }
                    .description {
                        text-align: center;
                        color: #333;
                        font-size: 18px;
                        margin: 20px 0;
                    }
                    .footer {
                        text-align: center;
                        color: #888;
                        margin-top: 30px;
                        font-style: italic;
                    }
                    .emoji {
                        font-size: 1.2em;
                        margin-right: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="header"><span class="emoji">🎮</span>LevelUp API</h1>
                    <p class="status"><span class="emoji">✅</span>Status: OK</p>
                    <p class="version"><strong>Version:</strong> 1.0.0</p>
                    <p class="description">LevelUp API is running successfully!</p>
                    
                    <div class="endpoints">
                        <h2 style="color: #333; margin-bottom: 20px;"><span class="emoji">🔗</span>Available Endpoints:</h2>
                        <div class="endpoint"><span class="emoji">🔧</span><a href="/admin/">Admin Panel</a> - Django administration interface</div>
                        <div class="endpoint"><span class="emoji">🚀</span><a href="/api/">API Endpoints</a> - RESTful API documentation</div>
                        <div class="endpoint"><span class="emoji">💚</span><a href="/api/health/">Health Check</a> - System status endpoint</div>
                        <div class="endpoint"><span class="emoji">📊</span><a href="/api/tasks/">Tasks API</a> - Task management endpoints</div>
                    </div>
                    
                    <div class="footer">
                        <p><span class="emoji">🚀</span>Backend deployed on Railway</p>
                        <p>Built with Django REST Framework</p>
                    </div>
                </div>
            </body>
            </html>
            """
            return HttpResponse(html_content, content_type='text/html; charset=utf-8')
        
        # Return JSON for API clients
        return Response(data)


class HealthView(APIView):
    """Health check endpoint for Railway"""
    permission_classes = []  # Allow anonymous access for health checks

    def get(self, request):
        return Response({
            "status": "healthy",
            "timestamp": timezone.now().isoformat(),
            "database": "connected"
        })
