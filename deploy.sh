#!/bin/bash

# Riona AI Agent - Deployment Script for Hostinger VPS
# Run this script on your VPS after initial setup

set -e  # Exit on any error

echo "🚀 Starting Riona AI Agent deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="riona-ai-agent"
APP_DIR="/var/www/Riona-AI-Agent"
BACKUP_DIR="/backups/riona-ai-agent"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider using a non-root user for better security."
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if MongoDB is running
if ! systemctl is-active --quiet mongod; then
    print_warning "MongoDB is not running. Starting MongoDB..."
    sudo systemctl start mongod
    sudo systemctl enable mongod
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    sudo npm install -g pm2
fi

# Install virtual display server packages
print_status "Installing virtual display server packages..."
sudo apt install -y \
    xvfb \
    tightvncserver \
    chromium-browser \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    libgconf-2-4

# Set up VNC server
print_status "Setting up VNC server for browser viewing..."
if [ ! -f ~/.vnc/passwd ]; then
    mkdir -p ~/.vnc
    print_warning "VNC password not set. Please run 'vncpasswd' to set a password for browser viewing."
fi

# Create VNC startup script
print_status "Creating VNC startup script..."
cat > ~/.vnc/xstartup << 'EOF'
#!/bin/bash
xrdb $HOME/.Xresources
xsetroot -solid grey
export XKL_XMODMAP_DISABLE=1
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
[ -x /etc/vnc/xstartup ] && exec /etc/vnc/xstartup
[ -r $HOME/.Xresources ] && xrdb $HOME/.Xresources
xsetroot -solid grey
vncconfig -iconic &
x-terminal-emulator -geometry 80x24+10+10 -ls -title "$VNCDESKTOP Desktop" &
gnome-session &
EOF

chmod +x ~/.vnc/xstartup

# Install noVNC for web-based browser viewing
print_status "Installing noVNC for web-based browser viewing..."
cd /opt
if [ ! -d "noVNC" ]; then
    sudo git clone https://github.com/novnc/noVNC.git
    cd noVNC
    sudo git clone https://github.com/novnc/websockify.git
else
    print_status "noVNC already installed, skipping..."
fi

# Create noVNC startup script
print_status "Creating noVNC startup script..."
sudo tee /opt/noVNC/start-novnc.sh > /dev/null << 'EOF'
#!/bin/bash
cd /opt/noVNC
./utils/novnc_proxy --vnc localhost:5901 --listen 6080
EOF

sudo chmod +x /opt/noVNC/start-novnc.sh

# Create systemd service for VNC
print_status "Creating VNC systemd service..."
sudo tee /etc/systemd/system/vncserver@.service > /dev/null << 'EOF'
[Unit]
Description=Start TightVNC server at startup
After=syslog.target network.target

[Service]
Type=forking
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu

PIDFile=/home/ubuntu/.vnc/%H:%i.pid
ExecStartPre=-/usr/bin/vncserver -kill :%i > /dev/null 2>&1
ExecStart=/usr/bin/vncserver -depth 24 -geometry 1920x1080 :%i
ExecStop=/usr/bin/vncserver -kill :%i

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for noVNC
print_status "Creating noVNC systemd service..."
sudo tee /etc/systemd/system/novnc.service > /dev/null << 'EOF'
[Unit]
Description=noVNC WebSocket proxy
After=vncserver@1.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/noVNC
ExecStart=/opt/noVNC/start-novnc.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start VNC services
print_status "Enabling VNC services..."
sudo systemctl daemon-reload
sudo systemctl enable vncserver@1.service
sudo systemctl start vncserver@1.service
sudo systemctl enable novnc.service
sudo systemctl start novnc.service

# Configure firewall for VNC
print_status "Configuring firewall for VNC access..."
sudo ufw allow 6080/tcp  # noVNC web interface
sudo ufw allow 5901/tcp  # VNC server

# Navigate to app directory
cd $APP_DIR

# Stop existing PM2 process if running
if pm2 list | grep -q $APP_NAME; then
    print_status "Stopping existing $APP_NAME process..."
    pm2 stop $APP_NAME
    pm2 delete $APP_NAME
fi

# Install dependencies
print_status "Installing backend dependencies..."
npm install --production

print_status "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Build the application
print_status "Building frontend for production..."
npm run build:frontend

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please create it with your configuration."
    print_status "You can copy .env.example to .env and fill in the values."
    exit 1
fi

# Start the application with PM2
print_status "Starting $APP_NAME with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Set up PM2 startup script
print_status "Setting up PM2 startup script..."
pm2 startup

# Create backup directory
mkdir -p $BACKUP_DIR

# Set up log rotation
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/riona-ai-agent > /dev/null <<EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload $APP_NAME
    endscript
}
EOF

# Create backup script
print_status "Creating backup script..."
tee backup.sh > /dev/null <<EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_DIR"
mkdir -p \$BACKUP_DIR

# Backup database
mongodump --out \$BACKUP_DIR/mongodb_\$DATE

# Backup application files (excluding node_modules and logs)
tar -czf \$BACKUP_DIR/app_\$DATE.tar.gz --exclude=node_modules --exclude=frontend/node_modules --exclude=logs --exclude=dist $APP_DIR

# Clean old backups (keep 30 days)
find \$BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find \$BACKUP_DIR -name "mongodb_*" -mtime +30 -exec rm -rf {} \;

echo "Backup completed: \$DATE"
EOF

chmod +x backup.sh

# Set up automated backups (daily at 2 AM)
print_status "Setting up automated backups..."
(crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup.sh") | crontab -

# Check application status
print_status "Checking application status..."
pm2 status

# Test if application is responding
print_status "Testing application..."
sleep 5
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_status "✅ Application is running successfully!"
else
    print_warning "⚠️  Application might not be responding. Check logs with: pm2 logs $APP_NAME"
fi

# Display browser viewer information
print_status ""
print_status "🌐 Browser Viewer Setup Complete!"
print_status "=================================="
print_status "Users can now view browser sessions at:"
print_status "   http://your-server-ip:6080/vnc.html"
print_status ""
print_status "Or use the integrated viewer at:"
print_status "   http://your-server-ip:3000/browser-viewer/browser-viewer.html"
print_status ""
print_status "📝 Important Notes:"
print_status "   • Set VNC password: vncpasswd"
print_status "   • Browser sessions will be visible to users"
print_status "   • Instagram automation runs in virtual display"
print_status "   • Users can watch automation in real-time"
print_status ""
print_status "🔧 Troubleshooting:"
print_status "   • Check VNC status: systemctl status vncserver@1"
print_status "   • Check noVNC status: systemctl status novnc"
print_status "   • View logs: pm2 logs $APP_NAME"
print_status "   • Restart services: systemctl restart vncserver@1 novnc"
fi

print_status "🎉 Deployment completed!"
print_status "Your application should be accessible at: http://your-domain.com"
print_status "Check logs with: pm2 logs $APP_NAME"
print_status "Monitor with: pm2 monit"
print_status "Restart with: pm2 restart $APP_NAME"