const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const db = require('./helpers/db');

const validUser = {
  name: 'Alice',
  tel: '0812345678',
  email: 'alice@example.com',
  password: 'secret123',
};

const register = (body = validUser) => request(app).post('/api/v1/auth/register').send(body);
const login = (body) => request(app).post('/api/v1/auth/login').send(body);

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('POST /api/v1/auth/register', () => {
  it('creates a user and returns a token without the password', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.data).toMatchObject({ name: 'Alice', tel: '0812345678', email: 'alice@example.com', role: 'user' });
    expect(res.body.data.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^token=.+HttpOnly/);
  });

  it('stores the password hashed', async () => {
    await register();
    const stored = await User.findOne({ email: validUser.email }).select('+password');
    expect(stored.password).not.toBe(validUser.password);
    expect(await stored.matchPassword(validUser.password)).toBe(true);
  });

  it('ignores a role sent in the body', async () => {
    const res = await register({ ...validUser, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('user');
  });

  it.each(['name', 'tel', 'email', 'password'])('returns 400 when %s is missing', async (field) => {
    const body = { ...validUser };
    delete body[field];
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an invalid email', async () => {
    const res = await register({ ...validUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a password shorter than 6 characters', async () => {
    const res = await register({ ...validUser, password: '12345' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid telephone number', async () => {
    const res = await register({ ...validUser, tel: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a duplicate email (case-insensitive)', async () => {
    await register();
    const res = await register({ ...validUser, email: 'ALICE@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => register());

  it('logs in with valid credentials', async () => {
    const res = await login({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.data.email).toBe(validUser.email);
    expect(res.body.data.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^token=/);
  });

  it('accepts the email in any case', async () => {
    const res = await login({ email: 'Alice@Example.com', password: validUser.password });
    expect(res.status).toBe(200);
  });

  it('returns 401 for a wrong password', async () => {
    const res = await login({ email: validUser.email, password: 'wrong-pass' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 for an unknown email', async () => {
    const res = await login({ email: 'nobody@example.com', password: validUser.password });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 400 when email or password is missing', async () => {
    expect((await login({ email: validUser.email })).status).toBe(400);
    expect((await login({ password: validUser.password })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/login')).status).toBe(400);
  });

  it('rejects NoSQL operator injection', async () => {
    const res = await login({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the current user with a Bearer token', async () => {
    const { body } = await register();
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(validUser.email);
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns the current user with the token cookie', async () => {
    const { body } = await register();
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `token=${body.token}`);
    expect(res.status).toBe(200);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the user no longer exists', async () => {
    const { body } = await register();
    await User.deleteMany({});
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/logout', () => {
  it('clears the token cookie', async () => {
    const { body } = await register();
    const res = await request(app).get('/api/v1/auth/logout').set('Cookie', `token=${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie'][0]).toMatch(/^token=;.*Expires=Thu, 01 Jan 1970/);
  });

  it('returns 401 when not logged in', async () => {
    const res = await request(app).get('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('unknown routes', () => {
  it('returns 404 JSON', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
