"""The achievements the System notices, and what earns them.

One catalogue, so a new achievement is a single entry here rather than a
condition buried in whichever view happened to run. Each check is a question
about what the user has already done — nothing is tracked towards an
achievement, so adding one awards it to everyone who already qualifies.

Models are imported inside the checks: the catalogue is the source of the
title choices on UserTitle, so importing models here would be circular.
"""
from datetime import timedelta

from django.utils import timezone

# How many days of quests have to go unmissed for a perfect week, and how
# many of them have to have been done — a week where the path asked for
# almost nothing isn't an achievement.
PERFECT_WEEK_DAYS = 7
PERFECT_WEEK_LEAST_DONE = 5


def _completed_logs(user):
    from .models import UserTaskLog
    return UserTaskLog.objects.filter(user=user, status='completed')


def _first_quest(user):
    return _completed_logs(user).exists()


def _busy_day(user):
    return _completed_logs(user).filter(
        completed_at__date=timezone.localdate()
    ).count() >= 5


def _early_bird(user):
    """Something finished in the early morning, in the app's timezone.

    From 4am, not from midnight: work finished at 2am is a late night, not
    an early start."""
    from django.db.models.functions import ExtractHour
    return _completed_logs(user).annotate(
        hour=ExtractHour('completed_at')
    ).filter(hour__gte=4, hour__lt=8).exists()


def _studious(user):
    from .models import UserAttribute
    return UserAttribute.objects.filter(
        user=user, name='intelligence', value__gte=200
    ).exists()


# As far back as the home screen's streak looks, so a run it can see is one
# an achievement can see — and so adding an achievement awards it to everyone
# who already qualifies, however long ago.
RUN_WINDOW_DAYS = 400


def _longest_run(user, days):
    """The longest run of consecutive days turned up.

    Counted strictly, unlike the streak on the home screen, which forgives a
    single missed day. "Seven days in a row" has to mean seven."""
    window = RUN_WINDOW_DAYS
    shown_up = user.days_shown_up(timezone.localdate() - timedelta(days=window))
    longest = 0
    run = 0
    day = timezone.localdate()
    while day > timezone.localdate() - timedelta(days=window):
        if day in shown_up:
            run += 1
            longest = max(longest, run)
        else:
            run = 0
        day -= timedelta(days=1)
    return longest


def _streak_of(days):
    def earned(user):
        return _longest_run(user, days) >= days
    return earned


def _came_back(user):
    """Turned up again the day after a day away.

    The day has to have been missed entirely: a day where one quest went
    undone but the user was there is not a day they came back from."""
    from .models import UserTaskLog
    missed_days = set(
        UserTaskLog.objects.filter(user=user, status='missed')
        .dates('assigned_at', 'day')
    )
    if not missed_days:
        return False
    shown_up = user.days_shown_up(min(missed_days))
    return any(
        day not in shown_up and day + timedelta(days=1) in shown_up
        for day in missed_days
    )


def _perfect_week(user):
    """A week of the path's quests with nothing missed, and enough done to
    mean it."""
    from .models import UserTaskLog
    since = timezone.localdate() - timedelta(days=PERFECT_WEEK_DAYS - 1)
    week = UserTaskLog.objects.filter(
        user=user, assigned_at__date__gte=since, task__milestone__isnull=False,
    )
    if week.filter(status='missed').exists():
        return False
    return week.filter(status='completed').count() >= PERFECT_WEEK_LEAST_DONE


def _path_set(user):
    from .models import Goal
    return Goal.objects.filter(user=user, path_confirmed_at__isnull=False).exists()


def _milestone_reached(user):
    from .models import Milestone
    return Milestone.objects.filter(goal__user=user, status=Milestone.COMPLETED).exists()


def _goal_reached(user):
    from .models import Goal
    return Goal.objects.filter(user=user, is_completed=True).exists()


# What the System says back, as opposed to a penalty it hands out on its own.
SYSTEM_REPLIES = ['chat_response', 'daily_brief', 'evening_eval']


def _met_the_system(user):
    from .models import SystemLog
    return SystemLog.objects.filter(user=user, message_type__in=SYSTEM_REPLIES).exists()


# key, name, what it says to the user, and the question that earns it.
# The keys of the first six are the ones the app already awarded.
ACHIEVEMENTS = [
    ('iron_will', 'Iron Will', 'Turned up seven days in a row', _streak_of(7)),
    ('early_bird', 'Early Bird', 'Finished something between 4am and 8am', _early_bird),
    ('comeback_king', 'Comeback', 'Came straight back after a day away', _came_back),
    ('consistent_scholar', 'Consistent Scholar', 'Reached 200 Intelligence', _studious),
    ('overachiever', 'Overachiever', 'Finished five things in one day', _busy_day),
    ('first_system_contact', 'First Contact', 'Spoke to the System', _met_the_system),
    ('first_steps', 'First Steps', 'Finished your first quest', _first_quest),
    ('unbroken', 'Unbroken', 'Turned up thirty days in a row', _streak_of(30)),
    ('path_set', 'Path Set', 'Confirmed a Goal Path', _path_set),
    ('first_milestone', 'Milestone', 'Reached the first step of your path', _milestone_reached),
    ('goal_reached', 'Arrived', 'Reached a goal you set yourself', _goal_reached),
    ('perfect_week', 'Perfect Week', 'Seven days with no quest missed, and five done', _perfect_week),
]

TITLE_CHOICES = [(key, name) for key, name, _, _ in ACHIEVEMENTS]


def award(user):
    """Award everything the user now qualifies for. Returns the keys of the
    ones that are new, so the client can say so.

    Serialised on the user's row, because two requests arriving together
    would otherwise each clear the displayed title and set their own, and
    both would report the same achievement as new."""
    from django.db import transaction

    from .models import User, UserTitle

    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)

        held = set(UserTitle.objects.filter(user=user).values_list('title_key', flat=True))
        newly = [
            key for key, _, _, earned in ACHIEVEMENTS
            if key not in held and earned(user)
        ]
        if not newly:
            return []

        UserTitle.objects.bulk_create(
            [UserTitle(user=user, title_key=key) for key in newly],
            ignore_conflicts=True,
        )
        # One of them goes on display. Several can land at once — when an
        # established account first sees this list, say — and the last in
        # catalogue order wins, which is the furthest down the collection.
        UserTitle.objects.filter(user=user, is_active=True).update(is_active=False)
        UserTitle.objects.filter(user=user, title_key=newly[-1]).update(is_active=True)
        return newly


def catalogue(user):
    """Every achievement, and when the user earned it."""
    from .models import UserTitle

    earned_at = dict(
        UserTitle.objects.filter(user=user).values_list('title_key', 'earned_at')
    )
    return [
        {
            'key': key,
            'name': name,
            'description': description,
            'earned': key in earned_at,
            'earned_at': earned_at[key].isoformat() if key in earned_at else None,
        }
        for key, name, description, _ in ACHIEVEMENTS
    ]
