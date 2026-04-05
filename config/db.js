const mongoose = require('mongoose');
const { DB_CONFIG } = require('./constants');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection pool settings for better performance
      maxPoolSize: DB_CONFIG.MAX_POOL_SIZE,
      serverSelectionTimeoutMS: DB_CONFIG.SERVER_SELECTION_TIMEOUT_MS,
      socketTimeoutMS: DB_CONFIG.SOCKET_TIMEOUT_MS,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
