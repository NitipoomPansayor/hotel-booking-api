const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const register = ({ name, tel, email, password }) =>
  // role is deliberately not read from input: every new account is a plain user
  User.create({ name, tel, email, password });

const login = async ({ email, password }) => {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new ApiError(400, 'Please provide an email and password');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new ApiError(401, 'Invalid credentials');
  }
  return user;
};

module.exports = { register, login };
