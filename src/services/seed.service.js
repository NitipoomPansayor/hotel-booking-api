const mongoose = require('mongoose');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const Favorite = require('../models/Favorite');
const ApiError = require('../utils/ApiError');
const sampleData = require('../data/sampleData');

const DAY_MS = 24 * 60 * 60 * 1000;

// Booking dates are whole UTC days, matching booking.service.
const utcMidnight = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// The app enables sanitizeFilter, which would neutralise these operators; the values here are our own data.
const inList = (values) => mongoose.trusted({ $in: values });

// Creates whatever is missing and leaves existing records untouched, so the seed is safe to re-run.
const findOrCreate = async (Model, filter, data) => {
  const existing = await Model.findOne(filter);
  if (existing) return { doc: existing, created: false };
  return { doc: await Model.create(data), created: true };
};

const seedHotels = async (hotels) => {
  const results = [];
  for (const hotel of hotels) {
    results.push(await findOrCreate(Hotel, { name: hotel.name }, hotel));
  }
  return results;
};

const seedUsers = async (users, password) => {
  const results = [];
  for (const { name, tel, email } of users) {
    results.push(await findOrCreate(User, { email }, { name, tel, email, password }));
  }
  return results;
};

// Only gives bookings to a sample user who has none, so a re-run never doubles them up.
const seedBookings = async (users, userDocs, hotelIdByName, today) => {
  const bookings = [];
  for (const [i, spec] of users.entries()) {
    const user = userDocs[i];
    if (user.role !== 'user' || (await Booking.exists({ user: user._id }))) continue;
    for (const { hotel, startsInDays, nights } of spec.bookings) {
      const checkInDate = new Date(today.getTime() + startsInDays * DAY_MS);
      const checkOutDate = new Date(checkInDate.getTime() + nights * DAY_MS);
      bookings.push({ user: user._id, hotel: hotelIdByName.get(hotel), checkInDate, checkOutDate });
    }
  }
  if (bookings.length) await Booking.insertMany(bookings);
  return bookings.length;
};

const seedFavorites = async (users, userDocs, hotelIdByName) => {
  const ops = users
    .map((spec, i) => ({ spec, user: userDocs[i] }))
    .filter(({ user }) => user.role === 'user')
    .flatMap(({ spec, user }) =>
      spec.favorites.map((hotelName) => {
        const pair = { user: user._id, hotel: hotelIdByName.get(hotelName) };
        return { updateOne: { filter: pair, update: { $setOnInsert: pair }, upsert: true } };
      })
    );
  if (!ops.length) return 0;
  const result = await Favorite.bulkWrite(ops);
  return result.upsertedCount;
};

const countCreated = (results) => results.filter((r) => r.created).length;

const seedSampleData = async ({ password, now = new Date(), data = sampleData } = {}) => {
  if (typeof password !== 'string' || !password) {
    throw new ApiError(400, 'SEED_USER_PASSWORD is required');
  }

  const hotelResults = await seedHotels(data.hotels);
  const userResults = await seedUsers(data.users, password);

  const hotelIdByName = new Map(hotelResults.map(({ doc }) => [doc.name, doc._id]));
  const userDocs = userResults.map(({ doc }) => doc);

  const bookings = await seedBookings(data.users, userDocs, hotelIdByName, utcMidnight(now));
  const favorites = await seedFavorites(data.users, userDocs, hotelIdByName);

  return {
    hotels: { created: countCreated(hotelResults), existing: hotelResults.length - countCreated(hotelResults) },
    users: { created: countCreated(userResults), existing: userResults.length - countCreated(userResults) },
    bookings: { created: bookings },
    favorites: { created: favorites },
  };
};

// Removes the sample hotels and sample (non-admin) users, plus every booking and favorite attached to them.
const removeSampleData = async ({ data = sampleData } = {}) => {
  let summary;
  await mongoose.connection.transaction(async (session) => {
    const userIds = await User.find({ email: inList(data.users.map((u) => u.email)), role: 'user' })
      .session(session)
      .distinct('_id');
    const hotelIds = await Hotel.find({ name: inList(data.hotels.map((h) => h.name)) })
      .session(session)
      .distinct('_id');

    const attached = { $or: [{ user: inList(userIds) }, { hotel: inList(hotelIds) }] };
    const bookings = await Booking.deleteMany(attached, { session });
    const favorites = await Favorite.deleteMany(attached, { session });
    const users = await User.deleteMany({ _id: inList(userIds) }, { session });
    const hotels = await Hotel.deleteMany({ _id: inList(hotelIds) }, { session });

    summary = {
      hotels: hotels.deletedCount,
      users: users.deletedCount,
      bookings: bookings.deletedCount,
      favorites: favorites.deletedCount,
    };
  });
  return summary;
};

module.exports = { seedSampleData, removeSampleData };
