"""
Backend test suite.

Run locally with:
    python manage.py test

Requires SECRET_KEY and DATABASE_URL to be set (see .env.example) — the
suite doesn't touch those tables directly, Django's test runner creates and
tears down an isolated test database around them.
"""
import os
from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from .models import User, UserAttribute, Task, Goal
from .views import calculate_level_from_exp, get_exp_for_level, calculate_task_exp, _call_ai_provider

# Throttled views (RegisterView, GuestLoginView, SystemChatView) read/write
# the throttle cache. Tests use an in-memory cache instead of the production
# DatabaseCache so they don't depend on `createcachetable` having been run
# against the test database.
TEST_CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


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


class LoginViewTests(TestCase):
    def setUp(self):
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


@override_settings(CACHES=TEST_CACHES)
class GuestLoginViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("guest-login")

    def test_valid_guest_id_creates_user_with_starter_tasks(self):
        response = self.client.post(self.url, {"guest_id": "guest_abc123"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        user = User.objects.get(username="guest_abc123")
        self.assertEqual(Task.objects.filter(user=user).count(), 6)
        self.assertEqual(UserAttribute.objects.filter(user=user).count(), 6)

    def test_invalid_guest_id_format_is_rejected(self):
        response = self.client.post(self.url, {"guest_id": "not-a-valid-id!"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_repeat_login_reuses_same_account(self):
        first = self.client.post(self.url, {"guest_id": "guest_repeat1"}, format="json")
        second = self.client.post(self.url, {"guest_id": "guest_repeat1"}, format="json")
        self.assertEqual(User.objects.filter(username="guest_repeat1").count(), 1)
        self.assertEqual(first.data["token"], second.data["token"])


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
        from django.utils import timezone
        from datetime import timedelta

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


class TaskCompleteViewTests(TestCase):
    def setUp(self):
        from django.utils import timezone
        from datetime import timedelta

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


class HealthViewTests(TestCase):
    def test_health_check_is_public_and_ok(self):
        response = APIClient().get(reverse("health"))
        self.assertEqual(response.status_code, 200)
