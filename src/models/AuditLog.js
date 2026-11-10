const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, immutable: true, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  actorRole: { type: String, enum: ['user', 'admin'], required: true, immutable: true },
  action: { type: String, enum: ['BOOKING_UPDATED', 'BOOKING_DELETED'], required: true, immutable: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  reason: { type: String, enum: ['direct', 'hotel_deleted'], default: 'direct', immutable: true },
  before: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  after: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
}, { versionKey: false });
AuditLogSchema.index({ bookingId: 1, timestamp: -1 });
module.exports = mongoose.model('AuditLog', AuditLogSchema);
