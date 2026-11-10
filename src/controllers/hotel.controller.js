const hotelService = require('../services/hotel.service');

// GET /api/v1/hotels
const getHotels = async (req, res) => {
  const { hotels, pagination } = await hotelService.listHotels(req.query);
  res.status(200).json({ success: true, count: hotels.length, pagination, data: hotels });
};

// GET /api/v1/hotels/:id
const getHotel = async (req, res) => {
  const hotel = await hotelService.getHotel(req.params.id);
  res.status(200).json({ success: true, data: hotel });
};

// POST /api/v1/hotels (admin)
const createHotel = async (req, res) => {
  const hotel = await hotelService.createHotel(req.body ?? {});
  res.status(201).json({ success: true, data: hotel });
};

// PUT /api/v1/hotels/:id (admin)
const updateHotel = async (req, res) => {
  const hotel = await hotelService.updateHotel(req.params.id, req.body ?? {});
  res.status(200).json({ success: true, data: hotel });
};

// DELETE /api/v1/hotels/:id (admin)
const deleteHotel = async (req, res) => {
  await hotelService.deleteHotel(req.params.id);
  res.status(200).json({ success: true, data: {} });
};

module.exports = { getHotels, getHotel, createHotel, updateHotel, deleteHotel };
