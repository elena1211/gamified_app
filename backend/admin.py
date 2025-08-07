from django.contrib import admin
from .models import User, Task, UserTaskLog, Goal, UserAttribute, Reward, UserReward, SubGoal

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'level', 'exp', 'current_streak', 'max_streak', 'last_activity_date')
    list_filter = ('level', 'last_activity_date')
    search_fields = ('username', 'email')
    readonly_fields = ('date_joined', 'last_login')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'attribute', 'difficulty', 'reward_point', 'deadline')
    list_filter = ('attribute', 'difficulty', 'created_by_ai', 'is_random')
    search_fields = ('title', 'user__username')
    date_hierarchy = 'created_at'

@admin.register(UserTaskLog)
class UserTaskLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'task', 'status', 'assigned_at', 'completed_at', 'earned_points')
    list_filter = ('status', 'assigned_at', 'completed_at')
    search_fields = ('user__username', 'task__title')
    date_hierarchy = 'assigned_at'

@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'is_completed', 'created_at')
    list_filter = ('is_completed', 'created_at')
    search_fields = ('title', 'user__username')

@admin.register(UserAttribute)
class UserAttributeAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'value')
    list_filter = ('name',)
    search_fields = ('user__username',)

@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display = ('name', 'unlock_point')
    list_filter = ('unlock_point',)
    search_fields = ('name',)

@admin.register(UserReward)
class UserRewardAdmin(admin.ModelAdmin):
    list_display = ('user', 'reward', 'unlocked_at')
    list_filter = ('unlocked_at',)
    search_fields = ('user__username', 'reward__name')

@admin.register(SubGoal)
class SubGoalAdmin(admin.ModelAdmin):
    list_display = ('title', 'goal', 'is_completed')
    list_filter = ('is_completed',)
    search_fields = ('title', 'goal__title')