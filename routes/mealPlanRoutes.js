const express = require('express');
const router = express.Router();
const MealPlanController = require('../controllers/mealPlanController');
const { validateRequest } = require('../middleware/validation');
const { cache } = require('../middleware/cache');
const { asyncHandler } = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// Request logging middleware
router.use((req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
    req.requestId = requestId;

    // Log request details (excluding sensitive data)
    logger.info('Incoming request:', {
        service: 'meal-generator',
        requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.method === 'POST' || req.method === 'PATCH' ? {
            ...req.body,
            // Exclude sensitive data from logs
            password: req.body.password ? '[REDACTED]' : undefined,
            token: req.body.token ? '[REDACTED]' : undefined
        } : undefined,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    // Log response details
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('Request completed:', {
            service: 'meal-generator',
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`
        });
    });

    next();
});

// Generate new meal plan
router.post('/',
    validateRequest('mealPlan'),
    asyncHandler(async (req, res) => {
        const result = await MealPlanController.generatePlan(req, res);
        res.status(201).json(result);
    })
);

// Get current active meal plan
router.get('/current',
    cache('meal-plan-current', 300), // Cache for 5 minutes
    asyncHandler(async (req, res) => {
        const result = await MealPlanController.getCurrentPlan(req, res);
        res.status(200).json(result);
    })
);

// Get meal plan by ID
router.get('/:id',
    validateRequest('mealPlanId'),
    cache('meal-plan', 300), // Cache for 5 minutes
    asyncHandler(async (req, res) => {
        const result = await MealPlanController.getPlanById(req, res);
        res.status(200).json(result);
    })
);

// Update meal plan
router.patch('/:id',
    validateRequest('mealPlanUpdate'),
    asyncHandler(async (req, res) => {
        const result = await MealPlanController.updatePlan(req, res);
        res.status(200).json(result);
    })
);

// Delete meal plan
router.delete('/:id',
    validateRequest('mealPlanId'),
    asyncHandler(async (req, res) => {
        const result = await MealPlanController.deletePlan(req, res);
        res.status(204).send();
    })
);

// Error handling middleware
router.use((err, req, res, next) => {
    // Log error details
    logger.error('Route error:', {
        service: 'meal-generator',
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        statusCode: err.statusCode || 500,
        body: req.body
    });

    // Determine if error is operational (expected) or programming (unexpected)
    const isOperational = err instanceof AppError;
    const statusCode = err.statusCode || 500;

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: {
            message: isOperational ? err.message : 'An unexpected error occurred',
            code: err.code || 'INTERNAL_SERVER_ERROR',
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                details: err.details
            })
        }
    });
});

module.exports = router;