const mongoose = require('mongoose');
const dns = require('dns');

// Override system DNS with Google DNS — local ISP/router DNS often blocks SRV records
// which MongoDB Atlas requires for its +srv connection strings
dns.setServers(['8.8.8.8', '8.8.4.4']);

let dbReady = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalrag';
  try {
    await mongoose.connect(uri);
    dbReady = true;
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.warn('⚠️  Auth features unavailable. Start MongoDB to enable login/registration.');
    // Do NOT exit — RAG features still work without DB
  }
}

function isDbReady() {
  return dbReady && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDbReady };
