const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const audit = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildPagination } = require('../utils/pagination');

const EDITABLE_FIELDS = ['name', 'address', 'tel', 'pricePerNightSatang'];

// Only copy whitelisted fields that were actually sent, so clients can't set _id, timestamps, etc.
const pickEditable = (input) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));

const listHotels = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const [hotels, total] = await Promise.all([
    Hotel.find().sort({ name: 1 }).skip(skip).limit(limit),
    Hotel.countDocuments(),
  ]);

  return { hotels, pagination: buildPagination(page, limit, total) };
};

const getHotel = async (id) => {
  const hotel = await Hotel.findById(id);
  if (!hotel) throw new ApiError(404, `Hotel not found with id ${id}`);
  return hotel;
};

const createHotel = (input) => Hotel.create(pickEditable(input));

const updateHotel = async (id, input) => {
  const hotel = await Hotel.findByIdAndUpdate(id, pickEditable(input), {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!hotel) throw new ApiError(404, `Hotel not found with id ${id}`);
  return hotel;
};

const deleteHotel = async (id, actor) => {
  await mongoose.connection.transaction(async (session) => {
    const hotel = await Hotel.findByIdAndDelete(id, { session });
    if (!hotel) throw new ApiError(404, `Hotel not found with id ${id}`);
    const bookings = Booking.find({ hotel: hotel._id }).session(session).cursor();
    for await (const booking of bookings) {
      await audit.record(booking, actor, 'BOOKING_DELETED', audit.snapshot(booking), session, 'hotel_deleted');
    }
    await Booking.deleteMany({ hotel: hotel._id }, { session });
  });
};

module.exports = { listHotels, getHotel, createHotel, updateHotel, deleteHotel };
