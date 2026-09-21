"""Validation for a Goal Path draft.

A draft is what the System proposes and the user edits before confirming: a
goal, 3 to 5 ordered milestones and their daily quests. The same rules check
the AI provider's reply and what the user sends back, so a draft the System
proposes can always be confirmed.
"""
import math
import re
from decimal import Decimal, InvalidOperation

from .models import CompletionCriteria, Task

GOAL_TITLE_MAX_LENGTH = 150
GOAL_DESCRIPTION_MAX_LENGTH = 500

MIN_MILESTONES = 3
MAX_MILESTONES = 5
TITLE_MAX_LENGTH = 150
DESCRIPTION_MAX_LENGTH = 500
UNIT_MAX_LENGTH = 20
MAX_TARGET_COUNT = 1000
# The largest value DecimalField(max_digits=12, decimal_places=2) can hold.
MAX_TARGET_VALUE = Decimal("9999999999.99")
MAX_DAILY_QUESTS_PER_MILESTONE = 2

# A daily quest that raised Stress would be a punishment, not a habit.
DAILY_QUEST_ATTRIBUTES = [name for name, _ in Task.ATTRIBUTE_CHOICES if name != "stress"]

# A target written as text: digits with at most two decimal places.
DECIMAL_TEXT = re.compile(r"\d{1,10}(\.\d{1,2})?")


class DraftError(ValueError):
    """A draft breaks a rule. The message names the rule and never repeats the
    submitted text, so it is safe to show to the user and to log."""


def validate_goal(goal):
    """A draft's goal, normalised, or DraftError."""
    if not isinstance(goal, dict):
        raise DraftError("goal is not an object")
    return {
        "title": _text(goal.get("title"), "goal title", GOAL_TITLE_MAX_LENGTH),
        "description": _text(
            goal.get("description"), "goal description", GOAL_DESCRIPTION_MAX_LENGTH, required=False
        ),
    }


def validate_path(draft):
    """A draft's milestones and daily quests, normalised, or DraftError.

    A milestone's position is its place in the list; daily quests refer to
    milestones by that 1-based position."""
    if not isinstance(draft, dict):
        raise DraftError("draft is not an object")

    raw_milestones = draft.get("milestones")
    if not isinstance(raw_milestones, list) or not (
        MIN_MILESTONES <= len(raw_milestones) <= MAX_MILESTONES
    ):
        raise DraftError(f"expected {MIN_MILESTONES} to {MAX_MILESTONES} milestones")
    milestones = [
        validate_milestone(item, position)
        for position, item in enumerate(raw_milestones, start=1)
    ]

    raw_quests = draft.get("daily_quests", [])
    if not isinstance(raw_quests, list):
        raise DraftError("daily_quests is not a list")
    most_quests = MAX_MILESTONES * MAX_DAILY_QUESTS_PER_MILESTONE
    if len(raw_quests) > most_quests:
        # Checked before any quest is validated, so an oversized list is
        # refused without doing that work first.
        raise DraftError(f"expected at most {most_quests} daily quests")
    daily_quests = [_daily_quest(item, len(milestones)) for item in raw_quests]
    for position in range(1, len(milestones) + 1):
        if sum(quest["milestone"] == position for quest in daily_quests) > MAX_DAILY_QUESTS_PER_MILESTONE:
            raise DraftError(
                f"more than {MAX_DAILY_QUESTS_PER_MILESTONE} daily quests for milestone {position}"
            )

    return {"milestones": milestones, "daily_quests": daily_quests}


def validate_milestone(item, position):
    """One milestone, normalised to the fields its completion type uses."""
    label = f"milestone {position}"
    if not isinstance(item, dict):
        raise DraftError(f"{label} is not an object")

    milestone = {
        "position": position,
        "title": _text(item.get("title"), f"{label} title", TITLE_MAX_LENGTH),
        "description": _text(
            item.get("description"), f"{label} description", DESCRIPTION_MAX_LENGTH, required=False
        ),
        "completion_type": item.get("completion_type"),
    }

    completion_type = milestone["completion_type"]
    if completion_type == CompletionCriteria.CUMULATIVE:
        milestone["target_count"] = _whole_number(
            item.get("target_count"), f"{label} target_count", 1, MAX_TARGET_COUNT
        )
    elif completion_type == CompletionCriteria.MEASURABLE:
        milestone["target_value"] = _target_value(item.get("target_value"), f"{label} target_value")
        direction = item.get("target_direction")
        if direction not in (CompletionCriteria.AT_LEAST, CompletionCriteria.AT_MOST):
            raise DraftError(f"{label} target_direction must be at_least or at_most")
        milestone["target_direction"] = direction
        milestone["unit"] = _text(item.get("unit"), f"{label} unit", UNIT_MAX_LENGTH, required=False)
    elif completion_type != CompletionCriteria.OUTCOME:
        raise DraftError(f"{label} completion_type is not outcome, cumulative or measurable")

    return milestone


def _text(value, field, max_length, required=True):
    if value is None and not required:
        return ""
    if not isinstance(value, str):
        raise DraftError(f"{field} is not text")
    value = value.strip()
    if required and not value:
        raise DraftError(f"{field} is empty")
    if len(value) > max_length:
        raise DraftError(f"{field} is longer than {max_length} characters")
    return value


def _whole_number(value, field, lowest, highest):
    # bool is an int in Python, and "40" is text, not a number.
    if isinstance(value, bool) or not isinstance(value, int) or not lowest <= value <= highest:
        raise DraftError(f"{field} must be a whole number from {lowest} to {highest}")
    return value


def _target_value(value, field):
    if isinstance(value, str):
        # A confirmed path reads its targets back as strings ("1500.50"), so
        # an edited draft sends them the same way.
        if not DECIMAL_TEXT.fullmatch(value.strip()):
            raise DraftError(f"{field} is not a number with at most two decimal places")
        amount = Decimal(value.strip())
    else:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise DraftError(f"{field} is not a number")
        # json.loads accepts NaN and Infinity. NaN passes quantize and then
        # fails the range comparison with a decimal error, not a DraftError.
        if isinstance(value, float) and not math.isfinite(value):
            raise DraftError(f"{field} is not a finite number")
        try:
            # Through str, so a float such as 0.1 doesn't carry binary noise along.
            amount = Decimal(str(value)).quantize(Decimal("0.01"))
        except InvalidOperation as exc:
            raise DraftError(f"{field} is not a usable number") from exc
    if not Decimal("0") < amount <= MAX_TARGET_VALUE:
        raise DraftError(f"{field} must be above 0 and at most {MAX_TARGET_VALUE}")
    return str(amount.quantize(Decimal("0.01")))


def _daily_quest(item, milestone_count):
    if not isinstance(item, dict):
        raise DraftError("a daily quest is not an object")
    attribute = item.get("attribute")
    if attribute not in DAILY_QUEST_ATTRIBUTES:
        raise DraftError("a daily quest attribute is not one of the allowed attributes")
    return {
        "title": _text(item.get("title"), "daily quest title", TITLE_MAX_LENGTH),
        "attribute": attribute,
        "milestone": _whole_number(item.get("milestone"), "daily quest milestone", 1, milestone_count),
    }
