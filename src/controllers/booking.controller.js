const bookingService = require('../services/booking.service');

const sendList = (res, { bookings, pagination }) => {
  res.status(200).json({ success: true, count: bookings.length, pagination, data: bookings });
};

// GET /api/v1/bookings (user: own, admin: all)
const getBookings = async (req, res) => {
  sendList(res, await bookingService.listBookings(req.user, req.query));
};

// GET /api/v1/hotels/:hotelId/bookings (admin)
const getHotelBookings = async (req, res) => {
  sendList(res, await bookingService.listBookings(req.user, req.query, req.params.hotelId));
};

// GET /api/v1/bookings/:id
const getBooking = async (req, res) => {
  const booking = await bookingService.getBooking(req.params.id, req.user);
  res.status(200).json({ success: true, data: booking });
};

// POST /api/v1/hotels/:hotelId/bookings
const createBooking = async (req, res) => {
  const booking = await bookingService.createBooking(req.params.hotelId, req.user, req.body ?? {});
  res.status(201).json({ success: true, data: booking });
};

// PUT /api/v1/bookings/:id
const updateBooking = async (req, res) => {
  const booking = await bookingService.updateBooking(req.params.id, req.user, req.body ?? {});
  res.status(200).json({ success: true, data: booking });
};

// DELETE /api/v1/bookings/:id
const deleteBooking = async (req, res) => {
  await bookingService.deleteBooking(req.params.id, req.user);
  res.status(200).json({ success: true, data: {} });
};

module.exports = { getBookings, getHotelBookings, getBooking, createBooking, updateBooking, deleteBooking };
