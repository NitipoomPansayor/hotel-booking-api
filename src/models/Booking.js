const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },
    checkInDate: {
      type: Date,
      required: [true, 'Please add a check-in date'],
    },
    checkOutDate: {
      type: Date,
      required: [true, 'Please add a check-out date'],
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

BookingSchema.index({ createdAt: 1, _id: 1 });
module.exports = mongoose.model('Booking', BookingSchema);
