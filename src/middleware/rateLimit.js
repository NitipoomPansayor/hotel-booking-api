const { rateLimit } = require('express-rate-limit');

const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX = 100;

// RATE_LIMIT_MAX changes the per-client cap, e.g. raised in development for full Postman runs.
// A bad value stops startup instead of silently changing the protection.
const parseRateLimitMax = (value) => {
  if (value === undefined || value.trim() === '') return DEFAULT_MAX;
  const max = Number(value);
  if (!Number.isInteger(max) || max < 1) {
    throw new Error(`RATE_LIMIT_MAX must be a positive integer, got "${value}"`);
  }
  return max;
};

const createRateLimiter = (max = parseRateLimitMax(process.env.RATE_LIMIT_MAX)) =>
  rateLimit({ windowMs: WINDOW_MS, limit: max, standardHeaders: 'draft-8', legacyHeaders: false });

module.exports = { parseRateLimitMax, createRateLimiter, DEFAULT_MAX };
