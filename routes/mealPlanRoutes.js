const express = require('express');
const router = express.Router();
const MealPlanController = require('../controllers/mealPlanController');
const { validateRequest } = require('../middleware/validation');
const logger = require('../utils/logger');

router.use((req, res, next) => {
  const start = Date.now();
  logger.info('Incoming request:', {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.method === 'POST' || req.method === 'PATCH' ? req.body : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed:', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
});

// Generate new meal plan
router.post('/', validateRequest('mealPlan'), (req, res, next) => {
  logger.debug('Route handler: generatePlan');
  MealPlanController.generatePlan(req, res, next);
});

// Get current active meal plan
router.get('/current', (req, res, next) => {
  logger.debug('Route handler: getCurrentPlan');
  MealPlanController.getCurrentPlan(req, res, next);
});

// Update meal plan
router.patch('/:id', validateRequest('mealPlanUpdate'), (req, res, next) => {
  logger.debug('Route handler: updatePlan');
  MealPlanController.updatePlan(req, res, next);
});

// Delete meal plan
router.delete('/:id', (req, res, next) => {
  logger.debug('Route handler: deletePlan');
  MealPlanController.deletePlan(req, res, next);
});

router.use((err, req, res, next) => {
  logger.error('Route error:', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500
  });
  next(err);
});

module.exports = router;