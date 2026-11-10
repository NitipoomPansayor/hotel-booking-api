const User = require('../../src/models/User');

let counter = 0;

// Creates a user directly in the DB (bypassing /register so admins can be made) and returns it with a JWT.
const createUser = async (overrides = {}) => {
  counter += 1;
  const user = await User.create({
    name: `User ${counter}`,
    tel: '0812345678',
    email: `user${counter}@example.com`,
    password: 'secret123',
    ...overrides,
  });
  return { user, token: user.getSignedJwtToken() };
};

const createAdmin = (overrides = {}) => createUser({ role: 'admin', ...overrides });

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { createUser, createAdmin, bearer };
