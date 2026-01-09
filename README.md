# Predix

A full-stack web application with a React frontend and Node.js backend.

## 📋 Project Overview

Predix is a modern web application built with:
- **Frontend**: React with TypeScript, built with Vite
- **Backend**: Node.js with Express
- **Database**: (Add your database technology here)

The frontend provides an interactive user interface, while the backend handles API requests, business logic, and data management.

## 🏗️ Project Structure

```
predix/
├── frontend/          # React + TypeScript frontend
│   ├── src/          # Source code
│   ├── package.json  # Frontend dependencies
│   └── vite.config.ts # Vite configuration
├── backend/          # Node.js backend
│   ├── index.js     # Main server file
│   ├── db.js        # Database configuration
│   └── package.json # Backend dependencies
└── README.md        # This file
```

## 🚀 Deployment Guide

This guide will help you deploy your application to production.

### Frontend Deployment (Vercel)

Vercel is perfect for deploying React applications. Follow these steps:

#### Step 1: Prepare Your Repository
1. Make sure your code is pushed to GitHub
2. Ensure your frontend code is in the `frontend/` directory

#### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up or log in
2. Click **"New Project"**
3. Import your GitHub repository (e.g., `your-username/predix`)
4. Configure the project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (or leave default)
   - **Output Directory**: `dist` (or leave default)
5. Click **"Deploy"**

#### Step 3: Configure Environment Variables on Vercel
1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Add the following environment variables:

   | Variable Name | Description | Example Value |
   |--------------|-------------|---------------|
   | `VITE_API_URL` | Your backend API URL | `https://your-app.onrender.com` |
   | `VITE_APP_NAME` | Application name (optional) | `Predix` |

3. Click **"Save"**
4. Redeploy your application to apply the changes

### Backend Deployment (Render)

Render makes it easy to deploy Node.js applications. Follow these steps:

#### Step 1: Prepare Your Repository
1. Make sure your code is pushed to GitHub
2. Ensure your backend has a `package.json` with a start script

#### Step 2: Deploy to Render
1. Go to [render.com](https://render.com) and sign up or log in
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repository (e.g., `your-username/predix`)
4. Configure the service:
   - **Name**: `predix-backend` (or your preferred name)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js` (or `npm start`)
   - **Instance Type**: Free (or your preferred tier)
5. Click **"Create Web Service"**

#### Step 3: Configure Environment Variables on Render
1. In your Render service dashboard, go to **Environment** section
2. Add the following environment variables:

   | Variable Name | Description | Example Value |
   |--------------|-------------|---------------|
   | `NODE_ENV` | Environment mode | `production` |
   | `DATABASE_URL` | Your database connection string | `mongodb://...` or `postgresql://...` |
   | `CORS_ORIGIN` | Frontend URL for CORS | `https://your-app.vercel.app` |
   | `JWT_SECRET` | Secret key for authentication (if using JWT) | `your-secret-key-here` |

   > Note: Render automatically sets the `PORT` environment variable for your service.
   > Your server should listen on `process.env.PORT`, and you typically do not need to
   > configure `PORT` manually in the Render dashboard.

3. Click **"Save Changes"**
4. Your service will automatically redeploy

## 🔐 Environment Variables

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory for local development:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000

# Optional: Application name
VITE_APP_NAME=Predix
```

**Important Notes:**
- In Vite, environment variables must be prefixed with `VITE_` to be accessible in your code
- Access them in your code using `import.meta.env.VITE_API_URL`
- Never commit `.env` files to version control (they're in `.gitignore`)

### Backend Environment Variables

Create a `.env` file in the `backend/` directory for local development:

```env
# Server port
PORT=3000

# Environment
NODE_ENV=development

# Database connection (update with your actual database)
DATABASE_URL=mongodb://localhost:27017/predix
# OR for PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost:5432/predix

# CORS - Frontend URL
CORS_ORIGIN=http://localhost:5173

# Authentication (if using JWT)
JWT_SECRET=your-local-secret-key-change-in-production

# Other API keys or secrets
# API_KEY=your-api-key
```

**Important Notes:**
- Never commit `.env` files to version control
- Use different values for development and production
- Keep sensitive data like API keys and secrets secure

## 🔄 How Frontend Talks to Backend

The frontend and backend communicate using HTTP requests. Here's how it works:

### 1. Frontend Makes API Requests

In your React components, you make requests to the backend:

```typescript
// Example: Fetching data from the backend
async function fetchData() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/data`);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error;
  }
}

// Example: Sending data to the backend
async function createItem(item: unknown) {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to create item:', error);
    throw error;
  }
}
```

### 2. Backend Receives and Responds

Your backend listens for these requests and sends responses:

```javascript
// Middleware to parse JSON request bodies
app.use(express.json());

// Example: Backend API endpoint
app.get('/api/data', (req, res) => {
  // Get data from database
  const data = { message: 'Hello from backend!' };
  res.json(data);
});

// Always validate and sanitize input on the backend before using it.
app.post('/api/items', (req, res) => {
  const { name, price } = req.body || {};

  // Basic validation example (adjust fields to match your real model)
  if (typeof name !== 'string' || name.trim() === '' || typeof price !== 'number') {
    return res.status(400).json({ success: false, error: 'Invalid item data.' });
  }

  const newItem = { name: name.trim(), price };
  // Save to database...
  res.json({ success: true, item: newItem });
});
```

### 3. CORS Configuration

For the frontend and backend to communicate across different domains, CORS must be enabled:

```javascript
// Backend: Enable CORS
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN, // Your frontend URL
  credentials: true, // Allow cookies/auth headers; frontend must use credentials: 'include' in fetch when needed
}));
```

### Communication Flow

```
┌─────────────┐         HTTP Request          ┌─────────────┐
│             │  ──────────────────────────>   │             │
│  Frontend   │                                │   Backend   │
│  (Vercel)   │  <──────────────────────────   │  (Render)   │
│             │         JSON Response          │             │
└─────────────┘                                └─────────────┘
      │                                              │
      │                                              │
      └──────────────────────────────────────────────┘
             Uses VITE_API_URL environment variable
```

## 💻 Local Development

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Running Locally

#### Backend
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file with your environment variables
# (see Backend Environment Variables section above)

# Start the server
npm start
# Backend will run on http://localhost:3000
```

#### Frontend
```bash
# Open a new terminal
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file with your environment variables
# (see Frontend Environment Variables section above)

# Start the development server
npm run dev
# Frontend will run on http://localhost:5173
```

Now you can access your application at `http://localhost:5173` and it will communicate with the backend at `http://localhost:3000`.

## 🔧 Common Issues & Solutions

### Issue: Frontend can't connect to backend
- **Solution**: Check that `VITE_API_URL` is correctly set in your frontend environment variables
- Verify the backend URL is correct and the backend is running
- Check CORS configuration in the backend

### Issue: Environment variables not working
- **Solution**: Make sure you restart your development server after changing `.env` files
- In Vite, ensure variables start with `VITE_`
- In production, verify environment variables are set in Vercel/Render dashboards

### Issue: Deployment fails
- **Solution**: Check the build logs in Vercel/Render
- Ensure all dependencies are listed in `package.json`
- Verify the build and start commands are correct

## 📚 Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Express.js Documentation](https://expressjs.com/)

## 📝 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ by the Predix team