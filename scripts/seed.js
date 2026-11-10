require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { seedSampleData, removeSampleData } = require('../src/services/seed.service');

const destroy = process.argv.includes('--destroy');

const seed = async () => {
  const { hotels, users, bookings, favorites } = await seedSampleData({ password: process.env.SEED_USER_PASSWORD });
  console.log(`Hotels:    ${hotels.created} created, ${hotels.existing} already existed`);
  console.log(`Users:     ${users.created} created, ${users.existing} already existed`);
  console.log(`Bookings:  ${bookings.created} created`);
  console.log(`Favorites: ${favorites.created} created`);
};

const remove = async () => {
  const { hotels, users, bookings, favorites } = await removeSampleData();
  console.log(`Removed ${hotels} hotels, ${users} users, ${bookings} bookings, ${favorites} favorites`);
};

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error('Missing required environment variable: MONGO_URI');

  await connectDB(process.env.MONGO_URI);
  try {
    await (destroy ? remove() : seed());
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(`${destroy ? 'Removing' : 'Seeding'} sample data failed: ${err.message}`);
  process.exit(1);
});
