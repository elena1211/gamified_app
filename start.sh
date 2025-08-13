#!/bin/bash
echo "Starting Django application..."
echo "Python version: $(python3 --version)"
echo "Checking gunicorn installation..."
python3 -c "import gunicorn; print(f'Gunicorn version: {gunicorn.__version__}')" || echo "Gunicorn not found"

echo "Setting Django settings..."
export DJANGO_SETTINGS_MODULE=backend.settings_prod

echo "Running migrations..."
python3 manage.py migrate --noinput || echo "Migration failed, continuing..."

echo "Collecting static files..."
python3 manage.py collectstatic --noinput || echo "Static collection failed, continuing..."

echo "Starting gunicorn server..."
exec python3 -m gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 --access-logfile - --error-logfile - backend.wsgi:application
