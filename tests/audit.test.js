const request = require('supertest');
const app = require('../src/app');
const Hotel = require('../src/models/Hotel');
const Booking = require('../src/models/Booking');
const AuditLog = require('../src/models/AuditLog');
const db = require('./helpers/db');
const { createUser, createAdmin, bearer } = require('./helpers/auth');
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const fixture = async () => {
  const owner = await createUser();
  const hotel = await Hotel.create({ name: 'Audit Hotel', address: 'Bangkok', tel: '021234567' });
  const booking = await Booking.create({ user: owner.user._id, hotel: hotel._id, checkInDate: day(2), checkOutDate: day(3) });
  return { ...owner, hotel, booking };
};
beforeAll(db.connect);
afterEach(async () => { jest.restoreAllMocks(); await db.clear(); });
afterAll(db.close);

test('records owner edits and retains before/after snapshots after deletion', async () => {
  const { user, token, booking } = await fixture();
  const edited = await request(app).put(`/api/v1/bookings/${booking.id}`).set(bearer(token))
    .send({ checkOutDate: day(4) });
  expect(edited.status).toBe(200);
  const log = await AuditLog.findOne({ action: 'BOOKING_UPDATED' });
  expect(log.actorId.equals(user._id)).toBe(true);
  expect(log.actorRole).toBe('user');
  expect(log.timestamp).toBeInstanceOf(Date);
  expect(log.before.checkOutDate.toISOString().slice(0, 10)).toBe(day(3));
  expect(log.after.checkOutDate.toISOString().slice(0, 10)).toBe(day(4));
  expect((await request(app).delete(`/api/v1/bookings/${booking.id}`).set(bearer(token))).status).toBe(200);
  expect(await AuditLog.countDocuments({ bookingId: booking._id })).toBe(2);
});

test('hotel cascade records the admin and preserves audit history', async () => {
  const { hotel, booking } = await fixture();
  const admin = await createAdmin();
  expect((await request(app).delete(`/api/v1/hotels/${hotel.id}`).set(bearer(admin.token))).status).toBe(200);
  const log = await AuditLog.findOne({ bookingId: booking._id });
  expect(log.actorId.equals(admin.user._id)).toBe(true);
  expect(log.reason).toBe('hotel_deleted');
  expect(log.after).toBeNull();
});

test('unauthorized and invalid edits produce no audit log', async () => {
  const { booking, token } = await fixture();
  const other = await createUser();
  expect((await request(app).delete(`/api/v1/bookings/${booking.id}`).set(bearer(other.token))).status).toBe(403);
  expect((await request(app).put(`/api/v1/bookings/${booking.id}`).set(bearer(token))
    .send({ checkOutDate: day(10) })).status).toBe(400);
  expect(await AuditLog.countDocuments()).toBe(0);
});

test.each(['edit', 'delete', 'cascade'])('audit failure rolls back %s', async (action) => {
  const { booking, hotel, token } = await fixture();
  jest.spyOn(AuditLog, 'create').mockRejectedValue(new Error('Audit storage failed'));
  let res;
  if (action === 'edit') res = await request(app).put(`/api/v1/bookings/${booking.id}`).set(bearer(token)).send({ checkOutDate: day(4) });
  if (action === 'delete') res = await request(app).delete(`/api/v1/bookings/${booking.id}`).set(bearer(token));
  if (action === 'cascade') {
    const admin = await createAdmin();
    res = await request(app).delete(`/api/v1/hotels/${hotel.id}`).set(bearer(admin.token));
  }
  expect(res.status).toBe(500);
  expect(await Hotel.findById(hotel.id)).not.toBeNull();
  expect((await Booking.findById(booking.id)).checkOutDate.toISOString().slice(0, 10)).toBe(day(3));
  expect(await AuditLog.countDocuments()).toBe(0);
});
