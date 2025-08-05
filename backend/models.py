from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    level = models.PositiveIntegerField(default=1)
    exp = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.username


# Model to store various attributes for a user
class UserAttribute(models.Model):
    ATTRIBUTE_CHOICES = [
        ('knowledge', 'Knowledge'),
        ('discipline', 'Discipline'),
        ('energy', 'Energy'),
        ('charisma', 'Charisma'),
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
        ('knowledge', 'Knowledge'),
        ('discipline', 'Discipline'),
        ('energy', 'Energy'),
        ('charisma', 'Charisma'),
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