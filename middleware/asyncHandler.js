const logger = require('../utils/logger');

/**
 * Wraps an async route handler to catch errors and pass them to the error handling middleware
 * @param {Function} fn - The async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            logger.error('Async handler error:', {
                requestId: req.requestId,
                error: error.message,
                stack: error.stack
            });

            // If error has a status code, use it, otherwise default to 500
            const statusCode = error.statusCode || 500;
            
            // If error has a message, use it, otherwise use a default message
            const message = error.message || 'Internal server error';

            res.status(statusCode).json({
                status: 'error',
                message,
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            });
        });
    };
};

module.exports = {
    asyncHandler
}; 