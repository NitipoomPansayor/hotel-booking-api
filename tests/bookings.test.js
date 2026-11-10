const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Hotel = require('../src/models/Hotel');
const Booking = require('../src/models/Booking');
const db = require('./helpers/db');
const { createUser, createAdmin, bearer } = require('./helpers/auth');

const DAY_MS = 24 * 60 * 60 * 1000;

// UTC calendar date `n` days from today, as YYYY-MM-DD
const day = (n) => new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);

const stay = (checkIn, nights) => ({ checkInDate: day(checkIn), checkOutDate: day(checkIn + nights) });

const missingId = () => new mongoose.Types.ObjectId().toString();

let hotelCounter = 0;
const createHotel = () => {
  hotelCounter += 1;
  return Hotel.create({ name: `Hotel ${hotelCounter}`, address: '1 Rama I Rd, Bangkok', tel: '021234567' });
};

const createBooking = (user, hotel, checkIn = 1, nights = 2) =>
  Booking.create({ user: user._id, hotel: hotel._id, ...stay(checkIn, nights) });

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('POST /api/v1/hotels/:hotelId/bookings', () => {
  const post = (hotelId, token, body) =>
    request(app).post(`/api/v1/hotels/${hotelId}/bookings`).set(bearer(token)).send(body);

  it.each([1, 3])('creates a %i-night booking for the logged-in user', async (nights) => {
    const { user, token } = await createUser();
    const hotel = await createHotel();

    const res = await post(hotel.id, token, stay(1, nights));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBe(user.id);
    expect(res.body.data.hotel).toEqual(expect.objectContaining({ _id: hotel.id, name: hotel.name }));
    expect(res.body.data.checkInDate).toBe(`${day(1)}T00:00:00.000Z`);
    expect(res.body.data.checkOutDate).toBe(`${day(1 + nights)}T00:00:00.000Z`);
  });

  it('allows check-in today', async () => {
    const { token } = await createUser();
    const hotel = await createHotel();
    const res = await post(hotel.id, token, stay(0, 1));
    expect(res.status).toBe(201);
  });

  it('counts nights by calendar day, ignoring the time of day', async () => {
    const { token } = await createUser();
    const hotel = await createHotel();
    const res = await post(hotel.id, token, {
      checkInDate: `${day(1)}T22:00:00Z`,
      checkOutDate: `${day(4)}T08:00:00Z`,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.checkInDate).toBe(`${day(1)}T00:00:00.000Z`);
  });

  it('ignores a user id sent in the body', async () => {
    const { user, token } = await createUser();
    const { user: other } = await createUser();
    const hotel = await createHotel();

    const res = await post(hotel.id, token, { ...stay(1, 1), user: other.id });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toBe(user.id);
  });

  it('lets a user hold several bookings', async () => {
    const { user, token } = await createUser();
    const hotel = await createHotel();

    await post(hotel.id, token, stay(1, 3));
    const res = await post(hotel.id, token, stay(10, 3));

    expect(res.status).toBe(201);
    expect(await Booking.countDocuments({ user: user._id })).toBe(2);
  });

  it.each([
    ['0 nights', stay(1, 0), 'Check-out date must be after check-in date'],
    ['4 nights', stay(1, 4), 'Booking cannot exceed 3 nights'],
    ['check-out before check-in', { checkInDate: day(5), checkOutDate: day(3) }, 'Check-out date must be after check-in date'],
    ['a past check-in', stay(-1, 2), 'Check-in date cannot be in the past'],
    ['a missing check-in', { checkOutDate: day(2) }, 'Please add a check-in date'],
    ['a missing check-out', { checkInDate: day(1) }, 'Please add a check-out date'],
    ['an invalid date', { checkInDate: 'not-a-date', checkOutDate: day(2) }, 'Invalid check-in date'],
    ['a non-string date', { checkInDate: { $gt: '' }, checkOutDate: day(2) }, 'Invalid check-in date'],
  ])('returns 400 for %s', async (_label, body, message) => {
    const { token } = await createUser();
    const hotel = await createHotel();

    const res = await post(hotel.id, token, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message });
    expect(await Booking.countDocuments()).toBe(0);
  });

  it('returns 401 when not logged in', async () => {
    const hotel = await createHotel();
    const res = await request(app).post(`/api/v1/hotels/${hotel.id}/bookings`).send(stay(1, 1));
    expect(res.status).toBe(401);
  });

  it('returns 404 for a hotel that does not exist', async () => {
    const { token } = await createUser();
    const res = await post(missingId(), token, stay(1, 1));
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed hotel id', async () => {
    const { token } = await createUser();
    const res = await post('not-an-id', token, stay(1, 1));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/bookings', () => {
  it('shows a user only their own bookings, with the hotel populated', async () => {
    const { user, token } = await createUser();
    const { user: other } = await createUser();
    const hotel = await createHotel();
    const mine = await createBooking(user, hotel);
    await createBooking(other, hotel);

    const res = await request(app).get('/api/v1/bookings').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0]._id).toBe(mine.id);
    expect(res.body.data[0].hotel).toEqual(expect.objectContaining({ name: hotel.name, address: hotel.address }));
    expect(res.body.data[0].user).toBe(user.id);
    expect(res.body.pagination).toEqual({ page: 1, limit: 25, total: 1, pages: 1 });
  });

  it('shows an admin every booking, with the user populated', async () => {
    const { token } = await createAdmin();
    const { user: a } = await createUser();
    const { user: b } = await createUser();
    const hotel = await createHotel();
    await createBooking(a, hotel, 5);
    await createBooking(b, hotel, 1);

    const res = await request(app).get('/api/v1/bookings').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data.map((bk) => bk.user._id)).toEqual([b.id, a.id]);
    expect(res.body.data[0].user).toEqual(expect.objectContaining({ name: b.name, email: b.email }));
    expect(res.body.data[0].user.password).toBeUndefined();
  });

  it('paginates', async () => {
    const { user, token } = await createUser();
    const hotel = await createHotel();
    await Promise.all([1, 2, 3].map((n) => createBooking(user, hotel, n)));

    const res = await request(app).get('/api/v1/bookings?page=2&limit=2').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].checkInDate).toBe(`${day(3)}T00:00:00.000Z`);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, pages: 2 });
  });

  it('returns 400 for an invalid page', async () => {
    const { token } = await createUser();
    const res = await request(app).get('/api/v1/bookings?page=0').set(bearer(token));
    expect(res.status).toBe(400);
  });

  it('returns 401 when not logged in', async () => {
    const res = await request(app).get('/api/v1/bookings');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/hotels/:hotelId/bookings', () => {
  it('lets an admin list the bookings for one hotel', async () => {
    const { token } = await createAdmin();
    const { user } = await createUser();
    const hotel = await createHotel();
    const otherHotel = await createHotel();
    const booking = await createBooking(user, hotel);
    await createBooking(user, otherHotel);

    const res = await request(app).get(`/api/v1/hotels/${hotel.id}/bookings`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0]._id).toBe(booking.id);
  });

  it('returns 403 for a non-admin user', async () => {
    const { token } = await createUser();
    const hotel = await createHotel();
    const res = await request(app).get(`/api/v1/hotels/${hotel.id}/bookings`).set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('returns 401 when not logged in', async () => {
    const hotel = await createHotel();
    const res = await request(app).get(`/api/v1/hotels/${hotel.id}/bookings`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a hotel that does not exist', async () => {
    const { token } = await createAdmin();
    const res = await request(app).get(`/api/v1/hotels/${missingId()}/bookings`).set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed hotel id', async () => {
    const { token } = await createAdmin();
    const res = await request(app).get('/api/v1/hotels/not-an-id/bookings').set(bearer(token));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/bookings/:id', () => {
  it('returns the booking to its owner', async () => {
    const { user, token } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await request(app).get(`/api/v1/bookings/${booking.id}`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(booking.id);
    expect(res.body.data.hotel.name).toBeDefined();
  });

  it('returns any booking to an admin', async () => {
    const { token } = await createAdmin();
    const { user } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await request(app).get(`/api/v1/bookings/${booking.id}`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it("returns 403 for another user's booking", async () => {
    const { user } = await createUser();
    const { token } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await request(app).get(`/api/v1/bookings/${booking.id}`).set(bearer(token));

    expect(res.status).toBe(403);
  });

  it('returns 401 when not logged in', async () => {
    const res = await request(app).get(`/api/v1/bookings/${missingId()}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a booking that does not exist', async () => {
    const { token } = await createUser();
    const res = await request(app).get(`/api/v1/bookings/${missingId()}`).set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const { token } = await createUser();
    const res = await request(app).get('/api/v1/bookings/not-an-id').set(bearer(token));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/bookings/:id', () => {
  const put = (id, token, body) => request(app).put(`/api/v1/bookings/${id}`).set(bearer(token)).send(body);

  it('lets the owner change the dates', async () => {
    const { user, token } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await put(booking.id, token, stay(7, 3));

    expect(res.status).toBe(200);
    expect(res.body.data.checkInDate).toBe(`${day(7)}T00:00:00.000Z`);
    expect(res.body.data.checkOutDate).toBe(`${day(10)}T00:00:00.000Z`);
  });

  it('re-checks the stay when only one date changes', async () => {
    const { user, token } = await createUser();
    const booking = await createBooking(user, await createHotel(), 1, 2);

    const res = await put(booking.id, token, { checkOutDate: day(5) });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Booking cannot exceed 3 nights');
    const unchanged = await Booking.findById(booking.id);
    expect(unchanged.checkOutDate.toISOString()).toBe(`${day(3)}T00:00:00.000Z`);
  });

  it.each([
    ['4 nights', stay(1, 4)],
    ['0 nights', stay(2, 0)],
    ['a past check-in', stay(-2, 1)],
    ['an invalid date', { checkInDate: 'nope' }],
  ])('returns 400 for an update to %s', async (_label, body) => {
    const { user, token } = await createUser();
    const booking = await createBooking(user, await createHotel());
    const res = await put(booking.id, token, body);
    expect(res.status).toBe(400);
  });

  it('does not let the user or hotel be changed', async () => {
    const { user, token } = await createUser();
    const { user: other } = await createUser();
    const hotel = await createHotel();
    const otherHotel = await createHotel();
    const booking = await createBooking(user, hotel);

    const res = await put(booking.id, token, { ...stay(2, 1), user: other.id, hotel: otherHotel.id });

    expect(res.status).toBe(200);
    const saved = await Booking.findById(booking.id);
    expect(saved.user.toString()).toBe(user.id);
    expect(saved.hotel.toString()).toBe(hotel.id);
  });

  it("lets an admin edit anyone's booking", async () => {
    const { token } = await createAdmin();
    const { user } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await put(booking.id, token, stay(4, 1));

    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBe(user.id);
  });

  it("returns 403 for another user's booking", async () => {
    const { user } = await createUser();
    const { token } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await put(booking.id, token, stay(4, 1));

    expect(res.status).toBe(403);
  });

  it('returns 401 when not logged in', async () => {
    const res = await request(app).put(`/api/v1/bookings/${missingId()}`).send(stay(1, 1));
    expect(res.status).toBe(401);
  });

  it('returns 404 for a booking that does not exist', async () => {
    const { token } = await createUser();
    const res = await put(missingId(), token, stay(1, 1));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/bookings/:id', () => {
  it('lets the owner delete their booking', async () => {
    const { user, token } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await request(app).delete(`/api/v1/bookings/${booking.id}`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: {} });
    expect(await Booking.findById(booking.id)).toBeNull();
  });

  it("lets an admin delete anyone's booking", async () => {
    const { token } = await createAdmin();
    const { user } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await request(app).delete(`/api/v1/bookings/${booking.id}`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(await Booking.findById(booking.id)).toBeNull();
  });

  it("returns 403 for another user's booking", async () => {
    const { user } = await createUser();
    const { token } = await createUser();
    const booking = await createBooking(user, await createHotel());

    const res = await request(app).delete(`/api/v1/bookings/${booking.id}`).set(bearer(token));

    expect(res.status).toBe(403);
    expect(await Booking.findById(booking.id)).not.toBeNull();
  });

  it('returns 401 when not logged in', async () => {
    const res = await request(app).delete(`/api/v1/bookings/${missingId()}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a booking that does not exist', async () => {
    const { token } = await createUser();
    const res = await request(app).delete(`/api/v1/bookings/${missingId()}`).set(bearer(token));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/hotels/:id cascade', () => {
  it("deletes the hotel's bookings and leaves other hotels' bookings alone", async () => {
    const { token } = await createAdmin();
    const { user } = await createUser();
    const hotel = await createHotel();
    const otherHotel = await createHotel();
    await createBooking(user, hotel, 1);
    await createBooking(user, hotel, 5);
    const kept = await createBooking(user, otherHotel);

    const res = await request(app).delete(`/api/v1/hotels/${hotel.id}`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(await Booking.countDocuments({ hotel: hotel._id })).toBe(0);
    expect(await Booking.findById(kept.id)).not.toBeNull();
  });
});
