const express = require('express');
const { getBookings, getBooking, updateBooking, deleteBooking } = require('../controllers/booking.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getBookings);

router.route('/:id').get(getBooking).put(updateBooking).delete(deleteBooking);

module.exports = router;
