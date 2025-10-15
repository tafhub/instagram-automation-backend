#!/bin/bash

# Instagram Automation Backend - Production Setup Script
# This script sets up a proper headless environment for production

echo "Setting up Instagram Automation Backend for production..."

# Update package lists
apt-get update

# Install Xvfb (X Virtual Framebuffer) - creates a virtual display
echo "Installing Xvfb (virtual display)..."
apt-get install -y xvfb

# Install Chrome dependencies
echo "Installing Chrome dependencies..."
apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    libxcb-dri3-0 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-randr0 \
    libxcb-render-util0 \
    libxcb-util1

# Add Google Chrome repository
echo "Adding Google Chrome repository..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Update package lists again
apt-get update

# Install Google Chrome
echo "Installing Google Chrome..."
apt-get install -y google-chrome-stable

# Verify Chrome installation
echo "Verifying Chrome installation..."
google-chrome --version

# Create a systemd service for Xvfb
echo "Creating Xvfb service..."
cat > /etc/systemd/system/xvfb.service << EOF
[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start Xvfb service
systemctl enable xvfb
systemctl start xvfb

echo "Production setup complete!"
echo "Virtual display (Xvfb) is running on :99"
echo "Chrome dependencies installed successfully."
echo ""
echo "You can now run the Instagram automation in headless mode."
echo "The automation will use the virtual display for rendering."
