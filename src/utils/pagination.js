const ApiError = require('./ApiError');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const parsePositiveInt = (value, fallback, name) => {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  return n;
};

const parsePagination = (query) => {
  const page = parsePositiveInt(query.page, 1, 'page');
  const limit = Math.min(parsePositiveInt(query.limit, DEFAULT_LIMIT, 'limit'), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
};

const buildPagination = (page, limit, total) => ({ page, limit, total, pages: Math.ceil(total / limit) });

module.exports = { parsePagination, buildPagination };
