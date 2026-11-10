const mongoose = require('mongoose');
const { TEL_REGEX } = require('../utils/validators');

const HotelSchema = new mongoose.Schema(
  {
    pricePerNightSatang: {
      type: Number,
      min: 0,
      validate: { validator: (value) => value == null || Number.isSafeInteger(value), message: 'Price must be a safe integer in satang' },
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Please add a hotel name'],
      unique: true,
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    address: {
      type: String,
      required: [true, 'Please add an address'],
      trim: true,
      maxlength: [300, 'Address cannot be more than 300 characters'],
    },
    tel: {
      type: String,
      required: [true, 'Please add a telephone number'],
      trim: true,
      match: [TEL_REGEX, 'Please add a valid telephone number'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Hotel', HotelSchema);
