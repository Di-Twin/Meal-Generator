require('dotenv').config();

const config = {
    fatSecret: {
        clientId: process.env.FATSECRET_CLIENT_ID?.trim(),
        clientSecret: process.env.FATSECRET_CLIENT_SECRET?.trim()
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY?.trim()
    },
    logLevel: process.env.LOG_LEVEL || 'info'
};

// Validate required configuration
const requiredConfig = {
    'FATSECRET_CLIENT_ID': config.fatSecret.clientId,
    'FATSECRET_CLIENT_SECRET': config.fatSecret.clientSecret,
    'OPENAI_API_KEY': config.openai.apiKey
};

const missingConfig = Object.entries(requiredConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (missingConfig.length > 0) {
    throw new Error(`Missing required configuration: ${missingConfig.join(', ')}`);
}

module.exports = config; 