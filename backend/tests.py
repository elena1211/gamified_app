from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from .models import Task, Goal
import json

User = get_user_model()

class APITestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com'
        )
        self.goal = Goal.objects.create(
            user=self.user,
            title='Test Goal',
            description='This is a test goal'
        )
        self.task = Task.objects.create(
            user=self.user,
            title='Test Task',
            description='This is a test task',
            attribute='intelligence',
            difficulty=1,
            reward_point=10,
            deadline='2025-12-31 23:59:59'
        )

    def test_login_api(self):
        """Test user login API"""
        url = reverse('login')
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post(url, json.dumps(data), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])

    def test_register_api(self):
        """Test user registration API"""
        url = reverse('register')
        data = {
            'username': 'newuser',
            'password': 'newpass123',
            'email': 'new@example.com',
            'goal_title': 'New Goal',
            'goal_description': 'New goal description'
        }
        response = self.client.post(url, json.dumps(data), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_tasks_api(self):
        """Test tasks listing API"""
        url = reverse('task-list')
        response = self.client.get(url, {'user': 'testuser'})
        self.assertEqual(response.status_code, 200)
        tasks = response.json()
        self.assertIsInstance(tasks, list)

    def test_user_stats_api(self):
        """Test user stats API"""
        url = reverse('user-stats')
        response = self.client.get(url, {'user': 'testuser'})
        self.assertEqual(response.status_code, 200)
        stats = response.json()
        self.assertIn('level', stats)
        self.assertIn('current_streak', stats)

    def test_goal_api(self):
        """Test goal API"""
        url = reverse('user-goal')
        response = self.client.get(url, {'user': 'testuser'})
        self.assertEqual(response.status_code, 200)
        goal = response.json()
        self.assertEqual(goal['title'], 'Test Goal')
