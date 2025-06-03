const { DataTypes } = require('sequelize');
const sequelize = require('../Database/models/postgres/connection');
const logger = require('./logger');
const { setCache, getCache, delCache } = require('../services/redisService');
const config = require('../config');
const { Op } = require('sequelize');
const NutritionDataStandardizer = require('./nutritionDataStandardizer');

// Define the Nutrition model
const Nutrition = sequelize.define('Nutrition', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    foodDescription: {
        type: DataTypes.STRING,
        allowNull: false
    },
    normalizedDescription: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    nutritionData: {
        type: DataTypes.JSONB,
        allowNull: false
    },
    totalNutrition: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    lastUpdated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    hitCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'nutrition_data',
    timestamps: true,
    indexes: [
        {
            fields: ['normalizedDescription']
        },
        {
            fields: ['lastUpdated']
        }
    ]
});

class NutritionCache {
    constructor() {
        this.ttl = config.redis.ttl || 86400; // Default 24 hours
        this.prefix = `${config.cache.prefix}nutrition:`;
        this.maxCacheSize = 1000; // Maximum number of items in cache
        this.cleanupInterval = 3600000; // Cleanup every hour
        
        // Initialize cleanup interval
        setInterval(() => this.cleanup(), this.cleanupInterval);
    }

    getKey(foodDescription) {
        return `${this.prefix}${foodDescription.toLowerCase().trim().replace(/\s+/g, ' ')}`;
    }

    async get(foodDescription) {
        const key = this.getKey(foodDescription);
        
        try {
            // Try Redis cache first
            const cachedData = await getCache(key);
            if (cachedData) {
                // Update hit count in database asynchronously
                this.updateHitCount(foodDescription).catch(err => 
                    logger.error('Error updating hit count:', { error: err.message })
                );
                return cachedData;
            }
            
            // If not in cache, check database
            const dbData = await Nutrition.findOne({
                where: { normalizedDescription: foodDescription.toLowerCase().trim() }
            });
            
            if (dbData) {
                const nutritionData = dbData.nutritionData;
                
                // Update cache asynchronously
                this.updateCache(key, nutritionData).catch(err => 
                    logger.error('Error updating cache:', { error: err.message })
                );
                
                // Update hit count and last accessed
                await this.updateHitCount(foodDescription);
                
                return nutritionData;
            }
            
            return null;
        } catch (error) {
            logger.error('Error retrieving data:', { error: error.message, key });
            return null;
        }
    }

    async set(foodDescription, nutritionData, source = 'nutritionix') {
        const key = this.getKey(foodDescription);
        
        try {
            // Standardize the nutrition data
            const standardizedData = NutritionDataStandardizer.standardizeNutritionData(nutritionData, source);
            
            // Validate the standardized data
            NutritionDataStandardizer.validateNutritionData(standardizedData);
            
            // Round nutrition values
            const roundedData = NutritionDataStandardizer.roundNutritionValues(standardizedData);
            
            // Store in Redis cache
            await setCache(key, roundedData, this.ttl);
            
            // Store in database
            await Nutrition.upsert({
                foodDescription: foodDescription,
                normalizedDescription: foodDescription.toLowerCase().trim(),
                nutritionData: roundedData,
                lastUpdated: new Date(),
                hitCount: 0
            });

            logger.debug('Stored nutrition data:', {
                food: foodDescription,
                calories: roundedData.calories,
                macros: roundedData.macros
            });
            
            return roundedData;
        } catch (error) {
            logger.error('Error storing nutrition data:', { 
                error: error.message,
                food: foodDescription,
                source: source
            });
            throw error;
        }
    }

    async updateHitCount(foodDescription) {
        try {
            await Nutrition.increment('hitCount', {
                where: { normalizedDescription: foodDescription.toLowerCase().trim() }
            });
        } catch (error) {
            logger.error('Error updating hit count:', { error: error.message });
        }
    }

    async updateCache(key, data) {
        try {
            await setCache(key, data, this.ttl);
        } catch (error) {
            logger.error('Error updating cache:', { error: error.message });
        }
    }

    async getBatchNutrition(ingredients) {
        const results = {};
        const missingIngredients = [];

        // Try to get all from cache first
        const cachePromises = ingredients.map(ingredient => this.get(ingredient));
        const cacheResults = await Promise.all(cachePromises);

        ingredients.forEach((ingredient, index) => {
            if (cacheResults[index]) {
                results[ingredient] = cacheResults[index];
            } else {
                missingIngredients.push(ingredient);
            }
        });

        return {
            cached: results,
            missing: missingIngredients
        };
    }

    async cleanup() {
        try {
            // Remove old entries from database
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 30); // Remove entries older than 30 days
            
            await Nutrition.destroy({
                where: {
                    lastUpdated: {
                        [Op.lt]: oldDate
                    },
                    hitCount: {
                        [Op.lt]: 5 // Remove entries with less than 5 hits
                    }
                }
            });
        } catch (error) {
            logger.error('Error during cache cleanup:', { error: error.message });
        }
    }

    async clear(foodDescription = null) {
        try {
            if (foodDescription) {
                const key = this.getKey(foodDescription);
                await delCache(key);
                await Nutrition.destroy({
                    where: { normalizedDescription: foodDescription.toLowerCase().trim() }
                });
            } else {
                // Clear all nutrition cache
                const pattern = `${this.prefix}*`;
                await delCache(pattern);
                await Nutrition.destroy({ where: {} });
            }
        } catch (error) {
            logger.error('Error clearing cache:', { error: error.message });
            throw error;
        }
    }

    async clearAll() {
        try {
            // Clear all Redis cache entries
            const pattern = `${this.prefix}*`;
            await delCache(pattern);
            
            // Clear all database entries
            await Nutrition.destroy({
                where: {},
                force: true // This will permanently delete all records
            });
            
            // Reset the auto-increment counter if using PostgreSQL
            await sequelize.query('TRUNCATE TABLE nutrition_data RESTART IDENTITY CASCADE');
            
            return {
                success: true,
                message: 'Successfully cleared all cache and database data'
            };
        } catch (error) {
            logger.error('Error during complete cleanup:', { error: error.message });
            throw new Error(`Failed to clear all data: ${error.message}`);
        }
    }
}

module.exports = new NutritionCache();