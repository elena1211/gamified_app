import logging
import math
import random
import re
import secrets
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, OperationalError, connection, transaction
from django.db.models import Count, OuterRef, Q, Subquery
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    Goal,
    MeasurementReport,
    Milestone,
    SystemLog,
    Task,
    User,
    UserAttribute,
    UserTaskLog,
    UserTitle,
)
from .throttles import SystemChatIPThrottle

logger = logging.getLogger(__name__)

# A time-limited quest fires every few minutes at most, so a real day never
# approaches this. It bounds an automated loop rather than rationing use.
MAX_TIME_LIMITED_COMPLETIONS_PER_DAY = 50

REWARD_STRING_MAX_SEGMENTS = 5
REWARD_STRING_MAX_DELTA = 10

def validate_reward_string(reward_string):
    """Check a client-supplied reward_string before it's allowed to reach
    apply_attribute_changes. Real reward strings only ever come from a small,
    fixed set of frontend-defined quests granting a few points to real
    attributes (see TIME_LIMITED_TASKS in HomePage.jsx), so anything outside
    that shape is treated as adversarial rather than clamped and applied."""
    if not reward_string:
        return True

    segments = [s.strip() for s in reward_string.split(',') if s.strip()]
    if not segments or len(segments) > REWARD_STRING_MAX_SEGMENTS:
        return False

    valid_attrs = dict(Task.ATTRIBUTE_CHOICES)
    for segment in segments:
        match = re.match(r'^([+-]\d+)\s+(\w+)$', segment)
        if not match:
            return False
        value_str, attr_name = match.groups()
        if attr_name.lower() not in valid_attrs:
            return False
        if not 1 <= abs(int(value_str)) <= REWARD_STRING_MAX_DELTA:
            return False
    return True

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

# Map common goal keywords to attributes the user should grow.
# Used to bias daily task selection toward goal-relevant attributes,
# so a 'Get Fit' user is more likely to see energy/wellness tasks.
GOAL_KEYWORD_TO_ATTRIBUTES = {
    'fit':         ['energy', 'wellness'],
    'health':      ['wellness', 'energy'],
    'workout':     ['energy', 'wellness'],
    'gym':         ['energy', 'wellness'],
    'engineer':    ['intelligence', 'discipline'],
    'software':    ['intelligence', 'discipline'],
    'developer':   ['intelligence', 'discipline'],
    'programming': ['intelligence', 'discipline'],
    'coding':      ['intelligence', 'discipline'],
    'data':        ['intelligence', 'discipline'],
    'web':         ['intelligence', 'discipline'],
    'language':    ['intelligence', 'social'],
    'learn':       ['intelligence'],
    'study':       ['intelligence', 'discipline'],
    'business':    ['social', 'discipline'],
    'startup':     ['social', 'discipline'],
    'social':      ['social'],
    'mindful':     ['wellness'],
    'meditat':     ['wellness'],
    'mental':      ['wellness'],
    'sleep':       ['wellness', 'energy'],
}


def preferred_attributes_for_goal(goal_title: str, goal_desc: str = '') -> list:
    """Return the list of attribute names preferred for this goal's keywords."""
    if not goal_title:
        return []
    haystack = (goal_title + ' ' + (goal_desc or '')).lower()
    preferred = []
    for keyword, attrs in GOAL_KEYWORD_TO_ATTRIBUTES.items():
        if keyword in haystack:
            for a in attrs:
                if a not in preferred:
                    preferred.append(a)
    return preferred


class TaskListView(APIView):
    """API view that returns task data from database"""

    def get(self, request):
        user = request.user
        today = timezone.localdate()

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

        # Weighted sampling: tasks whose attribute matches the user's goal
        # are roughly 3x more likely to be selected. Off-goal tasks still appear
        # (variety preserved) but the bias addresses user-test feedback where
        # a 'Get Fit' user kept getting Leetcode tasks.
        goal = Goal.objects.filter(user=user).first()
        preferred_attrs = preferred_attributes_for_goal(
            goal.title if goal else '',
            goal.description if goal else '',
        )

        def weighted_sample(pool, n):
            if not pool:
                return []
            weights = [3 if t.attribute in preferred_attrs else 1 for t in pool]
            picked = []
            remaining = list(zip(pool, weights))
            for _ in range(min(n, len(pool))):
                total = sum(w for _, w in remaining)
                if total <= 0:
                    break
                r = random.uniform(0, total)
                acc = 0
                for i, (task, w) in enumerate(remaining):
                    acc += w
                    if r <= acc:
                        picked.append(task)
                        remaining.pop(i)
                        break
            return picked

        # Prioritize uncompleted tasks
        num_tasks = min(random.randint(3, 6), len(all_tasks))

        if len(uncompleted_tasks) >= num_tasks:
            selected_tasks = weighted_sample(uncompleted_tasks, num_tasks)
        elif len(uncompleted_tasks) > 0:
            remaining_slots = num_tasks - len(uncompleted_tasks)
            selected_completed = weighted_sample(completed_tasks, remaining_slots)
            selected_tasks = uncompleted_tasks + selected_completed
        else:
            # All tasks are completed, show some completed ones
            selected_tasks = weighted_sample(all_tasks, num_tasks)

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
                "reward_point": task.reward_point,
                "completed": is_completed,
                "difficulty": task.difficulty,
                "attribute": task.attribute
            })

        return Response(tasks)

    def post(self, request):
        """Create a new task"""
        user = request.user

        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({"error": "Title cannot be empty"}, status=400)
        if len(title) > 150:
            return Response({"error": "Title must be 150 characters or fewer"}, status=400)

        description = request.data.get('description') or ''
        if len(description) > 500:
            return Response({"error": "Description must be 500 characters or fewer"}, status=400)

        # The create form's reward-point field can be submitted as an empty
        # string (it allows clearing the input), which is present-but-falsy —
        # `.get(key, default)` only falls back on a *missing* key, so an
        # explicit '' would otherwise reach int('') and 400 instead of
        # applying the documented default.
        reward_point_raw = request.data.get('reward_point')
        try:
            reward_point = 3 if reward_point_raw in (None, '') else int(reward_point_raw)
        except (TypeError, ValueError):
            return Response({"error": "reward_point must be a number"}, status=400)
        if not 1 <= reward_point <= 5:
            return Response({"error": "reward_point must be between 1 and 5"}, status=400)

        difficulty_raw = request.data.get('difficulty')
        try:
            difficulty = 1 if difficulty_raw in (None, '') else int(difficulty_raw)
        except (TypeError, ValueError):
            return Response({"error": "difficulty must be a number"}, status=400)
        if not 1 <= difficulty <= 3:
            return Response({"error": "difficulty must be between 1 and 3"}, status=400)

        attribute = request.data.get('attribute') or 'discipline'
        if attribute not in dict(Task.ATTRIBUTE_CHOICES):
            return Response({"error": "Invalid attribute"}, status=400)

        # Several endpoints find a task by (user, title), so two tasks sharing a
        # title make which one they act on ambiguous. There is no database
        # constraint enforcing this — adding one would need a migration that
        # fails on any account already holding duplicates, so existing data has
        # to be audited first. Rejecting new ones stops the problem growing in
        # the meantime, and the lookups order explicitly so they are at least
        # deterministic for accounts that already have them.
        if Task.objects.filter(user=user, title=title).exists():
            return Response(
                {"error": "You already have a task with this title"}, status=400
            )

        try:
            # Deadline isn't client-writable (mirrors TaskDetailView.put,
            # which doesn't expose it for editing either) — always 24 hours
            # from creation, so a malformed value can't reach Task.objects.create
            # and bubble a raw exception string back to the client.
            # timezone.now(), not datetime.now(): with USE_TZ on, a naive
            # datetime makes Django warn and store a value shifted by
            # whatever the server's clock is set to.
            deadline = timezone.now() + timedelta(days=1)

            # Create new task
            task = Task.objects.create(
                title=title,
                description=description,
                reward_point=reward_point,
                difficulty=difficulty,
                attribute=attribute,
                deadline=deadline,
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
                "reward_point": task.reward_point,
                "completed": False,
                "difficulty": task.difficulty,
                "attribute": task.attribute
            }

            return Response(task_data, status=201)

        except Exception:
            logger.exception(f"Task creation failed for '{user.username}'")
            return Response({"error": "Could not create task"}, status=500)

