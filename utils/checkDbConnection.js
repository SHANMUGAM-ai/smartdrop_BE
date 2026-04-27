const dotenv = require('dotenv');
const { connectDB, disconnectDB } = require('../config/db');

dotenv.config();

const checkDbConnection = async () => {
  try {
    await connectDB();
    console.log('MongoDB connection check passed.');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error(`MongoDB connection check failed: ${error.message}`);
    process.exit(1);
  }
};

checkDbConnection();
