import os
from django.http import HttpResponse
from django.urls import path

def health_check(request):
    return HttpResponse("Railway deployment test - Django is working!", content_type="text/plain")

urlpatterns = [
    path('', health_check),
]

# Minimal WSGI app for testing
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'test_settings')

# Minimal settings
import sys
sys.modules['test_settings'] = type(sys)('test_settings')
sys.modules['test_settings'].SECRET_KEY = 'test-key'
sys.modules['test_settings'].DEBUG = True
sys.modules['test_settings'].ALLOWED_HOSTS = ['*']
sys.modules['test_settings'].INSTALLED_APPS = ['django.contrib.contenttypes']
sys.modules['test_settings'].ROOT_URLCONF = __name__
sys.modules['test_settings'].DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}

application = get_wsgi_application()
