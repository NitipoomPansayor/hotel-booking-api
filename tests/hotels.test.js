const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Hotel = require('../src/models/Hotel');
const db = require('./helpers/db');
const { createUser, createAdmin, bearer } = require('./helpers/auth');

const validHotel = {
  name: 'Grand Palace Hotel',
  address: '1 Rama I Rd, Bangkok',
  tel: '021234567',
};

const missingId = () => new mongoose.Types.ObjectId().toString();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('hotel pricing', () => {
  it('persists admin prices and displays THB without a provider', async () => {
    const { token } = await createAdmin();
    const created = await request(app).post('/api/v1/hotels').set(bearer(token))
      .send({ ...validHotel, pricePerNightSatang: 125050 });
    expect(created.status).toBe(201);
    const result = await request(app).get(`/api/v1/hotels/${created.body.data._id}?currency=THB`);
    expect(result.body.data.displayPrice).toMatchObject({ amount: 1250.5, currency: 'THB', stale: false });
    const invalid = await request(app).put(`/api/v1/hotels/${created.body.data._id}`)
      .set(bearer(token)).send({ pricePerNightSatang: -1 });
    expect(invalid.status).toBe(400);
  });
});

describe('GET /api/v1/hotels', () => {
  it('lists hotels publicly, sorted by name, with pagination info', async () => {
    await Hotel.create([
      { ...validHotel, name: 'Zeta Inn' },
      { ...validHotel, name: 'Alpha Resort' },
    ]);

    const res = await request(app).get('/api/v1/hotels');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.data.map((h) => h.name)).toEqual(['Alpha Resort', 'Zeta Inn']);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({ name: 'Alpha Resort', address: validHotel.address, tel: validHotel.tel })
    );
    expect(res.body.pagination).toEqual({ page: 1, limit: 25, total: 2, pages: 1 });
  });

  it('returns an empty list when there are no hotels', async () => {
    const res = await request(app).get('/api/v1/hotels');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('paginates with page and limit', async () => {
    await Hotel.create(['A', 'B', 'C'].map((n) => ({ ...validHotel, name: `Hotel ${n}` })));

    const res = await request(app).get('/api/v1/hotels?page=2&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data.map((h) => h.name)).toEqual(['Hotel C']);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, pages: 2 });
  });

  it('caps limit at 100', async () => {
    const res = await request(app).get('/api/v1/hotels?limit=500');
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  it.each(['page=0', 'page=-1', 'limit=abc', 'limit=1.5'])('returns 400 for invalid query %s', async (qs) => {
    const res = await request(app).get(`/api/v1/hotels?${qs}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/hotels/:id', () => {
  it('returns one hotel publicly', async () => {
    const hotel = await Hotel.create(validHotel);
    const res = await request(app).get(`/api/v1/hotels/${hotel.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject(validHotel);
  });

  it('returns 404 for a hotel that does not exist', async () => {
    const res = await request(app).get(`/api/v1/hotels/${missingId()}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/v1/hotels/not-an-id');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/hotels', () => {
  it('lets an admin create a hotel', async () => {
    const { token } = await createAdmin();
    const res = await request(app).post('/api/v1/hotels').set(bearer(token)).send(validHotel);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject(validHotel);
    expect(await Hotel.countDocuments()).toBe(1);
  });

  it('ignores fields that are not editable', async () => {
    const { token } = await createAdmin();
    const forcedId = missingId();
    const res = await request(app)
      .post('/api/v1/hotels')
      .set(bearer(token))
      .send({ ...validHotel, _id: forcedId, extra: 'x' });

    expect(res.status).toBe(201);
    expect(res.body.data._id).not.toBe(forcedId);
    expect(res.body.data.extra).toBeUndefined();
  });

  it('returns 401 when not logged in', async () => {
    const res = await request(app).post('/api/v1/hotels').send(validHotel);
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin user', async () => {
    const { token } = await createUser();
    const res = await request(app).post('/api/v1/hotels').set(bearer(token)).send(validHotel);
    expect(res.status).toBe(403);
    expect(await Hotel.countDocuments()).toBe(0);
  });

  it.each(['name', 'address', 'tel'])('returns 400 when %s is missing', async (field) => {
    const { token } = await createAdmin();
    const body = { ...validHotel };
    delete body[field];
    const res = await request(app).post('/api/v1/hotels').set(bearer(token)).send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid telephone number', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/v1/hotels')
      .set(bearer(token))
      .send({ ...validHotel, tel: 'call me' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a duplicate hotel name', async () => {
    const { token } = await createAdmin();
    await Hotel.create(validHotel);
    const res = await request(app).post('/api/v1/hotels').set(bearer(token)).send(validHotel);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/);
  });
});

describe('PUT /api/v1/hotels/:id', () => {
  it('lets an admin update a hotel', async () => {
    const { token } = await createAdmin();
    const hotel = await Hotel.create(validHotel);

    const res = await request(app)
      .put(`/api/v1/hotels/${hotel.id}`)
      .set(bearer(token))
      .send({ address: '99 New Rd, Chiang Mai' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: validHotel.name, address: '99 New Rd, Chiang Mai' });
  });

  it('runs validators on update', async () => {
    const { token } = await createAdmin();
    const hotel = await Hotel.create(validHotel);
    const res = await request(app).put(`/api/v1/hotels/${hotel.id}`).set(bearer(token)).send({ tel: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for a non-admin user', async () => {
    const { token } = await createUser();
    const hotel = await Hotel.create(validHotel);
    const res = await request(app).put(`/api/v1/hotels/${hotel.id}`).set(bearer(token)).send({ name: 'Hacked' });
    expect(res.status).toBe(403);
    expect((await Hotel.findById(hotel.id)).name).toBe(validHotel.name);
  });

  it('returns 401 when not logged in', async () => {
    const hotel = await Hotel.create(validHotel);
    const res = await request(app).put(`/api/v1/hotels/${hotel.id}`).send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a hotel that does not exist', async () => {
    const { token } = await createAdmin();
    const res = await request(app).put(`/api/v1/hotels/${missingId()}`).set(bearer(token)).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/hotels/:id', () => {
  it('lets an admin delete a hotel', async () => {
    const { token } = await createAdmin();
    const hotel = await Hotel.create(validHotel);

    const res = await request(app).delete(`/api/v1/hotels/${hotel.id}`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: {} });
    expect(await Hotel.findById(hotel.id)).toBeNull();
  });

  it('returns 403 for a non-admin user', async () => {
    const { token } = await createUser();
    const hotel = await Hotel.create(validHotel);
    const res = await request(app).delete(`/api/v1/hotels/${hotel.id}`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(await Hotel.findById(hotel.id)).not.toBeNull();
  });

  it('returns 401 when not logged in', async () => {
    const hotel = await Hotel.create(validHotel);
    const res = await request(app).delete(`/api/v1/hotels/${hotel.id}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a hotel that does not exist', async () => {
    const { token } = await createAdmin();
    const res = await request(app).delete(`/api/v1/hotels/${missingId()}`).set(bearer(token));
    expect(res.status).toBe(404);
  });
});
