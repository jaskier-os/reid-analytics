const mongoose = require("mongoose");
const config = require('./config');

const connectDB = async () => {
  const maxRetries = 30;
  const retryDelayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await mongoose.connect(config.mongoURI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`MongoDB connection failed after ${maxRetries} attempts: ${error.message}`);
        process.exit(1);
      }
      console.warn(`MongoDB not ready, retrying in ${retryDelayMs / 1000}s (attempt ${attempt}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
};

module.exports = { connectDB };
