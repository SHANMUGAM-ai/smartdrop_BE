const dotenv = require('dotenv');

// Load env vars before loading app modules that may use process.env.
dotenv.config();

const express = require('express');
const cors = require('cors');
const { connectDB, isDatabaseConnected, startDbRetryLoop } = require('./config/db');
const { requireDatabase } = require('./middleware/dbMiddleware');

const app = express();

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173' || 'https://smartdrop-fe.vercel.app').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Health check
app.get('/', (req, res) =>
  res.json({
    message: 'SmartDrop API is running',
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
  })
);

// Routes
app.use('/api/orders', requireDatabase, require('./routes/orderRoutes'));
app.use('/api/users', requireDatabase, require('./routes/userRoutes'));
app.use('/api/support', requireDatabase, require('./routes/supportRoutes'));
app.use('/api/products', requireDatabase, require('./routes/productRoutes'));
app.use('/api/payments', requireDatabase, require('./routes/paymentRoutes'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Start HTTP server immediately so the API is reachable (health checks, etc.)
  app.listen(PORT, () => console.log(`SmartDrop server running on port ${PORT}`));

  // Attempt to connect to MongoDB; if it fails, retry in background
  try {
    await connectDB();
  } catch (error) {
    console.error('MongoDB connection failed on startup. Starting background retry loop...');
    startDbRetryLoop();
  }
};

startServer();
