const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

const MAX_RETRIES = 10;
const RETRY_INTERVAL_MS = 5000; // 5 seconds
let retryCount = 0;
let retryTimer = null;

const ATLAS_FALLBACKS = {
  'cluster0.whbzhj.mongodb.net': {
    hosts: [
      'cluster0-shard-00-00.whbzhj.mongodb.net:27017',
      'cluster0-shard-00-01.whbzhj.mongodb.net:27017',
      'cluster0-shard-00-02.whbzhj.mongodb.net:27017',
    ],
    replicaSet: 'atlas-ma9qg0-shard-0',
  },
  'cluster0.zz3ru5y.mongodb.net': {
    hosts: [
      'ac-p1h8ynn-shard-00-00.zz3ru5y.mongodb.net:27017',
      'ac-p1h8ynn-shard-00-01.zz3ru5y.mongodb.net:27017',
      'ac-p1h8ynn-shard-00-02.zz3ru5y.mongodb.net:27017',
    ],
    replicaSet: 'atlas-3vqll9-shard-0',
  },
};

const getMongoUri = () => (
  process.env.MONGO_URI ||
  process.env.MONGO_URI_STANDARD ||
  process.env.MONGO_URI_FALLBACK
);

const buildMongoFallbackUri = (mongoUri) => {
  if (!mongoUri || !mongoUri.startsWith('mongodb+srv://')) {
    return process.env.MONGO_URI_STANDARD || process.env.MONGO_URI_FALLBACK;
  }

  const fallbackUri = process.env.MONGO_URI_STANDARD || process.env.MONGO_URI_FALLBACK;
  if (fallbackUri) {
    return fallbackUri;
  }

  const uri = new URL(mongoUri);
  const atlasConfig = ATLAS_FALLBACKS[uri.hostname];
  if (!atlasConfig) {
    return null;
  }

  const auth = uri.username ? `${uri.username}:${uri.password}@` : '';
  uri.searchParams.set('ssl', 'true');
  uri.searchParams.set('replicaSet', atlasConfig.replicaSet);
  uri.searchParams.set('authSource', 'admin');
  uri.searchParams.set('retryWrites', 'true');
  uri.searchParams.set('w', 'majority');

  return `mongodb://${auth}${atlasConfig.hosts.join(',')}${uri.pathname}?${uri.searchParams.toString()}`;
};

const isSrvDnsError = (error) => (
  error &&
  typeof error.message === 'string' &&
  (
    error.message.includes('querySrv') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ENOTFOUND')
  )
);

const connectDB = async () => {
  const mongoUri = getMongoUri();

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
    const fallbackUri = buildMongoFallbackUri(mongoUri);
    if (mongoUri.startsWith('mongodb+srv://') && fallbackUri && isSrvDnsError(error)) {
      console.log('MongoDB SRV DNS lookup failed. Retrying with standard MongoDB URI...');
      try {
        const conn = await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 5000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        retryCount = 0;
        return conn;
      } catch (fallbackError) {
        console.error(`MongoDB fallback connection error: ${fallbackError.message}`);
        throw fallbackError;
      }
    }

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
