const request = require('supertest');
const app = require('../src/app');
const Hotel = require('../src/models/Hotel');
const Booking = require('../src/models/Booking');
const { csvCell } = require('../src/services/report.service');
const db = require('./helpers/db');
const { createUser, createAdmin, bearer } = require('./helpers/auth');
const endpoint = '/api/v1/reports/bookings/monthly';
beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

test('monthly CSV includes all bookings in Bangkok month and a consistent summary row', async () => {
  const { user } = await createUser();
  const admin = await createAdmin();
  const hotel = await Hotel.create({ name: 'โรงแรม "สบาย", กรุงเทพ', address: 'Bangkok', tel: '021234567' });
  for (const createdAt of ['2026-10-31T16:59:59Z', '2026-10-31T17:00:00Z', '2026-11-30T16:59:59Z', '2026-11-30T17:00:00Z']) {
    await Booking.create({ user: user._id, hotel: hotel._id, checkInDate: '2026-12-01', checkOutDate: '2026-12-03', createdAt });
  }
  const result = await request(app).get(`${endpoint}?year=2026&month=11&limit=1`).set(bearer(admin.token));
  expect(result.status).toBe(200);
  expect(result.headers['content-type']).toContain('text/csv');
  expect(result.headers['content-disposition']).toContain('bookings-2026-11.csv');
  expect(result.headers['cache-control']).toBe('no-store');
  expect(result.text.charCodeAt(0)).toBe(0xFEFF);
  expect(result.text).toContain('โรงแรม ""สบาย"", กรุงเทพ');
  const rows = result.text.trim().split('\r\n');
  expect(rows).toHaveLength(4);
  expect(rows[3]).toBe('"summary","","","","","","","","","2","4"');
  expect(result.text).not.toContain('2026-10-31T16:59:59.000Z');
  expect(result.text).not.toContain('2026-11-30T17:00:00.000Z');
});

test('empty month has a header and zero totals', async () => {
  const admin = await createAdmin();
  const res = await request(app).get(`${endpoint}?year=2026&month=2`).set(bearer(admin.token));
  expect(res.status).toBe(200);
  expect(res.text).toContain('"0","0"');
});

test('only admin can download, and date input is validated', async () => {
  const user = await createUser();
  const admin = await createAdmin();
  expect((await request(app).get(`${endpoint}?year=2026&month=1`)).status).toBe(401);
  expect((await request(app).get(`${endpoint}?year=2026&month=1`).set(bearer(user.token))).status).toBe(403);
  for (const query of ['year=2026&month=13', 'year=2026', 'year=abc&month=1', 'year=2026&month=1&month=2']) {
    expect((await request(app).get(`${endpoint}?${query}`).set(bearer(admin.token))).status).toBe(400);
  }
});

test('CSV escapes quotes/newlines and neutralizes spreadsheet formulas', () => {
  expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  for (const text of ['=1+1', '+cmd', '-1+2', '@SUM(A1)', '  =1', '\tvalue']) {
    expect(csvCell(text)).toBe(`"'${text}"`);
  }
});
