from django.db import models
from django.contrib.auth.models import AbstractUser
from datetime import date, timedelta

PERSONALITY_CHOICES = [
    ('logical', 'Logical'),
    ('mentor', 'Mentor'),
    ('tsundere', 'Tsundere'),
    ('drill_sergeant', 'Drill Sergeant'),
]

class User(AbstractUser):
    level = models.PositiveIntegerField(default=1)
    exp = models.PositiveIntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    max_streak = models.PositiveIntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)
    system_personality = models.CharField(
        max_length=20, choices=PERSONALITY_CHOICES, default='logical'
    )

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.username

    def update_streak(self):
        """Update user's streak based on daily activity (completing at least one task)"""
        today = date.today()

        # Check if any task was completed today
        completed_today = UserTaskLog.objects.filter(
            user=self,
            status='completed',
            completed_at__date=today
        ).count()

        has_activity_today = completed_today > 0

        # Update streak logic based on daily activity
        if has_activity_today:
            # User has activity today
            if self.last_activity_date == today - timedelta(days=1):
                # Consecutive day - increment streak
                self.current_streak += 1
            elif self.last_activity_date != today:
                # Either first day or gap in activity - reset streak to 1
                self.current_streak = 1

            # Update max streak if current streak is higher
            if self.current_streak > self.max_streak:
                self.max_streak = self.current_streak

            self.last_activity_date = today
            self.save()

        # Note: We don't decrement streak here because missing a day will naturally break the streak
        # when the user next completes a task (if it's not consecutive)

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

    def save(self, *args, **kwargs):
        # Apply max limit for stress attribute (100), others (1000)
        if self.name == 'stress':
            self.value = max(0, min(100, self.value))
        else:
            self.value = max(0, min(1000, self.value))
        super().save(*args, **kwargs)

    class Meta:
        # Ensures each user has only one entry per attribute
        unique_together = ('user', 'name')
        verbose_name = "User Attribute"
        verbose_name_plural = "User Attributes"

    def __str__(self):
        return f"{self.user.username} - {self.get_name_display()}: {self.value}"

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

class Task(models.Model):
    ATTRIBUTE_CHOICES = [
        ('intelligence', 'Intelligence'),
        ('discipline', 'Discipline'),
        ('energy', 'Energy'),
        ('social', 'Social'),
        ('wellness', 'Wellness'),
        ('stress', 'Stress')
    ]
    MISSION_TYPE_CHOICES = [
        ('daily', 'Daily Quest'),
        ('main', 'Main Quest'),
        ('urgent', 'Urgent Quest'),
        ('punishment', 'Punishment Quest'),
        ('hidden', 'Hidden Quest'),
        ('system_generated', 'System Generated'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=150)
    description = models.TextField()
    attribute = models.CharField(max_length=20, choices=ATTRIBUTE_CHOICES)
    difficulty = models.PositiveIntegerField(default=1)
    reward_point = models.PositiveIntegerField(default=10)
    deadline = models.DateTimeField()
    is_random = models.BooleanField(default=False)
    mission_type = models.CharField(
        max_length=20, choices=MISSION_TYPE_CHOICES, default='daily'
    )
    system_flavor = models.TextField(blank=True, default='')
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

    class Meta:
        verbose_name = "User Task Log"
        verbose_name_plural = "User Task Logs"
        unique_together = ('user', 'task', 'assigned_at')
        # A task can only be assigned once to a user at a specific time

    def __str__(self):
        return f"{self.user.username} - {self.task.title} - {self.get_status_display()}"


class SystemLog(models.Model):
    MESSAGE_TYPE_CHOICES = [
        ('daily_brief', 'Daily Brief'),
        ('evening_eval', 'Evening Evaluation'),
        ('punishment', 'Punishment'),
        ('chat_response', 'Chat Response'),
        ('alert', 'Alert'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='system_logs')
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES)
    content = models.TextField()
    missions_issued = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    was_read = models.BooleanField(default=False)

    class Meta:
        verbose_name = "System Log"
        verbose_name_plural = "System Logs"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.message_type} - {self.created_at.date()}"


class UserTitle(models.Model):
    TITLE_CHOICES = [
        ('iron_will', 'Iron Will'),
        ('early_bird', 'Early Bird'),
        ('comeback_king', 'Comeback King'),
        ('consistent_scholar', 'Consistent Scholar'),
        ('overachiever', 'Overachiever'),
        ('first_system_contact', 'First Contact'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='titles')
    title_key = models.CharField(max_length=30, choices=TITLE_CHOICES)
    earned_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        verbose_name = "User Title"
        verbose_name_plural = "User Titles"
        unique_together = ('user', 'title_key')

    def __str__(self):
        return f"{self.user.username} - {self.get_title_key_display()}"
