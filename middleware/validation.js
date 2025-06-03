const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Validation constants
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GENDERS = ['male', 'female', 'other'];
const GOALS = ['weight_loss', 'weight_maintenance', 'weight_gain', 'muscle_gain'];
const STATUSES = ['active', 'completed', 'cancelled'];

// Helper function to parse macro split string
const parseMacroSplit = (macroSplit) => {
    if (typeof macroSplit === 'string') {
        const parts = macroSplit.split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) {
            throw new Error('Macro split string must be in format "protein-carbs-fat" with numbers');
        }
        return {
            protein: parts[0],
            carbs: parts[1],
            fat: parts[2]
        };
    }
    return macroSplit;
};

// Validation schemas
const validationSchemas = {
    mealPlan: (req) => {
        logger.debug('Validating meal plan request:', { body: req.body });
        const { name, age, gender, height, weight, activity, goal, dailyCalories, macroSplit } = req.body;
        const errors = [];

        // Name validation
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            errors.push('Name must be a string with at least 2 characters');
        }

        // Age validation
        if (!age || typeof age !== 'number' || age < 1 || age > 120) {
            errors.push('Age must be between 1 and 120');
        }

        // Gender validation
        if (!gender || !GENDERS.includes(gender.toLowerCase())) {
            errors.push(`Gender must be one of: ${GENDERS.join(', ')}`);
        }

        // Height validation
        if (!height || typeof height !== 'number' || height < 50 || height > 300) {
            errors.push('Height must be between 50 and 300 cm');
        }

        // Weight validation
        if (!weight || typeof weight !== 'number' || weight < 20 || weight > 500) {
            errors.push('Weight must be between 20 and 500 kg');
        }

        // Activity level validation
        if (!activity || !ACTIVITY_LEVELS.includes(activity.toLowerCase())) {
            errors.push(`Activity level must be one of: ${ACTIVITY_LEVELS.join(', ')}`);
        }

        // Goal validation
        if (!goal || !GOALS.includes(goal.toLowerCase())) {
            errors.push(`Goal must be one of: ${GOALS.join(', ')}`);
        }

        // Daily calories validation
        if (!dailyCalories || typeof dailyCalories !== 'number' || dailyCalories < 500 || dailyCalories > 10000) {
            errors.push('Daily calories must be between 500 and 10000');
        }

        // Macro split validation
        if (!macroSplit) {
            errors.push('Macro split is required');
        } else {
            try {
                const parsedMacroSplit = parseMacroSplit(macroSplit);
                const { protein, carbs, fat } = parsedMacroSplit;

                if (typeof protein !== 'number' || protein < 0 || protein > 100) {
                    errors.push('Protein percentage must be between 0 and 100');
                }
                if (typeof carbs !== 'number' || carbs < 0 || carbs > 100) {
                    errors.push('Carbs percentage must be between 0 and 100');
                }
                if (typeof fat !== 'number' || fat < 0 || fat > 100) {
                    errors.push('Fat percentage must be between 0 and 100');
                }
                if (protein + carbs + fat !== 100) {
                    errors.push('Macro split percentages must sum to 100');
                }

                // Update the request body with parsed macro split
                req.body.macroSplit = parsedMacroSplit;
            } catch (error) {
                errors.push(error.message);
            }
        }

        if (errors.length > 0) {
            logger.warn('Validation failed:', { errors });
            throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
        }

        // Sanitize input
        req.body = {
            ...req.body,
            name: name.trim(),
            gender: gender.toLowerCase(),
            activity: activity.toLowerCase(),
            goal: goal.toLowerCase()
        };

        logger.info('Meal plan validation successful');
    },

    userId: (req) => {
        const { userId } = req.params;
        if (!userId || typeof userId !== 'string') {
            throw new AppError('Valid user ID is required', 400);
        }
    },

    mealPlanUpdate: (req) => {
        const { status, name, dailyCalories, macroSplit } = req.body;
        const errors = [];

        // Status validation
        if (status && !STATUSES.includes(status)) {
            errors.push(`Status must be one of: ${STATUSES.join(', ')}`);
        }

        // Name validation (if provided)
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length < 2) {
                errors.push('Name must be a string with at least 2 characters');
            }
        }

        // Daily calories validation (if provided)
        if (dailyCalories !== undefined) {
            if (typeof dailyCalories !== 'number' || dailyCalories < 500 || dailyCalories > 10000) {
                errors.push('Daily calories must be between 500 and 10000');
            }
        }

        // Macro split validation (if provided)
        if (macroSplit !== undefined) {
            if (typeof macroSplit !== 'object') {
                errors.push('Macro split must be an object');
            } else {
                const { protein, carbs, fat } = macroSplit;
                if (typeof protein !== 'number' || protein < 0 || protein > 100) {
                    errors.push('Protein percentage must be between 0 and 100');
                }
                if (typeof carbs !== 'number' || carbs < 0 || carbs > 100) {
                    errors.push('Carbs percentage must be between 0 and 100');
                }
                if (typeof fat !== 'number' || fat < 0 || fat > 100) {
                    errors.push('Fat percentage must be between 0 and 100');
                }
                if (protein + carbs + fat !== 100) {
                    errors.push('Macro split percentages must sum to 100');
                }
            }
        }

        if (errors.length > 0) {
            logger.warn('Validation failed:', { errors });
            throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
        }

        // Sanitize input
        if (name) {
            req.body.name = name.trim();
        }

        logger.info('Meal plan update validation successful');
    },

    mealPlanId: (req) => {
        const { id } = req.params;
        if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
            throw new AppError('Valid meal plan ID is required (24 character hex string)', 400);
        }
    }
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
        logger.error('Validation error:', {
            requestId: req.requestId,
            error: error.message,
            stack: error.stack
        });
        next(error);
    }
};

module.exports = { validateRequest }; 