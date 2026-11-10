const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const csvCell = (value) => {
  let text = String(value ?? '');
  // Protect spreadsheet consumers, including formulas hidden behind whitespace.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const csvRow = (values) => values.map(csvCell).join(',');

const monthRange = ({ year, month }) => {
  if (typeof year !== 'string' || !/^\d{4}$/.test(year) || Number(year) < 2000 ||
      typeof month !== 'string' || !/^(0?[1-9]|1[0-2])$/.test(month)) {
    throw new ApiError(400, 'Provide year (2000-9999) and month (1-12)');
  }
  const y = Number(year), m = Number(month);
  // Bangkok is UTC+07:00. Half-open interval includes every instant of this month.
  return { start: new Date(Date.UTC(y, m - 1, 1) - 7 * 3600000),
    end: new Date(Date.UTC(y, m, 1) - 7 * 3600000), label: `${year}-${String(m).padStart(2, '0')}` };
};

const monthlyBookings = async (query) => {
  const { start, end, label } = monthRange(query);
  const bookings = Booking.find({ createdAt: mongoose.trusted({ $gte: start, $lt: end }) })
    .sort({ createdAt: 1, _id: 1 })
    .populate('user', 'name email').populate('hotel', 'name').lean().cursor();
  const rows = [csvRow(['recordType', 'bookingId', 'userName', 'userEmail', 'hotelName',
    'checkInDate', 'checkOutDate', 'nights', 'createdAt', 'totalBookings', 'totalNights'])];
  let totalBookings = 0, totalNights = 0;
  for await (const booking of bookings) {
    const nights = Math.round((booking.checkOutDate - booking.checkInDate) / 864e5);
    totalBookings += 1;
    totalNights += nights;
    rows.push(csvRow(['booking', booking._id, booking.user?.name, booking.user?.email,
      booking.hotel?.name, booking.checkInDate.toISOString().slice(0, 10),
      booking.checkOutDate.toISOString().slice(0, 10), nights, booking.createdAt.toISOString(), '', '']));
  }
  rows.push(csvRow(['summary', '', '', '', '', '', '', '', '', totalBookings, totalNights]));
  return { filename: `bookings-${label}.csv`, csv: '\uFEFF' + rows.join('\r\n') + '\r\n' };
};

module.exports = { monthlyBookings, csvCell, monthRange };
