const nutritionCache = require('../utils/nutritionCache');
const logger = require('../utils/logger');

async function clearAllCache() {
    try {
        logger.info('Starting cache clearing script');
        const result = await nutritionCache.clearAll();
        logger.info('Cache clearing completed:', result);
        process.exit(0);
    } catch (error) {
        logger.error('Failed to clear cache:', error);
        process.exit(1);
    }
}

clearAllCache(); 