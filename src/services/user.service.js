const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// Creates the admin account, or promotes an existing account to admin. Safe to run repeatedly.
// An existing account keeps its name, tel and password, so seeding can't take over someone's login.
const seedAdmin = async ({ name, tel, email, password }) => {
  if (typeof email !== 'string' || !email.trim()) {
    throw new ApiError(400, 'ADMIN_EMAIL is required');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });

  if (!existing) {
    const user = await User.create({ name, tel, email, password, role: 'admin' });
    return { user, action: 'created' };
  }

  if (existing.role === 'admin') {
    return { user: existing, action: 'unchanged' };
  }

  existing.role = 'admin';
  await existing.save();
  return { user: existing, action: 'promoted' };
};

module.exports = { seedAdmin };
