const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
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

const deleteHotel = async (id) => {
  const hotel = await Hotel.findByIdAndDelete(id);
  if (!hotel) throw new ApiError(404, `Hotel not found with id ${id}`);
  await Booking.deleteMany({ hotel: hotel._id });
};

module.exports = { listHotels, getHotel, createHotel, updateHotel, deleteHotel };
