const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

const validationSchemas = {
  mealPlan: (req) => {
    logger.debug('Validating meal plan request:', { body: req.body });
    const { name, age, gender, height, weight, activity, goal, dailyCalories, macroSplit } = req.body;
    const errors = [];

    if (!name || typeof name !== 'string') errors.push('Valid name is required');
    if (!age || typeof age !== 'number' || age < 1 || age > 120) errors.push('Age must be between 1 and 120');
    if (!gender || !['male', 'female', 'other'].includes(gender.toLowerCase())) {
      errors.push('Gender must be male, female, or other');
    }
    if (!height || typeof height !== 'number' || height < 50 || height > 300) {
      errors.push('Height must be between 50 and 300 cm');
    }
    if (!weight || typeof weight !== 'number' || weight < 20 || weight > 500) {
      errors.push('Weight must be between 20 and 500 kg');
    }
    if (!activity || !['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(activity.toLowerCase())) {
      errors.push('Invalid activity level');
    }
    if (!goal || !['weight_loss', 'weight_maintenance', 'weight_gain', 'muscle_gain'].includes(goal.toLowerCase())) {
      errors.push('Invalid goal');
    }
    if (!dailyCalories || typeof dailyCalories !== 'number' || dailyCalories < 500 || dailyCalories > 10000) {
      errors.push('Daily calories must be between 500 and 10000');
    }
    if (!macroSplit || typeof macroSplit !== 'string') errors.push('Macro split is required');

    if (errors.length > 0) {
      logger.warn('Validation failed:', { errors });
      throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
    }
    logger.info('Meal plan validation successful');
  },

  userId: (req) => {
    const { userId } = req.params;
    if (!userId || typeof userId !== 'string') {
      throw new AppError('Valid user ID is required', 400);
    }
  },

  mealPlanUpdate: (req) => {
    const { status } = req.body;
    if (status && !['active', 'completed', 'cancelled'].includes(status)) {
      throw new AppError('Invalid status value', 400);
    }
  },

  mealPlanId: (req) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      throw new AppError('Valid meal plan ID is required', 400);
    }
  },
};

/**
 * Middleware to validate request data based on schema type
 * @param {string} schemaType - Type of validation schema to use
 * @returns {Function} Express middleware function
 */
const validateRequest = (schemaType) => (req, res, next) => {
  logger.debug('Starting request validation:', { schemaType, path: req.path });
  try {
    const validator = validationSchemas[schemaType];
    if (!validator) {
      logger.error('Validation schema not found:', { schemaType });
      throw new AppError(`Validation schema '${schemaType}' not found`, 500);
    }
    validator(req);
    logger.debug('Validation completed successfully');
    next();
  } catch (error) {
    logger.error('Validation error:', { error: error.message, stack: error.stack });
    next(error);
  }
};

module.exports = { validateRequest }; 