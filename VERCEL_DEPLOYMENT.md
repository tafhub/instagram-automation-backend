# Vercel + VPS Deployment Guide

This guide shows how to deploy the frontend on Vercel while keeping the backend on your VPS server.

## Architecture

- **Frontend**: Deployed on Vercel (fast, global CDN)
- **Backend**: Running on your VPS (full control, automation)
- **Communication**: Frontend calls backend API over HTTPS

## Deployment Steps

### Step 1: Deploy Backend to VPS

```bash
# On your VPS server
cd ~/instagram-automation-backend

# Pull latest changes
git pull origin main

# Build and start
npm run build:all
npm run pm2:restart

# Test the API
curl http://localhost:3001/health
```

### Step 2: Deploy Frontend to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from frontend directory
cd frontend
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? (choose your account)
# - Link to existing project? N
# - What's your project's name? instagram-automation-frontend
# - In which directory is your code located? ./
```

#### Option B: Using GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Set the **Root Directory** to `frontend`
5. Vercel will automatically detect it's a Vite project

### Step 3: Configure Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add:
   - `VITE_API_URL` = `http://147.93.126.228:3001/api`

### Step 4: Update CORS on Backend

Update your VPS backend with the actual Vercel URL:

```bash
# On your VPS, edit the environment variables
nano ~/instagram-automation-backend/.env

# Add your Vercel URL
FRONTEND_URL=https://your-app-name.vercel.app
```

Then restart:
```bash
npm run pm2:restart
```

## URLs After Deployment

- **Frontend**: `https://your-app-name.vercel.app`
- **Backend API**: `http://147.93.126.228:3001/api`
- **Health Check**: `http://147.93.126.228:3001/health`

## Benefits

✅ **Fast Frontend**: Served from Vercel's global CDN  
✅ **Reliable Backend**: Full control on your VPS  
✅ **Easy Updates**: Frontend deploys automatically on git push  
✅ **Cost Effective**: Vercel free tier for frontend  
✅ **Better Performance**: Frontend cached globally  

## Development Workflow

### Local Development
```bash
# Backend (Terminal 1)
npm run start

# Frontend (Terminal 2)
cd frontend
npm run dev
```

### Production Deployment
```bash
# Push changes
git add .
git commit -m "Update features"
git push origin main

# Vercel automatically deploys frontend
# VPS backend needs manual restart if changed
npm run pm2:restart
```

## Troubleshooting

### CORS Issues
If you get CORS errors:
1. Check your Vercel URL is added to backend CORS origins
2. Verify `credentials: true` is set in CORS config
3. Check the API URL in Vercel environment variables

### API Connection Issues
```bash
# Test API connectivity from Vercel
curl -I https://your-app-name.vercel.app

# Check backend health
curl http://147.93.126.228:3001/health
```

### Environment Variables
Make sure these are set in Vercel:
- `VITE_API_URL=http://147.93.126.228:3001/api`

## Security Considerations

- **HTTPS**: Vercel serves over HTTPS, your VPS should too
- **CORS**: Only allow your Vercel domain
- **API Keys**: Store sensitive data on VPS, not frontend
- **Rate Limiting**: Implement rate limiting on VPS API

## Optional: Add HTTPS to VPS

For better security, add HTTPS to your VPS:

```bash
# Install Certbot
sudo apt install certbot nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Update API URL to use HTTPS
VITE_API_URL=https://your-domain.com/api
```

This setup gives you the best of both worlds - fast, reliable frontend on Vercel and full control over your automation backend on VPS!
