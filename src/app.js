const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const hotelRoutes = require('./routes/hotel.routes');
const bookingRoutes = require('./routes/booking.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Strip query selectors like { $gt: '' } from filters built from user input (NoSQL injection)
mongoose.set('sanitizeFilter', true);

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimit({ windowMs: 10 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
}

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/hotels', hotelRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/reports', require('./routes/report.routes'));
app.use('/api/v1/favorites', require('./routes/favorite.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
