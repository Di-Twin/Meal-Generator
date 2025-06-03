const IORedis = require('ioredis');
const logger = require('../utils/logger');
const config = require('../config');

// In-memory fallback cache
const memoryCache = new Map();

// Create Redis client with connection options
const redisClient = new IORedis(config.redis.url, {
    retryStrategy: (times) => {
        if (times > 3) {
            logger.error('Redis connection failed after 3 retries, falling back to memory cache');
            return null; // Stop retrying after 3 attempts
        }
        const delay = Math.min(times * 1000, 3000);
        return delay;
    },
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    connectTimeout: 5000,
    disconnectTimeout: 2000,
    lazyConnect: true // Don't connect immediately
});

let isRedisConnected = false;

// Connection event handlers
redisClient.on('connect', () => {
    logger.info('✅ Connected to Redis');
    isRedisConnected = true;
});

redisClient.on('ready', () => {
    logger.info('✅ Redis client ready');
    isRedisConnected = true;
});

redisClient.on('error', (err) => {
    logger.error('❌ Redis connection error:', err);
    isRedisConnected = false;
});

redisClient.on('reconnecting', () => {
    logger.warn('🔄 Reconnecting to Redis...');
    isRedisConnected = false;
});

redisClient.on('end', () => {
    logger.warn('❌ Redis connection ended');
    isRedisConnected = false;
});

/**
 * Set a value in cache (Redis or memory)
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} expiration - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<void>}
 */
const setCache = async (key, value, expiration = 3600) => {
    try {
        const serializedValue = JSON.stringify(value);
        
        if (isRedisConnected) {
            await redisClient.set(key, serializedValue, 'EX', expiration);
            logger.debug('Cache set in Redis:', { key, expiration });
        } else {
            memoryCache.set(key, {
                value: serializedValue,
                expiry: Date.now() + (expiration * 1000)
            });
            logger.debug('Cache set in memory:', { key, expiration });
        }
    } catch (err) {
        logger.error('Error setting cache:', { key, error: err.message });
        // Fallback to memory cache
        memoryCache.set(key, {
            value: JSON.stringify(value),
            expiry: Date.now() + (expiration * 1000)
        });
    }
};

/**
 * Get a value from cache (Redis or memory)
 * @param {string} key - Cache key
 * @returns {Promise<any>} Cached value or null if not found
 */
const getCache = async (key) => {
    try {
        if (isRedisConnected) {
            const data = await redisClient.get(key);
            if (!data) {
                logger.debug('Cache miss in Redis:', { key });
                return null;
            }
            logger.debug('Cache hit in Redis:', { key });
            return JSON.parse(data);
        } else {
            const cached = memoryCache.get(key);
            if (!cached) {
                logger.debug('Cache miss in memory:', { key });
                return null;
            }
            if (cached.expiry < Date.now()) {
                memoryCache.delete(key);
                logger.debug('Cache expired in memory:', { key });
                return null;
            }
            logger.debug('Cache hit in memory:', { key });
            return JSON.parse(cached.value);
        }
    } catch (err) {
        logger.error('Error getting cache:', { key, error: err.message });
        return null;
    }
};

/**
 * Delete a key from cache (Redis or memory)
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
const delCache = async (key) => {
    try {
        if (isRedisConnected) {
            await redisClient.del(key);
            logger.debug('Cache deleted from Redis:', { key });
        }
        memoryCache.delete(key);
        logger.debug('Cache deleted from memory:', { key });
    } catch (err) {
        logger.error('Error deleting cache:', { key, error: err.message });
    }
};

/**
 * Delete multiple keys from cache (Redis or memory)
 * @param {string} pattern - Pattern to match keys
 * @returns {Promise<void>}
 */
const delCacheByPattern = async (pattern) => {
    try {
        if (isRedisConnected) {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
                logger.debug('Cache deleted from Redis by pattern:', { pattern, keys });
            }
        }
        // Clear matching keys from memory cache
        for (const key of memoryCache.keys()) {
            if (key.includes(pattern.replace('*', ''))) {
                memoryCache.delete(key);
            }
        }
        logger.debug('Cache deleted from memory by pattern:', { pattern });
    } catch (err) {
        logger.error('Error deleting cache by pattern:', { pattern, error: err.message });
    }
};

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
const getCacheStats = async () => {
    try {
        const stats = {
            connected: isRedisConnected,
            memoryCacheSize: memoryCache.size
        };

        if (isRedisConnected) {
            const info = await redisClient.info();
            stats.redis = {
                connected_clients: info.match(/connected_clients:(\d+)/)?.[1],
                used_memory_human: info.match(/used_memory_human:([^\r\n]+)/)?.[1],
                total_connections_received: info.match(/total_connections_received:(\d+)/)?.[1],
                total_commands_processed: info.match(/total_commands_processed:(\d+)/)?.[1],
                keyspace_hits: info.match(/keyspace_hits:(\d+)/)?.[1],
                keyspace_misses: info.match(/keyspace_misses:(\d+)/)?.[1]
            };
        }

        return stats;
    } catch (err) {
        logger.error('Error getting cache stats:', err);
        return {
            connected: isRedisConnected,
            memoryCacheSize: memoryCache.size,
            error: err.message
        };
    }
};

// Graceful shutdown
const shutdown = async () => {
    try {
        if (isRedisConnected) {
            await redisClient.quit();
            logger.info('Redis connection closed');
        }
        memoryCache.clear();
        logger.info('Memory cache cleared');
    } catch (err) {
        logger.error('Error during cache shutdown:', err);
    }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = {
    redisClient,
    setCache,
    getCache,
    delCache,
    delCacheByPattern,
    getCacheStats
}; 