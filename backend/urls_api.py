from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('tasks/', views.TaskListView.as_view(), name='task-list'),
    path('tasks/<int:pk>/', views.TaskDetailView.as_view(), name='task-detail'),
    path('tasks/complete/', views.TaskCompleteView.as_view(), name='task-complete'),
    path('tasks/completed-history/', views.CompletedTasksHistoryView.as_view(), name='completed-tasks-history'),
    path('tasks/weekly-stats/', views.WeeklyStatsView.as_view(), name='weekly-stats'),
    path('goal/', views.GoalView.as_view(), name='user-goal'),
    path('user/stats/', views.UserStatsView.as_view(), name='user-stats'),
    path('user/progress/', views.ProgressStatsView.as_view(), name='user-progress'),
    path('user/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('user/delete-account/', views.DeleteAccountView.as_view(), name='delete-account'),
]
