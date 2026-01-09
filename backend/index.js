const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for Vercel deployments
const corsOptions = {
  origin: function (origin, callback) {
    // Disallow requests with no origin to prevent bypassing Vercel restriction
    if (!origin) {
      console.warn('CORS blocked request with no origin header');
      return callback(null, false);
    }
    
    // Allow only this app's Vercel deployments, e.g.:
    // - https://predix.vercel.app
    // - https://predix-<suffix>.vercel.app (preview deployments)
    const vercelPattern = /^https:\/\/predix(-[a-z0-9]+)?\.vercel\.app$/;
    if (vercelPattern.test(origin)) {
      callback(null, true);
    } else {
      // Deny the request without throwing an error; log for debugging
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(null, false);
    }
  }
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'predix' });
});

// Start server only when this file is run directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    console.error(`Failed to start server on port ${PORT}:`, err.message || err);
    process.exit(1);
  });
}

module.exports = app;
