const nutritionixService = require('./nutritionixService');
const fatSecretService = require('./fatsecretService');
const nutritionCache = require('../utils/nutritionCache');
const logger = require('../utils/logger');

class MealService {
    constructor() {
        this.initializeServices();
    }

    async initializeServices() {
        try {
            // Try to verify Nutritionix connection
            await nutritionixService.verifyConnection();
            logger.info('Nutritionix service is available');
        } catch (error) {
            logger.warn('Nutritionix service is not available, will use FatSecret as fallback:', {
                error: error.message
            });
        }
    }

    async getNutritionData(foodName) {
        try {
            // First try to get from cache
            const cachedData = await nutritionCache.get(foodName);
            if (cachedData) {
                return cachedData;
            }

            // Try Nutritionix first if available
            try {
                const nutritionixData = await nutritionixService.getNutritionData(foodName);
                if (nutritionixData) {
                    await nutritionCache.set(foodName, nutritionixData, 'nutritionix');
                    return nutritionixData;
                }
            } catch (nutritionixError) {
                logger.warn('Failed to get data from Nutritionix, falling back to FatSecret:', {
                    error: nutritionixError.message,
                    foodName
                });
            }

            // Fallback to FatSecret
            const fatSecretData = await fatSecretService.getMealNutritionData({
                name: foodName,
                ingredients: foodName
            });

            if (fatSecretData) {
                await nutritionCache.set(foodName, fatSecretData, 'fatsecret');
                return fatSecretData;
            }

            throw new Error('No nutrition data available from any source');
        } catch (error) {
            logger.error('Error getting nutrition data:', {
                error: error.message,
                foodName
            });
            throw error;
        }
    }

    async searchFood(query) {
        try {
            // Try Nutritionix first if available
            try {
                const nutritionixResults = await nutritionixService.searchFood(query);
                if (nutritionixResults) {
                    return nutritionixResults;
                }
            } catch (nutritionixError) {
                logger.warn('Failed to search with Nutritionix, falling back to FatSecret:', {
                    error: nutritionixError.message,
                    query
                });
            }

            // Fallback to FatSecret
            const fatSecretResults = await fatSecretService.searchFood(query);
            return fatSecretResults;
        } catch (error) {
            logger.error('Error searching food:', {
                error: error.message,
                query
            });
            throw error;
        }
    }
}

module.exports = new MealService(); 