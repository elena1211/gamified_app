"""
Backend test suite.

Run locally with:
    python manage.py test

Requires SECRET_KEY and DATABASE_URL to be set (see .env.example) — the
suite doesn't touch those tables directly, Django's test runner creates and
tears down an isolated test database around them.
"""
import os
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from unittest import mock
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Goal, SystemLog, Task, User, UserAttribute, UserTaskLog
from .views import (
    _call_ai_provider,
    calculate_level_from_exp,
    calculate_task_exp,
    get_exp_for_level,
)

# Throttled views (RegisterView, GuestLoginView, SystemChatView) read/write
# the throttle cache. Tests use an in-memory cache instead of the production
# DatabaseCache so they don't depend on `createcachetable` having been run
# against the test database. Every class below that applies this shares the
# same LocMemCache location (none is set, so Django falls back to one
# process-wide default store), so each of those classes clears it in setUp —
# otherwise throttle counts from one class's requests leak into the next
# class that also hits an account_create/system_chat-scoped view, and the
# combined total can trip a real 429 in what should be an isolated test.
TEST_CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@contextmanager
def patch_localdate(fixed):
    """Pin timezone.localdate() so a test can assert what "today" resolves to
    without waiting for a real date to arrive."""
    with mock.patch("django.utils.timezone.localdate", return_value=fixed):
        yield


class LevelMathTests(TestCase):
    """Pure functions — no DB, no auth, fastest tests in the suite."""

    def test_level_1_requires_zero_exp(self):
        self.assertEqual(get_exp_for_level(1), 0)

    def test_exp_requirement_increases_with_level(self):
        self.assertLess(get_exp_for_level(2), get_exp_for_level(3))
        self.assertLess(get_exp_for_level(3), get_exp_for_level(10))

    def test_calculate_level_from_exp_matches_thresholds(self):
        self.assertEqual(calculate_level_from_exp(0), 1)
        exp_for_level_5 = get_exp_for_level(5)
        self.assertEqual(calculate_level_from_exp(exp_for_level_5), 5)
        self.assertEqual(calculate_level_from_exp(exp_for_level_5 - 1), 4)

    def test_task_exp_scales_with_difficulty(self):
        easy = Task(difficulty=1, is_random=False)
        hard = Task(difficulty=3, is_random=False)
        self.assertLess(calculate_task_exp(easy), calculate_task_exp(hard))

    def test_time_limited_task_gives_exp_bonus(self):
        normal = Task(difficulty=1, is_random=False)
        time_limited = Task(difficulty=1, is_random=True)
        self.assertGreater(calculate_task_exp(time_limited), calculate_task_exp(normal))


class UserAttributeClampingTests(TestCase):
    """UserAttribute.save() clamps values into a valid range — see models.py."""

    def setUp(self):
        self.user = User.objects.create_user(username="attrtester", password="pw12345")

    def test_stress_is_clamped_to_0_100(self):
        over = UserAttribute.objects.create(user=self.user, name="stress", value=999)
        self.assertEqual(over.value, 100)

        under = UserAttribute.objects.create(user=self.user, name="discipline", value=-999)
        self.assertEqual(under.value, 0)

    def test_non_stress_attribute_is_clamped_to_0_1000(self):
        over = UserAttribute.objects.create(user=self.user, name="intelligence", value=5000)
        self.assertEqual(over.value, 1000)


