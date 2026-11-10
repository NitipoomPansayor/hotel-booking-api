const mongoose = require('mongoose');
const FavoriteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
}, { timestamps: true, versionKey: false });
FavoriteSchema.index({ user: 1, hotel: 1 }, { unique: true });
module.exports = mongoose.model('Favorite', FavoriteSchema);
