const AuditLog = require('../models/AuditLog');

// Snapshot booking fields only; never copy token, credentials or request bodies.
const snapshot = (booking) => ({
  user: booking.user, hotel: booking.hotel,
  checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate,
  createdAt: booking.createdAt, updatedAt: booking.updatedAt,
});

const record = (booking, actor, action, before, session, reason = 'direct') => AuditLog.create([{
  actorId: actor._id, actorRole: actor.role, action, bookingId: booking._id, reason, before,
  after: action === 'BOOKING_UPDATED' ? snapshot(booking) : null,
}], { session });

module.exports = { snapshot, record };
