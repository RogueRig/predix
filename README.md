# predix

A full-stack application with React frontend and Express backend.

## Project Structure

- `frontend/` - React + TypeScript + Vite application
- `backend/` - Express.js API server

## Setup

### Backend

```bash
cd backend
npm install
npm start
```

The backend server will start on port 3000 (or the port specified in the `PORT` environment variable).

### Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in the frontend directory (copy from `.env.example`):

```
VITE_API_URL=http://localhost:3000
```

Then start the development server:

```bash
npm run dev
```

The frontend will be available at http://localhost:5173

## Features

### Backend API

- **GET /api/health** - Health check endpoint that returns server status

### Frontend

- Home page displays backend health status
- Reads API URL from `VITE_API_URL` environment variable
- No authentication required (yet)

## Environment Variables

### Frontend

- `VITE_API_URL` - Backend API base URL (default: http://localhost:3000)
