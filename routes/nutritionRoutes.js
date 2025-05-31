const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');

// Route to get nutrition data for a food description
router.post('/analyze', nutritionController.getNutritionData);

// Route to get nutrition data for multiple ingredients
router.post('/analyze-batch', nutritionController.getBatchNutritionData);

// Route to clear nutrition cache (for testing/admin purposes)
router.post('/clear-cache', nutritionController.clearNutritionCache);

module.exports = router;