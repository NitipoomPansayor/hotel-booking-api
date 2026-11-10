const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { monthlyBookings } = require('../controllers/report.controller');
router.get('/bookings/monthly', protect, authorize('admin'), monthlyBookings);
module.exports = router;
