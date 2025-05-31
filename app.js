require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const sequelize = require('./Database/models/postgres/connection');
const fatSecretService = require('./services/fatsecretService');

// Validate required environment variables
const requiredEnvVars = ['FATSECRET_CLIENT_ID', 'FATSECRET_CLIENT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    logger.error('Missing required environment variables:', { missing: missingEnvVars });
    process.exit(1);
}

// Log environment variables (safely)
logger.info('Environment variables loaded:', {
    fatSecretClientId: process.env.FATSECRET_CLIENT_ID ? 'Set' : 'Not Set',
    fatSecretClientSecret: process.env.FATSECRET_CLIENT_SECRET ? 'Set' : 'Not Set'
});

// Initialize services and database
(async () => {
    try {
        // Sync all models with database
        await sequelize.sync();
        logger.info('Database synchronized successfully');

        // Verify FatSecret API connection
        const fatSecretVerified = await fatSecretService.verifyConnection();
        if (!fatSecretVerified) {
            logger.error('FatSecret API verification failed. Some features may not work correctly.');
        }
    } catch (error) {
        logger.error('Initialization error:', error);
        process.exit(1);
    }
})();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Routes
app.use('/api/meal-plans', require('./routes/mealPlanRoutes'));
app.use('/api/nutrition', require('./routes/nutritionRoutes'));

// Error handling
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;