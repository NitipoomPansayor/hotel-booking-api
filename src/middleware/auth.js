const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const getToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.token;
};

const protect = async (req, res, next) => {
  const token = getToken(req);
  if (!token || token === 'none') {
    throw new ApiError(401, 'Not authorized to access this route');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Not authorized to access this route');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'Not authorized to access this route');
  }

  req.user = user;
  next();
};

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `User role '${req.user.role}' is not authorized to access this route`);
    }
    next();
  };

module.exports = { protect, authorize };
