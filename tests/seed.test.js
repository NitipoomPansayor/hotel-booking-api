const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Hotel = require('../src/models/Hotel');
const Booking = require('../src/models/Booking');
const Favorite = require('../src/models/Favorite');
const ApiError = require('../src/utils/ApiError');
const sampleData = require('../src/data/sampleData');
const { seedSampleData, removeSampleData } = require('../src/services/seed.service');
const db = require('./helpers/db');
const { createUser, createAdmin, bearer } = require('./helpers/auth');

const DAY_MS = 24 * 60 * 60 * 1000;
const password = 'sample123';
const [somchai, malee] = sampleData.users;

const totalBookings = sampleData.users.reduce((sum, u) => sum + u.bookings.length, 0);
const totalFavorites = sampleData.users.reduce((sum, u) => sum + u.favorites.length, 0);

const login = async (email) => {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
};

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('sample data definitions', () => {
  it('only references hotels that exist in the sample data', () => {
    const names = new Set(sampleData.hotels.map((h) => h.name));
    for (const user of sampleData.users) {
      for (const booking of user.bookings) expect(names).toContain(booking.hotel);
      for (const favorite of user.favorites) expect(names).toContain(favorite);
    }
  });

  it('keeps every stay within the 1–3 night rule and never in the past', () => {
    for (const { bookings } of sampleData.users) {
      for (const { startsInDays, nights } of bookings) {
        expect(startsInDays).toBeGreaterThanOrEqual(0);
        expect(nights).toBeGreaterThanOrEqual(1);
        expect(nights).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('seedSampleData', () => {
  it('creates the sample hotels, users, bookings and favorites', async () => {
    const summary = await seedSampleData({ password });

    expect(summary).toEqual({
      hotels: { created: sampleData.hotels.length, existing: 0 },
      users: { created: sampleData.users.length, existing: 0 },
      bookings: { created: totalBookings },
      favorites: { created: totalFavorites },
    });
    expect(await Hotel.countDocuments()).toBe(sampleData.hotels.length);
    expect(await Booking.countDocuments()).toBe(totalBookings);
    expect(await Favorite.countDocuments()).toBe(totalFavorites);
  });

  it('creates regular users with hashed passwords, never admins', async () => {
    await seedSampleData({ password });

    const users = await User.find().select('+password');
    expect(users).toHaveLength(sampleData.users.length);
    for (const user of users) {
      expect(user.role).toBe('user');
      expect(user.password).not.toBe(password);
      expect(await user.matchPassword(password)).toBe(true);
    }
  });

  it('dates bookings from today in whole UTC days', async () => {
    const now = new Date('2030-05-10T17:45:00Z');
    await seedSampleData({ password, now });

    const user = await User.findOne({ email: somchai.email });
    const bookings = await Booking.find({ user: user._id }).sort({ checkInDate: 1 });
    const [first] = somchai.bookings;

    expect(bookings[0].checkInDate.toISOString()).toBe('2030-05-10T00:00:00.000Z');
    expect((bookings[0].checkOutDate - bookings[0].checkInDate) / DAY_MS).toBe(first.nights);
  });

  it('is safe to run again: nothing is duplicated', async () => {
    await seedSampleData({ password });
    const summary = await seedSampleData({ password });

    expect(summary).toEqual({
      hotels: { created: 0, existing: sampleData.hotels.length },
      users: { created: 0, existing: sampleData.users.length },
      bookings: { created: 0 },
      favorites: { created: 0 },
    });
    expect(await Booking.countDocuments()).toBe(totalBookings);
    expect(await Favorite.countDocuments()).toBe(totalFavorites);
  });

  it('leaves an existing account and hotel as they are', async () => {
    await createUser({ email: somchai.email, name: 'Real Somchai', password: 'original1' });
    const hotel = sampleData.hotels[0];
    await Hotel.create({ ...hotel, tel: '029999999' });

    await seedSampleData({ password });

    const user = await User.findOne({ email: somchai.email }).select('+password');
    expect(user.name).toBe('Real Somchai');
    expect(await user.matchPassword('original1')).toBe(true);
    expect((await Hotel.findOne({ name: hotel.name })).tel).toBe('029999999');
  });

  it('gives no bookings or favorites to a sample email that belongs to an admin', async () => {
    const { user: admin } = await createAdmin({ email: somchai.email });

    await seedSampleData({ password });

    expect(await Booking.countDocuments({ user: admin._id })).toBe(0);
    expect(await Favorite.countDocuments({ user: admin._id })).toBe(0);
  });

  it.each([undefined, ''])('rejects a missing password (%p)', async (missing) => {
    await expect(seedSampleData({ password: missing })).rejects.toEqual(
      new ApiError(400, 'SEED_USER_PASSWORD is required')
    );
    expect(await Hotel.countDocuments()).toBe(0);
  });

  it('fails schema validation for a password shorter than 6 characters', async () => {
    await expect(seedSampleData({ password: 'abc' })).rejects.toMatchObject({ name: 'ValidationError' });
  });
});

describe('seeded data through the API', () => {
  beforeEach(() => seedSampleData({ password }));

  it('lets a sample user log in and see only their own bookings', async () => {
    const token = await login(malee.email);

    const res = await request(app).get('/api/v1/bookings').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(malee.bookings.length);
    expect(res.body.data.map((b) => b.hotel.name).sort()).toEqual(malee.bookings.map((b) => b.hotel).sort());
  });

  it('produces bookings the API accepts when re-saved unchanged', async () => {
    const token = await login(somchai.email);
    const { body } = await request(app).get('/api/v1/bookings').set(bearer(token));

    for (const booking of body.data) {
      const res = await request(app)
        .put(`/api/v1/bookings/${booking._id}`)
        .set(bearer(token))
        .send({ checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate });
      expect(res.status).toBe(200);
    }
  });

  it('blocks a sample user from another sample user’s booking', async () => {
    const owner = await User.findOne({ email: somchai.email });
    const booking = await Booking.findOne({ user: owner._id });
    const token = await login(malee.email);

    const res = await request(app).get(`/api/v1/bookings/${booking._id}`).set(bearer(token));

    expect(res.status).toBe(403);
  });

  it('lists the sample favorites for the user', async () => {
    const token = await login(somchai.email);

    const res = await request(app).get('/api/v1/favorites').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.map((h) => h.name).sort()).toEqual([...somchai.favorites].sort());
  });
});

describe('removeSampleData', () => {
  it('removes the sample records and leaves everything else alone', async () => {
    const { user: admin } = await createAdmin();
    const { user: other } = await createUser();
    const otherHotel = await Hotel.create({ name: 'Unrelated Hotel', address: '1 Silom Rd, Bangkok', tel: '021112222' });
    const tomorrow = new Date(Date.now() + DAY_MS);
    const keptBooking = await Booking.create({
      user: other._id,
      hotel: otherHotel._id,
      checkInDate: tomorrow,
      checkOutDate: new Date(tomorrow.getTime() + DAY_MS),
    });
    await seedSampleData({ password });

    const summary = await removeSampleData();

    expect(summary).toEqual({
      hotels: sampleData.hotels.length,
      users: sampleData.users.length,
      bookings: totalBookings,
      favorites: totalFavorites,
    });
    expect((await User.find().distinct('_id')).map(String).sort()).toEqual([admin._id, other._id].map(String).sort());
    expect(await Hotel.find().distinct('name')).toEqual(['Unrelated Hotel']);
    expect((await Booking.find().distinct('_id')).map(String)).toEqual([String(keptBooking._id)]);
    expect(await Favorite.countDocuments()).toBe(0);
  });

  it('never deletes an admin that uses a sample email', async () => {
    await createAdmin({ email: somchai.email });

    await removeSampleData();

    expect(await User.countDocuments({ email: somchai.email })).toBe(1);
  });

  it('removes another user’s booking at a sample hotel along with the hotel', async () => {
    await seedSampleData({ password });
    const { user: other } = await createUser();
    const hotel = await Hotel.findOne({ name: sampleData.hotels[0].name });
    const tomorrow = new Date(Date.now() + DAY_MS);
    await Booking.create({
      user: other._id,
      hotel: hotel._id,
      checkInDate: tomorrow,
      checkOutDate: new Date(tomorrow.getTime() + DAY_MS),
    });

    await removeSampleData();

    expect(await Booking.countDocuments({ user: other._id })).toBe(0);
    expect(await User.exists({ _id: other._id })).toBeTruthy();
  });
});
