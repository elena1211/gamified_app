#!/bin/bash
echo "Starting Django application..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
echo "Running database migrations..."
python3 manage.py migrate --noinput
echo "Collecting static files..."
python3 manage.py collectstatic --noinput
echo "Starting gunicorn server..."
python3 -m gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
