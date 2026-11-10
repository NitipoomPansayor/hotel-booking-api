const Hotel = require('../models/Hotel');
const ApiError = require('../utils/ApiError');

const EDITABLE_FIELDS = ['name', 'address', 'tel'];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// Only copy whitelisted fields that were actually sent, so clients can't set _id, timestamps, etc.
const pickEditable = (input) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));

const parsePositiveInt = (value, fallback, name) => {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  return n;
};

const listHotels = async (query) => {
  const page = parsePositiveInt(query.page, 1, 'page');
  const limit = Math.min(parsePositiveInt(query.limit, DEFAULT_LIMIT, 'limit'), MAX_LIMIT);

  const [hotels, total] = await Promise.all([
    Hotel.find()
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Hotel.countDocuments(),
  ]);

  return { hotels, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
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
};

module.exports = { listHotels, getHotel, createHotel, updateHotel, deleteHotel };
