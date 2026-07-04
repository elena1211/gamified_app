web: python manage.py migrate --noinput && python manage.py createcachetable && gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