class TaskDetailView(APIView):
    """API view for individual task details"""
    def get(self, request, pk):
        try:
            task = Task.objects.get(pk=pk, user=request.user)
            reward_attr = task.attribute.title()
            reward_str = f"+{task.reward_point//2} {reward_attr}"
            if task.difficulty > 1:
                reward_str += f", +{task.difficulty-1} Discipline"

            task_data = {
                "id": task.id,
                "title": task.title,
                "tip": task.description,
                "reward": reward_str,
                "reward_point": task.reward_point,
                "completed": False,
                "difficulty": task.difficulty,
                "attribute": task.attribute
            }
            return Response(task_data)
        except Task.DoesNotExist:
            return Response({"error": "Task not found"}, status=404)

    def put(self, request, pk):
        try:
            task = Task.objects.get(pk=pk, user=request.user)
        except Task.DoesNotExist:
            return Response({"error": "Task not found"}, status=404)

        # Punishment/system-generated quests are system-controlled — letting a
        # user edit their own penalty would defeat the reward/risk loop.
        if task.mission_type in ('punishment', 'system_generated') or task.is_random:
            return Response({"error": "This quest cannot be edited"}, status=403)

        reward_fields = {'reward_point', 'difficulty', 'attribute'}
        if reward_fields & set(request.data.keys()):
            # The reward string is recomputed from the task's current fields
            # whenever it's uncompleted, not snapshotted at completion time —
            # changing them while today's completion is still in effect would
            # desync the XP/attribute reversal from what was actually granted.
            completed_today = UserTaskLog.objects.filter(
                task=task, user=request.user, status='completed',
                completed_at__date=timezone.localdate()
            ).exists()
            if completed_today:
                return Response(
                    {"error": "Uncomplete this quest before changing its reward, difficulty or attribute"},
                    status=400
                )

        if 'title' in request.data:
            title = (request.data.get('title') or '').strip()
            if not title:
                return Response({"error": "Title cannot be empty"}, status=400)
            if len(title) > 150:
                return Response({"error": "Title must be 150 characters or fewer"}, status=400)
            task.title = title

        if 'description' in request.data:
            description = request.data.get('description') or ''
            if len(description) > 500:
                return Response({"error": "Description must be 500 characters or fewer"}, status=400)
            task.description = description

        if 'reward_point' in request.data:
            try:
                reward_point = int(request.data.get('reward_point'))
            except (TypeError, ValueError):
                return Response({"error": "reward_point must be a number"}, status=400)
            if not 1 <= reward_point <= 5:
                return Response({"error": "reward_point must be between 1 and 5"}, status=400)
            task.reward_point = reward_point

        if 'difficulty' in request.data:
            try:
                difficulty = int(request.data.get('difficulty'))
            except (TypeError, ValueError):
                return Response({"error": "difficulty must be a number"}, status=400)
            if not 1 <= difficulty <= 3:
                return Response({"error": "difficulty must be between 1 and 3"}, status=400)
            task.difficulty = difficulty

        if 'attribute' in request.data:
            attribute = request.data.get('attribute')
            if attribute not in dict(Task.ATTRIBUTE_CHOICES):
                return Response({"error": "Invalid attribute"}, status=400)
            task.attribute = attribute

        task.save()

        reward_attr = task.attribute.title()
        reward_str = f"+{task.reward_point//2} {reward_attr}"
        if task.difficulty > 1:
            reward_str += f", +{task.difficulty-1} Discipline"

        task_data = {
            "id": task.id,
            "title": task.title,
            "tip": task.description,
            "reward": reward_str,
            "reward_point": task.reward_point,
            "completed": False,
            "difficulty": task.difficulty,
            "attribute": task.attribute
        }
        return Response(task_data)

    def delete(self, request, pk):
        try:
            task = Task.objects.get(pk=pk, user=request.user)
        except Task.DoesNotExist:
            return Response({"error": "Task not found"}, status=404)

        # Cascades to this task's UserTaskLog entries, so completion history
        # and weekly stats stop counting a deleted task.
        task.delete()
        return Response({"success": True})

