#!/bin/bash

# Instagram Automation Backend - Server Setup Script
# This script installs necessary dependencies for running Puppeteer on a VPS

echo "Setting up Instagram Automation Backend on server..."

# Update package lists
echo "Updating package lists..."
apt-get update

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
    xdg-utils

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

echo "Server setup complete!"
echo "Chrome dependencies installed successfully."
echo "You can now run the Instagram automation in headless mode."
