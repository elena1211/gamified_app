"""
Utility functions for the backend application
"""
from .models import User


def get_user_from_request(request, method='GET', default_username='elena'):
    """
    Extract username from request and return User object
    
    Args:
        request: Django request object
        method: HTTP method ('GET' or 'POST')
        default_username: Default username if none provided
        
    Returns:
        User object or None if not found
    """
    if method == 'GET':
        username = request.GET.get('user', default_username)
    else:
        username = request.data.get('user', default_username)
    
    try:
        return User.objects.get(username=username)
    except User.DoesNotExist:
        return None


def format_task_reward(task):
    """
    Format task reward string based on task attributes
    
    Args:
        task: Task object
        
    Returns:
        Formatted reward string
    """
    reward_attr = task.attribute.title()
    reward_str = f"+{task.reward_point//2} {reward_attr}"
    if task.difficulty > 1:
        reward_str += f", +{task.difficulty-1} Discipline"
    return reward_str


def task_to_dict(task, is_completed=False):
    """
    Convert Task object to dictionary representation
    
    Args:
        task: Task object
        is_completed: Whether the task is completed
        
    Returns:
        Dictionary representation of the task
    """
    return {
        "id": task.id,
        "title": task.title,
        "tip": task.description,
        "reward": format_task_reward(task),
        "completed": is_completed,
        "difficulty": task.difficulty,
        "attribute": task.attribute
    }
