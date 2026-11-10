const express = require('express');
const {
  getHotels,
  getHotel,
  createHotel,
  updateHotel,
  deleteHotel,
} = require('../controllers/hotel.controller');
const { getHotelBookings, createBooking } = require('../controllers/booking.controller');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.get('/top-favorites', require('../controllers/favorite.controller').topFavorites);

router.route('/').get(getHotels).post(protect, authorize('admin'), createHotel);

router
  .route('/:id')
  .get(getHotel)
  .put(protect, authorize('admin'), updateHotel)
  .delete(protect, authorize('admin'), deleteHotel);

router
  .route('/:hotelId/bookings')
  .get(protect, authorize('admin'), getHotelBookings)
  .post(protect, createBooking);

module.exports = router;
