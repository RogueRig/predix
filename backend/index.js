import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow all origins in non-production environments (development/testing).
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, only allow explicitly configured origins.
    if (!origin) {
      // Allow non-browser or same-origin requests with no Origin header.
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  }
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'predix-backend'
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
