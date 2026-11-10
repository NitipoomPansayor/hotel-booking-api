const Favorite = require('../models/Favorite');
const Hotel = require('../models/Hotel');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildPagination } = require('../utils/pagination');

const addFavorite = async (userId, hotelId) => {
  if (!(await Hotel.exists({ _id: hotelId }))) throw new ApiError(404, 'Hotel not found');
  try {
    return await Favorite.findOneAndUpdate({ user: userId, hotel: hotelId }, { $setOnInsert: { user: userId, hotel: hotelId } },
      { upsert: true, returnDocument: 'after', runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Favorite.findOne({ user: userId, hotel: hotelId });
  }
};
const removeFavorite = (userId, hotelId) => Favorite.deleteOne({ user: userId, hotel: hotelId });

const listFavorites = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const [favorites, total] = await Promise.all([
    Favorite.find({ user: userId }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate('hotel'),
    Favorite.countDocuments({ user: userId }),
  ]);
  return { hotels: favorites.map((favorite) => favorite.hotel).filter(Boolean), pagination: buildPagination(page, limit, total) };
};

const topFavorites = () => Favorite.aggregate([
  { $group: { _id: '$hotel', favoriteCount: { $sum: 1 } } },
  { $lookup: { from: Hotel.collection.name, localField: '_id', foreignField: '_id', as: 'hotel' } },
  { $unwind: '$hotel' },
  { $sort: { favoriteCount: -1, 'hotel.name': 1, _id: 1 } },
  { $limit: 3 },
  { $replaceRoot: { newRoot: { $mergeObjects: ['$hotel', { favoriteCount: '$favoriteCount' }] } } },
  { $project: { __v: 0 } },
]);
module.exports = { addFavorite, removeFavorite, listFavorites, topFavorites };
