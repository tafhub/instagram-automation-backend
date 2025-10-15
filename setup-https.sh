#!/bin/bash

# Script to set up HTTPS with self-signed certificate for testing

echo "Setting up HTTPS for VPS backend..."

# Install nginx
apt-get update
apt-get install -y nginx

# Generate self-signed certificate
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx-selfsigned.key \
    -out /etc/nginx/ssl/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=147.93.126.228"

# Create nginx configuration
cat > /etc/nginx/sites-available/instagram-automation << EOF
server {
    listen 80;
    server_name 147.93.126.228;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl;
    server_name 147.93.126.228;

    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/instagram-automation /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Restart nginx
systemctl restart nginx
systemctl enable nginx

echo "HTTPS setup complete!"
echo "Your API is now available at: https://147.93.126.228/"
echo "Note: Browsers will show a security warning for self-signed certificates."
echo "Click 'Advanced' -> 'Proceed to 147.93.126.228 (unsafe)' to continue."