@override_settings(CACHES=TEST_CACHES)
class RegisterViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("register")

    def test_register_creates_user_and_returns_token(self):
        response = self.client.post(self.url, {
            "username": "newplayer",
            "password": "strongpass123",
            "goal_title": "Get fit",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIn("token", response.data)
        self.assertTrue(User.objects.filter(username="newplayer").exists())
        self.assertTrue(Goal.objects.filter(user__username="newplayer", title="Get fit").exists())

    def test_register_requires_goal_title(self):
        response = self.client.post(self.url, {
            "username": "newplayer2",
            "password": "strongpass123",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_duplicate_username(self):
        User.objects.create_user(username="dupeplayer", password="pw12345")
        response = self.client.post(self.url, {
            "username": "dupeplayer",
            "password": "strongpass123",
            "goal_title": "Get fit",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_guest_prefixed_username(self):
        response = self.client.post(self.url, {
            "username": "guest_sneaky",
            "password": "strongpass123",
            "goal_title": "Get fit",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="guest_sneaky").exists())

    def test_register_rejects_oversized_goal_title(self):
        # goal_title/description are read back into the System companion's
        # AI prompt on every chat request, so an unbounded value here is
        # both a DB-constraint 500 waiting to happen and an unbounded
        # prompt-injection surface.
        response = self.client.post(self.url, {
            "username": "wordyplayer",
            "password": "strongpass123",
            "goal_title": "x" * 151,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="wordyplayer").exists())

    def test_register_rejects_oversized_goal_description(self):
        response = self.client.post(self.url, {
            "username": "wordyplayer2",
            "password": "strongpass123",
            "goal_title": "Get fit",
            "goal_description": "x" * 501,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="wordyplayer2").exists())

    def test_register_rejects_a_weak_password(self):
        # AUTH_PASSWORD_VALIDATORS was configured but never invoked, because
        # make_password() hashes whatever it is given. "a" was accepted.
        response = self.client.post(self.url, {
            "username": "weakpassplayer",
            "password": "a",
            "goal_title": "Get fit",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="weakpassplayer").exists())

    def test_register_rejects_a_common_password(self):
        response = self.client.post(self.url, {
            "username": "commonpassplayer",
            "password": "password123",
            "goal_title": "Get fit",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_a_password_too_similar_to_the_username(self):
        response = self.client.post(self.url, {
            "username": "seraphina",
            "password": "seraphina",
            "goal_title": "Get fit",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_oversized_username(self):
        # Matches the check UpgradeGuestView already applies -- without it,
        # an overlong username hits User's DB-level constraint and surfaces
        # as a raw 500 instead of a clean 400.
        response = self.client.post(self.url, {
            "username": "x" * 151,
            "password": "strongpass123",
            "goal_title": "Get fit",
        }, format="json")
        self.assertEqual(response.status_code, 400)


@override_settings(CACHES=TEST_CACHES)
class LoginViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("login")
        self.user = User.objects.create_user(username="loginplayer", password="correcthorse")

    def test_login_with_correct_credentials_returns_token(self):
        response = self.client.post(self.url, {
            "username": "loginplayer",
            "password": "correcthorse",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)

    def test_login_with_wrong_password_is_rejected(self):
        response = self.client.post(self.url, {
            "username": "loginplayer",
            "password": "wrongpassword",
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_repeated_password_guesses_are_throttled(self):
        # ScopedRateThrottle does nothing on a view that declares no scope, so
        # this endpoint previously accepted unlimited password guesses. Uses the
        # real configured rate rather than overriding it, so the test fails if
        # the rate is ever loosened without thought.
        rate = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["login"]
        allowed = int(rate.split("/")[0])

        for _ in range(allowed):
            self.client.post(self.url, {
                "username": "loginplayer", "password": "wrong",
            }, format="json")

        blocked = self.client.post(self.url, {
            "username": "loginplayer", "password": "wrong",
        }, format="json")
        self.assertEqual(blocked.status_code, 429)

    def test_throttle_does_not_block_a_correct_password_within_the_limit(self):
        response = self.client.post(self.url, {
            "username": "loginplayer", "password": "correcthorse",
        }, format="json")
        self.assertEqual(response.status_code, 200)


@override_settings(CACHES=TEST_CACHES)
class GuestLoginViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("guest-login")

    def test_creates_a_seeded_account_and_returns_a_token(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        user = User.objects.get(username=response.data["username"])
        self.assertEqual(Task.objects.filter(user=user).count(), 6)
        self.assertEqual(UserAttribute.objects.filter(user=user).count(), 6)

    def test_guest_id_is_server_generated_and_unguessable(self):
        # The id is the credential for the account, so the client no longer
        # chooses it. 16 bytes of CSPRNG output, hex encoded.
        response = self.client.post(self.url, {}, format="json")
        username = response.data["username"]
        self.assertTrue(username.startswith("guest_"))
        self.assertEqual(len(username), len("guest_") + 32)
        self.assertRegex(username, r"^guest_[0-9a-f]{32}$")

    def test_client_supplied_guest_id_is_ignored(self):
        # Accepting one would restore the hole: knowing another user's id was
        # enough to be handed a token for their account.
        response = self.client.post(self.url, {"guest_id": "guest_a"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["username"], "guest_a")
        self.assertFalse(User.objects.filter(username="guest_a").exists())

    def test_each_request_gets_its_own_account(self):
        first = self.client.post(self.url, {}, format="json")
        second = self.client.post(self.url, {}, format="json")
        self.assertNotEqual(first.data["username"], second.data["username"])
        self.assertNotEqual(first.data["token"], second.data["token"])

@override_settings(CACHES=TEST_CACHES)
class UpgradeGuestViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.guest = User.objects.create_user(username="guest_upgrader", password="throwaway")
        self.guest_token = Token.objects.create(user=self.guest)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.guest_token.key}")
        self.url = reverse("upgrade-guest")

    def test_upgrade_preserves_all_existing_progress(self):
        from datetime import timedelta

        from django.utils import timezone

        goal = Goal.objects.create(user=self.guest, title="Getting Started", description="")
        task = Task.objects.create(
            user=self.guest, title="Meditate", description="", attribute="wellness",
            deadline=timezone.now() + timedelta(days=1),
        )
        self.guest.level = 5
        self.guest.exp = 240
        self.guest.save()

        response = self.client.post(self.url, {
            "username": "realplayer", "password": "strongpass123", "email": "a@example.com",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "realplayer")
        self.assertIn("token", response.data)

        # Same row, same pk -- this is the whole point of the fix.
        self.guest.refresh_from_db()
        self.assertEqual(self.guest.username, "realplayer")
        self.assertEqual(self.guest.level, 5)
        self.assertEqual(self.guest.exp, 240)
        self.assertTrue(self.guest.check_password("strongpass123"))

        goal.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(goal.user_id, self.guest.pk)
        self.assertEqual(task.user_id, self.guest.pk)

    def test_token_still_works_after_username_change(self):
        response = self.client.post(self.url, {
            "username": "realplayer2", "password": "strongpass123",
        }, format="json")
        new_token = response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {new_token}")
        stats_response = self.client.get(reverse("user-stats"))
        self.assertEqual(stats_response.status_code, 200)

    def test_upgrade_rotates_the_token_and_invalidates_the_old_one(self):
        # The guest id that produced the old token was, until this upgrade, the
        # only thing guarding the account. It must stop working once there is a
        # real password behind it.
        old_token = self.guest_token.key
        response = self.client.post(self.url, {
            "username": "rotationplayer", "password": "strongpass123",
        }, format="json")
        new_token = response.data["token"]
        self.assertNotEqual(new_token, old_token)

        stale = APIClient()
        stale.credentials(HTTP_AUTHORIZATION=f"Token {old_token}")
        self.assertEqual(stale.get(reverse("user-stats")).status_code, 401)

        fresh = APIClient()
        fresh.credentials(HTTP_AUTHORIZATION=f"Token {new_token}")
        self.assertEqual(fresh.get(reverse("user-stats")).status_code, 200)

    def test_upgrade_rejects_a_weak_password(self):
        response = self.client.post(self.url, {
            "username": "weakupgrade", "password": "abc",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_retry_after_rotation_fails_closed_rather_than_reporting_success(self):
        # A lost response (e.g. a Render cold-start blip) makes apiRequest resend
        # the request. Before token rotation the retry carried a still-valid
        # token, reached the same account and reported success again. Rotation
        # deliberately trades that for revoking the guest token: the retry now
        # carries an invalidated token and is rejected at the auth layer.
        #
        # The account really was created, so the client tells the user their
        # account may already exist and to sign in, rather than implying the
        # upgrade failed. Failing closed is the right side to err on here — the
        # alternative leaves the pre-upgrade credential working indefinitely.
        first = self.client.post(self.url, {
            "username": "realplayer5", "password": "strongpass123",
        }, format="json")
        self.assertEqual(first.status_code, 200)

        # self.client still holds the pre-upgrade token, as a retry would.
        second = self.client.post(self.url, {
            "username": "realplayer5", "password": "strongpass123",
        }, format="json")
        self.assertEqual(second.status_code, 401)

        # The upgrade itself stands.
        self.assertTrue(User.objects.filter(username="realplayer5").exists())
        upgraded = APIClient()
        upgraded.credentials(HTTP_AUTHORIZATION=f"Token {first.data['token']}")
        self.assertEqual(upgraded.get(reverse("user-stats")).status_code, 200)

    def test_rejects_non_guest_account(self):
        real_user = User.objects.create_user(username="alreadyregistered", password="pw12345")
        token = Token.objects.create(user=real_user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        response = client.post(self.url, {"username": "newname", "password": "strongpass123"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_duplicate_username(self):
        User.objects.create_user(username="taken", password="pw12345")
        response = self.client.post(self.url, {"username": "taken", "password": "strongpass123"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_guest_prefixed_username(self):
        response = self.client.post(self.url, {"username": "guest_sneaky", "password": "strongpass123"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_short_password(self):
        response = self.client.post(self.url, {"username": "realplayer3", "password": "abc"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.guest.refresh_from_db()
        self.assertEqual(self.guest.username, "guest_upgrader")

    def test_requires_authentication(self):
        response = APIClient().post(self.url, {"username": "realplayer4", "password": "strongpass123"}, format="json")
        self.assertEqual(response.status_code, 401)


class TaskListViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tasklister", password="pw12345")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.url = reverse("task-list")

    def test_requires_authentication(self):
        anon_client = APIClient()
        response = anon_client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_returns_only_current_users_tasks(self):
        from datetime import timedelta

        from django.utils import timezone

        other_user = User.objects.create_user(username="otherplayer", password="pw12345")
        Task.objects.create(
            user=self.user, title="Mine", description="", attribute="discipline",
            deadline=timezone.now() + timedelta(days=1),
        )
        Task.objects.create(
            user=other_user, title="Not mine", description="", attribute="discipline",
            deadline=timezone.now() + timedelta(days=1),
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        titles = [t["title"] for t in response.data]
        self.assertIn("Mine", titles)
        self.assertNotIn("Not mine", titles)

    def test_response_includes_raw_reward_point_alongside_display_string(self):
        # The frontend used to reconstruct reward_point by regex-parsing the
        # "reward" display string, which is already halved (reward_point//2)
        # -- silently corrupting the stored value on every edit-after-fetch.
        # The raw field must be present and must NOT match the halved string.
        from datetime import timedelta

        from django.utils import timezone

        Task.objects.create(
            user=self.user, title="Solo task", description="", attribute="discipline",
            reward_point=5, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        task_data = next(t for t in response.data if t["title"] == "Solo task")
        self.assertEqual(task_data["reward_point"], 5)
        self.assertEqual(task_data["reward"], "+2 Discipline")


class TaskCreateValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="creator", password="pw12345")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.url = reverse("task-list")

    def test_valid_task_is_created(self):
        response = self.client.post(self.url, {
            "title": "Read a chapter",
            "description": "Any nonfiction chapter",
            "reward_point": 4,
            "difficulty": 2,
            "attribute": "intelligence",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "Read a chapter")
        self.assertEqual(response.data["difficulty"], 2)
        self.assertEqual(response.data["attribute"], "intelligence")
        self.assertEqual(response.data["reward_point"], 4)

        task = Task.objects.get(user=self.user, title="Read a chapter")
        self.assertEqual(task.reward_point, 4)
        self.assertEqual(task.difficulty, 2)

    def test_rejects_empty_title(self):
        response = self.client.post(self.url, {"title": "   "}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Task.objects.filter(user=self.user).exists())

    def test_rejects_oversized_title(self):
        response = self.client.post(self.url, {"title": "x" * 151}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Task.objects.filter(user=self.user).exists())

    def test_rejects_oversized_description(self):
        response = self.client.post(self.url, {
            "title": "Valid title",
            "description": "x" * 501,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Task.objects.filter(user=self.user).exists())

    def test_rejects_out_of_range_reward_point(self):
        response = self.client.post(self.url, {"title": "Valid title", "reward_point": 999}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Task.objects.filter(user=self.user).exists())

    def test_rejects_out_of_range_difficulty(self):
        response = self.client.post(self.url, {"title": "Valid title", "difficulty": 0}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Task.objects.filter(user=self.user).exists())

    def test_rejects_invalid_attribute(self):
        response = self.client.post(self.url, {"title": "Valid title", "attribute": "not-a-real-attribute"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Task.objects.filter(user=self.user).exists())

    def test_requires_authentication(self):
        response = APIClient().post(self.url, {"title": "Valid title"}, format="json")
        self.assertEqual(response.status_code, 401)
        self.assertFalse(Task.objects.filter(user=self.user).exists())

    def test_omitted_fields_fall_back_to_defaults(self):
        response = self.client.post(self.url, {"title": "Bare minimum quest"}, format="json")
        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(user=self.user, title="Bare minimum quest")
        self.assertEqual(task.reward_point, 3)
        self.assertEqual(task.difficulty, 1)
        self.assertEqual(task.attribute, "discipline")

    def test_blank_reward_point_and_difficulty_fall_back_to_defaults(self):
        # The create form's number input can be cleared to an empty string
        # rather than omitting the key entirely — must not 400.
        response = self.client.post(self.url, {
            "title": "Cleared fields quest", "reward_point": "", "difficulty": "",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(user=self.user, title="Cleared fields quest")
        self.assertEqual(task.reward_point, 3)
        self.assertEqual(task.difficulty, 1)

    def test_title_and_description_at_exact_length_limit_are_accepted(self):
        response = self.client.post(self.url, {
            "title": "x" * 150, "description": "y" * 500,
        }, format="json")
        self.assertEqual(response.status_code, 201)

    def test_client_supplied_deadline_is_ignored(self):
        response = self.client.post(self.url, {
            "title": "Deadline test quest", "deadline": "not-a-real-date",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(user=self.user, title="Deadline test quest")
        self.assertIsNotNone(task.deadline)


class TaskDeleteTests(TestCase):
    def setUp(self):
        from datetime import timedelta

        from django.utils import timezone

        self.user = User.objects.create_user(username="deleter", password="pw12345")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.task = Task.objects.create(
            user=self.user, title="Doomed task", description="", attribute="discipline",
            deadline=timezone.now() + timedelta(days=1),
        )
        self.url = reverse("task-detail", args=[self.task.id])

    def test_deleting_own_task_removes_it(self):
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Task.objects.filter(id=self.task.id).exists())

    def test_cannot_delete_another_users_task(self):
        other = User.objects.create_user(username="victim", password="pw12345")
        other_task = Task.objects.create(
            user=other, title="Not yours", description="", attribute="discipline",
            deadline=self.task.deadline,
        )
        response = self.client.delete(reverse("task-detail", args=[other_task.id]))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Task.objects.filter(id=other_task.id).exists())

    def test_requires_authentication(self):
        response = APIClient().delete(self.url)
        self.assertEqual(response.status_code, 401)
        self.assertTrue(Task.objects.filter(id=self.task.id).exists())

    def test_deleting_a_completed_task_removes_its_history(self):
        from django.utils import timezone

        from .models import UserTaskLog

        log = UserTaskLog.objects.create(
            user=self.user, task=self.task, status="completed",
            completed_at=timezone.now(),
        )
        self.client.delete(self.url)
        # Assert by the log's own pk — the row must be gone entirely
        # (CASCADE), not merely detached from the task.
        self.assertFalse(UserTaskLog.objects.filter(pk=log.pk).exists())


class TaskEditTests(TestCase):
    def setUp(self):
        from datetime import timedelta

        from django.utils import timezone

        self.user = User.objects.create_user(username="editor", password="pw12345")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.task = Task.objects.create(
            user=self.user, title="Original title", description="Original tip",
            attribute="discipline", difficulty=1, reward_point=10,
            deadline=timezone.now() + timedelta(days=1),
        )
        self.url = reverse("task-detail", args=[self.task.id])

    def test_editing_own_task_persists_changes(self):
        response = self.client.put(self.url, {
            "title": "Updated title",
            "description": "Updated tip",
            "reward_point": 4,
            "difficulty": 3,
            "attribute": "wellness",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["reward"], "+2 Wellness, +2 Discipline")
        self.assertEqual(response.data["reward_point"], 4)

        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Updated title")
        self.assertEqual(self.task.description, "Updated tip")
        self.assertEqual(self.task.reward_point, 4)
        self.assertEqual(self.task.difficulty, 3)
        self.assertEqual(self.task.attribute, "wellness")

    def test_partial_update_only_changes_given_fields(self):
        response = self.client.put(self.url, {"title": "Only title changed"}, format="json")
        self.assertEqual(response.status_code, 200)

        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Only title changed")
        self.assertEqual(self.task.description, "Original tip")
        self.assertEqual(self.task.reward_point, 10)

    def test_rejects_empty_title(self):
        response = self.client.put(self.url, {"title": "   "}, format="json")
        self.assertEqual(response.status_code, 400)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Original title")

    def test_rejects_null_title_instead_of_crashing(self):
        response = self.client.put(self.url, {"title": None}, format="json")
        self.assertEqual(response.status_code, 400)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Original title")

    def test_rejects_invalid_attribute(self):
        response = self.client.put(self.url, {"attribute": "not-a-real-attribute"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.task.refresh_from_db()
        self.assertEqual(self.task.attribute, "discipline")

    def test_rejects_out_of_range_reward_point(self):
        response = self.client.put(self.url, {"reward_point": 999}, format="json")
        self.assertEqual(response.status_code, 400)
        self.task.refresh_from_db()
        self.assertEqual(self.task.reward_point, 10)

    def test_rejects_out_of_range_difficulty(self):
        response = self.client.put(self.url, {"difficulty": 0}, format="json")
        self.assertEqual(response.status_code, 400)
        self.task.refresh_from_db()
        self.assertEqual(self.task.difficulty, 1)

    def test_cannot_edit_punishment_task(self):
        from django.utils import timezone

        punishment = Task.objects.create(
            user=self.user, title="Punishment quest", description="", attribute="discipline",
            difficulty=2, reward_point=8, mission_type="punishment",
            deadline=timezone.now(),
        )
        response = self.client.put(
            reverse("task-detail", args=[punishment.id]),
            {"reward_point": 1}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        punishment.refresh_from_db()
        self.assertEqual(punishment.reward_point, 8)

    def test_cannot_edit_time_limited_task(self):
        from django.utils import timezone

        timed = Task.objects.create(
            user=self.user, title="Time-limited quest", description="", attribute="discipline",
            is_random=True, deadline=timezone.now(),
        )
        response = self.client.put(
            reverse("task-detail", args=[timed.id]),
            {"title": "Renamed"}, format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_cannot_change_reward_fields_after_completing_today(self):
        from django.utils import timezone

        from .models import UserTaskLog

        UserTaskLog.objects.create(
            user=self.user, task=self.task, status="completed",
            completed_at=timezone.now(),
        )
        response = self.client.put(self.url, {"reward_point": 3}, format="json")
        self.assertEqual(response.status_code, 400)
        self.task.refresh_from_db()
        self.assertEqual(self.task.reward_point, 10)

    def test_can_still_rename_a_task_completed_today(self):
        from django.utils import timezone

        from .models import UserTaskLog

        UserTaskLog.objects.create(
            user=self.user, task=self.task, status="completed",
            completed_at=timezone.now(),
        )
        response = self.client.put(self.url, {"title": "Renamed after completion"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Renamed after completion")

    def test_cannot_edit_another_users_task(self):
        other = User.objects.create_user(username="editor-victim", password="pw12345")
        other_task = Task.objects.create(
            user=other, title="Not yours", description="", attribute="discipline",
            deadline=self.task.deadline,
        )
        response = self.client.put(
            reverse("task-detail", args=[other_task.id]),
            {"title": "Hijacked"}, format="json",
        )
        self.assertEqual(response.status_code, 404)
        other_task.refresh_from_db()
        self.assertEqual(other_task.title, "Not yours")

    def test_requires_authentication(self):
        response = APIClient().put(self.url, {"title": "Hijacked"}, format="json")
        self.assertEqual(response.status_code, 401)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Original title")


class TaskCompleteViewTests(TestCase):
    def setUp(self):
        from datetime import timedelta

        from django.utils import timezone

        self.user = User.objects.create_user(username="completer", password="pw12345")
        for attr_name in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=self.user, name=attr_name, value=0)
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.task = Task.objects.create(
            user=self.user, title="Meditate", description="", attribute="wellness",
            difficulty=1, reward_point=10, deadline=timezone.now() + timedelta(days=1),
        )
        self.url = reverse("task-complete")

    def test_completing_a_task_awards_exp_and_attribute(self):
        response = self.client.post(self.url, {"task_id": self.task.id}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["task_completed"])
        self.user.refresh_from_db()
        # difficulty=1 task -> base_exp = 10 + 1*5 (calculate_task_exp),
        # reward string = "+5 Wellness" (reward_point=10 // 2)
        self.assertEqual(self.user.exp, 15)
        wellness = UserAttribute.objects.get(user=self.user, name="wellness")
        self.assertEqual(wellness.value, 5)

    def test_completing_twice_toggles_back_to_incomplete(self):
        self.client.post(self.url, {"task_id": self.task.id}, format="json")
        response = self.client.post(self.url, {"task_id": self.task.id}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["task_completed"])
        self.user.refresh_from_db()
        self.assertEqual(self.user.exp, 0)

    def test_unknown_task_id_returns_404(self):
        response = self.client.post(self.url, {"task_id": 999999}, format="json")
        self.assertEqual(response.status_code, 404)


class DynamicTaskCompleteViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="dynamiccompleter", password="pw12345")
        for attr_name in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=self.user, name=attr_name, value=0)
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.url = reverse("dynamic-task-complete")

    def test_rejects_empty_task_title(self):
        response = self.client.post(self.url, {
            "task_title": "   ",
            "task_type": "daily",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_oversized_task_title(self):
        # task_title is stored as Task.title (max_length=150) and later read
        # back into the System companion's AI prompt (see recent_titles in
        # _build_user_prompt) -- unbounded input here was both a DB-
        # constraint 500 waiting to happen and a prompt-injection surface.
        response = self.client.post(self.url, {
            "task_title": "x" * 151,
            "task_type": "daily",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Task.objects.filter(user=self.user, title__startswith="xxx").exists())

    def test_accepts_task_title_at_the_150_char_limit(self):
        # The cap must match Task.title's actual max_length -- a stricter
        # cap here would silently break completing a legitimately-created
        # task whose title is 140-150 chars (allowed everywhere else a
        # title is written: TaskListView, TaskDetailView, SystemChatView).
        title = "x" * 150
        response = self.client.post(self.url, {
            "task_title": title,
            "task_type": "daily",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Task.objects.filter(user=self.user, title=title).exists())

    def test_time_limited_task_title_near_the_limit_does_not_hit_db_constraint(self):
        # time_limited appends " - HH:MM:SS" (11 chars) to task_title before
        # storing it, so a title right at the 150-char cap must be
        # truncated rather than raising a DB-level error on save.
        response = self.client.post(self.url, {
            "task_title": "x" * 150,
            "task_type": "time_limited",
            "reward_points": 3,
            "attribute": "discipline",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        task = Task.objects.filter(user=self.user, title__startswith="x" * 139).first()
        self.assertIsNotNone(task)
        self.assertLessEqual(len(task.title), 150)

    def test_time_limited_task_persists_every_attribute_in_reward_string(self):
        # Previously only reached the frontend's local AppContext state —
        # never written to UserAttribute at all.
        response = self.client.post(self.url, {
            "task_title": "Click VS Code Tab",
            "task_type": "time_limited",
            "reward_points": 3,
            "reward_string": "+3 Intelligence, +2 Discipline",
            "attribute": "intelligence",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["task_completed"])

        intelligence = UserAttribute.objects.get(user=self.user, name="intelligence")
        discipline = UserAttribute.objects.get(user=self.user, name="discipline")
        self.assertEqual(intelligence.value, 3)
        self.assertEqual(discipline.value, 2)

    def test_time_limited_task_without_reward_string_does_not_crash(self):
        response = self.client.post(self.url, {
            "task_title": "Press Ctrl+S",
            "task_type": "time_limited",
            "reward_points": 2,
            "attribute": "discipline",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        # No reward_string given -- no attribute change to apply, but the
        # request must still succeed (EXP/level still awarded).
        discipline = UserAttribute.objects.get(user=self.user, name="discipline")
        self.assertEqual(discipline.value, 0)

    def test_time_limited_reward_points_out_of_range_falls_back_to_default(self):
        response = self.client.post(self.url, {
            "task_title": "Open Terminal",
            "task_type": "time_limited",
            "reward_points": 9999,
            "attribute": "not-a-real-attribute",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        task = Task.objects.filter(user=self.user, title__startswith="Open Terminal").first()
        self.assertEqual(task.reward_point, 3)
        self.assertEqual(task.attribute, "discipline")

    def test_time_limited_oversized_reward_string_is_rejected(self):
        # reward_points/attribute are validated, but reward_string is what
        # actually drives the stat grant -- a request can't use a valid
        # reward_points/attribute pair to smuggle an unbounded reward_string.
        response = self.client.post(self.url, {
            "task_title": "Open Terminal",
            "task_type": "time_limited",
            "reward_points": 3,
            "attribute": "discipline",
            "reward_string": "+9999 Intelligence, -1000 Stress",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        intelligence = UserAttribute.objects.get(user=self.user, name="intelligence")
        stress = UserAttribute.objects.get(user=self.user, name="stress")
        self.assertEqual(intelligence.value, 0)
        self.assertEqual(stress.value, 0)

    def test_time_limited_reward_string_with_unknown_attribute_is_rejected(self):
        response = self.client.post(self.url, {
            "task_title": "Open Terminal",
            "task_type": "time_limited",
            "reward_points": 3,
            "attribute": "discipline",
            "reward_string": "+3 NotARealAttribute",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(UserAttribute.objects.filter(user=self.user, name="notarealattribute").exists())

    def test_time_limited_reward_string_within_bounds_is_still_applied(self):
        response = self.client.post(self.url, {
            "task_title": "Navigate to GitHub",
            "task_type": "time_limited",
            "reward_points": 3,
            "attribute": "intelligence",
            "reward_string": "+3 Intelligence, +2 Social",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        intelligence = UserAttribute.objects.get(user=self.user, name="intelligence")
        social = UserAttribute.objects.get(user=self.user, name="social")
        self.assertEqual(intelligence.value, 3)
        self.assertEqual(social.value, 2)

    def test_daily_task_reward_is_derived_from_stored_task_not_client_string(self):
        from datetime import timedelta

        from django.utils import timezone

        # A real task already exists with a small, single-attribute reward...
        Task.objects.create(
            user=self.user, title="Organise workspace", description="", attribute="discipline",
            reward_point=6, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        # ...but the client sends a wildly different, made-up multi-attribute
        # string (as the frontend's offline-fallback task list would, if the
        # user completes a task while /api/tasks/ is failing to load).
        response = self.client.post(self.url, {
            "task_title": "Organise workspace",
            "task_type": "daily",
            "reward_points": 6,
            "reward_string": "+6 Discipline, +8 Wellness, +2 Energy",
            "attribute": "discipline",
        }, format="json")
        self.assertEqual(response.status_code, 200)

        # Only what the real stored task actually grants (reward_point // 2
        # to its own attribute) is applied -- not the client's string.
        discipline = UserAttribute.objects.get(user=self.user, name="discipline")
        wellness = UserAttribute.objects.get(user=self.user, name="wellness")
        energy = UserAttribute.objects.get(user=self.user, name="energy")
        self.assertEqual(discipline.value, 3)
        self.assertEqual(wellness.value, 0)
        self.assertEqual(energy.value, 0)

    def test_daily_task_creates_new_task_with_validated_defaults(self):
        response = self.client.post(self.url, {
            "task_title": "Brand new daily quest",
            "task_type": "daily",
            "reward_points": 999,
            "attribute": "not-a-real-attribute",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        task = Task.objects.get(user=self.user, title="Brand new daily quest")
        self.assertEqual(task.reward_point, 3)
        self.assertEqual(task.attribute, "discipline")

    def test_completing_same_daily_task_twice_in_one_day_does_not_double_grant(self):
        from datetime import timedelta

        from django.utils import timezone

        Task.objects.create(
            user=self.user, title="Write journal entry", description="", attribute="discipline",
            reward_point=5, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        payload = {
            "task_title": "Write journal entry", "task_type": "daily",
            "reward_points": 5, "attribute": "discipline",
        }
        self.client.post(self.url, payload, format="json")
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["message"], "Daily task already completed today")

        discipline = UserAttribute.objects.get(user=self.user, name="discipline")
        self.assertEqual(discipline.value, 2)  # 5 // 2, granted once


class DynamicTaskUncompleteViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="dynamicuncompleter", password="pw12345")
        for attr_name in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=self.user, name=attr_name, value=0)
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.complete_url = reverse("dynamic-task-complete")
        self.uncomplete_url = reverse("dynamic-task-uncomplete")

    def test_uncomplete_of_nonexistent_task_returns_clean_404_not_500(self):
        # The "not found" branch used to reference an undefined `username`
        # variable (should have been user.username), raising a NameError
        # that the outer except swallowed into a raw 500 with the Python
        # error text leaked to the client, instead of the intended 404.
        response = self.client.post(self.uncomplete_url, {
            "task_title": "This task was never created",
        }, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"], "Dynamic task not found")

    def test_uncomplete_reverses_exactly_what_complete_applied_even_with_mismatched_client_string(self):
        from datetime import timedelta

        from django.utils import timezone

        # Real stored task grants a small, single-attribute reward...
        Task.objects.create(
            user=self.user, title="Organise workspace", description="", attribute="discipline",
            reward_point=6, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        self.client.post(self.complete_url, {
            "task_title": "Organise workspace",
            "task_type": "daily",
            "reward_points": 6,
            "attribute": "discipline",
        }, format="json")
        discipline = UserAttribute.objects.get(user=self.user, name="discipline")
        self.assertEqual(discipline.value, 3)  # 6 // 2

        # ...but the client sends a wildly different string when uncompleting
        # (e.g. the frontend's offline-fallback task list, or simply a stale
        # cached value). It must be ignored: the reversal is derived from the
        # same stored task, so it always undoes exactly what was granted.
        response = self.client.post(self.uncomplete_url, {
            "task_title": "Organise workspace",
            "reward_string": "+6 Discipline, +8 Wellness, +2 Energy",
        }, format="json")
        self.assertEqual(response.status_code, 200)

        discipline.refresh_from_db()
        wellness = UserAttribute.objects.get(user=self.user, name="wellness")
        energy = UserAttribute.objects.get(user=self.user, name="energy")
        self.assertEqual(discipline.value, 0)
        self.assertEqual(wellness.value, 0)
        self.assertEqual(energy.value, 0)

    def test_a_substring_does_not_match_an_unrelated_task(self):
        # The lookup used to fall back to icontains and then to any word over
        # three characters, so {"task_title": "a"} reversed the completion of
        # whichever task happened to contain an "a" — subtracting the wrong EXP
        # and attributes from a task the user never touched.
        from datetime import timedelta

        from django.utils import timezone

        Task.objects.create(
            user=self.user, title="Read a chapter", description="", attribute="intelligence",
            reward_point=6, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        self.client.post(self.complete_url, {
            "task_title": "Read a chapter", "task_type": "daily",
            "reward_points": 6, "attribute": "intelligence",
        }, format="json")
        intelligence = UserAttribute.objects.get(user=self.user, name="intelligence")
        self.assertEqual(intelligence.value, 3)

        response = self.client.post(self.uncomplete_url, {"task_title": "a"}, format="json")
        self.assertEqual(response.status_code, 404)

        intelligence.refresh_from_db()
        self.assertEqual(intelligence.value, 3)

    def test_rejects_empty_and_oversized_titles(self):
        self.assertEqual(
            self.client.post(self.uncomplete_url, {"task_title": "   "}, format="json").status_code,
            400,
        )
        self.assertEqual(
            self.client.post(self.uncomplete_url, {"task_title": "x" * 151}, format="json").status_code,
            400,
        )

    def test_uncomplete_without_reward_string_still_reverses_correctly(self):
        from datetime import timedelta

        from django.utils import timezone

        Task.objects.create(
            user=self.user, title="Meditation", description="", attribute="energy",
            reward_point=4, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        self.client.post(self.complete_url, {
            "task_title": "Meditation", "task_type": "daily",
            "reward_points": 4, "attribute": "energy",
        }, format="json")
        energy = UserAttribute.objects.get(user=self.user, name="energy")
        self.assertEqual(energy.value, 2)  # 4 // 2

        response = self.client.post(self.uncomplete_url, {"task_title": "Meditation"}, format="json")
        self.assertEqual(response.status_code, 200)
        energy.refresh_from_db()
        self.assertEqual(energy.value, 0)


class AIProviderTests(TestCase):
    """_call_ai_provider() branches on AI_PROVIDER; each branch needs its
    own client mocked out so these run without a real API key or network call."""

    @mock.patch.dict(os.environ, {}, clear=True)
    def test_defaults_to_nvidia_and_requires_its_key(self):
        with self.assertRaises(RuntimeError):
            _call_ai_provider("sys", "user")

    @mock.patch.dict(os.environ, {"AI_PROVIDER": "anthropic"}, clear=True)
    def test_anthropic_provider_requires_its_key(self):
        with self.assertRaises(RuntimeError):
            _call_ai_provider("sys", "user")

    @mock.patch.dict(os.environ, {"NVIDIA_API_KEY": "test-key"}, clear=True)
    @mock.patch("openai.OpenAI")
    def test_nvidia_provider_calls_openai_compatible_client(self, mock_openai_cls):
        mock_client = mock_openai_cls.return_value
        # Shape of a real OpenAI-compatible response: .choices[0].message.content
        mock_client.chat.completions.create.return_value.choices = [
            mock.Mock(message=mock.Mock(content='{"system_message": "hi"}'))
        ]

        result = _call_ai_provider("sys prompt", "user prompt")

        self.assertEqual(result, '{"system_message": "hi"}')
        mock_openai_cls.assert_called_once_with(
            api_key="test-key", base_url="https://integrate.api.nvidia.com/v1"
        )
        _, kwargs = mock_client.chat.completions.create.call_args
        self.assertEqual(
            kwargs["messages"],
            [
                {"role": "system", "content": "sys prompt"},
                {"role": "user", "content": "user prompt"},
            ],
        )

    @mock.patch.dict(
        os.environ, {"AI_PROVIDER": "anthropic", "ANTHROPIC_API_KEY": "test-key"}, clear=True
    )
    @mock.patch("anthropic.Anthropic")
    def test_anthropic_provider_calls_claude_client(self, mock_anthropic_cls):
        mock_client = mock_anthropic_cls.return_value
        mock_client.messages.create.return_value.content = [mock.Mock(text="hi")]

        result = _call_ai_provider("sys prompt", "user prompt")

        self.assertEqual(result, "hi")
        mock_anthropic_cls.assert_called_once_with(api_key="test-key")
        _, kwargs = mock_client.messages.create.call_args
        self.assertEqual(kwargs["system"], "sys prompt")
        self.assertEqual(kwargs["messages"], [{"role": "user", "content": "user prompt"}])


@override_settings(CACHES=TEST_CACHES)
class SystemChatViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="chatuser", password="pw12345")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.url = reverse("system-chat")

    def test_requires_authentication(self):
        anon_client = APIClient()
        response = anon_client.post(self.url, {"message": "hi", "context_type": "user_input"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_rejects_oversized_message(self):
        response = self.client.post(self.url, {
            "message": "x" * 1001,
            "context_type": "user_input",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_invalid_context_type(self):
        response = self.client.post(self.url, {
            "message": "hi",
            "context_type": "not_a_real_type",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_empty_user_input_message(self):
        response = self.client.post(self.url, {
            "message": "   ",
            "context_type": "user_input",
        }, format="json")
        self.assertEqual(response.status_code, 400)


class GoalViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="goalowner", password="pw12345")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.url = reverse("user-goal")

    def test_returns_the_users_own_goal(self):
        Goal.objects.create(user=self.user, title="Learn Django", description="Ship a real app")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "Learn Django")

    def test_user_without_a_goal_gets_null_not_a_stand_in(self):
        # This used to return a hardcoded "Become a Software Engineer" goal,
        # which the UI rendered as if the user had written it themselves.
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["goal"])

    def test_does_not_return_another_users_goal(self):
        other = User.objects.create_user(username="goalstranger", password="pw12345")
        Goal.objects.create(user=other, title="Not yours", description="")
        response = self.client.get(self.url)
        self.assertIsNone(response.data["goal"])

    def test_requires_authentication(self):
        self.assertEqual(APIClient().get(self.url).status_code, 401)


class HealthViewTests(TestCase):
    def test_health_check_is_public_and_ok(self):
        response = APIClient().get(reverse("health"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["database"], "connected")

    def test_health_check_reports_degraded_when_the_database_is_unreachable(self):
        # It used to report "connected" without touching the database, so Render
        # saw a healthy service throughout an outage and never restarted it.
        from unittest import mock

        from django.db import OperationalError

        with mock.patch("backend.views.connection.cursor", side_effect=OperationalError("down")):
            response = APIClient().get(reverse("health"))

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["database"], "unreachable")


class CompletedHistoryLimitTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="historyreader", password="pw12345")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.url = reverse("completed-tasks-history")

    def test_non_numeric_limit_is_a_400_not_a_500(self):
        # A bare int() on the query parameter, outside the try block, made this
        # an unhandled ValueError.
        response = self.client.get(self.url, {"limit": "abc"})
        self.assertEqual(response.status_code, 400)

    def test_negative_limit_is_a_400_not_a_500(self):
        # Became a negative slice, which Django refuses.
        response = self.client.get(self.url, {"limit": "-1"})
        self.assertEqual(response.status_code, 400)

    def test_oversized_limit_is_capped_rather_than_run_unbounded(self):
        response = self.client.get(self.url, {"limit": "999999999"})
        self.assertEqual(response.status_code, 200)

    def test_default_limit_works(self):
        self.assertEqual(self.client.get(self.url).status_code, 200)


class DuplicateTaskTitleTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="titleowner", password="pw12345")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.url = reverse("task-list")

    def test_rejects_a_second_task_with_the_same_title(self):
        # Endpoints that find a task by (user, title) cannot tell duplicates
        # apart, so the reward applied depends on which row comes back.
        payload = {"title": "Morning pages", "reward_point": 4, "difficulty": 1,
                   "attribute": "discipline"}
        self.assertEqual(self.client.post(self.url, payload, format="json").status_code, 201)
        self.assertEqual(self.client.post(self.url, payload, format="json").status_code, 400)
        self.assertEqual(Task.objects.filter(user=self.user, title="Morning pages").count(), 1)

    def test_another_user_may_still_use_that_title(self):
        # The constraint is per user, not global.
        Task.objects.create(
            user=self.user, title="Morning pages", description="",
            attribute="discipline", reward_point=4, difficulty=1,
            deadline=timezone.now() + timedelta(days=1),
        )
        other = User.objects.create_user(username="titlestranger", password="pw12345")
        other_client = APIClient()
        other_client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=other).key}")
        response = other_client.post(self.url, {
            "title": "Morning pages", "reward_point": 4, "difficulty": 1,
            "attribute": "discipline",
        }, format="json")
        self.assertEqual(response.status_code, 201)


@override_settings(CACHES=TEST_CACHES)
class EndpointAuthTests(TestCase):
    """Every endpoint that is not deliberately public must reject an
    unauthenticated caller. Driven off a list so adding a view without
    protecting it shows up here rather than in production."""

    # (url name, method, kwargs for reverse)
    PROTECTED = [
        ("upgrade-guest", "post", {}),
        ("task-list", "get", {}),
        ("task-list", "post", {}),
        ("task-detail", "get", {"args": [1]}),
        ("task-detail", "put", {"args": [1]}),
        ("task-detail", "delete", {"args": [1]}),
        ("task-complete", "post", {}),
        ("dynamic-task-complete", "post", {}),
        ("dynamic-task-uncomplete", "post", {}),
        ("completed-tasks-history", "get", {}),
        ("weekly-stats", "get", {}),
        ("user-goal", "get", {}),
        ("user-stats", "get", {}),
        ("user-progress", "get", {}),
        ("system-chat", "post", {}),
        ("system-messages", "get", {}),
        ("system-daily-status", "get", {}),
        ("system-punishment-check", "post", {}),
    ]

    PUBLIC = [
        ("register", "post"),
        ("login", "post"),
        ("guest-login", "post"),
        ("health", "get"),
        ("root", "get"),
    ]

    def test_every_protected_endpoint_rejects_an_anonymous_caller(self):
        anon = APIClient()
        for name, method, kwargs in self.PROTECTED:
            with self.subTest(endpoint=name, method=method):
                url = reverse(name, **kwargs)
                response = getattr(anon, method)(url, {}, format="json")
                self.assertEqual(
                    response.status_code, 401,
                    f"{method.upper()} {name} answered {response.status_code} without a token",
                )

    def test_every_protected_endpoint_rejects_a_bad_token(self):
        forged = APIClient()
        forged.credentials(HTTP_AUTHORIZATION="Token 0000000000000000000000000000000000000000")
        for name, method, kwargs in self.PROTECTED:
            with self.subTest(endpoint=name, method=method):
                url = reverse(name, **kwargs)
                response = getattr(forged, method)(url, {}, format="json")
                self.assertEqual(
                    response.status_code, 401,
                    f"{method.upper()} {name} accepted a forged token",
                )

    def test_the_lists_above_cover_every_registered_endpoint(self):
        # Without this, the two lists silently go stale: a new view is added,
        # nobody adds it here, and the suite keeps reporting full coverage of a
        # set that no longer matches the URL conf.
        from django.urls import get_resolver

        registered = {
            name for name in get_resolver().reverse_dict.keys()
            if isinstance(name, str) and not name.startswith("admin")
        }
        listed = {name for name, _, _ in self.PROTECTED} | {name for name, _ in self.PUBLIC}
        self.assertEqual(
            registered - listed, set(),
            "endpoint(s) missing from PROTECTED/PUBLIC above",
        )

    def test_the_public_endpoints_stay_public(self):
        # The counterpart: a change that locked these would break sign-up and
        # the deployment health probe.
        anon = APIClient()
        for name, method in self.PUBLIC:
            with self.subTest(endpoint=name):
                response = getattr(anon, method)(reverse(name), {}, format="json")
                self.assertNotEqual(response.status_code, 401, f"{name} now requires auth")


@override_settings(CACHES=TEST_CACHES)
class CrossUserIsolationTests(TestCase):
    """The old design took a ?user=<username> parameter and trusted it. It is
    gone, but "gone" is a claim — these make it checkable. Every read is asserted
    to return only the caller's own rows, and every write against someone else's
    row is asserted to fail."""

    def setUp(self):
        cache.clear()
        self.alice = self._make_user("alice")
        self.bob = self._make_user("bob")

        self.alice_client = APIClient()
        self.alice_client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.alice).key}"
        )

        self.bob_task = Task.objects.create(
            user=self.bob, title="Bob's private task", description="secret",
            attribute="intelligence", reward_point=6, difficulty=1,
            deadline=timezone.now() + timedelta(days=1),
        )
        Goal.objects.create(user=self.bob, title="Bob's private goal", description="secret")
        SystemLog.objects.create(
            user=self.bob, message_type='morning_brief', content="Bob's private briefing",
        )
        UserTaskLog.objects.create(
            user=self.bob, task=self.bob_task, status='completed',
            completed_at=timezone.now(),
        )

    def _make_user(self, name):
        user = User.objects.create_user(username=name, password="pw12345")
        for attr in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=user, name=attr, value=42)
        return user

    def test_task_list_shows_only_the_callers_tasks(self):
        response = self.alice_client.get(reverse("task-list"))
        self.assertEqual(response.status_code, 200)
        titles = [t["title"] for t in response.data]
        self.assertNotIn("Bob's private task", titles)

    def test_cannot_read_another_users_task_by_id(self):
        response = self.alice_client.get(reverse("task-detail", args=[self.bob_task.id]))
        self.assertEqual(response.status_code, 404)

    def test_cannot_edit_or_delete_another_users_task(self):
        url = reverse("task-detail", args=[self.bob_task.id])
        self.assertEqual(
            self.alice_client.put(url, {"title": "hijacked"}, format="json").status_code, 404
        )
        self.assertEqual(self.alice_client.delete(url).status_code, 404)
        self.bob_task.refresh_from_db()
        self.assertEqual(self.bob_task.title, "Bob's private task")

    def test_cannot_complete_another_users_task(self):
        # The reward always lands on request.user, so checking Bob's EXP proves
        # nothing -- it cannot move through this path either way. Alice's EXP is
        # the discriminating value: if the owner filter were dropped she would
        # be paid for Bob's task.
        exp_before = self.alice.exp
        response = self.alice_client.post(
            reverse("task-complete"), {"task_id": self.bob_task.id}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        self.alice.refresh_from_db()
        self.assertEqual(self.alice.exp, exp_before)

    def test_completion_history_shows_only_the_callers_completions(self):
        response = self.alice_client.get(reverse("completed-tasks-history"))
        self.assertEqual(response.status_code, 200)
        titles = [t["title"] for t in response.data["completed_tasks"]]
        self.assertNotIn("Bob's private task", titles)

    def test_goal_shows_only_the_callers_goal(self):
        response = self.alice_client.get(reverse("user-goal"))
        self.assertNotEqual(response.data.get("title"), "Bob's private goal")

    def test_system_messages_show_only_the_callers_log(self):
        response = self.alice_client.get(reverse("system-messages"))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("Bob's private briefing", str(response.data))

    def test_stats_report_only_the_callers_attributes(self):
        # Both users were seeded with 42 in every attribute, so a leak here
        # would be invisible if the values differed by user only by accident.
        self.alice.attributes.update(value=7)
        response = self.alice_client.get(reverse("user-stats"))
        self.assertEqual(response.data["attributes"]["intelligence"], 7)

    def test_uncompleting_by_title_cannot_reach_another_users_task(self):
        # The lookup is by title, so a shared title is the case that matters.
        # Bob's row is created first so it holds the lower id: the view resolves
        # with .order_by('id').first(), so creating Alice's first would make her
        # own task win on ordering alone and the test could never fail.
        bobs = Task.objects.create(
            user=self.bob, title="Shared title", description="",
            attribute="discipline", reward_point=4, difficulty=1,
            deadline=timezone.now() + timedelta(days=1),
        )
        Task.objects.create(
            user=self.alice, title="Shared title", description="",
            attribute="discipline", reward_point=4, difficulty=1,
            deadline=timezone.now() + timedelta(days=1),
        )
        bobs_log = UserTaskLog.objects.create(
            user=self.bob, task=bobs, status='completed', completed_at=timezone.now(),
        )

        self.alice_client.post(
            reverse("dynamic-task-uncomplete"), {"task_title": "Shared title"}, format="json"
        )
        # The view scopes twice -- once resolving the task, once resolving the
        # completion log -- so removing either filter alone leaves this passing.
        # Only removing both reaches Bob's row, which is what this asserts.
        self.assertTrue(UserTaskLog.objects.filter(pk=bobs_log.pk).exists())


@override_settings(CACHES=TEST_CACHES)
class PunishmentCheckTests(TestCase):
    """system-punishment-check deducts attributes and issues a redemption task.
    It is the risk half of the reward loop: without it, missing tasks costs
    nothing. These pin the thresholds and the exact amounts."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="slacker", password="pw12345")
        for attr in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=self.user, name=attr, value=50)
        self.client = APIClient()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.user).key}"
        )
        self.url = reverse("system-punishment-check")
        self.yesterday = timezone.now() - timedelta(days=1)

    def _task(self, title):
        return Task.objects.create(
            user=self.user, title=title, description="", attribute="discipline",
            reward_point=4, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )

    def _log_yesterday(self, title, status):
        log = UserTaskLog.objects.create(
            user=self.user, task=self._task(title), status=status,
            completed_at=self.yesterday if status == "completed" else None,
        )
        # assigned_at is auto_now_add, so it has to be moved after creation.
        UserTaskLog.objects.filter(pk=log.pk).update(assigned_at=self.yesterday)
        return log

    def test_no_tasks_yesterday_is_not_punished(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["punishment_applied"])
        self.assertEqual(response.data["reason"], "no_tasks_yesterday")

    def test_a_good_day_is_not_punished(self):
        for i in range(4):
            self._log_yesterday(f"done {i}", "completed")
        self._log_yesterday("missed", "pending")

        response = self.client.post(self.url, {}, format="json")
        self.assertFalse(response.data["punishment_applied"])
        self.assertEqual(response.data["reason"], "good_performance")
        self.assertEqual(
            UserAttribute.objects.get(user=self.user, name="discipline").value, 50
        )

    def test_a_poor_day_deducts_attributes_and_issues_a_redemption_task(self):
        for i in range(5):
            self._log_yesterday(f"missed {i}", "pending")

        tasks_before = Task.objects.filter(user=self.user).count()
        response = self.client.post(self.url, {}, format="json")

        self.assertTrue(response.data["punishment_applied"])
        self.assertEqual(response.data["severity"], "heavy")

        discipline = UserAttribute.objects.get(user=self.user, name="discipline")
        stress = UserAttribute.objects.get(user=self.user, name="stress")
        self.assertLess(discipline.value, 50, "discipline should have been deducted")
        self.assertGreater(stress.value, 50, "stress should have risen")

        self.assertEqual(Task.objects.filter(user=self.user).count(), tasks_before + 1)
        self.assertTrue(
            SystemLog.objects.filter(user=self.user, message_type="punishment").exists()
        )

    def test_the_heavy_penalty_is_the_exact_documented_amount(self):
        # Asserting only the direction would let a penalty applied twice, or one
        # with the wrong constants, pass unnoticed.
        for i in range(5):
            self._log_yesterday(f"missed {i}", "pending")

        self.client.post(self.url, {}, format="json")
        self.assertEqual(
            UserAttribute.objects.get(user=self.user, name="discipline").value, 45
        )
        self.assertEqual(UserAttribute.objects.get(user=self.user, name="stress").value, 58)

    def test_a_mostly_missed_day_takes_the_lighter_penalty(self):
        # 1 of 5 is under the 30% threshold but not zero, so it takes the light
        # branch -- the only severity the suite did not reach.
        self._log_yesterday("done", "completed")
        for i in range(4):
            self._log_yesterday(f"missed {i}", "pending")

        response = self.client.post(self.url, {}, format="json")
        self.assertTrue(response.data["punishment_applied"])
        self.assertEqual(response.data["severity"], "light")
        self.assertGreater(
            UserAttribute.objects.get(user=self.user, name="discipline").value,
            45, "the light penalty must be smaller than the heavy one",
        )

    def test_the_threshold_itself_is_not_punished(self):
        # Exactly 30% is the boundary the branch turns on. Written out so a
        # later change from >= to > has to fail here rather than silently start
        # punishing users who hit the bar.
        for i in range(3):
            self._log_yesterday(f"done {i}", "completed")
        for i in range(7):
            self._log_yesterday(f"missed {i}", "pending")

        response = self.client.post(self.url, {}, format="json")
        self.assertFalse(
            response.data["punishment_applied"],
            "a 30% completion rate is on the threshold, not below it",
        )

    def test_it_only_punishes_once_a_day(self):
        for i in range(5):
            self._log_yesterday(f"missed {i}", "pending")

        self.client.post(self.url, {}, format="json")
        after_first = UserAttribute.objects.get(user=self.user, name="discipline").value

        second = self.client.post(self.url, {}, format="json")
        self.assertFalse(second.data["punishment_applied"])
        self.assertEqual(second.data["reason"], "already_checked_today")
        self.assertEqual(
            UserAttribute.objects.get(user=self.user, name="discipline").value, after_first
        )


@override_settings(CACHES=TEST_CACHES)
class ReadOnlyEndpointTests(TestCase):
    """Endpoints with no coverage at all. Nothing elaborate — they mostly need
    to be asserted to answer at all, since an exception in any of them reaches
    the user as a broken panel."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="reader", password="pw12345")
        for attr in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=self.user, name=attr, value=10)
        self.client = APIClient()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.user).key}"
        )

    def test_weekly_stats_answers_for_a_user_with_no_history(self):
        response = self.client.get(reverse("weekly-stats"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("daily_breakdown", response.data)
        self.assertEqual(len(response.data["daily_breakdown"]), 7)

    def test_weekly_stats_counts_a_completion(self):
        task = Task.objects.create(
            user=self.user, title="Counted", description="", attribute="discipline",
            reward_point=4, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        UserTaskLog.objects.create(
            user=self.user, task=task, status="completed", completed_at=timezone.now(),
        )
        response = self.client.get(reverse("weekly-stats"))
        self.assertEqual(response.data["total_completed_this_week"], 1)

    def test_user_progress_answers(self):
        response = self.client.get(reverse("user-progress"))
        self.assertEqual(response.status_code, 200)

    def test_system_messages_answers_for_a_new_user(self):
        response = self.client.get(reverse("system-messages"))
        self.assertEqual(response.status_code, 200)

    def test_system_daily_status_answers_for_a_new_user(self):
        response = self.client.get(reverse("system-daily-status"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("unread_messages", response.data)

    def test_root_is_public_and_describes_the_api(self):
        response = APIClient().get(reverse("root"))
        self.assertEqual(response.status_code, 200)


@override_settings(CACHES=TEST_CACHES)
class RewardFormatTests(TestCase):
    """The reward string is the user-facing half of the formula the whole
    reward loop runs on: half the points to the task's own attribute, plus a
    difficulty bonus to Discipline. It has been the source of two separate
    double-counting bugs, so the wording is pinned here."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="rewarded", password="pw12345")
        for attr in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=self.user, name=attr, value=10)
        self.client = APIClient()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.user).key}"
        )

    def _task(self, reward_point, difficulty, attribute="intelligence"):
        return Task.objects.create(
            user=self.user, title=f"Task {reward_point}/{difficulty}", description="tip",
            attribute=attribute, reward_point=reward_point, difficulty=difficulty,
            deadline=timezone.now() + timedelta(days=1),
        )

    def test_an_easy_task_rewards_half_its_points_and_no_bonus(self):
        task = self._task(reward_point=6, difficulty=1)
        response = self.client.get(reverse("task-detail", args=[task.id]))
        self.assertEqual(response.data["reward"], "+3 Intelligence")

    def test_a_harder_task_adds_a_discipline_bonus(self):
        # difficulty 3 is +2 Discipline, not +3 -- the bonus is difficulty - 1.
        task = self._task(reward_point=6, difficulty=3)
        response = self.client.get(reverse("task-detail", args=[task.id]))
        self.assertEqual(response.data["reward"], "+3 Intelligence, +2 Discipline")

    def test_odd_points_round_down_rather_than_up(self):
        task = self._task(reward_point=5, difficulty=1)
        response = self.client.get(reverse("task-detail", args=[task.id]))
        self.assertEqual(response.data["reward"], "+2 Intelligence")


@override_settings(CACHES=TEST_CACHES)
class GoalKeywordTests(TestCase):
    """The goal text steers which attributes a new user's tasks are drawn from.
    It is the one place free-text user input changes game behaviour, so the
    mapping is asserted rather than assumed."""

    def test_a_coding_goal_prefers_intelligence_and_discipline(self):
        from backend.views import preferred_attributes_for_goal
        self.assertEqual(
            preferred_attributes_for_goal("Learn coding"), ["intelligence", "discipline"]
        )

    def test_the_description_is_searched_as_well_as_the_title(self):
        from backend.views import preferred_attributes_for_goal
        self.assertIn(
            "intelligence", preferred_attributes_for_goal("My plan", "get better at coding")
        )

    def test_an_unrecognised_goal_yields_no_preference(self):
        # No match must mean "no preference", not an empty task pool.
        from backend.views import preferred_attributes_for_goal
        self.assertEqual(preferred_attributes_for_goal("zzzz"), [])

    def test_each_attribute_is_listed_once_even_when_several_keywords_match(self):
        from backend.views import preferred_attributes_for_goal
        preferred = preferred_attributes_for_goal("learn coding and data and web")
        self.assertEqual(len(preferred), len(set(preferred)))


class TimezoneBoundaryTests(TestCase):
    """\"Today\" has to mean the user's calendar day. With TIME_ZONE on UTC and
    date.today() reading the server clock, the day rolled over at midnight UTC —
    01:00 British Summer Time, so for seven months a year a task completed late
    in the evening counted toward the following day."""

    def setUp(self):
        self.user = User.objects.create_user(username="bsttester", password="pw12345")
        for name in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=self.user, name=name, value=0)
        self.task = Task.objects.create(
            user=self.user, title="Evening review", description="", attribute="discipline",
            reward_point=4, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )

    def test_the_configured_zone_is_the_users_not_utc(self):
        self.assertEqual(settings.TIME_ZONE, "Europe/London")

    def test_a_completion_late_on_a_summer_evening_counts_as_that_day(self):
        # 23:30 on 15 June is 22:30 UTC — the same calendar day either way, so
        # this is the control for the case below.
        london = ZoneInfo("Europe/London")
        local_evening = datetime(2025, 6, 15, 23, 30, tzinfo=london)

        UserTaskLog.objects.create(
            user=self.user, task=self.task, status="completed", completed_at=local_evening,
        )
        with patch_localdate(date(2025, 6, 15)):
            count = UserTaskLog.objects.filter(
                user=self.user, status="completed",
                completed_at__date=timezone.localdate(),
            ).count()
        self.assertEqual(count, 1)

    def test_a_completion_just_after_midnight_bst_belongs_to_the_new_day(self):
        # 00:30 on 16 June BST is 23:30 UTC on the 15th. Under the old UTC
        # setting this counted toward the 15th — a day the user had already
        # finished — so the streak for the 16th looked empty.
        london = ZoneInfo("Europe/London")
        just_after_midnight = datetime(2025, 6, 16, 0, 30, tzinfo=london)

        UserTaskLog.objects.create(
            user=self.user, task=self.task, status="completed", completed_at=just_after_midnight,
        )

        with patch_localdate(date(2025, 6, 16)):
            same_day = UserTaskLog.objects.filter(
                user=self.user, status="completed",
                completed_at__date=timezone.localdate(),
            ).count()
        self.assertEqual(same_day, 1, "a completion at 00:30 BST belongs to that morning")

    def test_localdate_and_the_date_lookup_agree(self):
        # The real bug was two different clocks: date.today() read the server's
        # OS date while completed_at__date used Django's TIME_ZONE. They matched
        # only because both happened to be UTC; changing one alone would have
        # made them disagree.
        self.assertEqual(timezone.localdate(), timezone.localtime(timezone.now()).date())


class ConcurrencyTests(TestCase):
    """The reward paths read EXP, derive a new value and write it back. Without
    a lock two interleaved requests both read the old value and the second write
    discards the first."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="concurrent", password="pw12345")
        for name in ["intelligence", "discipline", "energy", "social", "wellness", "stress"]:
            UserAttribute.objects.create(user=self.user, name=name, value=0)
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_completing_the_same_task_twice_grants_exp_once(self):
        from datetime import timedelta

        from django.utils import timezone

        task = Task.objects.create(
            user=self.user, title="Focus block", description="", attribute="discipline",
            reward_point=6, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        url = reverse("task-complete")

        self.client.post(url, {"task_id": task.id}, format="json")
        self.user.refresh_from_db()
        after_first = self.user.exp
        self.assertGreater(after_first, 0)

        # A second complete toggles it back off rather than granting again.
        self.client.post(url, {"task_id": task.id}, format="json")
        self.user.refresh_from_db()
        self.assertLess(self.user.exp, after_first)

        self.assertEqual(
            UserTaskLog.objects.filter(user=self.user, task=task, status="completed").count(), 0
        )

    def test_reward_write_is_atomic(self):
        # If the log is written but the EXP save fails, the user is left having
        # completed a task for nothing. The transaction makes that impossible.
        from datetime import timedelta
        from unittest import mock

        from django.utils import timezone

        task = Task.objects.create(
            user=self.user, title="Atomic check", description="", attribute="discipline",
            reward_point=6, difficulty=1, deadline=timezone.now() + timedelta(days=1),
        )
        exp_before = self.user.exp

        with mock.patch.object(User, "update_streak", side_effect=RuntimeError("boom")):
            response = self.client.post(reverse("task-complete"), {"task_id": task.id}, format="json")
        self.assertEqual(response.status_code, 500)

        self.user.refresh_from_db()
        self.assertEqual(self.user.exp, exp_before)
        self.assertEqual(
            UserTaskLog.objects.filter(user=self.user, task=task, status="completed").count(), 0
        )
        self.assertEqual(
            UserAttribute.objects.get(user=self.user, name="discipline").value, 0
        )

    def test_time_limited_completions_are_capped_per_day(self):
        from backend.views import MAX_TIME_LIMITED_COMPLETIONS_PER_DAY

        url = reverse("dynamic-task-complete")
        payload = {
            "task_title": "Press Ctrl+S", "task_type": "time_limited",
            "reward_points": 2, "attribute": "discipline",
        }
        for _ in range(MAX_TIME_LIMITED_COMPLETIONS_PER_DAY):
            self.client.post(url, payload, format="json")

        blocked = self.client.post(url, payload, format="json")
        self.assertEqual(blocked.status_code, 429)


class DeploymentSecurityTests(TestCase):
    """The SECURE_* block only applies when DEBUG is off, so it is invisible in
    local development and in the rest of the suite. These load settings the way
    production does and assert it is actually there."""

    def _prod_settings(self):
        import importlib
        from unittest import mock

        env = {
            "SECRET_KEY": "a-long-enough-production-looking-key-1234567890abcdef",
            "DEBUG": "0",
            "DATABASE_URL": "postgres://user:pass@localhost:5432/placeholder",
            "ALLOWED_HOSTS": "example.com",
        }
        with mock.patch.dict(os.environ, env, clear=True):
            import backend.settings
            importlib.reload(backend.settings)
            return backend.settings

    def test_production_redirects_to_https_and_trusts_the_proxy_header(self):
        cfg = self._prod_settings()
        self.assertTrue(cfg.SECURE_SSL_REDIRECT)
        # Without this, Django never sees a request as secure behind Render's
        # TLS-terminating proxy and the redirect above loops forever.
        self.assertEqual(cfg.SECURE_PROXY_SSL_HEADER, ("HTTP_X_FORWARDED_PROTO", "https"))

    def test_production_sets_secure_cookies_and_headers(self):
        cfg = self._prod_settings()
        self.assertTrue(cfg.SESSION_COOKIE_SECURE)
        self.assertTrue(cfg.CSRF_COOKIE_SECURE)
        self.assertTrue(cfg.SECURE_CONTENT_TYPE_NOSNIFF)
        self.assertGreater(cfg.SECURE_HSTS_SECONDS, 0)

    def test_local_development_is_not_forced_onto_https(self):
        # Turning these on for DEBUG=1 would redirect localhost to an https URL
        # nothing is serving.
        import backend.settings
        self.assertFalse(getattr(backend.settings, "SECURE_SSL_REDIRECT", False))

    def tearDown(self):
        import importlib

        import backend.settings
        importlib.reload(backend.settings)


class SettingsGuardTests(TestCase):
    """.env.example ships a working local config, so copying it verbatim to a real
    deployment is an easy mistake. settings.py refuses to start in that case."""

    def _load_settings(self, env):
        import importlib
        from unittest import mock
        with mock.patch.dict(os.environ, env, clear=True):
            import backend.settings
            importlib.reload(backend.settings)
            return backend.settings

    def test_placeholder_secret_key_is_rejected_when_debug_is_off(self):
        with self.assertRaises(RuntimeError) as ctx:
            self._load_settings({
                "SECRET_KEY": "dev-only-insecure-key-replace-me-in-production",
                "DEBUG": "0",
                "DATABASE_URL": "sqlite:///:memory:",
            })
        self.assertIn("placeholder", str(ctx.exception))

    def test_placeholder_secret_key_is_allowed_in_local_development(self):
        # The whole point of shipping a working .env.example is that this
        # combination loads without raising.
        settings_module = self._load_settings({
            "SECRET_KEY": "dev-only-insecure-key-replace-me-in-production",
            "DEBUG": "1",
            "DATABASE_URL": "sqlite:///:memory:",
        })
        self.assertTrue(settings_module.DEBUG)
        self.assertEqual(
            settings_module.SECRET_KEY, settings_module.DEV_PLACEHOLDER_SECRET_KEY
        )

    def tearDown(self):
        # Restore the real settings module for every test that runs after this
        # class -- reload() above mutated it in place.
        import importlib

        import backend.settings
        importlib.reload(backend.settings)
