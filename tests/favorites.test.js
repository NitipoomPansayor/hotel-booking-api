const request = require('supertest');
const app = require('../src/app');
const Hotel = require('../src/models/Hotel');
const Favorite = require('../src/models/Favorite');
const db = require('./helpers/db');
const { createUser, createAdmin, bearer } = require('./helpers/auth');
beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);
const hotel = (name) => Hotel.create({ name, address: 'Bangkok', tel: '021234567' });
const put = (id, token) => request(app).put(`/api/v1/favorites/${id}`).set(bearer(token));

test('favorites are personal, idempotent and cannot use another user from request body', async () => {
  const a = await createUser(), b = await createUser(), h = await hotel('A');
  const results = await Promise.all(Array.from({ length: 4 }, () => put(h.id, a.token).send({ user: b.user.id })));
  expect(results.every((res) => res.status === 200)).toBe(true);
  expect(await Favorite.countDocuments()).toBe(1);
  expect((await Favorite.findOne()).user.equals(a.user._id)).toBe(true);
  const mine = await request(app).get('/api/v1/favorites').set(bearer(a.token));
  expect(mine.body.data[0]._id).toBe(h.id);
  expect((await request(app).get('/api/v1/favorites').set(bearer(b.token))).body.count).toBe(0);
  await request(app).delete(`/api/v1/favorites/${h.id}`).set(bearer(b.token));
  expect(await Favorite.countDocuments()).toBe(1);
  for (let i = 0; i < 2; i++) expect((await request(app).delete(`/api/v1/favorites/${h.id}`).set(bearer(a.token))).status).toBe(200);
  expect(await Favorite.countDocuments()).toBe(0);
});

test('Top 3 uses actual counts with deterministic ties and updates after removal', async () => {
  const hotels = await Promise.all(['Alpha', 'Beta', 'Gamma', 'Delta'].map(hotel));
  const users = await Promise.all([1, 2, 3].map(() => createUser()));
  for (let i = 0; i < hotels.length; i++) {
    for (const u of users.slice(0, i === 0 ? 3 : i === 1 ? 2 : 1)) await put(hotels[i].id, u.token);
  }
  const top = await request(app).get('/api/v1/hotels/top-favorites');
  expect(top.status).toBe(200);
  expect(top.body.data.map((h) => [h.name, h.favoriteCount])).toEqual([['Alpha', 3], ['Beta', 2], ['Delta', 1]]);
  await request(app).delete(`/api/v1/favorites/${hotels[3].id}`).set(bearer(users[0].token));
  expect((await request(app).get('/api/v1/hotels/top-favorites')).body.data[2].name).toBe('Gamma');
});

test('validates IDs and authentication; missing hotels cannot be saved', async () => {
  const user = await createUser();
  expect((await request(app).get('/api/v1/favorites')).status).toBe(401);
  expect((await request(app).put('/api/v1/favorites/abc')).status).toBe(401);
  expect((await put('abc', user.token)).status).toBe(400);
  expect((await put('000000000000000000000001', user.token)).status).toBe(404);
  expect((await request(app).get('/api/v1/hotels/top-favorites')).body.data).toEqual([]);
});

test('hotel deletion removes favorites and the hotel disappears from ranking', async () => {
  const user = await createUser(), admin = await createAdmin(), h = await hotel('A');
  await put(h.id, user.token);
  expect((await request(app).delete(`/api/v1/hotels/${h.id}`).set(bearer(admin.token))).status).toBe(200);
  expect(await Favorite.countDocuments()).toBe(0);
  expect((await request(app).get('/api/v1/hotels/top-favorites')).body.count).toBe(0);
});
