require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { seedAdmin } = require('../src/services/user.service');

const MESSAGES = {
  created: 'Admin created',
  promoted: 'Existing account promoted to admin (name, tel and password unchanged)',
  unchanged: 'Account is already an admin, nothing to do',
};

const main = async () => {
  const missing = ['MONGO_URI', 'ADMIN_EMAIL'].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  await connectDB(process.env.MONGO_URI);
  try {
    const { user, action } = await seedAdmin({
      name: process.env.ADMIN_NAME,
      tel: process.env.ADMIN_TEL,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log(`${MESSAGES[action]}: ${user.email}`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(`Seeding admin failed: ${err.message}`);
  process.exit(1);
});
