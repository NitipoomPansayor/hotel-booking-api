const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const audit = require('./audit.service');
const Hotel = require('../models/Hotel');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildPagination } = require('../utils/pagination');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NIGHTS = 3;

const isAdmin = (user) => user.role === 'admin';

// Admins also see who made each booking; users only ever see their own, so they get just the hotel.
const populateFor = (user) => {
  const paths = [{ path: 'hotel', select: 'name address tel' }];
  if (isAdmin(user)) paths.push({ path: 'user', select: 'name email tel' });
  return paths;
};

// Bookings are by calendar day, so drop the time of day and compare UTC midnights.
const utcMidnight = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const toUtcDay = (value, label) => {
  if (value === undefined || value === null || value === '') {
    throw new ApiError(400, `Please add a ${label}`);
  }
  const date = typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return utcMidnight(date);
};

const startOfTodayUtc = () => utcMidnight(new Date());

const validateStay = (checkInDate, checkOutDate) => {
  if (checkInDate < startOfTodayUtc()) {
    throw new ApiError(400, 'Check-in date cannot be in the past');
  }
  const nights = Math.round((checkOutDate - checkInDate) / DAY_MS);
  if (nights < 1) {
    throw new ApiError(400, 'Check-out date must be after check-in date');
  }
  if (nights > MAX_NIGHTS) {
    throw new ApiError(400, `Booking cannot exceed ${MAX_NIGHTS} nights`);
  }
};

const assertHotelExists = async (hotelId) => {
  if (!(await Hotel.exists({ _id: hotelId }))) {
    throw new ApiError(404, `Hotel not found with id ${hotelId}`);
  }
};

// Loads a booking and enforces confidentiality: only its owner or an admin may touch it.
const findAccessibleBooking = async (id, user, session = null) => {
  const booking = await Booking.findById(id).session(session);
  if (!booking) throw new ApiError(404, `Booking not found with id ${id}`);
  if (!isAdmin(user) && !booking.user.equals(user._id)) {
    throw new ApiError(403, 'Not authorized to access this booking');
  }
  return booking;
};

const listBookings = async (user, query, hotelId) => {
  const { page, limit, skip } = parsePagination(query);
  if (hotelId) await assertHotelExists(hotelId);

  const filter = isAdmin(user) ? {} : { user: user._id };
  if (hotelId) filter.hotel = hotelId;

  const [bookings, total] = await Promise.all([
    Booking.find(filter).sort({ checkInDate: 1 }).skip(skip).limit(limit).populate(populateFor(user)),
    Booking.countDocuments(filter),
  ]);

  return { bookings, pagination: buildPagination(page, limit, total) };
};

const getBooking = async (id, user) => {
  const booking = await findAccessibleBooking(id, user);
  return booking.populate(populateFor(user));
};

const createBooking = async (hotelId, user, input) => {
  const checkInDate = toUtcDay(input.checkInDate, 'check-in date');
  const checkOutDate = toUtcDay(input.checkOutDate, 'check-out date');
  validateStay(checkInDate, checkOutDate);
  await assertHotelExists(hotelId);

  // user comes from the token, never from the body
  const booking = await Booking.create({ user: user._id, hotel: hotelId, checkInDate, checkOutDate });
  return booking.populate(populateFor(user));
};

const updateBooking = async (id, user, input) => {
  await mongoose.connection.transaction(async (session) => {
    const booking = await findAccessibleBooking(id, user, session);
    const before = audit.snapshot(booking);

    const checkInDate =
      input.checkInDate === undefined ? booking.checkInDate : toUtcDay(input.checkInDate, 'check-in date');
    const checkOutDate =
      input.checkOutDate === undefined ? booking.checkOutDate : toUtcDay(input.checkOutDate, 'check-out date');
    validateStay(checkInDate, checkOutDate);

    // Only the dates are editable; user and hotel stay as they were.
    booking.set({ checkInDate, checkOutDate });
    await booking.save({ session });
    await audit.record(booking, user, 'BOOKING_UPDATED', before, session);
  });
  return getBooking(id, user);
};

const deleteBooking = async (id, user) => {
  await mongoose.connection.transaction(async (session) => {
    const booking = await findAccessibleBooking(id, user, session);
    await audit.record(booking, user, 'BOOKING_DELETED', audit.snapshot(booking), session);
    await booking.deleteOne({ session });
  });
};

module.exports = { listBookings, getBooking, createBooking, updateBooking, deleteBooking };
