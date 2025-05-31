const NodeCache = require('node-cache');
const { DataTypes } = require('sequelize');
const sequelize = require('../Database/models/postgres/connection');
const logger = require('./logger');

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
    }
}, {
    tableName: 'nutrition_data',
    timestamps: true,
    indexes: [
        {
            fields: ['normalizedDescription']
        }
    ]
});

class NutritionCache {
    constructor() {
        logger.info('Initializing NutritionCache with 24-hour TTL');
        this.cache = new NodeCache({ stdTTL: 24 * 60 * 60 });
    }

    getKey(foodDescription) {
        const key = foodDescription.toLowerCase().trim().replace(/\s+/g, ' ');
        logger.debug('Generated cache key:', { original: foodDescription, normalized: key });
        return key;
    }

    async get(foodDescription) {
        const key = this.getKey(foodDescription);
        logger.info('Attempting to get nutrition data:', { key });
        
        const cachedData = this.cache.get(key);
        if (cachedData) {
            logger.info('Cache hit:', { key });
            return cachedData;
        }
        
        logger.info('Cache miss, checking database:', { key });
        try {
            const dbData = await Nutrition.findOne({
                where: { normalizedDescription: key }
            });
            
            if (dbData) {
                logger.info('Database hit:', { key });
                const nutritionData = dbData.nutritionData;
                
                logger.debug('Updating cache with database data:', { key });
                this.cache.set(key, nutritionData);
                
                return nutritionData;
            }
            
            logger.info('No data found in cache or database:', { key });
        } catch (error) {
            logger.error('Error retrieving from database:', { error: error.message, key });
        }
        
        return null;
    }

    async set(foodDescription, nutritionData, totalNutrition = null) {
        const key = this.getKey(foodDescription);
        logger.info('Setting nutrition data:', { key });
        
        logger.debug('Setting in-memory cache:', { key });
        this.cache.set(key, nutritionData);
        
        try {
            logger.debug('Storing in database:', { key });
            await Nutrition.findOrCreate({
                where: { normalizedDescription: key },
                defaults: {
                    foodDescription: foodDescription,
                    normalizedDescription: key,
                    nutritionData: nutritionData,
                    totalNutrition: totalNutrition
                }
            });
            logger.info('Successfully stored nutrition data:', { key });
        } catch (error) {
            logger.error('Error storing in database:', { error: error.message, key });
        }
    }

    // Get nutrition data for multiple ingredients
    async getBatchNutrition(ingredients) {
        logger.info('Getting batch nutrition data:', { count: ingredients.length });
        const results = {};
        const missingIngredients = [];

        for (const ingredient of ingredients) {
            logger.debug('Processing ingredient:', { ingredient });
            const cachedData = await this.get(ingredient);
            if (cachedData) {
                logger.debug('Found data for ingredient:', { ingredient });
                results[ingredient] = cachedData;
            } else {
                logger.debug('No data found for ingredient:', { ingredient });
                missingIngredients.push(ingredient);
            }
        }

        logger.info('Batch nutrition retrieval complete:', {
            found: Object.keys(results).length,
            missing: missingIngredients.length
        });

        return {
            cached: results,
            missing: missingIngredients
        };
    }
}

module.exports = new NutritionCache();