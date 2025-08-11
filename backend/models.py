from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from datetime import date, timedelta


class User(AbstractUser):
    level = models.PositiveIntegerField(default=1)
    exp = models.PositiveIntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    max_streak = models.PositiveIntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)
    all_tasks_completed_today = models.BooleanField(default=False)
    last_all_tasks_completed_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.username
    
    def update_streak(self):
        """Update user's streak based on completing all tasks"""
        today = date.today()
        
        # Check if all tasks are completed today
        total_tasks = Task.objects.filter(user=self).count()
        completed_today = UserTaskLog.objects.filter(
            user=self,
            status='completed',
            completed_at__date=today
        ).count()
        
        all_completed = completed_today >= total_tasks and total_tasks > 0
        
        # Update streak logic
        if all_completed and not self.all_tasks_completed_today:
            # First time completing all tasks today
            if self.last_all_tasks_completed_date == today - timedelta(days=1):
                # Consecutive day
                self.current_streak += 1
            else:
                # Streak starts fresh
                self.current_streak = 1
            
            # Update max streak if current streak is higher
            if self.current_streak > self.max_streak:
                self.max_streak = self.current_streak
            
            self.all_tasks_completed_today = True
            self.last_all_tasks_completed_date = today
            self.last_activity_date = today
            self.save()
            
        elif not all_completed and self.all_tasks_completed_today:
            # Tasks were uncompleted, decrease streak
            if self.current_streak > 0:
                self.current_streak -= 1
            self.all_tasks_completed_today = False
            self.save()
    
    def check_and_reset_streak(self):
        """Check if streak should be reset due to inactivity"""
        today = date.today()
        if self.last_activity_date and self.last_activity_date < today - timedelta(days=1):
            self.current_streak = 0
            self.all_tasks_completed_today = False
            self.save()


# Model to store various attributes for a user
class UserAttribute(models.Model):
    ATTRIBUTE_CHOICES = [
        ('intelligence', 'Intelligence'),
        ('discipline', 'Discipline'),
        ('energy', 'Energy'),
        ('social', 'Social'),
        ('wellness', 'Wellness'),
        ('stress', 'Stress')
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attributes')
    name = models.CharField(max_length=20, choices=ATTRIBUTE_CHOICES)
    value = models.IntegerField(default=0)

    class Meta:
        # Ensures each user has only one entry per attribute
        unique_together = ('user', 'name')
        verbose_name = "User Attribute"
        verbose_name_plural = "User Attributes"

    def __str__(self):
        return f"{self.user.username} - {self.get_name_display()}: {self.value}"


class Reward(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    unlock_point = models.PositiveIntegerField()
    image_url = models.URLField(blank=True)

    class Meta:
        verbose_name = "Reward"
        verbose_name_plural = "Rewards"

    def __str__(self):
        return self.name


class UserReward(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    reward = models.ForeignKey(Reward, on_delete=models.CASCADE)
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensures a user cannot unlock the same reward multiple times.
        unique_together = ('user', 'reward')
        verbose_name = "User Reward"
        verbose_name_plural = "User Rewards"

    def __str__(self):
        return f"{self.user.username} unlocked {self.reward.name}"


class Goal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=150)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_completed = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Goal"
        verbose_name_plural = "Goals"

    def __str__(self):
        return self.title


class SubGoal(models.Model):
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='subgoals')
    title = models.CharField(max_length=150)
    description = models.TextField()
    is_completed = models.BooleanField(default=False)

    class Meta:
        verbose_name = "SubGoal"
        verbose_name_plural = "SubGoals"

    def __str__(self):
        return f"{self.goal.title} - {self.title}"


class Task(models.Model):
    ATTRIBUTE_CHOICES = [
        ('intelligence', 'Intelligence'),
        ('discipline', 'Discipline'),
        ('energy', 'Energy'),
        ('social', 'Social'),
        ('wellness', 'Wellness'),
        ('stress', 'Stress')
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=150)
    description = models.TextField()
    attribute = models.CharField(max_length=20, choices=ATTRIBUTE_CHOICES)
    difficulty = models.PositiveIntegerField(default=1)
    reward_point = models.PositiveIntegerField(default=10)
    deadline = models.DateTimeField()
    is_random = models.BooleanField(default=False)
    created_by_ai = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Task"
        verbose_name_plural = "Tasks"

    def __str__(self):
        return self.title


class UserTaskLog(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('missed', 'Missed')
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    assigned_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    earned_points = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "User Task Log"
        verbose_name_plural = "User Task Logs"
        unique_together = ('user', 'task', 'assigned_at')
        # A task can only be assigned once to a user at a specific time

    def __str__(self):
        return f"{self.user.username} - {self.task.title} - {self.get_status_display()}"