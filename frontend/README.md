# Riona AI Agent - Frontend UI

A minimal, clean web interface for interacting with the Riona AI Agent API.

## Features

- 🔐 **Authentication**: Login with Instagram credentials
- 💬 **Direct Messages**: Send DMs to Instagram users
- 👥 **Follower Scraping**: Scrape followers from target accounts
- ❤️ **Auto Interaction**: Automatically like and comment on posts
- 🍪 **Cookie Management**: Clear Instagram session cookies
- 📊 **Status Dashboard**: View database connection status

## Development

### Prerequisites
- Node.js 18+ installed
- Backend server running on port 3000

### Setup

1. Install dependencies (already done during scaffolding):
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The dev server will run on `http://localhost:5173` and proxy API requests to `http://localhost:3000`.

### Build for Production

```bash
npm run build
```

This creates optimized production files in the `dist/` directory, which the backend serves.

## Usage

### From Root Directory

**Development (frontend only):**
```bash
npm run dev:frontend
```

**Build frontend:**
```bash
npm run build:frontend
```

**Build everything:**
```bash
npm run build:all
```

### Running the Full Stack

1. Make sure MongoDB is running
2. Build the frontend: `npm run build:frontend`
3. Start the backend: `npm start` (from root directory)
4. Open your browser to `http://localhost:3000`

The backend will serve the frontend from `/frontend/dist`.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS** - Minimal custom styling (no framework)

## API Integration

The frontend communicates with the backend API at `/api/*` endpoints:

- `POST /api/login` - Authenticate with Instagram
- `GET /api/me` - Check authentication status
- `POST /api/interact` - Interact with Instagram posts
- `POST /api/dm` - Send direct message
- `POST /api/scrape-followers` - Scrape followers
- `DELETE /api/clear-cookies` - Clear Instagram cookies
- `POST /api/logout` - Logout
- `GET /api/status` - Get system status

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx          # Main application component
│   ├── App.css          # Application styles
│   ├── api.ts           # API service layer
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── dist/                # Production build output
└── vite.config.ts       # Vite configuration
```
