# Web UI Usage Guide

## Quick Start

### 1. Setup & Launch

```bash
# First time setup - build the frontend
npm run build:frontend

# Start the server (make sure MongoDB is running)
npm start

# Open your browser
# Navigate to: http://localhost:3000
```

### 2. Login

- Enter your Instagram username and password
- Click "Login"
- The system will authenticate with Instagram and save your session

## Features

### 🔐 Authentication
- **Secure login**: Uses JWT tokens and httpOnly cookies
- **Session persistence**: Stay logged in across page refreshes
- **Status indicator**: Shows database connection status

### 💬 Send Direct Messages
1. Navigate to the "Send Direct Message" card
2. Enter the target username
3. Type your message
4. Click "Send DM"

### 👥 Scrape Followers
1. Go to the "Scrape Followers" card
2. Enter the target account username
3. Set the maximum number of followers to scrape
4. Click "Scrape"
5. View the list of followers (scrollable)

### ❤️ Auto Interaction
- Click "Start Interaction" to automatically:
  - Like posts in your feed
  - Leave AI-generated comments
  - Engage with content

### 🍪 Clear Cookies
- Use the "Clear Cookies" button to:
  - Remove saved Instagram session
  - Force a fresh login next time

### 🚪 Logout
- Click "Logout" in the header to:
  - End your current session
  - Clear authentication tokens

## API Endpoints

All API endpoints are available at `/api/*`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/login` | POST | Login with Instagram credentials |
| `/api/logout` | POST | Logout and clear session |
| `/api/me` | GET | Check authentication status |
| `/api/status` | GET | Get system status |
| `/api/interact` | POST | Interact with Instagram posts |
| `/api/dm` | POST | Send direct message |
| `/api/scrape-followers` | POST | Scrape followers from account |
| `/api/clear-cookies` | DELETE | Clear Instagram cookies |

## Development

### Frontend Development Mode

```bash
# Terminal 1: Start backend
npm start

# Terminal 2: Start frontend dev server (hot reload)
cd frontend
npm run dev

# Frontend runs on: http://localhost:5173
# Backend runs on: http://localhost:3000
```

### Building for Production

```bash
# Build frontend only
npm run build:frontend

# Build everything (frontend + backend)
npm run build:all
```

## Troubleshooting

### Cannot login
- Ensure MongoDB is running
- Check your `.env` file has correct credentials
- Try clearing cookies first

### Database not connected (🔴)
- Start MongoDB: `docker start instagram-ai-mongodb`
- Check `MONGODB_URI` in `.env`

### Frontend not loading
- Build the frontend: `npm run build:frontend`
- Check that `frontend/dist` directory exists
- Restart the server: `npm start`

### API errors
- Check the logs in the `logs/` directory
- Ensure backend is running on port 3000
- Verify credentials in `.env` file

## Architecture

```
┌─────────────────┐
│   Web Browser   │
│  localhost:3000 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Express Server │
│   Port 3000     │
│  (Serves UI +   │
│   API Routes)   │
└────────┬────────┘
         │
         ├─────────────► MongoDB (Session/Data)
         │
         └─────────────► Instagram API (via instagram-private-api)
```

## Security Notes

- Passwords are never stored in plain text
- Sessions use httpOnly cookies (XSS protection)
- JWT tokens for authentication
- CORS and Helmet configured for security
- Use environment variables for sensitive data

## Tips

1. **Stay within rate limits**: Instagram may flag your account if you perform too many actions too quickly
2. **Use realistic delays**: The AI agent uses randomized delays to appear more human-like
3. **Monitor logs**: Check the `logs/` directory for detailed activity logs
4. **Test with burner account**: Use a test account first to understand the behavior

## Need Help?

- Check the main [README.md](./README.md) for setup instructions
- Review the [frontend README](./frontend/README.md) for technical details
- Check the [Guides](./Guides/) directory for additional documentation 