from django.contrib import admin

from .models import Goal, MeasurementReport, Milestone, Task, User, UserAttribute, UserTaskLog


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'level', 'exp', 'current_streak', 'max_streak', 'last_activity_date')
    list_filter = ('level', 'last_activity_date')
    search_fields = ('username', 'email')
    readonly_fields = ('date_joined', 'last_login')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'attribute', 'difficulty', 'reward_point', 'deadline')
    list_filter = ('attribute', 'difficulty', 'is_random')
    search_fields = ('title', 'user__username')
    date_hierarchy = 'created_at'

@admin.register(UserTaskLog)
class UserTaskLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'task', 'status', 'assigned_at', 'completed_at')
    list_filter = ('status', 'assigned_at', 'completed_at')
    search_fields = ('user__username', 'task__title')
    date_hierarchy = 'assigned_at'

class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 0
    fields = (
        'position', 'title', 'status', 'completion_type',
        'target_count', 'target_value', 'target_direction', 'unit',
    )

@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'is_completed', 'path_confirmed_at', 'created_at')
    list_filter = ('is_completed', 'created_at')
    search_fields = ('title', 'user__username')
    inlines = [MilestoneInline]

@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ('title', 'goal', 'position', 'status', 'completion_type')
    list_filter = ('status', 'completion_type')
    search_fields = ('title', 'goal__title', 'goal__user__username')
    list_select_related = ('goal',)

@admin.register(MeasurementReport)
class MeasurementReportAdmin(admin.ModelAdmin):
    list_display = ('milestone', 'value', 'created_at')
    search_fields = ('milestone__title',)
    list_select_related = ('milestone',)

@admin.register(UserAttribute)
class UserAttributeAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'value')
    list_filter = ('name',)
    search_fields = ('user__username',)
