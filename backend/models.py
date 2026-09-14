from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

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
        today = timezone.localdate()

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

class CompletionCriteria(models.Model):
    """How a Goal or Milestone counts as reached. Shared so the two can't
    drift apart: an Outcome is confirmed by the user, a Cumulative target by
    completed quests, and a Measurable target by a reported value."""

    OUTCOME = 'outcome'
    CUMULATIVE = 'cumulative'
    MEASURABLE = 'measurable'
    COMPLETION_TYPE_CHOICES = [
        (OUTCOME, 'Outcome'),
        (CUMULATIVE, 'Cumulative'),
        (MEASURABLE, 'Measurable'),
    ]

    AT_LEAST = 'at_least'
    AT_MOST = 'at_most'
    TARGET_DIRECTION_CHOICES = [
        (AT_LEAST, 'At least'),
        (AT_MOST, 'At most'),
    ]

    completion_type = models.CharField(
        max_length=12, choices=COMPLETION_TYPE_CHOICES, default=OUTCOME
    )
    target_count = models.PositiveIntegerField(null=True, blank=True)
    target_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    # A measurable target isn't always "more is better": a 5 km time is
    # reached by getting under it.
    target_direction = models.CharField(
        max_length=8, choices=TARGET_DIRECTION_CHOICES, blank=True, default=''
    )
    unit = models.CharField(max_length=20, blank=True, default='')
    outcome_note = models.CharField(max_length=300, blank=True, default='')
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class Goal(CompletionCriteria):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=150)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_completed = models.BooleanField(default=False)
    # Set when the user confirms a Goal Path. The placeholder goal a guest
    # account starts with never has one, so it reads as "no path yet".
    path_confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Goal"
        verbose_name_plural = "Goals"
        constraints = [
            # One Goal Path in progress at a time. Goals without a path (every
            # goal created before Goal Paths existed) and finished goals are
            # outside the condition, so they never conflict.
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_completed=False, path_confirmed_at__isnull=False),
                name='one_current_path_per_user',
            ),
        ]

    def __str__(self):
        return self.title

class Milestone(CompletionCriteria):
    LOCKED = 'locked'
    ACTIVE = 'active'
    COMPLETED = 'completed'
    STATUS_CHOICES = [
        (LOCKED, 'Locked'),
        (ACTIVE, 'Active'),
        (COMPLETED, 'Completed'),
    ]

    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='milestones')
    position = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=150)
    description = models.CharField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=LOCKED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Milestone"
        verbose_name_plural = "Milestones"
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(
                fields=['goal', 'position'], name='unique_milestone_position'
            ),
            # Enforced by the database rather than by view code, so two
            # requests finishing the same milestone can't both unlock the next.
            models.UniqueConstraint(
                fields=['goal'],
                condition=models.Q(status='active'),
                name='one_active_milestone_per_goal',
            ),
        ]

    def __str__(self):
        return f"{self.position}. {self.title}"


class MeasurementReport(models.Model):
    """One reported value for a Measurable milestone, kept as a history
    rather than a single field so progress can be shown as a trend."""

    milestone = models.ForeignKey(Milestone, on_delete=models.CASCADE, related_name='reports')
    value = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.CharField(max_length=300, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Measurement Report"
        verbose_name_plural = "Measurement Reports"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.milestone.title}: {self.value}"


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
    # Quests on a Goal Path point at their milestone. Deleting a milestone
    # leaves the quest and its completion history in place.
    milestone = models.ForeignKey(
        Milestone, null=True, blank=True, on_delete=models.SET_NULL, related_name='quests'
    )
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
