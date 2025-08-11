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
    Format task reward string based on task attributes with enhanced rewards
    
    Args:
        task: Task object
        
    Returns:
        Formatted reward string with 1-10 point range and multiple attributes
    """
    # Primary attribute gets the main reward (2-10 points based on difficulty and reward_point)
    primary_attr = task.attribute.title()
    base_reward = min(10, max(2, task.reward_point // 2))
    
    reward_parts = [f"+{base_reward} {primary_attr}"]
    
    # Add secondary rewards based on difficulty and task type
    if task.difficulty >= 2:
        # Medium/Hard tasks get discipline bonus
        discipline_bonus = min(6, task.difficulty * 2)
        reward_parts.append(f"+{discipline_bonus} Discipline")
    
    if task.difficulty >= 3:
        # Hard tasks get additional wellness or social bonus
        if 'social' in task.title.lower() or 'present' in task.title.lower():
            reward_parts.append("+3 Social")
        elif 'clean' in task.title.lower() or 'organise' in task.title.lower():
            reward_parts.append("+4 Wellness")
        else:
            reward_parts.append("+2 Wellness")
    
    # Special bonuses for specific task types
    if 'workout' in task.title.lower() or 'exercise' in task.title.lower():
        reward_parts.append("+3 Wellness")
    elif 'meditat' in task.title.lower():
        reward_parts.append("+5 Wellness")
        reward_parts.append("-2 Stress")
    elif 'social' in task.title.lower() or 'friend' in task.title.lower():
        reward_parts.append("+4 Social")
    
    return ", ".join(reward_parts)


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
