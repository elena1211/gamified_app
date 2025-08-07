from django.urls import path
from . import views

urlpatterns = [
    path('tasks/', views.TaskListView.as_view(), name='task-list'),
    path('tasks/<int:pk>/', views.TaskDetailView.as_view(), name='task-detail'),
    path('tasks/complete/', views.TaskCompleteView.as_view(), name='task-complete'),
    path('goal/', views.GoalView.as_view(), name='user-goal'),
    path('user/stats/', views.UserStatsView.as_view(), name='user-stats'),
]
