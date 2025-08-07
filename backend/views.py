from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Task, User, Goal, UserTaskLog
from django.utils import timezone
from datetime import date
import random


class TaskListView(APIView):
    """API view that returns task data from database"""
    def get(self, request):
        try:
            # prepare to fetch tasks for a specific user
            # Assuming the user is 'elena' for demonstration purposes
            user = User.objects.get(username='elena')
            
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
        try:
            # Get the test user (later can be based on authentication)
            user = User.objects.get(username='elena')
            
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
        try:
            task_id = request.data.get('task_id')
            user = User.objects.get(username='elena')
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
        try:
            user = User.objects.get(username='elena')
            
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
