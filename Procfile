web: gunicorn --env DJANGO_SETTINGS_MODULE=backend.settings_prod backend.wsgi:application --bind 0.0.0.0:$PORT --timeout 120 --keep-alive 5 --max-requests 1000
release: python manage.py migrate --settings=backend.settings_prod --verbosity=2
