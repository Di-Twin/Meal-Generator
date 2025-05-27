const express = require('express');
const router = express.Router();
const MealPlanController = require('../controllers/mealPlanController');
const authMiddleware = require('../../../middleware/auth');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Generate new meal plan
router.post('/generate', MealPlanController.generateMealPlan);

// Get current active meal plan
router.get('/current', MealPlanController.getMealPlan);

module.exports = router; 