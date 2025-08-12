#!/bin/bash
set -e

echo "🚀 Starting Railway deployment..."

# Check if we have DATABASE_URL (runtime, not build)
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  No DATABASE_URL found, using SQLite for build"
    export DATABASE_URL="sqlite:///tmp/build.db"
fi

# Only run migrations if not in build stage
if [ "$NIXPACKS_PHASE" != "build" ]; then
    echo "🔄 Running migrations..."
    python manage.py migrate --settings=backend.settings_prod --verbosity=2
    
    echo "📦 Collecting static files..."
    python manage.py collectstatic --noinput --settings=backend.settings_prod
else
    echo "🏗️  Build stage - skipping database operations"
fi

echo "✅ Ready to start!"
