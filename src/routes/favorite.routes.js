const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { listFavorites, addFavorite, removeFavorite } = require('../controllers/favorite.controller');
router.use(protect);
router.get('/', listFavorites);
router.route('/:hotelId').put(addFavorite).delete(removeFavorite);
module.exports = router;
