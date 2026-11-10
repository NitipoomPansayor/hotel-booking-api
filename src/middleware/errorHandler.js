const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars -- Express needs 4 args to treat this as an error handler
const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Server error';

  if (err instanceof ApiError) {
    ({ statusCode, message } = err);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 400;
    message = `Duplicate value for field: ${Object.keys(err.keyValue || {}).join(', ')}`;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON body';
  } else if (err.status && err.status < 500) {
    statusCode = err.status;
    message = err.message;
  }

  if (statusCode === 500 && process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  res.status(statusCode).json({ success: false, message });
};

module.exports = { notFound, errorHandler };
