const logger = require('../utils/logger');

/**
 * Custom application error class
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Handle Sequelize validation errors
 */
const handleSequelizeValidationError = (err) => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

/**
 * Handle Sequelize unique constraint errors
 */
const handleSequelizeUniqueConstraintError = (err) => {
    const message = `Duplicate field value: ${err.errors[0].value}. Please use another value.`;
    return new AppError(message, 400);
};

/**
 * Handle Sequelize foreign key constraint errors
 */
const handleSequelizeForeignKeyConstraintError = (err) => {
    const message = 'Invalid reference: The referenced record does not exist.';
    return new AppError(message, 400);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);

/**
 * Handle JWT expired errors
 */
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

/**
 * Main error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    err.timestamp = err.timestamp || new Date().toISOString();

    // Log error details
    logger.error('Error occurred:', {
        requestId: req.requestId,
        timestamp: err.timestamp,
        statusCode: err.statusCode,
        status: err.status,
        message: err.message,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Handle specific error types
    let error = err;
    if (err.name === 'SequelizeValidationError') error = handleSequelizeValidationError(err);
    if (err.name === 'SequelizeUniqueConstraintError') error = handleSequelizeUniqueConstraintError(err);
    if (err.name === 'SequelizeForeignKeyConstraintError') error = handleSequelizeForeignKeyConstraintError(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // Send error response
    if (process.env.NODE_ENV === 'development') {
        res.status(error.statusCode).json({
            status: error.status,
            error: error,
            message: error.message,
            stack: error.stack,
            timestamp: error.timestamp
        });
    } else {
        // Production mode
        if (error.isOperational) {
            res.status(error.statusCode).json({
                status: error.status,
                message: error.message,
                timestamp: error.timestamp
            });
        } else {
            // Programming or unknown errors
            res.status(500).json({
                status: 'error',
                message: 'Something went wrong',
                timestamp: error.timestamp
            });
        }
    }
};

module.exports = {
    AppError,
    errorHandler
}; 