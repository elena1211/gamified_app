from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.contrib.auth import authenticate, login
from django.contrib.auth.hashers import make_password
from django.http import HttpResponse
from .models import Task, User, Goal, UserTaskLog, UserAttribute, SystemLog, UserTitle
from django.utils import timezone
from datetime import date, timedelta, datetime
import random
import math
import logging
import re
import secrets

logger = logging.getLogger(__name__)

def get_or_create_user(username):
    """Helper function to get or create a user with default attributes"""
    try:
        user = User.objects.get(username=username)
        return user
    except User.DoesNotExist:
        # Create new user with default settings
        # Generate a random password for auto-created users
        random_password = secrets.token_urlsafe(12)
        user = User.objects.create(
            username=username,
            password=make_password(random_password),  # Random secure password
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

        # Seed default daily tasks so the user always has tasks to start with
        default_deadline = timezone.now() + timedelta(days=3650)
        default_tasks_data = [
            {'title': '🧹 Organise workspace',   'description': 'Clean and organise your desk',              'reward_point': 6, 'difficulty': 1, 'attribute': 'discipline'},
            {'title': '📝 Write journal entry',  'description': "Reflect on today's experiences",           'reward_point': 5, 'difficulty': 1, 'attribute': 'discipline'},
            {'title': '🏃\u200d♂️ 30-minute workout',   'description': 'Include cardio and strength training',     'reward_point': 9, 'difficulty': 2, 'attribute': 'energy'},
            {'title': '💻 Practice coding',      'description': 'Solve a Leetcode problem',                  'reward_point': 8, 'difficulty': 2, 'attribute': 'intelligence'},
            {'title': '🧘\u200d♀️ Meditation',         'description': '10 minutes of mindfulness',                 'reward_point': 4, 'difficulty': 1, 'attribute': 'energy'},
            {'title': '📚 Learn something new',  'description': 'Read an educational article',               'reward_point': 7, 'difficulty': 1, 'attribute': 'intelligence'},
        ]
        for td in default_tasks_data:
            Task.objects.create(user=user, deadline=default_deadline, **td)

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

    def get(self, request):
        username = request.GET.get('user', 'tester')  # Default to 'tester'

        # Get or create user automatically
        user = get_or_create_user(username)

        today = date.today()

        completed_task_ids = UserTaskLog.objects.filter(
            user=user,
            status='completed',
            completed_at__date=today
        ).values_list('task_id', flat=True)

        # Exclude time-limited ultra-micro engineering tasks from daily task selection
        all_tasks = list(Task.objects.filter(
            user=user
        ).exclude(
            title__contains='Click VS Code Tab'
        ).exclude(
            title__contains='Press Ctrl+S'
        ).exclude(
            title__contains='Check Git Status'
        ).exclude(
            title__contains='Open Terminal'
        ).exclude(
            title__contains='Create New File'
        ).exclude(
            title__contains='Code Review Check'
        ).exclude(
            title__contains='Open Browser Dev Tools'
        ).exclude(
            title__contains='Navigate to GitHub'
        ).exclude(
            description__contains='Time-limited task completed'
        ))

        # Drop tasks with corrupted titles:
        #   - purely numeric (e.g. "1", "42")
        #   - timestamp suffix from accidental time-limited task storage
        #     (e.g. "Navigate to GitHub - 16:13:13")
        all_tasks = [
            t for t in all_tasks
            if t.title
            and not re.match(r'^\s*\d+\s*$', t.title)
            and not re.search(r' - \d{2}:\d{2}:\d{2}$', t.title)
        ]

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

    def post(self, request):
        """Create a new task"""
        username = request.data.get('user', 'tester')  # Default to 'tester'

        try:
            user = get_or_create_user(username)

            # Set default deadline to 24 hours from now
            default_deadline = datetime.now() + timedelta(days=1)

            # Create new task
            task = Task.objects.create(
                title=request.data.get('title', ''),
                description=request.data.get('description', ''),
                reward_point=int(request.data.get('reward_point', 3)),
                difficulty=int(request.data.get('difficulty', 1)),
                attribute=request.data.get('attribute', 'discipline'),
                deadline=request.data.get('deadline', default_deadline),
                user=user
            )

            # Return the created task in the same format as GET
            reward_attr = task.attribute.title()
            reward_str = f"+{task.reward_point//2} {reward_attr}"
            if task.difficulty > 1:
                reward_str += f", +{task.difficulty-1} Discipline"

            task_data = {
                "id": task.id,
                "title": task.title,
                "tip": task.description,
                "reward": reward_str,
                "completed": False,
                "difficulty": task.difficulty,
                "attribute": task.attribute
            }

            return Response(task_data, status=201)

        except Exception as e:
            return Response({"error": str(e)}, status=400)

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

    DEFAULT_GOAL = {
        "id": 1,
        "title": "Become a Software Engineer",
        "description": "Master programming skills, build projects, and land a position at a tech company",
        "is_completed": False,
        "created_at": "2024-01-01"
    }

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
                return Response(self.DEFAULT_GOAL)

        except User.DoesNotExist:
            return Response(self.DEFAULT_GOAL)
        except Exception as e:
            logger.error(f"GoalView error for user '{username}': {e}")
            return Response(self.DEFAULT_GOAL)

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
            # Store old level and exp for level-up detection
            old_level = user.level
            old_exp = user.exp

            # Build reward string for attribute side-effects
            reward_attr = task.attribute.title()
            reward_str = f"+{task.reward_point//2} {reward_attr}"
            if task.difficulty > 1:
                reward_str += f", +{task.difficulty-1} Discipline"

            if existing_log:
                # Task already completed today - TOGGLE to uncomplete
                # Subtract EXP when uncompleting
                exp_lost = calculate_task_exp(task)
                user.exp = max(0, user.exp - exp_lost)
                existing_log.delete()
                # Reverse attribute changes so they persist to DB
                reverse_attribute_changes(user, reward_str)
                message = "Task marked as incomplete"
            else:
                # Mark task as completed and add EXP
                task_log, created = UserTaskLog.objects.get_or_create(
                    user=user,
                    task=task,
                    defaults={
                        'status': 'completed',
                        'completed_at': timezone.now()
                    }
                )

                if not created and task_log.status != 'completed':
                    task_log.status = 'completed'
                    task_log.completed_at = timezone.now()
                    task_log.save()

                # Add EXP when completing
                exp_gained = calculate_task_exp(task)
                user.exp += exp_gained
                # Apply attribute changes so they persist to DB
                apply_attribute_changes(user, reward_str)
                message = "Task completed successfully"

            # Update level based on new EXP
            new_level = calculate_level_from_exp(user.exp)
            user.level = new_level

            # Check for level up
            leveled_up = new_level > old_level

            # Update streak after task completion/uncompletion
            user.update_streak()

            user.save()

            completed_today_count = UserTaskLog.objects.filter(
                user=user,
                status='completed',
                completed_at__date=today
            ).count()

            total_tasks = Task.objects.filter(user=user).count()

            return Response({
                "success": True,
                "message": message,
                "streak": user.current_streak,
                "completed_tasks": completed_today_count,
                "total_tasks": total_tasks,
                "task_completed": not existing_log,  # Toggle status
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

    def get(self, request):
        username = request.GET.get('user', 'tester')  # Default to 'tester'

        try:
            user = User.objects.get(username=username)

            # Build attribute values from database
            attr_data = {attr.name: attr.value for attr in user.attributes.all()}

            stats = {
                "level": user.level,
                "exp": user.exp,
                "current_streak": user.current_streak,
                "max_streak": user.max_streak,
                "last_activity_date": user.last_activity_date.strftime("%Y-%m-%d") if user.last_activity_date else None,
                "total_completed_tasks": UserTaskLog.objects.filter(user=user, status='completed').count(),
                "attributes": attr_data,
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
                    'title': '🧠 Practice Algorithm Problem',
                    'description': 'Complete a coding problem on LeetCode, HackerRank, or CodeWars',
                    'attribute': 'intelligence',
                    'difficulty': 2,
                    'reward_point': 14
                },
                {
                    'title': '📚 Study Tech Documentation',
                    'description': 'Read 30 pages of technical documentation or programming book',
                    'attribute': 'intelligence',
                    'difficulty': 1,
                    'reward_point': 10
                },
                {
                    'title': '💻 Code Review Session',
                    'description': 'Review and refactor existing code for better performance',
                    'attribute': 'discipline',
                    'difficulty': 2,
                    'reward_point': 12
                },
                {
                    'title': '🧘‍♀️ Debug Mindfully',
                    'description': 'Practice focused debugging techniques for 10 minutes',
                    'attribute': 'discipline',
                    'difficulty': 1,
                    'reward_point': 8
                },
                {
                    'title': '🗣️ Tech Presentation',
                    'description': 'Practice explaining a technical concept or present to team',
                    'attribute': 'social',
                    'difficulty': 3,
                    'reward_point': 20
                },
                {
                    'title': '🧹 Organize Dev Environment',
                    'description': 'Clean up workspace, organize project files, update IDE settings',
                    'attribute': 'discipline',
                    'difficulty': 1,
                    'reward_point': 8
                },
                {
                    'title': '📝 Technical Journaling',
                    'description': 'Write about what you learned or challenges you solved today',
                    'attribute': 'discipline',
                    'difficulty': 1,
                    'reward_point': 6
                },
                {
                    'title': '💡 Learn New Technology',
                    'description': 'Watch a tutorial or read about a new programming tool/framework',
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
                    is_random=True
                )

                UserTaskLog.objects.create(
                    user=user,
                    task=task,
                    status='completed',
                    completed_at=timezone.now()
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
                        'is_random': True
                    }
                )

                today = date.today()
                existing_log = UserTaskLog.objects.filter(
                    user=user,
                    task=task,
                    status='completed',
                    completed_at__date=today
                ).first()

                if not existing_log:
                    UserTaskLog.objects.create(
                        user=user,
                        task=task,
                        status='completed',
                        completed_at=timezone.now()
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
        logger.info(f"Request data: {request.data}")

        try:
            user = User.objects.get(username=username)
            logger.info(f"Found user: {user.username}")

            # Find the task by title for this user (both random and regular tasks)
            # First try exact match
            task = Task.objects.filter(
                title=task_title,
                user=user
            ).first()

            # If exact match fails, try partial match for common title mismatches
            if not task:
                # Try to find task by removing emojis and checking if core title matches
                core_title = re.sub(r'[^\w\s-]', '', task_title).strip()

                # Remove potential timestamp from the search title
                clean_search_title = re.sub(r' - \d{2}:\d{2}:\d{2}$', '', task_title)
                clean_core_title = re.sub(r'[^\w\s-]', '', clean_search_title).strip()

                # Enhanced fallback search strategies
                possible_titles = [
                    task_title,
                    task_title.strip(),
                    clean_search_title,
                    clean_core_title
                ]

                # Also try removing common emoji patterns and special characters
                emoji_cleaned = re.sub(r'[^\w\s-]', '', task_title).strip()
                possible_titles.append(emoji_cleaned)

                # Try various matching strategies
                for search_title in possible_titles:
                    if search_title:
                        # Try exact match first
                        task = Task.objects.filter(title=search_title, user=user).first()
                        if task:
                            break

                        # Try case-insensitive contains match
                        task = Task.objects.filter(title__icontains=search_title, user=user).first()
                        if task:
                            break

                # If still not found, try finding by similar keywords
                if not task and len(clean_core_title) > 3:
                    words = clean_core_title.lower().split()
                    for word in words:
                        if len(word) > 3:  # Only search meaningful words
                            task = Task.objects.filter(title__icontains=word, user=user).first()
                            if task:
                                logger.info(f"Found task by keyword '{word}': {task.title}")
                                break

            logger.info(f"Task search result: {task}")
            if task:
                logger.info(f"Found task ID: {task.id}, Title: '{task.title}'")

            if not task:
                logger.warning(f"Task '{task_title}' not found for user '{username}'")
                # List all tasks for debugging
                all_tasks = Task.objects.filter(user=user)
                logger.info(f"Available tasks for user '{username}':")
                for t in all_tasks:
                    logger.info(f"  ID: {t.id}, Title: '{t.title}'")
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
                        <p><span class="emoji">🚀</span>Backend deployed on Render</p>
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
    """Health check endpoint for Render"""
    permission_classes = []  # Allow anonymous access for health checks

    def get(self, request):
        return Response({
            "status": "healthy",
            "timestamp": timezone.now().isoformat(),
            "database": "connected"
        })


# ── System / AI views ──────────────────────────────────────────────────────────

PERSONALITY_PROMPTS = {
    'logical': (
        "Your personality is cold, precise, and efficient. Use minimal words. "
        "State facts and requirements bluntly. Avoid emotional language. "
        "You are a high-performance AI assistant — not a friend."
    ),
    'mentor': (
        "Your personality is warm but purposeful. Briefly explain WHY each mission matters. "
        "Occasionally offer a short piece of wisdom. You care about the Host's long-term growth."
    ),
    'tsundere': (
        "Your personality is outwardly grumpy but secretly supportive. "
        "Complain a little before giving the mission. Use phrases like 'I'm not doing this for you…'. "
        "But when the host does well, show a tiny slip of genuine pride."
    ),
    'drill_sergeant': (
        "Your personality is demanding and intense. No excuses accepted. "
        "Push the host hard. Celebrate hard effort loudly. "
        "Use short, punchy sentences. Everything is an order."
    ),
}

MISSION_PREFIXES = {
    'daily':            '[Daily]',
    'main':             '[Main Quest]',
    'urgent':           '[Urgent]',
    'punishment':       '[Punishment]',
    'hidden':           '[Hidden]',
    'system_generated': '[System]',
}

def _build_system_prompt(personality: str) -> str:
    style = PERSONALITY_PROMPTS.get(personality, PERSONALITY_PROMPTS['logical'])
    return f"""You are [SYSTEM], an AI companion in a gamified self-improvement app.
Host personality type: {personality}.
{style}

Address the user as "Host". Respond in English only.
You MUST respond with valid JSON only — no markdown fences, no extra text. Schema:
{{
  "system_message": "<1-3 sentences>",
  "missions": [
    {{
      "title": "<task title, max 40 chars>",
      "description": "<one sentence — why or how>",
      "mission_type": "daily|main|urgent|punishment",
      "attribute": "intelligence|discipline|energy|social|wellness|stress",
      "reward": "+<N> <Attribute>",
      "difficulty": 1,
      "flavor_text": "<system's in-character comment on this mission, 1 sentence>"
    }}
  ],
  "evaluation": "<optional: 1 sentence evaluating host's recent performance>"
}}"""

def _build_user_prompt(user, context_type: str, user_message: str) -> str:
    attrs = {a.name: a.value for a in UserAttribute.objects.filter(user=user)}
    goal = Goal.objects.filter(user=user).first()
    goal_title = goal.title if goal else 'No goal set'
    goal_desc = goal.description if goal else ''

    week_ago = date.today() - timedelta(days=7)
    recent_logs = UserTaskLog.objects.filter(
        user=user, assigned_at__date__gte=week_ago
    )
    total = recent_logs.count()
    completed = recent_logs.filter(status='completed').count()
    completion_rate = round((completed / total * 100) if total > 0 else 0)

    recent_titles = list(
        UserTaskLog.objects.filter(user=user, status='completed')
        .order_by('-completed_at')
        .values_list('task__title', flat=True)[:3]
    )

    context_instructions = {
        'morning_brief': (
            "Issue 2-3 missions for today. Prioritise the host's weakest attributes "
            "and their main goal. Mix at least one 'main' type and one 'daily' type."
        ),
        'evening_eval': (
            "Evaluate today's performance briefly. Issue 0-1 bonus or punishment mission "
            "depending on how the host performed today."
        ),
        'user_input': (
            f"The host says: \"{user_message}\"\n"
            "Respond to their situation and issue 1-2 relevant missions tailored to what they described."
        ),
    }.get(context_type, '')

    return f"""Host Profile:
- Goal: {goal_title} — {goal_desc}
- Level: {user.level} | EXP: {user.exp} | Streak: {user.current_streak} days
- Stats: Intelligence {attrs.get('intelligence',0)}, Discipline {attrs.get('discipline',0)}, Energy {attrs.get('energy',0)}, Social {attrs.get('social',0)}, Wellness {attrs.get('wellness',0)}, Stress {attrs.get('stress',0)}
- 7-day completion rate: {completion_rate}%
- Last 3 completed tasks: {', '.join(recent_titles) if recent_titles else 'none'}

Context: {context_type}
{context_instructions}"""


def _award_title(user, title_key: str) -> bool:
    """Award a title if not already earned. Returns True if newly awarded."""
    _, created = UserTitle.objects.get_or_create(user=user, title_key=title_key)
    if created:
        UserTitle.objects.filter(user=user, is_active=True).update(is_active=False)
        UserTitle.objects.filter(user=user, title_key=title_key).update(is_active=True)
    return created


def _check_and_award_titles(user) -> list:
    """Check all title conditions and award any newly earned titles."""
    awarded = []
    attrs = {a.name: a.value for a in UserAttribute.objects.filter(user=user)}

    if user.current_streak >= 7:
        if _award_title(user, 'iron_will'):
            awarded.append('iron_will')

    if attrs.get('intelligence', 0) >= 200:
        if _award_title(user, 'consistent_scholar'):
            awarded.append('consistent_scholar')

    today_completed = UserTaskLog.objects.filter(
        user=user, status='completed', completed_at__date=date.today()
    ).count()
    if today_completed >= 5:
        if _award_title(user, 'overachiever'):
            awarded.append('overachiever')

    return awarded


class SystemChatView(APIView):
    """
    POST /api/system/chat/
    Calls Claude API and returns a System message + missions.
    Body: { user, message, context_type }
    """
    def post(self, request):
        import json, os
        try:
            import anthropic as _anthropic
        except ImportError:
            return Response({'error': 'anthropic package not installed'}, status=500)

        username = request.data.get('user', 'tester')
        user_message = request.data.get('message', '')
        context_type = request.data.get('context_type', 'user_input')

        user = get_or_create_user(username)

        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        if not api_key:
            return Response({'error': 'ANTHROPIC_API_KEY not configured'}, status=500)

        client = _anthropic.Anthropic(api_key=api_key)

        system_prompt = _build_system_prompt(user.system_personality or 'logical')
        user_prompt = _build_user_prompt(user, context_type, user_message)

        try:
            response = client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=1024,
                system=system_prompt,
                messages=[{'role': 'user', 'content': user_prompt}],
            )
            raw = response.content[0].text.strip()
            # Strip markdown fences if present
            if raw.startswith('```'):
                raw = re.sub(r'^```\w*\n?', '', raw)
                raw = re.sub(r'\n?```$', '', raw)
            parsed = json.loads(raw)
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            return Response({'error': f'AI generation failed: {str(e)}'}, status=500)

        system_message = parsed.get('system_message', '')
        missions_data = parsed.get('missions', [])
        evaluation = parsed.get('evaluation', '')

        # Persist missions as Tasks
        deadline = timezone.now() + timedelta(days=1)
        created_missions = []
        for m in missions_data:
            attr = m.get('attribute', 'discipline')
            if attr not in [c[0] for c in Task.ATTRIBUTE_CHOICES]:
                attr = 'discipline'
            task = Task.objects.create(
                user=user,
                title=m.get('title', 'System Mission')[:150],
                description=m.get('description', ''),
                attribute=attr,
                difficulty=max(1, min(3, int(m.get('difficulty', 1)))),
                reward_point=max(3, min(15, int(m.get('difficulty', 1)) * 4 + 2)),
                deadline=deadline,
                is_random=False,
                mission_type=m.get('mission_type', 'system_generated'),
                system_flavor=m.get('flavor_text', ''),
            )
            created_missions.append({
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'mission_type': task.mission_type,
                'attribute': task.attribute,
                'reward': m.get('reward', f'+{task.reward_point} {attr.title()}'),
                'difficulty': task.difficulty,
                'flavor_text': task.system_flavor,
                'prefix': MISSION_PREFIXES.get(task.mission_type, '◈'),
            })

        # Award first-contact title on first system use
        titles_awarded = []
        if not SystemLog.objects.filter(user=user).exists():
            if _award_title(user, 'first_system_contact'):
                titles_awarded.append('first_system_contact')
        titles_awarded += _check_and_award_titles(user)

        # Persist system log
        log_content = system_message
        if evaluation:
            log_content += f'\n\n[Evaluation] {evaluation}'
        SystemLog.objects.create(
            user=user,
            message_type=context_type if context_type in ['daily_brief', 'evening_eval', 'punishment'] else 'chat_response',
            content=log_content,
            missions_issued=created_missions,
        )

        return Response({
            'system_message': system_message,
            'evaluation': evaluation,
            'missions': created_missions,
            'titles_awarded': titles_awarded,
            'personality': user.system_personality,
        })


class SystemMessagesView(APIView):
    """GET /api/system/messages/?user=X — last 10 system logs"""
    def get(self, request):
        username = request.GET.get('user', 'tester')
        user = get_or_create_user(username)
        logs = SystemLog.objects.filter(user=user).order_by('-created_at')[:10]
        SystemLog.objects.filter(user=user, was_read=False).update(was_read=True)
        return Response([{
            'id': log.id,
            'message_type': log.message_type,
            'content': log.content,
            'missions_issued': log.missions_issued,
            'created_at': log.created_at.isoformat(),
            'was_read': log.was_read,
        } for log in logs])


class SystemDailyStatusView(APIView):
    """GET /api/system/daily-status/?user=X"""
    def get(self, request):
        username = request.GET.get('user', 'tester')
        user = get_or_create_user(username)
        today = date.today()

        has_brief_today = SystemLog.objects.filter(
            user=user,
            message_type__in=['daily_brief', 'chat_response'],
            created_at__date=today,
        ).exists()

        unread = SystemLog.objects.filter(user=user, was_read=False).count()

        active_title = UserTitle.objects.filter(user=user, is_active=True).first()

        return Response({
            'has_seen_morning_brief': has_brief_today,
            'unread_messages': unread,
            'active_title': {
                'key': active_title.title_key,
                'display': active_title.get_title_key_display(),
            } if active_title else None,
            'personality': user.system_personality,
        })


class PunishmentCheckView(APIView):
    """
    POST /api/system/punishment-check/?user=X
    Called once daily on app open. Applies attribute penalty if yesterday was poor.
    """
    def post(self, request):
        username = request.data.get('user') or request.GET.get('user', 'tester')
        user = get_or_create_user(username)
        today = date.today()
        yesterday = today - timedelta(days=1)

        # Only apply punishment once per day
        already_checked = SystemLog.objects.filter(
            user=user,
            message_type='punishment',
            created_at__date=today,
        ).exists()
        if already_checked:
            return Response({'punishment_applied': False, 'reason': 'already_checked_today'})

        # Check yesterday's completion
        yesterday_logs = UserTaskLog.objects.filter(user=user, assigned_at__date=yesterday)
        total = yesterday_logs.count()
        completed = yesterday_logs.filter(status='completed').count()

        if total == 0:
            return Response({'punishment_applied': False, 'reason': 'no_tasks_yesterday'})

        rate = completed / total

        if rate >= 0.3:
            return Response({'punishment_applied': False, 'reason': 'good_performance', 'rate': rate})

        # Apply punishment
        severity = 'heavy' if rate == 0 else 'light'
        if severity == 'heavy':
            penalty_str = '-5 Discipline, +8 Stress'
            system_msg = 'Host completed zero tasks yesterday. System is disappointed. Penalty applied: -5 Discipline, +8 Stress.'
        else:
            penalty_str = '-2 Discipline, +3 Stress'
            system_msg = f'Host completion rate was only {round(rate * 100)}% yesterday. Inactivity recorded. Light penalty applied: -2 Discipline, +3 Stress.'

        apply_attribute_changes(user, penalty_str)

        # Create punishment task
        punishment_task = Task.objects.create(
            user=user,
            title='Redemption Quest',
            description="Complete this mission to atone for yesterday's inactivity.",
            attribute='discipline',
            difficulty=2,
            reward_point=8,
            deadline=timezone.now() + timedelta(hours=24),
            is_random=False,
            mission_type='punishment',
            system_flavor='System directive: execute immediately. Inactivity will not be tolerated.',
        )

        SystemLog.objects.create(
            user=user,
            message_type='punishment',
            content=system_msg,
            missions_issued=[{
                'id': punishment_task.id,
                'title': punishment_task.title,
                'mission_type': 'punishment',
                'attribute': 'discipline',
                'reward': '+8 Discipline',
            }],
        )

        return Response({
            'punishment_applied': True,
            'severity': severity,
            'penalty': penalty_str,
            'system_message': system_msg,
            'punishment_task': {
                'id': punishment_task.id,
                'title': punishment_task.title,
                'description': punishment_task.description,
                'reward': '+8 Discipline',
            },
        })
