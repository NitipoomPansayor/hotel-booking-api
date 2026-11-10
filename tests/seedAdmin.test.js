const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const ApiError = require('../src/utils/ApiError');
const { seedAdmin } = require('../src/services/user.service');
const db = require('./helpers/db');
const { createUser } = require('./helpers/auth');

const adminInput = {
  name: 'Site Admin',
  tel: '0800000000',
  email: 'admin@example.com',
  password: 'admin123',
};

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('seedAdmin', () => {
  it('creates an admin account with a hashed password', async () => {
    const { user, action } = await seedAdmin(adminInput);

    expect(action).toBe('created');
    expect(user.role).toBe('admin');

    const saved = await User.findById(user._id).select('+password');
    expect(saved.password).not.toBe(adminInput.password);
    expect(await saved.matchPassword(adminInput.password)).toBe(true);
  });

  it('promotes an existing user and leaves their name, tel and password alone', async () => {
    const { user: existing } = await createUser({ email: adminInput.email, password: 'original1' });

    const { action } = await seedAdmin({ ...adminInput, name: 'Other', tel: '0899999999', password: 'changed1' });

    expect(action).toBe('promoted');
    const saved = await User.findById(existing._id).select('+password');
    expect(saved.role).toBe('admin');
    expect(saved.name).toBe(existing.name);
    expect(saved.tel).toBe(existing.tel);
    expect(await saved.matchPassword('original1')).toBe(true);
    expect(await saved.matchPassword('changed1')).toBe(false);
  });

  it('does nothing when the account is already an admin', async () => {
    await seedAdmin(adminInput);

    const { action } = await seedAdmin(adminInput);

    expect(action).toBe('unchanged');
    expect(await User.countDocuments()).toBe(1);
  });

  it('matches the email case-insensitively', async () => {
    await createUser({ email: adminInput.email });

    const { action } = await seedAdmin({ ...adminInput, email: '  ADMIN@Example.com ' });

    expect(action).toBe('promoted');
    expect(await User.countDocuments()).toBe(1);
  });

  it.each([undefined, '', '   '])('rejects a missing email (%p)', async (email) => {
    await expect(seedAdmin({ ...adminInput, email })).rejects.toEqual(new ApiError(400, 'ADMIN_EMAIL is required'));
  });

  it('fails schema validation for a new account without a password', async () => {
    await expect(seedAdmin({ ...adminInput, password: undefined })).rejects.toMatchObject({
      name: 'ValidationError',
    });
    expect(await User.countDocuments()).toBe(0);
  });

  it('fails schema validation for a new account with an invalid tel', async () => {
    await expect(seedAdmin({ ...adminInput, tel: 'abc' })).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('gives an account that can log in and use admin routes', async () => {
    await seedAdmin(adminInput);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminInput.email, password: adminInput.password });
    expect(login.status).toBe(200);

    const res = await request(app)
      .post('/api/v1/hotels')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Seeded Admin Hotel', address: '1 Rama I Rd, Bangkok', tel: '021234567' });
    expect(res.status).toBe(201);
  });
});
