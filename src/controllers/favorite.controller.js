const favoriteService = require('../services/favorite.service');
const { priceHotels } = require('../services/currency.service');

const listFavorites = async (req, res) => {
  const { hotels, pagination } = await favoriteService.listFavorites(req.user._id, req.query);
  res.json({ success: true, count: hotels.length, pagination, data: await priceHotels(hotels, req.query.currency) });
};
const addFavorite = async (req, res) => {
  const favorite = await favoriteService.addFavorite(req.user._id, req.params.hotelId);
  res.json({ success: true, data: favorite });
};
const removeFavorite = async (req, res) => {
  await favoriteService.removeFavorite(req.user._id, req.params.hotelId);
  res.json({ success: true, data: {} });
};
const topFavorites = async (req, res) => {
  const hotels = await priceHotels(await favoriteService.topFavorites(), req.query.currency);
  res.json({ success: true, count: hotels.length, data: hotels });
};
module.exports = { listFavorites, addFavorite, removeFavorite, topFavorites };
