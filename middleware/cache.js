const { getCache, setCache } = require('../services/redisService');
const logger = require('../utils/logger');

/**
 * Cache middleware factory
 * @param {string} key - Base key for caching
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (key, ttl = 3600) => {
    return async (req, res, next) => {
        try {
            // Generate cache key based on request parameters
            const cacheKey = `${key}-${req.params.id || req.query.id || 'current'}`;
            
            // Check if data exists in cache
            const cachedData = await getCache(cacheKey);
            if (cachedData) {
                logger.debug('Cache hit:', { key: cacheKey });
                return res.status(200).json({
                    status: 'success',
                    data: cachedData,
                    fromCache: true
                });
            }

            // If not in cache, store the original res.json method
            const originalJson = res.json;

            // Override res.json method
            res.json = function(data) {
                if (res.statusCode === 200) {
                    // Only cache successful responses
                    setCache(cacheKey, data, ttl).catch(err => {
                        logger.error('Error setting cache:', { key: cacheKey, error: err.message });
                    });
                }
                return originalJson.call(this, data);
            };

            next();
        } catch (error) {
            logger.error('Cache middleware error:', error);
            next();
        }
    };
};

/**
 * Cache invalidation helper
 * @param {string} key - Base key to invalidate
 * @returns {Promise<void>}
 */
const invalidateCache = async (key) => {
    try {
        const { delCacheByPattern } = require('../services/redisService');
        await delCacheByPattern(`${key}*`);
        logger.debug('Cache invalidated:', { pattern: `${key}*` });
    } catch (error) {
        logger.error('Cache invalidation error:', error);
    }
};

module.exports = {
    cache: cacheMiddleware,
    invalidateCache
}; 