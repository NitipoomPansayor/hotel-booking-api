require('dotenv').config({ quiet: true });

const app = require('./app');
const connectDB = require('./config/db');

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB(process.env.MONGO_URI);
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

start().catch((err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
