# Deployment Guide for VPS

This guide will help you deploy the Instagram Automation Backend on a VPS server.

## Prerequisites

- VPS with Node.js installed (v18+ recommended)
- MongoDB instance (local or remote)
- Domain name (optional, but recommended)

## Deployment Steps

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd instagram-automation-backend
```

### 2. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install Chrome dependencies for Puppeteer (required for Instagram automation)
chmod +x setup-server.sh
sudo ./setup-server.sh
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=production

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/instagram-automation

# Session Secret
SESSION_SECRET=your-super-secret-key-change-this

# Instagram Credentials
INSTAGRAM_USERNAME=your_username
INSTAGRAM_PASSWORD=your_password

# Twitter/X Credentials (if using)
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

# Google AI (if using)
GOOGLE_AI_API_KEY=your_google_ai_key
```

### 4. Build the Application

```bash
# Build both frontend and backend
npm run build:all
```

This command will:
- Build the React frontend (output to `frontend/dist`)
- Compile TypeScript backend (output to `build/`)

### 5. Start the Application

#### Option A: Direct Node (for testing)

```bash
npm run start
```

The application will be available at `http://YOUR_VPS_IP:3001`

#### Option B: Using PM2 (recommended for production)

Install PM2 globally:

```bash
npm install -g pm2
```

Start the application with PM2:

```bash
pm2 start build/index.js --name instagram-automation
```

Useful PM2 commands:

```bash
# View logs
pm2 logs instagram-automation

# Restart the app
pm2 restart instagram-automation

# Stop the app
pm2 stop instagram-automation

# Auto-start on system reboot
pm2 startup
pm2 save
```

### 6. Configure Firewall

Make sure port 3001 is open on your VPS:

```bash
# For UFW (Ubuntu)
sudo ufw allow 3001/tcp
sudo ufw reload

# For firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

### 7. Access Your Application

Open your browser and navigate to:
```
http://YOUR_VPS_IP:3001
```

## Optional: Set Up Nginx Reverse Proxy

For production, it's recommended to use Nginx as a reverse proxy:

### 1. Install Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 2. Configure Nginx

Create a new configuration file:

```bash
sudo nano /etc/nginx/sites-available/instagram-automation
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or VPS IP

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/instagram-automation /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Now you can access your app at `http://your-domain.com` (port 80).

### 3. Set Up SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3001
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>
```

### Cannot Connect to MongoDB

- Ensure MongoDB is running: `sudo systemctl status mongod`
- Check MongoDB connection string in `.env`
- If using remote MongoDB, ensure firewall allows connection

### Application Crashes

```bash
# View logs with PM2
pm2 logs instagram-automation

# Or check system logs
tail -f logs/2025-*.log
```

## Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild
npm run build:all

# Restart with PM2
pm2 restart instagram-automation
```

## Development Mode on VPS (Not Recommended)

If you need to run in development mode on the VPS:

```bash
# Frontend (in one terminal)
cd frontend
npm run dev
# Access at http://YOUR_VPS_IP:5173

# Backend (in another terminal)
npm run start
# Runs at http://YOUR_VPS_IP:3001
```

**Note:** For production, always use the built version (Step 4-5 above).

