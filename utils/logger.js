const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// ANSI color codes for terminal colors
const colors = {
    error: '\x1b[31m', // Red
    warn: '\x1b[33m',  // Yellow
    info: '\x1b[36m',  // Cyan
    debug: '\x1b[35m', // Magenta
    http: '\x1b[32m',  // Green
    success: '\x1b[32m', // Green
    performance: '\x1b[34m', // Blue
    reset: '\x1b[0m'   // Reset
};

// Custom emojis for different log levels
const emojis = {
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    debug: '🔍',
    http: '🌐',
    success: '✅',
    performance: '⚡'
};

// Custom format function
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    const emoji = emojis[level] || '';
    const color = colors[level] || colors.info;
    const reset = colors.reset;
    
    // Format timestamp with timezone
    const formattedTimestamp = new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    });

    // Clean and format metadata
    let metadataStr = '';
    if (metadata && Object.keys(metadata).length > 0) {
        // Remove nested metadata and empty values
        const cleanMetadata = Object.entries(metadata).reduce((acc, [key, value]) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                // If value is an object with metadata property, use that instead
                if (value.metadata) {
                    Object.assign(acc, value.metadata);
                } else {
                    acc[key] = value;
                }
            } else if (value !== undefined && value !== null && value !== '') {
                acc[key] = value;
            }
            return acc;
        }, {});

        if (Object.keys(cleanMetadata).length > 0) {
            metadataStr = '\n' + JSON.stringify(cleanMetadata, null, 2);
        }
    }

    return `${color}[${formattedTimestamp}] ${emoji}  ${level.toUpperCase()}: ${message}${metadataStr}${reset}`;
});

// Create the logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
        customFormat
    ),
    transports: [
        // Write all logs to daily rotated files
        new winston.transports.DailyRotateFile({
            filename: path.join(logsDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        // Write error logs to a separate file
        new winston.transports.DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
            customFormat
        )
    }));
}

// Create a stream object for Morgan
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    }
};

// Helper methods for different types of logging
logger.logError = (message, error) => {
    logger.error(message, {
        error: error.message,
        stack: error.stack,
        ...error
    });
};

logger.logSuccess = (message, data) => {
    logger.info(message, data);
};

logger.logHttp = (req, res, duration) => {
    const metadata = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
    };
    logger.http(`${req.method} ${req.url}`, metadata);
};

logger.logDatabase = (operation, details) => {
    logger.debug(`Database ${operation}`, details);
};

logger.logCache = (operation, key, details) => {
    logger.debug(`Cache ${operation}: ${key}`, details);
};

logger.logApi = (service, operation, details) => {
    logger.info(`${service} API ${operation}`, details);
};

logger.logSecurity = (event, details) => {
    logger.warn(`Security: ${event}`, details);
};

logger.logValidation = (entity, details) => {
    logger.debug(`Validation: ${entity}`, details);
};

logger.logInit = (component, details) => {
    logger.info(`Initializing ${component}`, details);
};

// Override console methods
const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
};

console.log = (...args) => {
    logger.info(args.join(' '));
    originalConsole.log.apply(console, args);
};

console.info = (...args) => {
    logger.info(args.join(' '));
    originalConsole.info.apply(console, args);
};

console.warn = (...args) => {
    logger.warn(args.join(' '));
    originalConsole.warn.apply(console, args);
};

console.error = (...args) => {
    logger.error(args.join(' '));
    originalConsole.error.apply(console, args);
};

console.debug = (...args) => {
    logger.debug(args.join(' '));
    originalConsole.debug.apply(console, args);
};

module.exports = logger;