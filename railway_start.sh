#!/bin/bash
set -e

echo "🚀 Starting Railway deployment..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
python -c "
import os
import time
import psycopg2
from urllib.parse import urlparse

if os.environ.get('DATABASE_URL'):
    url = urlparse(os.environ.get('DATABASE_URL'))
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            conn = psycopg2.connect(
                host=url.hostname,
                port=url.port or 5432,
                database=url.path[1:],
                user=url.username,
                password=url.password,
                connect_timeout=10
            )
            conn.close()
            print('✅ Database connection successful!')
            break
        except Exception as e:
            retry_count += 1
            print(f'🔄 Database connection attempt {retry_count}/{max_retries}: {str(e)}')
            if retry_count < max_retries:
                time.sleep(2)
            else:
                print('❌ Database connection failed after all retries')
                exit(1)
else:
    print('⚠️  No DATABASE_URL found, using SQLite')
"

# Run migrations
echo "🔄 Running migrations..."
python manage.py migrate --settings=backend.settings_prod --verbosity=2

# Collect static files
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput --settings=backend.settings_prod

echo "✅ Deployment preparation complete!"