class GoalView(APIView):
    """API view for user's main goal"""

    def get(self, request):
        user = request.user
        try:
            # Get user's main goal (first active goal)
            goal = Goal.objects.filter(user=user, is_completed=False).first()

            # A user with no active goal gets an explicit null rather than a
            # stand-in. This used to return a hardcoded "Become a Software
            # Engineer" goal, which every caller displayed as if the user had
            # written it themselves.
            if not goal:
                return Response({"goal": None})

            return Response({
                "id": goal.id,
                "title": goal.title,
                "description": goal.description,
                "is_completed": goal.is_completed,
                "created_at": goal.created_at.strftime("%Y-%m-%d")
            })

        except Exception:
            logger.exception(f"GoalView error for user '{user.username}'")
            return Response({"error": "Could not load goal"}, status=500)

def _decimal_string(value):
    """A money-style decimal as a string with exactly two places.

    Strings, so a target such as 100000.00 isn't rounded by a float on its
    way to the client. The explicit scale matters because SQLite returns an
    annotated decimal unscaled (250 rather than 250.00) while PostgreSQL
    doesn't, and the API should read the same on both."""
    if value is None:
        return None
    return str(Decimal(value).quantize(Decimal("0.01")))


def _completion_criteria(obj):
    """The fields Goal and Milestone share through CompletionCriteria."""
    return {
        "completion_type": obj.completion_type,
        "target_count": obj.target_count,
        "target_value": _decimal_string(obj.target_value),
        "target_direction": obj.target_direction or None,
        "unit": obj.unit or None,
        "outcome_note": obj.outcome_note or None,
        "completed_at": obj.completed_at.isoformat() if obj.completed_at else None,
    }


def _milestone_progress(milestone):
    """Progress towards a milestone's target, from the annotations added in
    GoalPathView. Outcome milestones have no number to show.

    Cumulative progress counts completions, not distinct quests, so a
    "run 12 times" milestone moves one step each day its recurring quest is
    done."""
    if milestone.completion_type == Milestone.CUMULATIVE:
        return {"completions": milestone.completions}
    if milestone.completion_type == Milestone.MEASURABLE:
        return {"latest_value": _decimal_string(milestone.latest_value)}
    return None


class GoalPathView(APIView):
    """The user's confirmed Goal Path: the goal and its ordered milestones.

    Returns {"path": null} until a path has been confirmed, including for the
    placeholder goal a guest account starts with, rather than a sample path.
    Cumulative progress is counted from completion logs on every read instead
    of being stored, so un-completing a quest can't leave a stale count."""

    def get(self, request):
        try:
            # one_current_path_per_user guarantees at most one match.
            goal = Goal.objects.filter(
                user=request.user, is_completed=False, path_confirmed_at__isnull=False,
            ).first()
            if goal is None:
                return Response({"path": None})

            latest_report = (
                MeasurementReport.objects
                .filter(milestone=OuterRef('pk'))
                # pk breaks the tie between reports saved in the same instant.
                .order_by('-created_at', '-pk')
                .values('value')[:1]
            )
            # Meta.ordering is dropped once a query aggregates, so path order
            # has to be requested explicitly here.
            milestones = goal.milestones.annotate(
                completions=Count(
                    'quests__usertasklog',
                    filter=Q(
                        quests__usertasklog__status='completed',
                        # Only this user's logs, even if a quest were ever
                        # linked to someone else's path by a later bug.
                        quests__usertasklog__user=request.user,
                    ),
                ),
                latest_value=Subquery(latest_report),
            ).order_by('position')

            return Response({
                "path": {
                    "confirmed_at": goal.path_confirmed_at.isoformat(),
                    "goal": {
                        "id": goal.id,
                        "title": goal.title,
                        "description": goal.description,
                        **_completion_criteria(goal),
                    },
                    "milestones": [
                        {
                            "id": milestone.id,
                            "position": milestone.position,
                            "title": milestone.title,
                            "description": milestone.description,
                            "status": milestone.status,
                            **_completion_criteria(milestone),
                            "progress": _milestone_progress(milestone),
                        }
                        for milestone in milestones
                    ],
                }
            })
        except Exception:
            logger.exception("GoalPathView error for user id %s", request.user.id)
            return Response({"error": "Could not load your path"}, status=500)


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
    throttle_scope = 'task_write'

    def post(self, request):
        try:
            # Everything below reads the user's EXP, decides a new value from
            # it, and writes it back. Two requests interleaving there — a
            # double-tap, or a retry racing the original — both read the old
            # value and the second write silently discards the first. Locking
            # the row for the duration serialises them, and the transaction
            # means a failure part-way cannot leave EXP granted without its
            # completion log (or the reverse).
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                task_id = request.data.get('task_id')
                task = Task.objects.get(id=task_id, user=user)

                # Check if task is already completed today
                today = timezone.localdate()
                existing_log = UserTaskLog.objects.filter(
                    user=user,
                    task=task,
                    status='completed',
                    completed_at__date=today
                ).first()

                # Store old level and exp for level-up detection
                # Store old level for level-up detection
                old_level = user.level

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
                    # Every completion gets its own log. This used to be a
                    # get_or_create on (user, task), which matched a recurring
                    # task's log from an earlier day: today's completion was
                    # never recorded, so the streak stood still and the task
                    # could be completed again and again for EXP.
                    UserTaskLog.objects.create(
                        user=user,
                        task=task,
                        status='completed',
                        completed_at=timezone.now(),
                    )

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
        except Exception:
            logger.exception(f"Task completion failed for '{user.username}'")
            return Response({"error": "Could not complete task"}, status=500)


