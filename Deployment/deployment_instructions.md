# LevelUp App Deployment Instructions

## Overview

This document provides step-by-step instructions for deploying the LevelUp gamified productivity application using Render for the Django backend, Neon for the PostgreSQL database, and Vercel for the React frontend.

## Prerequisites

- GitHub account
- Render account (https://render.com)
- Neon account (https://neon.tech)
- Vercel account (https://vercel.com)
- Git installed locally

## Architecture

- **Frontend**: React + Vite deployed on Vercel
- **Backend**: Django + Django REST Framework deployed on Render
- **Database**: PostgreSQL hosted on Neon (serverless)

## Live URLs

- **Backend**: https://gamified-app-p9ao.onrender.com
- **Frontend**: https://levelup-jet.vercel.app
- **Live Demo**: https://levelup-jet.vercel.app/home

---

## Part 1: Database Setup (Neon)

### Step 1: Create a Neon Project

1. Visit https://neon.tech and sign up/login
2. Click "New Project"
3. Choose a region close to your Render deployment (e.g. US East)
4. Copy the connection string — it looks like:
   ```
   postgresql://neondb_owner:<password>@ep-xxxx.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

---

## Part 2: Backend Deployment (Render)

### Step 1: Prepare Backend Code

1. Ensure these files exist in the project root:
   - `requirements.txt`
   - `Procfile` — must contain:
     ```
     web: python manage.py migrate --noinput && python manage.py createcachetable && gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
     ```
     `createcachetable` is required: rate limiting uses the database cache, so
     without that table registration and guest login return a 500.
   - `runtime.txt` — must contain the Python version, e.g. `python-3.13.0`

2. Run locally to verify:
   ```bash
   python manage.py collectstatic --noinput
   python manage.py migrate
   ```

### Step 2: Create a Web Service on Render

1. Visit https://render.com and sign up/login
2. Click **New → Web Service**
3. Connect your GitHub account and select the repository: `elena1211/gamified_app`
4. Configure the service:
   - **Environment**: Python
   - **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command**: leave blank so Render uses the `Procfile`. Setting one here
     overrides it and skips the `migrate` / `createcachetable` steps it runs.

### Step 3: Configure Environment Variables on Render

In the Render dashboard → Environment, add:

```
DATABASE_URL=<your Neon connection string>
SECRET_KEY=<50+ character random string>
DEBUG=0
```

> `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` do **not** need to be set — the defaults in `settings.py` handle them automatically.

### Step 4: Run Migrations

Migrations run automatically as part of the build command above. To run them manually from the Render shell:

```bash
python manage.py migrate
```

---

## Part 3: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend Code

```bash
cd frontend
npm install
npm run build
```

### Step 2: Deploy to Vercel

1. Visit https://vercel.com and sign up/login
2. Click **New Project** and import your GitHub repository
3. Configure build settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3: Configure Environment Variables on Vercel

In the Vercel dashboard → Settings → Environment Variables, add:

```
VITE_API_URL=https://gamified-app-p9ao.onrender.com/api
```

### Step 4: Custom Domain (Optional)

In Vercel dashboard → Domains, add your custom domain if desired.

---

## Part 4: Testing and Verification

### Backend

```bash
# Health probe (public)
curl https://gamified-app-p9ao.onrender.com/health/

# Authenticated endpoints need a token — mint a guest one, then use it
TOKEN=$(curl -s -X POST https://gamified-app-p9ao.onrender.com/api/guest/ \
  -H "Content-Type: application/json" \
  -d '{"guest_id":"guest_smoke1"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

curl -H "Authorization: Token $TOKEN" \
  https://gamified-app-p9ao.onrender.com/api/tasks/
```

### Frontend

1. Visit https://levelup-jet.vercel.app
2. Test registration and login
3. Verify tasks load, stat bars update, and weekly stats show

---

## Troubleshooting

### Common Issues

1. **HTTP 400 Bad Request** — `ALLOWED_HOSTS` mismatch. Check the `ALLOWED_HOSTS` env var on Render for leading/trailing spaces. Left unset in production, `settings.py` falls back to `["localhost", "127.0.0.1"]` plus the Render hosts (`gamified-app-p9ao.onrender.com`, `.onrender.com`). There is no wildcard.
2. **CORS Errors / "Unable to connect"** — origins are an explicit allowlist, not `CORS_ALLOW_ALL_ORIGINS`. Left unset in production it defaults to `https://levelup-jet.vercel.app`; set `CORS_ALLOWED_ORIGINS` (comma-separated) to serve a different frontend origin.
3. **Database connection errors** — Neon requires `conn_max_age=0` (already set) and `sslmode=require` in the connection string.
4. **Build Failures** — Check `requirements.txt` and `runtime.txt` match the Python version on Render.
5. **Render cold start (30s delay)** — Free tier services sleep after inactivity. The frontend handles this with optimistic UI updates.

### Logs

- **Render**: Dashboard → your service → Logs tab
- **Vercel**: Dashboard → your project → Deployments → Build Logs (the frontend is a
  static build, so there are no Functions logs)

---

## Environment Variables Summary

### Render (Backend)

| Variable            | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`      | Neon connection string                                      |
| `SECRET_KEY`        | 50+ char random string (never the `.env.example` placeholder) |
| `DEBUG`             | `0`                                                         |
| `NVIDIA_API_KEY`    | Free key from build.nvidia.com — required by the default provider |
| `AI_PROVIDER`       | Optional. `nvidia` (default) or `anthropic`                 |
| `ANTHROPIC_API_KEY` | Only if `AI_PROVIDER=anthropic`                             |
| `ADMIN_URL`         | Optional. Path for the Django admin (default `admin`). Set something unguessable |

Without an AI provider key the System tab returns an error; every other feature works.

With `DEBUG=0`, `settings.py` also turns on HTTPS redirection, HSTS, secure
cookies and `SECURE_PROXY_SSL_HEADER` — the last is what makes the redirect
work behind Render's TLS-terminating proxy rather than looping. `manage.py
check --deploy` runs in CI against production-shaped settings, so a
regression there fails the build rather than reaching a deploy.

### Vercel (Frontend)

| Variable       | Value                                        |
| -------------- | -------------------------------------------- |
| `VITE_API_URL` | `https://gamified-app-p9ao.onrender.com/api` |

---

## Notes

- Database data persists across deployments on Neon
- Static files are served by Whitenoise on Render
- Vercel provides automatic HTTPS and CDN
- Both platforms trigger automatic deployments on every `git push` to `main`
