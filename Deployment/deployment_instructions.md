# LevelUp App Deployment Instructions

## Overview

This document provides step-by-step instructions for deploying the LevelUp gamified productivity application using Railway for the Django backend and Vercel for the React frontend.

## Prerequisites

- GitHub account
- Railway account (https://railway.app)
- Vercel account (https://vercel.com)
- Git installed locally

## Architecture

- **Frontend**: React + Vite deployed on Vercel
- **Backend**: Django + Django REST Framework deployed on Railway
- **Database**: SQLite (development) / PostgreSQL (Railway production)

## Part 1: Backend Deployment (Railway)

### Step 1: Prepare Backend Code

1. Ensure your Django project is ready:

   ```bash
   cd LevelUp_Project
   python manage.py collectstatic --noinput
   python manage.py migrate
   ```

2. Verify required files exist:
   - `requirements.txt`
   - `Procfile`
   - `.railwayignore`

### Step 2: Connect to Railway

1. Visit https://railway.app and sign up/login
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select your repository: `elena1211/gamified_app`
5. Railway will automatically detect it's a Python project

### Step 3: Configure Environment Variables

Set the following environment variables in Railway dashboard:

```
DJANGO_SETTINGS_MODULE=backend.settings
PYTHONPATH=.
```

### Step 4: Configure Domain and CORS

1. Get your Railway app URL: `https://web-production-d27fa.up.railway.app`
2. Update `backend/settings.py` CORS settings:
   ```python
   CORS_ALLOWED_ORIGINS = [
       "https://levelup-jet.vercel.app",
   ]
   CSRF_TRUSTED_ORIGINS = [
       "https://web-production-d27fa.up.railway.app",
       "https://levelup-jet.vercel.app",
   ]
   ```

### Step 5: Database Migration

Railway automatically provisions PostgreSQL. Migrations run automatically on deployment.

## Part 2: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend Code

1. Navigate to frontend directory:

   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Create production environment file:
   ```bash
   # frontend/.env.production
   VITE_API_URL=https://web-production-d27fa.up.railway.app/api
   ```

### Step 2: Deploy to Vercel

1. Visit https://vercel.com and sign up/login
2. Click "New Project"
3. Import your GitHub repository
4. Configure build settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3: Configure Environment Variables

In Vercel dashboard, add:

```
VITE_API_URL=https://web-production-d27fa.up.railway.app/api
```

### Step 4: Custom Domain (Optional)

1. In Vercel dashboard, go to "Domains"
2. Add your custom domain if desired

## Part 3: Testing and Verification

### Backend Testing

1. Visit your Railway URL: `https://web-production-d27fa.up.railway.app`
2. Test API endpoints: `https://web-production-d27fa.up.railway.app/api/tasks/`
3. Check Django admin: `https://web-production-d27fa.up.railway.app/admin/`

### Frontend Testing

1. Visit your Vercel URL: `https://levelup-jet.vercel.app`
2. Test user registration and login
3. Verify API connectivity
4. Test all app features

## Troubleshooting

### Common Issues

1. **CORS Errors**: Update CORS_ALLOWED_ORIGINS in Django settings
2. **Build Failures**: Check dependencies in requirements.txt/package.json
3. **Database Issues**: Verify migrations ran successfully
4. **API Connection**: Ensure VITE_API_URL is correctly set

### Logs

- **Railway**: Check logs in Railway dashboard
- **Vercel**: Check function logs in Vercel dashboard

## Environment Variables Summary

### Railway (Backend)

```
DJANGO_SETTINGS_MODULE=backend.settings
PYTHONPATH=.
```

### Vercel (Frontend)

```
VITE_API_URL=https://web-production-d27fa.up.railway.app/api
```

## URLs

- **Backend**: https://web-production-d27fa.up.railway.app
- **Frontend**: https://levelup-jet.vercel.app
- **Live Demo**: https://levelup-jet.vercel.app/home

## Notes

- Database data persists across deployments on Railway
- Static files are served by Whitenoise on Railway
- Vercel provides automatic HTTPS and CDN
- Both platforms offer automatic deployments on git push

## Security Considerations

- Never commit real environment variables to git
- Use strong SECRET_KEY for Django in production
- Regularly update dependencies
- Monitor logs for security issues