class UserStatsView(APIView):
    """API view for user statistics including streak"""

    def get(self, request):
        user = request.user
        try:
            # Build attribute values from database
            attr_data = {attr.name: attr.value for attr in user.attributes.all()}

            stats = {
                "level": user.level,
                "exp": user.exp,
                "current_streak": user.current_streak,
                "max_streak": user.max_streak,
                "last_activity_date": user.last_activity_date.strftime("%Y-%m-%d") if user.last_activity_date else None,
                "date_joined": user.date_joined.strftime("%Y-%m-%d") if user.date_joined else None,
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

        except Exception:
            logger.exception(f"UserStatsView failed for '{user.username}'")
            return Response(
                {"error": "Could not load stats"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class RegisterView(APIView):
    """API view for user registration"""
    permission_classes = [AllowAny]
    # Account creation is IP-throttled: unlimited free accounts would let one
    # client dodge every per-account rate limit (see SystemChatView).
    throttle_scope = 'account_create'

    def post(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')
            email = request.data.get('email', '')
            goal_title = (request.data.get('goal_title') or '').strip()
            goal_description = request.data.get('goal_description') or ''

            # Validation
            if not username or not password or not goal_title:
                return Response({
                    "error": "Username, password, and goal title are required"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Matches the check UpgradeGuestView already applies to username —
            # without it, an overlong value hits User's DB-level constraint
            # and surfaces as a raw 500 via the except clause below instead
            # of a clean 400.
            if len(username) > 150:
                return Response({
                    "error": "Username must be 150 characters or fewer"
                }, status=status.HTTP_400_BAD_REQUEST)

            # goal_title/description are read back into the System companion's
            # AI prompt on every chat request (see _build_user_prompt), so an
            # unbounded value is both a Postgres CharField-constraint 500
            # waiting to happen (title) and an unbounded-injection surface
            # (description) — same limits TaskListView.post applies to Task
            # title/description.
            if len(goal_title) > 150:
                return Response({
                    "error": "Goal title must be 150 characters or fewer"
                }, status=status.HTTP_400_BAD_REQUEST)
            if len(goal_description) > 500:
                return Response({
                    "error": "Goal description must be 500 characters or fewer"
                }, status=status.HTTP_400_BAD_REQUEST)

            if username.startswith('guest_'):
                # Reserved for GuestLoginView's generated ids — a real account
                # with this prefix would be treated as an ephemeral guest by
                # every "is this a guest?" check in the app.
                return Response({
                    "error": "Username cannot start with \"guest_\""
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check if username already exists
            if User.objects.filter(username=username).exists():
                return Response({
                    "error": "Username already exists"
                }, status=status.HTTP_400_BAD_REQUEST)

            # AUTH_PASSWORD_VALIDATORS has been configured since the project was
            # generated, but make_password() below hashes whatever it is handed —
            # the validators only run when validate_password() is called, which
            # nothing did. "a" was an accepted password.
            try:
                validate_password(password, user=User(username=username, email=email))
            except ValidationError as exc:
                return Response({
                    "error": " ".join(exc.messages)
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

            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                "success": True,
                "message": "User registered successfully",
                "username": username,
                "token": token.key,
                "goal": goal_title
            }, status=status.HTTP_201_CREATED)

        except Exception:
            logger.exception("Registration failed")
            return Response({
                "error": "Could not create account"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpgradeGuestView(APIView):
    """Convert the authenticated guest account into a real, password-protected
    account in place. A guest is already a normal User row — every Task,
    Goal, UserAttribute and UserTaskLog is a foreign key to that row's id,
    not to the username — so setting a real username/password/email on the
    SAME row preserves all of it automatically. No data to migrate.

    Not IP-throttled like RegisterView/GuestLoginView: this doesn't create a
    new account (the caller already holds an authenticated guest token, which
    was itself throttled to obtain), and a shared IP scope here would let one
    other guest session on the same network block a legitimate upgrade.
    """

    def post(self, request):
        user = request.user

        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        email = request.data.get('email', '')

        if not username or not password:
            return Response(
                {"error": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST
            )
        if len(username) > 150:
            return Response(
                {"error": "Username must be 150 characters or fewer"}, status=status.HTTP_400_BAD_REQUEST
            )
        # Same validators as registration — the two paths both set a password
        # and previously disagreed about what counted as acceptable, with this
        # one enforcing a bare 6-character minimum and registration enforcing
        # nothing at all.
        try:
            validate_password(password, user=User(username=username, email=email))
        except ValidationError as exc:
            return Response(
                {"error": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST
            )
        if username.startswith('guest_'):
            # Would make this account indistinguishable from a fresh guest
            # session to every "is this a guest?" check in the app.
            return Response(
                {"error": "Username cannot start with \"guest_\""}, status=status.HTTP_400_BAD_REQUEST
            )

        if user.username == username and not user.username.startswith('guest_'):
            # Idempotent retry: this exact upgrade already succeeded (e.g. the
            # response was lost to a Render cold-start blip and apiRequest
            # resent the same request with the same still-valid token) —
            # the account is already in the target state, so confirm success
            # again instead of re-running the guest-only check below, which
            # would now fail and wrongly look like the upgrade never happened.
            token, _ = Token.objects.get_or_create(user=user)
            return Response({"success": True, "username": user.username, "token": token.key})

        if not user.username.startswith('guest_'):
            return Response(
                {"error": "Only guest accounts can be upgraded"}, status=status.HTTP_400_BAD_REQUEST
            )
        if User.objects.exclude(pk=user.pk).filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user.username = username
            user.email = email
            user.set_password(password)
            user.save()
        except IntegrityError:
            # Another request claimed this username between the check above
            # and this save (two guests racing for the same name).
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        # Issue a fresh token and invalidate the old one. The guest id that
        # produced the previous token was, until this upgrade, the only thing
        # standing between anyone who knew it and this account — so it must not
        # keep working once the account has a real password behind it.
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        return Response({
            "success": True,
            "username": username,
            "token": token.key,
        })


class LoginView(APIView):
    """API view for user login"""
    permission_classes = [AllowAny]
    # Without a scope, ScopedRateThrottle does nothing and this endpoint accepts
    # unlimited password guesses. Register and guest login were given a scope;
    # login was missed, which is the one that actually guards a password.
    throttle_scope = 'login'

    def post(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')

            if not username or not password:
                return Response({
                    "error": "Username and password are required"
                }, status=status.HTTP_400_BAD_REQUEST)

            user = authenticate(username=username, password=password)

            if user:
                user.update_streak()
                token, _ = Token.objects.get_or_create(user=user)
                return Response({
                    "success": True,
                    "message": "Login successful",
                    "username": username,
                    "token": token.key,
                    "level": user.level,
                    "streak": user.current_streak
                })
            else:
                return Response({
                    "error": "Invalid username or password"
                }, status=status.HTTP_401_UNAUTHORIZED)

        except Exception:
            logger.exception("Login failed")
            return Response({
                "error": "Could not sign in"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GuestLoginView(APIView):
    """Create or retrieve a guest session and return an auth token."""
    permission_classes = [AllowAny]
    # Same IP throttle as RegisterView — guest accounts are the cheapest way
    # to mint fresh identities.
    throttle_scope = 'account_create'

    # A guest id is not just a name — possession of it is what grants access to
    # that account and everything in it. It therefore has to be unguessable, so
    # the server mints it. The client used to choose it with
    # Math.random().toString(36).slice(2, 8): not a CSPRNG, around 31 bits at
    # best, sometimes fewer than 6 characters, and the old pattern accepted a
    # single character, leaving a 1-2 character space of 1,332 ids that could be
    # walked from a handful of addresses.
    GUEST_ID_BYTES = 16

    def post(self, request):
        guest_id = f"guest_{secrets.token_hex(self.GUEST_ID_BYTES)}"

        user = User.objects.create(
            username=guest_id,
            password=make_password(secrets.token_urlsafe(16)),
            level=1, exp=0, current_streak=0, max_streak=0,
        )

        for attr_name in ['intelligence', 'discipline', 'energy', 'social', 'wellness', 'stress']:
            UserAttribute.objects.create(user=user, name=attr_name, value=0)
        Goal.objects.create(
            user=user,
            title='Getting Started',
            description='Learn how to use the gamified productivity system',
        )
        default_deadline = timezone.now() + timedelta(days=3650)
        for td in [
            {'title': '🧹 Organise workspace',  'description': 'Clean and organise your desk',         'reward_point': 6, 'difficulty': 1, 'attribute': 'discipline'},
            {'title': '📝 Write journal entry', 'description': "Reflect on today's experiences",      'reward_point': 5, 'difficulty': 1, 'attribute': 'discipline'},
            {'title': '🏃 30-minute workout',   'description': 'Include cardio and strength training', 'reward_point': 9, 'difficulty': 2, 'attribute': 'energy'},
            {'title': '💻 Practice coding',     'description': 'Solve a Leetcode problem',             'reward_point': 8, 'difficulty': 2, 'attribute': 'intelligence'},
            {'title': '🧘 Meditation',          'description': '10 minutes of mindfulness',            'reward_point': 4, 'difficulty': 1, 'attribute': 'energy'},
            {'title': '📚 Learn something new', 'description': 'Read an educational article',          'reward_point': 7, 'difficulty': 1, 'attribute': 'intelligence'},
        ]:
            Task.objects.create(user=user, deadline=default_deadline, **td)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({'username': guest_id, 'token': token.key})


class WeeklyStatsView(APIView):
    """API view for weekly task completion statistics"""
    def get(self, request):
        user = request.user
        try:

            # Calculate date range for current week (Monday to Sunday)
            today = timezone.localdate()
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

        except Exception:
            logger.exception(f"WeeklyStatsView failed for '{user.username}'")
            return Response(
                {'error': 'Could not load weekly stats'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DynamicTaskCompleteView(APIView):
    """API view for completing dynamic tasks (daily tasks, time-limited tasks)"""
    throttle_scope = 'task_write'

    def post(self, request):
        user = request.user
        task_type = request.data.get('task_type', 'daily')  # 'daily' or 'time_limited'
        reward_string = request.data.get('reward_string', '')  # Full reward string for attribute processing

        # Unlike TaskListView.post/TaskDetailView.put, this endpoint used to
        # take task_title completely unvalidated — it's stored as Task.title
        # (max_length=150) and later read back into the System companion's
        # AI prompt (see _build_user_prompt's recent_titles), so an
        # unbounded value is both a DB-constraint 500 waiting to happen and
        # a prompt-injection surface. Capped at 150 to match every other
        # Task.title write path (TaskListView, TaskDetailView, SystemChatView)
        # — a stricter cap here would silently break completing a
        # legitimately-created 140-150 char task.
        task_title = (request.data.get('task_title') or '').strip()
        if not task_title:
            return Response({"error": "task_title cannot be empty"}, status=400)
        if len(task_title) > 150:
            return Response({"error": "task_title must be 150 characters or fewer"}, status=400)

        # reward_points/attribute are only ever used as defaults when a brand
        # new Task row has to be created below (no existing task with this
        # title yet) — validate them so a malformed or adversarial request
        # can't store an out-of-range value or a made-up attribute name.
        try:
            reward_points = int(request.data.get('reward_points', 1))
        except (TypeError, ValueError):
            reward_points = 1
        if not 1 <= reward_points <= 5:
            reward_points = 3
        attribute = request.data.get('attribute', 'discipline')
        if attribute not in dict(Task.ATTRIBUTE_CHOICES):
            attribute = 'discipline'

        try:
            # Same lock and transaction as TaskCompleteView: this path also
            # reads EXP, derives a new value and writes it back, and creates
            # a UserTaskLog alongside it. Without both, a double-tap can
            # double-grant or leave the log and the EXP disagreeing.
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)

                # Store old level for level-up detection
                old_level = user.level

                # For time-limited tasks, create unique task each time to allow multiple completions
                if task_type == 'time_limited':
                    # Unlike the daily branch, nothing here stops the same quest
                    # being completed repeatedly — a new Task row is created
                    # every call. The frontend offers these on a timer measured
                    # in minutes, so a genuine day tops out well under this;
                    # the cap exists to bound a loop, not to ration real use.
                    completed_today = UserTaskLog.objects.filter(
                        user=user,
                        status='completed',
                        task__is_random=True,
                        completed_at__date=timezone.localdate(),
                    ).count()
                    if completed_today >= MAX_TIME_LIMITED_COMPLETIONS_PER_DAY:
                        return Response({
                            'success': False,
                            'error': 'Daily limit for time-limited quests reached',
                        }, status=429)

                    # Add timestamp to make each time-limited task unique (for
                    # database uniqueness). The " - HH:MM:SS" suffix is 11 chars,
                    # so truncate task_title to keep the result within
                    # Task.title's max_length=150 regardless of how close to the
                    # 150 cap above task_title itself is.
                    unique_title = f"{task_title[:139]} - {timezone.now().strftime('%H:%M:%S')}"

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

                    # Time-limited quests can reward multiple attributes at once
                    # (e.g. "+3 Intelligence, +2 Discipline"). This used to only
                    # be applied to local browser state via the frontend's own
                    # applyStatChanges call and was never persisted server-side
                    # at all — every attribute point earned this way was lost on
                    # a new device or cleared storage. Persist it here too, same
                    # as the daily-task path already does below.
                    #
                    # Unlike reward_points/attribute (validated above and only
                    # ever used for the Task row), reward_string is what actually
                    # drives the stat change, so it's validated the same way
                    # before being trusted — otherwise a request could name any
                    # attribute with any magnitude, bypassing the validation done
                    # on the other two fields entirely.
                    if reward_string and validate_reward_string(reward_string):
                        apply_attribute_changes(user, reward_string)
                    elif reward_string:
                        logger.warning(f"Rejected malformed/out-of-range reward_string for user '{user.username}': {reward_string!r}")

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
                        'message': 'Time-limited task completed successfully',
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
                    # For daily tasks, use existing logic (prevent duplicates per day).
                    # Looked up explicitly (not get_or_create with a reward_point
                    # default) so an existing task is never re-parameterized by
                    # whatever the client happened to send this time.
                    # Ordered explicitly: Task has no uniqueness constraint on
                    # (user, title), and an unordered .first() picks whichever
                    # row the database happens to return — so an account that
                    # already holds duplicates could have a different one's
                    # reward applied on different requests.
                    task = Task.objects.filter(title=task_title, user=user).order_by('id').first()
                    if not task:
                        task = Task.objects.create(
                            title=task_title,
                            user=user,
                            description=f'Dynamic {task_type} task',
                            reward_point=reward_points,
                            attribute=attribute,
                            difficulty=1,
                            deadline=timezone.now() + timedelta(days=1),
                            is_random=True
                        )

                    today = timezone.localdate()
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

                        # Derive the applied reward from the task's own stored
                        # values (same formula as TaskCompleteView), never from
                        # the client-supplied reward_string — that string can be
                        # stale, or (for the frontend's offline-fallback task
                        # list, shown when /api/tasks/ fails) entirely made up
                        # and unrelated to what this task actually grants, which
                        # would otherwise let a request apply an arbitrary
                        # mismatched reward to a real task.
                        reward_attr = task.attribute.title()
                        computed_reward_string = f"+{task.reward_point // 2} {reward_attr}"
                        if task.difficulty > 1:
                            computed_reward_string += f", +{task.difficulty - 1} Discipline"
                        apply_attribute_changes(user, computed_reward_string)

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
                            'message': 'Daily task completed successfully',
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
        except Exception:
            logger.exception(f"Dynamic task completion failed for '{user.username}'")
            return Response({
                'success': False,
                'error': 'Could not complete task'
            }, status=500)


class DynamicTaskUncompleteView(APIView):
    """API view for uncompleting dynamic daily tasks"""
    throttle_scope = 'task_write'

    def post(self, request):
        user = request.user

        # Validated the same way DynamicTaskCompleteView validates it — this
        # endpoint reverses a completion, so it is as sensitive as the one that
        # records it.
        task_title = (request.data.get('task_title') or '').strip()
        if not task_title:
            return Response({'error': 'task_title cannot be empty'}, status=400)
        if len(task_title) > 150:
            return Response({'error': 'task_title must be 150 characters or fewer'}, status=400)

        try:
            # Reversing a completion subtracts EXP and attributes and deletes
            # the log — the same read-modify-write shape as granting them, so
            # it needs the same lock to avoid two undos both subtracting from
            # the value they each read.
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                # Exact match only. This used to fall back to a chain of fuzzy
                # strategies — icontains on the raw input, then on an
                # emoji-stripped version, then on any word over three characters —
                # so {"task_title": "a"} matched the first task containing an "a"
                # and reversed that completion instead, subtracting the wrong EXP
                # and attributes. Each attempt was also an unindexed LIKE '%…%'
                # scan on unbounded input.
                #
                # The timestamp suffix is stripped because time-limited tasks are
                # stored as "<title> - HH:MM:SS"; that is a known, exact shape
                # rather than a guess.
                task = Task.objects.filter(title=task_title, user=user).order_by('id').first()
                if not task:
                    without_timestamp = re.sub(r' - \d{2}:\d{2}:\d{2}$', '', task_title)
                    if without_timestamp != task_title:
                        task = Task.objects.filter(title=without_timestamp, user=user).order_by('id').first()

                if not task:
                    # Previously logged every task the user owns, one line each, on
                    # every miss — an unauthenticated-adjacent way to drive log
                    # spend, and a copy of the user's task titles in the logs.
                    logger.warning("Uncomplete: no matching task for this user")
                    return Response({
                        'success': False,
                        'error': 'Dynamic task not found'
                    }, status=404)

                # Find today's completion log for this task
                today = timezone.localdate()
                completion_logs = UserTaskLog.objects.filter(
                    user=user,
                    task=task,
                    status='completed',
                    completed_at__date=today
                )


                completion_log = completion_logs.first()

                if completion_log:
                    # Store old level for level-up detection
                    old_level = user.level

                    # Subtract EXP when uncompleting
                    exp_lost = calculate_task_exp(task)
                    user.exp = max(0, user.exp - exp_lost)

                    # Reverse exactly what the complete path would have applied,
                    # derived from the task's own stored values rather than the
                    # client's reward_string. DynamicTaskCompleteView computes
                    # the daily-task reward server-side the same way (see the
                    # comment there) — reversing from a client-supplied string
                    # instead would drift out of sync whenever it doesn't match
                    # what was actually granted (e.g. the frontend's offline-
                    # fallback task list reuses real task titles with invented,
                    # unrelated reward text).
                    reward_attr = task.attribute.title()
                    computed_reward_string = f"+{task.reward_point // 2} {reward_attr}"
                    if task.difficulty > 1:
                        computed_reward_string += f", +{task.difficulty - 1} Discipline"
                    reverse_attribute_changes(user, computed_reward_string)

                    # Update level based on new EXP
                    new_level = calculate_level_from_exp(user.exp)
                    user.level = new_level

                    completion_log.delete()

                    # Update user streak
                    user.update_streak()

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

        except Exception:
            logger.exception(f"Dynamic task uncompletion failed for '{user.username}'")
            return Response({
                'success': False,
                'error': 'Could not undo completion'
            }, status=500)


class CompletedTasksHistoryView(APIView):
    """API view to get user's completed tasks history"""

    DEFAULT_LIMIT = 50
    MAX_LIMIT = 200

    def get(self, request):
        user = request.user

        # This was a bare int() on a query parameter, outside the try below, so
        # ?limit=abc raised ValueError and ?limit=-1 became a negative slice
        # Django refuses — both surfacing as unhandled 500s. An arbitrarily
        # large value was accepted and ran unbounded.
        try:
            limit = int(request.GET.get('limit', self.DEFAULT_LIMIT))
        except (TypeError, ValueError):
            return Response({'error': 'limit must be a number'}, status=400)
        if limit < 1:
            return Response({'error': 'limit must be at least 1'}, status=400)
        limit = min(limit, self.MAX_LIMIT)

        try:

            # Get completed task logs with task details
            completed_logs = UserTaskLog.objects.filter(
                user=user,
                status='completed'
            ).select_related('task').order_by('-completed_at')[:limit]


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

        except Exception:
            # Returned HTTP 200 with the exception text and an empty list, so a
            # crash was indistinguishable from "you have completed nothing".
            logger.exception(f"CompletedTasksHistoryView failed for '{user.username}'")
            return Response(
                {'success': False, 'error': 'Could not load completion history'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ProgressStatsView(APIView):
    """API view to get user's progress statistics"""
    def get(self, request):
        user = request.user
        range_type = request.GET.get('range', 'today')  # today, week, month

        try:
            today = timezone.localdate()

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
        except Exception:
            logger.exception(f"ProgressStatsView failed for '{user.username}'")
            return Response({
                "error": "Could not load progress"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RootView(APIView):
    """Root endpoint to verify the API is running"""
    permission_classes = [AllowAny]

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
    permission_classes = [AllowAny]

    def get(self, request):
        # This used to report "database": "connected" unconditionally without
        # touching the database, so Render saw a healthy service throughout a
        # Postgres outage and never restarted or alerted on it.
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            database = "connected"
        except OperationalError:
            logger.exception("Health check: database unreachable")
            return Response({
                "status": "degraded",
                "timestamp": timezone.now().isoformat(),
                "database": "unreachable",
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            "status": "healthy",
            "timestamp": timezone.now().isoformat(),
            "database": database,
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
    # Every field interpolated below reaches the AI provider raw, so each is
    # truncated here too, as a second line of defense on top of the length
    # limits already enforced where these values are written (RegisterView,
    # TaskListView, TaskDetailView, DynamicTaskCompleteView) — in case a
    # future write path forgets to validate.
    goal_title = (goal.title if goal else 'No goal set')[:150]
    goal_desc = (goal.description if goal else '')[:500]

    week_ago = timezone.localdate() - timedelta(days=7)
    recent_logs = UserTaskLog.objects.filter(
        user=user, assigned_at__date__gte=week_ago
    )
    total = recent_logs.count()
    completed = recent_logs.filter(status='completed').count()
    completion_rate = round((completed / total * 100) if total > 0 else 0)

    recent_titles = [
        t[:150] for t in
        UserTaskLog.objects.filter(user=user, status='completed')
        .order_by('-completed_at')
        .values_list('task__title', flat=True)[:3]
    ]

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
        user=user, status='completed', completed_at__date=timezone.localdate()
    ).count()
    if today_completed >= 5:
        if _award_title(user, 'overachiever'):
            awarded.append('overachiever')

    return awarded


def _call_ai_provider(system_prompt, user_prompt):
    """Call the configured AI provider and return its raw text response.

    AI_PROVIDER selects the backend ('nvidia' by default, or 'anthropic').
    NVIDIA's hosted NIM API (sign up at build.nvidia.com, calls served from
    integrate.api.nvidia.com) is free and rate-limited rather than billed
    per token, which is why it's the default for a guest-accessible
    endpoint — 'anthropic' stays available as an opt-in for higher-quality
    output once that cost is worth paying for.
    """
    import os
    provider = os.environ.get('AI_PROVIDER', 'nvidia').lower()

    if provider == 'anthropic':
        try:
            import anthropic as _anthropic
        except ImportError:
            raise RuntimeError('anthropic package not installed')
        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        if not api_key:
            raise RuntimeError('ANTHROPIC_API_KEY not configured')
        client = _anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=1024,
            system=system_prompt,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        return response.content[0].text

    # Default: NVIDIA NIM — OpenAI-compatible endpoint, free tier.
    try:
        from openai import OpenAI
    except ImportError:
        raise RuntimeError('openai package not installed')
    api_key = os.environ.get('NVIDIA_API_KEY', '')
    if not api_key:
        raise RuntimeError('NVIDIA_API_KEY not configured')
    client = OpenAI(api_key=api_key, base_url='https://integrate.api.nvidia.com/v1')
    model = os.environ.get('NVIDIA_MODEL', 'meta/llama-3.1-70b-instruct')
    response = client.chat.completions.create(
        model=model,
        max_tokens=1024,
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
    )
    return response.choices[0].message.content


class SystemChatView(APIView):
    """
    POST /api/system/chat/
    Calls the configured AI provider (see _call_ai_provider) and returns a
    System message + missions.
    Body: { message, context_type }
    """
    # Two throttle layers: per-account (scoped) plus per-IP, so rotating
    # guest accounts cannot dodge the cap on this endpoint. Even the free
    # NVIDIA tier is rate-limited, and the optional Anthropic path is billed.
    throttle_classes = [ScopedRateThrottle, SystemChatIPThrottle]
    throttle_scope = 'system_chat'

    # Chat input goes straight into the AI prompt, so it must be bounded.
    MAX_MESSAGE_LENGTH = 1000

    VALID_CONTEXT_TYPES = ('morning_brief', 'evening_eval', 'user_input')

    def post(self, request):
        import json

        user = request.user
        user_message = request.data.get('message', '')
        context_type = request.data.get('context_type', 'user_input')

        if not isinstance(user_message, str):
            return Response({'error': 'Message must be a string'}, status=400)
        user_message = user_message.strip()
        if len(user_message) > self.MAX_MESSAGE_LENGTH:
            return Response(
                {'error': f'Message too long (max {self.MAX_MESSAGE_LENGTH} characters)'},
                status=400,
            )
        if context_type not in self.VALID_CONTEXT_TYPES:
            return Response(
                {'error': f"Invalid context_type. Expected one of: {', '.join(self.VALID_CONTEXT_TYPES)}"},
                status=400,
            )
        # Briefs and evaluations ignore the message text, so empty is fine
        # there — but an empty user_input would just waste a Claude call.
        if context_type == 'user_input' and not user_message:
            return Response({'error': 'Message is required'}, status=400)

        system_prompt = _build_system_prompt(user.system_personality or 'logical')
        user_prompt = _build_user_prompt(user, context_type, user_message)

        try:
            raw = _call_ai_provider(system_prompt, user_prompt).strip()
            # Strip markdown fences if present
            if raw.startswith('```'):
                raw = re.sub(r'^```\w*\n?', '', raw)
                raw = re.sub(r'\n?```$', '', raw)
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise ValueError('model returned non-object JSON')
        except Exception as e:
            # Log the detail but keep it out of the response — SDK errors can
            # include request IDs and upstream bodies the client shouldn't see.
            logger.error(f"AI provider error: {e}")
            return Response({'error': 'AI generation failed. Please try again'}, status=500)

        system_message = parsed.get('system_message', '')
        missions_data = parsed.get('missions', [])
        evaluation = parsed.get('evaluation', '')
        if not isinstance(missions_data, list):
            missions_data = []

        # Persist missions as Tasks. Every model-supplied field is validated
        # or clamped — the model's output is not trusted to fit the schema.
        deadline = timezone.now() + timedelta(days=1)
        created_missions = []
        for m in missions_data:
            if not isinstance(m, dict):
                continue
            attr = m.get('attribute', 'discipline')
            if attr not in [c[0] for c in Task.ATTRIBUTE_CHOICES]:
                attr = 'discipline'
            mission_type = m.get('mission_type', 'system_generated')
            if mission_type not in [c[0] for c in Task.MISSION_TYPE_CHOICES]:
                mission_type = 'system_generated'
            try:
                difficulty = int(m.get('difficulty', 1))
            except (TypeError, ValueError):
                difficulty = 1
            difficulty = max(1, min(3, difficulty))
            task = Task.objects.create(
                user=user,
                # Stripped like TaskListView.post/TaskDetailView.put already
                # strip user-supplied titles — DynamicTaskCompleteView's
                # lookup strips the incoming title before comparing, so an
                # un-stripped stored title here would never match and the
                # mission could never be found/completed again.
                title=str(m.get('title') or 'System Mission').strip()[:150],
                # Capped like title — an open model is more likely than Claude
                # to ignore the "one sentence" instruction in the prompt.
                description=str(m.get('description') or '')[:500],
                attribute=attr,
                difficulty=difficulty,
                reward_point=max(3, min(15, difficulty * 4 + 2)),
                deadline=deadline,
                is_random=False,
                mission_type=mission_type,
                system_flavor=str(m.get('flavor_text') or '')[:500],
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
        # message_type drives the label in the chat history — 'daily_brief'
        # renders as "Morning Brief" in SystemMessageBox.
        log_type_map = {'morning_brief': 'daily_brief', 'evening_eval': 'evening_eval'}
        SystemLog.objects.create(
            user=user,
            message_type=log_type_map.get(context_type, 'chat_response'),
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
    """GET /api/system/messages/ — last 10 system logs"""
    def get(self, request):
        user = request.user
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
    """GET /api/system/daily-status/"""
    def get(self, request):
        user = request.user
        today = timezone.localdate()

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
    POST /api/system/punishment-check/
    Called once daily on app open. Applies attribute penalty if yesterday was poor.
    """
    def post(self, request):
        user = request.user
        today = timezone.localdate()
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
