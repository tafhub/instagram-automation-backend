# Remote Chrome Setup Guide

This guide shows how to run the Instagram automation on your VPS server while controlling a Chrome browser on your local machine.

## Benefits

- **Server-side automation**: All processing happens on your VPS
- **Visible browser**: You can see what the automation is doing on your local Chrome
- **Easy debugging**: You can interact with the browser if needed
- **No server GUI needed**: No need to install Chrome on the server

## Setup Steps

### Step 1: Find Your Local Machine's IP Address

On your local machine (MacBook), find your IP address:

```bash
# Find your local IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# Or use this simpler command
ipconfig getifaddr en0
```

Note down your IP address (e.g., `192.168.1.100`).

### Step 2: Start Chrome with Remote Debugging on Your Local Machine

```bash
# On your local machine (MacBook)
cd ~/Documents/Projects/instagram-automation-backend

# Start Chrome with remote debugging
./start-chrome-debug.sh
```

This will:
- Kill any existing Chrome instances
- Start Chrome with remote debugging on port 9222
- Make Chrome accessible from your VPS

### Step 3: Configure Firewall (if needed)

If you're behind a firewall, you may need to open port 9222:

```bash
# On your local machine, allow connections on port 9222
# This might not be needed if you're on the same network
```

### Step 4: Update Server Configuration

On your VPS server, update the environment variable with your local IP:

```bash
# Edit the ecosystem.config.js file
nano ~/instagram-automation-backend/ecosystem.config.js

# Replace YOUR_LOCAL_IP with your actual IP address
# For example: REMOTE_CHROME_URL: 'http://192.168.1.100:9222'
```

### Step 5: Deploy and Start

```bash
# On your VPS server
cd ~/instagram-automation-backend

# Pull latest changes
git pull origin main

# Build the application
npm run build:all

# Restart PM2
npm run pm2:restart

# Check logs
npm run pm2:logs:backend
```

## Usage

1. **Start Chrome locally**: Run `./start-chrome-debug.sh` on your MacBook
2. **Start automation**: Use the web interface at `http://147.93.126.228:3001`
3. **Watch automation**: You'll see Chrome open on your MacBook and perform Instagram actions
4. **Monitor logs**: Check server logs with `npm run pm2:logs:backend`

## Troubleshooting

### Chrome Won't Start
```bash
# Kill any existing Chrome processes
pkill -f "Google Chrome"

# Try starting Chrome manually
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --remote-debugging-port=9222 \
    --user-data-dir=/tmp/chrome-debug
```

### Connection Failed
1. Check your local IP address hasn't changed
2. Make sure Chrome is running with remote debugging
3. Verify the IP address in the server configuration
4. Check if there are any firewall restrictions

### Test Connection
```bash
# From your VPS, test if it can reach your local Chrome
curl http://YOUR_LOCAL_IP:9222/json/version
```

## Security Note

This setup opens Chrome for remote control. Only use this on trusted networks. For production, consider using a VPN or more secure connection methods.

## Stopping

```bash
# Stop Chrome debugging
pkill -f "Google Chrome"

# Stop server automation
npm run pm2:stop
```
