# MediFind — Deployment Guide

## Run locally
```
pip install -r requirements.txt
python app.py
# Open http://localhost:5000
```

## Deploy to Render.com (FREE)
1. Push this folder to GitHub
2. Go to render.com → New Web Service → connect GitHub repo
3. Build command:  pip install -r requirements.txt
4. Start command:  gunicorn app:app
5. Add environment variable:
   GEOAPIFY_API_KEY = be7be3e5dcfc48069a16d4813b1bf16d
6. Click Deploy ✅

## Deploy to Railway.app (FREE)
1. Go to railway.app → New Project → Deploy from GitHub
2. Add env variable: GEOAPIFY_API_KEY
3. Done ✅
