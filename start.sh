#!/bin/bash

# Install production dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate

# Start server
gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
