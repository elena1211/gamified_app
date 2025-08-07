from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.contrib.auth import authenticate, login
from django.contrib.auth.hashers import make_password
from .models import Task, User, Goal, UserTaskLog
from django.utils import timezone
from datetime import date, timedelta
import random


class TaskListView(APIView):
    """API view that returns task data from database"""
    def get(self, request):
        username = request.GET.get('user', 'elena')  # Default to 'elena' for backward compatibility
        
        try:
            user = User.objects.get(username=username)
            
            # Get today's date for checking completion status
            today = date.today()
            
            # Get completed task IDs for today
            completed_task_ids = UserTaskLog.objects.filter(
                user=user,
                status='completed',
                completed_at__date=today
            ).values_list('task_id', flat=True)
            
            # Get all tasks and separate completed/uncompleted
            all_tasks = list(Task.objects.filter(user=user))
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
            
        except User.DoesNotExist:
            # If the user does not exist, return an empty list
            default_tasks = [
                {
                    "id": 1,
                    "title": "🧠 Practice Leetcode Problem",
                    "tip": "Complete within 25 minutes + Document your thought process",
                    "reward": "+2 Knowledge, +1 Discipline",
                    "completed": False
                },
                {
                    "id": 2,
                    "title": "📚 Read 30 pages",
                    "tip": "Focus on key concepts and take notes",
                    "reward": "+3 Knowledge, +1 Discipline",
                    "completed": False
                }
            ]
            return Response(default_tasks)


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
        username = request.GET.get('user', 'elena')  # Default to 'elena'
        
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


class TaskCompleteView(APIView):
    """API view for marking tasks as complete or uncomplete"""
    def post(self, request):
        username = request.data.get('user', 'elena')  # Default to 'elena'
        
        try:
            task_id = request.data.get('task_id')
            user = User.objects.get(username=username)
            task = Task.objects.get(id=task_id)
            
            # Check if task is already completed today
            today = date.today()
            existing_log = UserTaskLog.objects.filter(
                user=user,
                task=task,
                status='completed',
                completed_at__date=today
            ).first()
            
            if existing_log:
                # Task already completed today - TOGGLE to uncomplete
                existing_log.delete()
                message = "Task marked as incomplete"
                success = True
            else:
                # Mark task as completed
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
                
                message = "Task completed successfully"
                success = True
            
            # Update streak after task completion/uncompletion
            user.update_streak()
            
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
                "task_completed": not existing_log  # True if we just completed it, False if we uncompleted it
            })
            
        except (Task.DoesNotExist, User.DoesNotExist):
            return Response({"error": "Task or user not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class UserStatsView(APIView):
    """API view for user statistics including streak"""
    def get(self, request):
        username = request.GET.get('user', 'elena')  # Default to 'elena'
        
        try:
            user = User.objects.get(username=username)
            
            stats = {
                "level": user.level,
                "current_streak": user.current_streak,
                "max_streak": user.max_streak,
                "last_activity_date": user.last_activity_date.strftime("%Y-%m-%d") if user.last_activity_date else None,
                "total_completed_tasks": UserTaskLog.objects.filter(user=user, status='completed').count()
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
                    'attribute': 'knowledge',
                    'difficulty': 2,
                    'reward_point': 14
                },
                {
                    'title': '📚 Read 30 pages',
                    'description': 'Read and take notes on any educational book',
                    'attribute': 'knowledge',
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
                    'attribute': 'charisma',
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
                    'attribute': 'knowledge',
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
