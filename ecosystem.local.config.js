module.exports = {
  apps: [
    {
      name: 'instagram-automation-local',
      script: 'build/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        HOST: '0.0.0.0',
        FORCE_HEADLESS: 'false', // Force visible browser for local development
        DISPLAY: process.env.DISPLAY || ':0' // Use local display
      },
      error_file: './logs/pm2-local-error.log',
      out_file: './logs/pm2-local-out.log',
      log_file: './logs/pm2-local-combined.log',
      time: true
    }
  ]
};
