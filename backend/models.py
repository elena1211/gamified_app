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

    # A single missed day doesn't break the streak; it just doesn't extend it.
    # Two in a row does. Missing a day already costs the user a penalty, and a
    # streak that falls to zero on the first slip is one people stop trying to
    # keep — the point of it is to bring them back tomorrow.
    STREAK_FORGIVEN_DAYS = 1

    def days_shown_up(self, since):
        """The days from `since` to today the user turned up: checked in, or
        completed something, which counts as turning up without the tap."""
        checked_in = DailyCheckIn.objects.filter(
            user=self, date__gte=since,
        ).values_list('date', flat=True)
        completed = UserTaskLog.objects.filter(
            user=self, status='completed', completed_at__date__gte=since,
        ).dates('completed_at', 'day')
        return set(checked_in) | set(completed)

    def refresh_streak(self):
        """Work the streak out from the days the user turned up, and store it.

        Counted rather than incremented: a completion that is undone stops
        counting on its own, where a running total would have to be told to
        go back down, and wouldn't be.
        """
        today = timezone.localdate()
        # Far enough back to find the start of any streak worth showing, and
        # bounded so this stays one query however long the account has run.
        window = 400
        shown_up = self.days_shown_up(today - timedelta(days=window))

        streak = 0
        longest = 0
        run = 0
        missed_in_a_row = 0
        counting = True
        day = today
        while day > today - timedelta(days=window):
            if day in shown_up:
                run += 1
                longest = max(longest, run)
                missed_in_a_row = 0
                if counting:
                    streak += 1
            else:
                missed_in_a_row += 1
                # Today not being done yet is never a miss: the day isn't over.
                if day == today:
                    missed_in_a_row = 0
                elif missed_in_a_row > self.STREAK_FORGIVEN_DAYS:
                    # The current streak ends here, but keep walking: the
                    # longest run is read from the whole window, so a streak
                    # that lapsed is still remembered.
                    counting = False
                    run = 0
            day -= timedelta(days=1)

        self.current_streak = streak
        # Older than the window, only the stored figure remembers it.
        self.max_streak = max(self.max_streak, longest)
        self.last_activity_date = max(shown_up) if shown_up else None
        self.save(update_fields=['current_streak', 'max_streak', 'last_activity_date'])
        return self.current_streak

    def check_in(self):
        """Record that the user turned up today. Doing it twice is the same as
        doing it once."""
        _, created = DailyCheckIn.objects.get_or_create(user=self, date=timezone.localdate())
        self.refresh_streak()
        return created

class DailyCheckIn(models.Model):
    """One row per day the user turned up. Separate from the quests, which
    are what they set out to do: this only records that they came back."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='check_ins')
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Daily Check-in"
        verbose_name_plural = "Daily Check-ins"
        ordering = ['-date']
        constraints = [
            models.UniqueConstraint(fields=['user', 'date'], name='one_check_in_per_day'),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.date}"


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
