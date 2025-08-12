web: gunicorn --env DJANGO_SETTINGS_MODULE=backend.settings_prod backend.wsgi:application --bind 0.0.0.0:$PORT
release: python manage.py migrate --settings=backend.settings_prod
