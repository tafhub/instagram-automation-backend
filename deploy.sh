#!/bin/bash

# Riona AI Agent - Hostinger VPS Deployment Script
# Usage: ./deploy.sh [your-vps-ip]

set -e

VPS_IP=$1
VPS_USER="root"
APP_DIR="/var/www/riona-ai-agent"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ -z "$VPS_IP" ]; then
    echo -e "${RED}Error: Please provide VPS IP address${NC}"
    echo "Usage: ./deploy.sh your-vps-ip"
    exit 1
fi

echo -e "${GREEN}Starting deployment to $VPS_IP...${NC}"

# Step 1: Build frontend
echo -e "${YELLOW}Building frontend...${NC}"
cd frontend
npm install
npm run build
cd ..

# Step 2: Build backend
echo -e "${YELLOW}Building backend...${NC}"
npm install
npm run build

# Step 3: Create deployment package
echo -e "${YELLOW}Creating deployment package...${NC}"
tar -czf deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='frontend/node_modules' \
  --exclude='logs/*.log' \
  --exclude='.git' \
  --exclude='cookies' \
  --exclude='deploy.tar.gz' \
  build/ \
  frontend/dist/ \
  package.json \
  package-lock.json \
  tsconfig.json \
  src/

# Step 4: Upload to VPS
echo -e "${YELLOW}Uploading to VPS...${NC}"
scp deploy.tar.gz $VPS_USER@$VPS_IP:/tmp/

# Step 5: Deploy on VPS
echo -e "${YELLOW}Deploying on VPS...${NC}"
ssh $VPS_USER@$VPS_IP << 'ENDSSH'
cd /tmp
mkdir -p /var/www/riona-ai-agent
cd /var/www/riona-ai-agent

# Backup existing deployment
if [ -d "build" ]; then
    echo "Creating backup..."
    tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz build/ frontend/ || true
fi

# Extract new deployment
echo "Extracting files..."
tar -xzf /tmp/deploy.tar.gz

# Install dependencies (production only)
echo "Installing dependencies..."
npm install --production

# Restart application
echo "Restarting application..."
pm2 restart riona-ai-agent || pm2 start build/index.js --name "riona-ai-agent"
pm2 save

# Cleanup
rm /tmp/deploy.tar.gz

echo "Deployment complete!"
pm2 status
ENDSSH

# Cleanup local file
rm deploy.tar.gz

echo -e "${GREEN}Deployment successful!${NC}"
echo -e "${GREEN}Your app is now running at: http://$VPS_IP${NC}"
echo -e "${YELLOW}Check logs with: ssh $VPS_USER@$VPS_IP 'pm2 logs riona-ai-agent'${NC}"


