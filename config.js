require('dotenv').config();

const config = {
    // Application
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',

    // Nutritionix API Configuration
    nutritionix: {
        keys: [
            { appId: process.env.NUTRITIONIX_APP_ID_1, appKey: process.env.NUTRITIONIX_APP_KEY_1 },
            { appId: process.env.NUTRITIONIX_APP_ID_2, appKey: process.env.NUTRITIONIX_APP_KEY_2 },
            { appId: process.env.NUTRITIONIX_APP_ID_3, appKey: process.env.NUTRITIONIX_APP_KEY_3 },
            { appId: process.env.NUTRITIONIX_APP_ID_4, appKey: process.env.NUTRITIONIX_APP_KEY_4 },
            { appId: process.env.NUTRITIONIX_APP_ID_5, appKey: process.env.NUTRITIONIX_APP_KEY_5 },
            { appId: process.env.NUTRITIONIX_APP_ID_6, appKey: process.env.NUTRITIONIX_APP_KEY_6 },
            { appId: process.env.NUTRITIONIX_APP_ID_7, appKey: process.env.NUTRITIONIX_APP_KEY_7 },
            { appId: process.env.NUTRITIONIX_APP_ID_8, appKey: process.env.NUTRITIONIX_APP_KEY_8 },
            { appId: process.env.NUTRITIONIX_APP_ID_9, appKey: process.env.NUTRITIONIX_APP_KEY_9 },
            { appId: process.env.NUTRITIONIX_APP_ID_10, appKey: process.env.NUTRITIONIX_APP_KEY_10 }
        ].filter(key => key.appId && key.appKey), // Only include keys that are configured
        baseUrl: 'https://trackapi.nutritionix.com/v2',
        dailyLimit: 200
    },
    
    // FatSecret API Configuration
    fatsecret: {
        clientId: process.env.FATSECRET_CLIENT_ID,
        clientSecret: process.env.FATSECRET_CLIENT_SECRET,
        baseUrl: 'https://platform.fatsecret.com/rest/server.api',
        tokenUrl: 'https://oauth.fatsecret.com/connect/token'
    },

    // Redis Configuration
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        ttl: parseInt(process.env.REDIS_TTL || '86400'), // 24 hours in seconds
        prefix: process.env.REDIS_PREFIX || 'meal-generator:'
    },

    // Cache Configuration
    cache: {
        prefix: process.env.CACHE_PREFIX || 'meal-generator:',
        ttl: parseInt(process.env.CACHE_TTL || '86400'), // 24 hours in seconds
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
    },

    // Database Configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'meal_generator',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        dialect: 'postgres',
        logging: process.env.DB_LOGGING === 'true',
        pool: {
            max: parseInt(process.env.DB_POOL_MAX || '5'),
            min: parseInt(process.env.DB_POOL_MIN || '0'),
            acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000'),
            idle: parseInt(process.env.DB_POOL_IDLE || '10000')
        }
    },

    // API Keys
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },

    // Security
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Total-Count'],
        credentials: true,
        maxAge: 86400 // 24 hours
    },

    // Rate Limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: { status: 'error', message: 'Too many requests from this IP, please try again later.' }
    }
};

// Validate required environment variables
const requiredEnvVars = [
    'FATSECRET_CLIENT_ID',
    'FATSECRET_CLIENT_SECRET'
];

// Check if at least one set of Nutritionix credentials is configured
const hasNutritionixCredentials = config.nutritionix.keys.length > 0;

if (!hasNutritionixCredentials) {
    console.warn('Warning: No Nutritionix API credentials configured. The application will use FatSecret API only.');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

module.exports = config; 