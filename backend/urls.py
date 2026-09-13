"""backend URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import os

from django.contrib import admin
from django.urls import include, path

from . import views

# Moving the admin off /admin/ does not make it secure — it is still a login
# page — but it does take it out of the path every automated scanner tries
# first, which is most of the traffic it would otherwise see. Set ADMIN_URL in
# the environment to something unguessable in production.
ADMIN_URL = os.environ.get("ADMIN_URL", "admin").strip("/")

urlpatterns = [
    path('', views.RootView.as_view(), name='root'),  # Root endpoint
    path('health/', views.HealthView.as_view(), name='health'),  # Health check
    path(f'{ADMIN_URL}/', admin.site.urls),
    path('api/', include('backend.urls_api')),  # API endpoints for React
]
