from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('tasks/', views.TaskListView.as_view(), name='task-list'),
    path('tasks/<int:pk>/', views.TaskDetailView.as_view(), name='task-detail'),
    path('tasks/complete/', views.TaskCompleteView.as_view(), name='task-complete'),
    path('tasks/complete-dynamic/', views.DynamicTaskCompleteView.as_view(), name='dynamic-task-complete'),
    path('tasks/uncomplete-dynamic/', views.DynamicTaskUncompleteView.as_view(), name='dynamic-task-uncomplete'),
    path('tasks/completed-history/', views.CompletedTasksHistoryView.as_view(), name='completed-tasks-history'),
    path('tasks/weekly-stats/', views.WeeklyStatsView.as_view(), name='weekly-stats'),
    path('goal/', views.GoalView.as_view(), name='user-goal'),
    path('user/stats/', views.UserStatsView.as_view(), name='user-stats'),
    path('user/progress/', views.ProgressStatsView.as_view(), name='user-progress'),
]
