const authService = require('../services/auth.service');

const DAY_MS = 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  expires: new Date(Date.now() + Number(process.env.JWT_COOKIE_EXPIRE || 30) * DAY_MS),
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
});

const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  res.status(statusCode).cookie('token', token, cookieOptions()).json({
    success: true,
    token,
    data: user,
  });
};

// POST /api/v1/auth/register
const register = async (req, res) => {
  const user = await authService.register(req.body ?? {});
  sendTokenResponse(user, 201, res);
};

// POST /api/v1/auth/login
const login = async (req, res) => {
  const user = await authService.login(req.body ?? {});
  sendTokenResponse(user, 200, res);
};

// GET /api/v1/auth/logout
const logout = (req, res) => {
  res
    .clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
    .status(200)
    .json({ success: true, data: {} });
};

// GET /api/v1/auth/me
const getMe = (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

module.exports = { register, login, logout, getMe };
