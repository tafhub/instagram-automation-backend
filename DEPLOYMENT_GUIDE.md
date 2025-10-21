# Riona AI Agent - Hostinger VPS Deployment Guide

This guide will help you deploy your Riona AI Agent on a Hostinger VPS.

## Prerequisites

- Hostinger VPS with Ubuntu 20.04+ or CentOS 7+
- Root or sudo access to the server
- Domain name (optional, but recommended)
- Basic knowledge of Linux commands

## Step 1: Server Setup

### 1.1 Connect to your VPS
```bash
ssh root@your-vps-ip
# or
ssh your-username@your-vps-ip
```

### 1.2 Update the system
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 1.3 Install Node.js 18+
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 1.4 Install MongoDB
```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# CentOS/RHEL
sudo yum install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 1.5 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### 1.6 Install Nginx (Reverse Proxy)
```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx
```

## Step 2: Application Deployment

### 2.1 Clone your repository
```bash
cd /var/www
sudo git clone https://github.com/your-username/Riona-AI-Agent.git
sudo chown -R $USER:$USER /var/www/Riona-AI-Agent
cd Riona-AI-Agent
```

### 2.2 Install dependencies
```bash
npm install
cd frontend
npm install
cd ..
```

### 2.3 Create production environment file
```bash
cp .env.example .env
nano .env
```

### 2.4 Configure production environment variables
```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/riona-ai-agent

# Instagram Credentials (keep these secure)
INSTAGRAM_USERNAME=your_username
INSTAGRAM_PASSWORD=your_password

# Gemini AI API Keys
GEMINI_API_KEY=your_gemini_api_key

# JWT Secret (generate a strong secret)
JWT_SECRET=your_very_strong_jwt_secret_here

# Optional: Proxy settings if needed
PROXY_HOST=
PROXY_PORT=
PROXY_USERNAME=
PROXY_PASSWORD=
```

### 2.5 Build the application
```bash
# Build frontend
npm run build:frontend

# Or build everything
npm run build:all
```

## Step 3: Process Management with PM2

### 3.1 Create PM2 ecosystem file
```bash
nano ecosystem.config.js
```

Add this content:
```javascript
module.exports = {
  apps: [{
    name: 'riona-ai-agent',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 3.2 Start the application with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 4: Nginx Configuration

### 4.1 Create Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/riona-ai-agent
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration (will be set up with Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
    }
}
```

### 4.2 Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/riona-ai-agent /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 5: SSL Certificate with Let's Encrypt

### 5.1 Install Certbot
```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install -y certbot python3-certbot-nginx
```

### 5.2 Obtain SSL certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Step 6: Firewall Configuration

### 6.1 Configure UFW (Ubuntu)
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### 6.2 Configure firewalld (CentOS)
```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Step 7: Monitoring and Maintenance

### 7.1 Check application status
```bash
pm2 status
pm2 logs riona-ai-agent
```

### 7.2 Monitor system resources
```bash
# Install htop for better monitoring
sudo apt install htop  # Ubuntu/Debian
sudo yum install htop  # CentOS/RHEL

htop
```

### 7.3 Set up log rotation
```bash
sudo nano /etc/logrotate.d/riona-ai-agent
```

Add:
```
/var/www/Riona-AI-Agent/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload riona-ai-agent
    endscript
}
```

## Step 8: Backup Strategy

### 8.1 Create backup script
```bash
nano backup.sh
```

Add:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/riona-ai-agent"
mkdir -p $BACKUP_DIR

# Backup database
mongodump --out $BACKUP_DIR/mongodb_$DATE

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/Riona-AI-Agent

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "mongodb_*" -mtime +30 -exec rm -rf {} \;
```

### 8.2 Set up automated backups
```bash
chmod +x backup.sh
crontab -e
```

Add:
```
0 2 * * * /var/www/Riona-AI-Agent/backup.sh
```

## Troubleshooting

### Common Issues:

1. **Application won't start:**
   ```bash
   pm2 logs riona-ai-agent
   sudo systemctl status mongod
   ```

2. **Nginx 502 error:**
   - Check if Node.js app is running: `pm2 status`
   - Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

3. **Database connection issues:**
   - Check MongoDB status: `sudo systemctl status mongod`
   - Verify connection string in .env file

4. **SSL certificate issues:**
   - Renew certificate: `sudo certbot renew --dry-run`

## Security Recommendations

1. **Change default SSH port** (optional)
2. **Use SSH keys** instead of passwords
3. **Regular security updates**: `sudo apt update && sudo apt upgrade`
4. **Monitor logs** regularly
5. **Use strong passwords** for all services
6. **Enable fail2ban** for additional security

## Performance Optimization

1. **Enable Nginx caching**
2. **Use CDN** for static assets
3. **Monitor memory usage** and adjust PM2 settings
4. **Regular database maintenance**

Your Riona AI Agent should now be successfully deployed on your Hostinger VPS!



