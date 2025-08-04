from django.contrib import admin
from .models import User, Task, UserTaskLog

admin.site.register(User)
admin.site.register(Task)
admin.site.register(UserTaskLog)
# This file is part of the gamified_app project.