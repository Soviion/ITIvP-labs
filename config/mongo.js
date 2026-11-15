require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

const isEnabled = () => Boolean(process.env.MONGO_URI);
const isConnected = () => mongoose.connection.readyState === 1;

async function connectMongo() {
  if (!isEnabled()) {
    console.warn('MongoDB: MONGO_URI не задан в .env — маршруты /mongo/* отключены');
    return false;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return true;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    return false;
  }
}

const mongoStatus = () => ({
  enabled: isEnabled(),
  state: STATES[mongoose.connection.readyState] ?? 'unknown',
  host: isConnected() ? mongoose.connection.host : null,
  database: isConnected() ? mongoose.connection.name : null,
});

module.exports = { connectMongo, isEnabled, isConnected, mongoStatus };
