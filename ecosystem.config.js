module.exports = {
  apps: [
    {
      name: 'instagram-automation-backend',
      script: 'build/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
        DISPLAY: ':99' // Use virtual display for headless mode
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
        DISPLAY: ':99' // Use virtual display for headless mode
      },
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_file: './logs/pm2-backend-combined.log',
      time: true
    },
    {
      name: 'instagram-automation-frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/pm2-frontend-error.log',
      out_file: './logs/pm2-frontend-out.log',
      log_file: './logs/pm2-frontend-combined.log',
      time: true
    }
  ]
};
