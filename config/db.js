const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

const MAX_RETRIES = 10;
const RETRY_INTERVAL_MS = 5000; // 5 seconds
let retryCount = 0;
let retryTimer = null;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Add it to backend/.env before starting the server.');
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    retryCount = 0; // reset on success
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

const isDatabaseConnected = () => mongoose.connection.readyState === 1;

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
};

const startDbRetryLoop = () => {
  if (retryTimer) return; // already running

  const attempt = async () => {
    if (isDatabaseConnected()) {
      console.log('MongoDB reconnected successfully.');
      retryTimer = null;
      return;
    }

    retryCount += 1;
    if (retryCount > MAX_RETRIES) {
      console.error(`MongoDB retry limit (${MAX_RETRIES}) reached. Stopping background retries.`);
      retryTimer = null;
      return;
    }

    console.log(`[Retry ${retryCount}/${MAX_RETRIES}] Attempting MongoDB reconnection in ${RETRY_INTERVAL_MS}ms...`);
    try {
      await connectDB();
      retryTimer = null;
    } catch (err) {
      retryTimer = setTimeout(attempt, RETRY_INTERVAL_MS);
    }
  };

  retryTimer = setTimeout(attempt, RETRY_INTERVAL_MS);
};

module.exports = { connectDB, disconnectDB, isDatabaseConnected, startDbRetryLoop };
