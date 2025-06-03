const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const fatSecretService = require('./fatsecretService');
const nutritionCache = require('../utils/nutritionCache');
const nutritionixKeyManager = require('./nutritionixKeyManager');
const NutritionDataStandardizer = require('../utils/nutritionDataStandardizer');

class NutritionixService {
    constructor() {
        this.baseUrl = config.nutritionix.baseUrl;
        this.hasCredentials = config.nutritionix.keys.length > 0;
        
        if (!this.hasCredentials) {
            logger.warn('NutritionixService initialized without API credentials');
        }
    }

    async verifyConnection() {
        if (!this.hasCredentials) {
            logger.warn('Cannot verify connection: No Nutritionix API credentials configured');
            return false;
        }

        try {
            const key = nutritionixKeyManager.getNextKey();
            const response = await axios.get(`${this.baseUrl}/search/instant`, {
                headers: {
                    'x-app-id': key.appId,
                    'x-app-key': key.appKey
                },
                params: {
                    query: 'apple'
                }
            });

            return response.status === 200;
        } catch (error) {
            logger.error('Failed to verify Nutritionix API connection:', {
                error: error.message,
                status: error.response?.status
            });
            return false;
        }
    }

    async getNutritionData(foodName) {
        if (!this.hasCredentials) {
            logger.warn('Cannot get nutrition data: No Nutritionix API credentials configured');
            return null;
        }

        try {
            const key = nutritionixKeyManager.getNextKey();
            const response = await axios.post(
                `${this.baseUrl}/natural/nutrients`,
                { query: foodName },
                {
                    headers: {
                        'x-app-id': key.appId,
                        'x-app-key': key.appKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.status === 200 && response.data.foods && response.data.foods.length > 0) {
                const standardizedData = NutritionDataStandardizer.standardizeNutritionData(response.data, 'nutritionix');
                if (standardizedData) {
                    return standardizedData;
                }
            }

            return null;
        } catch (error) {
            if (error.response?.status === 401) {
                const key = nutritionixKeyManager.getNextKey();
                nutritionixKeyManager.markKeyAsExhausted(key.appId);
            }
            
            logger.error('Error getting nutrition data from Nutritionix:', {
                error: error.message,
                status: error.response?.status,
                foodName
            });
            return null;
        }
    }

    async searchFood(query) {
        if (!this.hasCredentials) {
            logger.warn('Cannot search food: No Nutritionix API credentials configured');
            return null;
        }

        try {
            const key = nutritionixKeyManager.getNextKey();
            const response = await axios.get(`${this.baseUrl}/search/instant`, {
                headers: {
                    'x-app-id': key.appId,
                    'x-app-key': key.appKey
                },
                params: { query }
            });

            return response.status === 200 ? response.data : null;
        } catch (error) {
            if (error.response?.status === 401) {
                const key = nutritionixKeyManager.getNextKey();
                nutritionixKeyManager.markKeyAsExhausted(key.appId);
            }
            
            logger.error('Error searching food in Nutritionix:', {
                error: error.message,
                status: error.response?.status,
                query
            });
            return null;
        }
    }

    async getMealNutritionData(meal) {
        try {
            // Check cache first
            const cachedData = await nutritionCache.get(meal.name);
            if (cachedData) {
                return cachedData;
            }

            // If meal already has nutrition data from LLM, use it
            if (meal.nutrition && this.isValidNutritionData(meal.nutrition)) {
                const standardizedData = NutritionDataStandardizer.standardizeNutritionData({
                    mealName: meal.name,
                    nutrition: meal.nutrition
                });
                await nutritionCache.set(meal.name, standardizedData);
                return standardizedData;
            }

            // Try to get data for the whole meal
            const response = await this.getNutritionData(meal.name);
            if (response) {
                await nutritionCache.set(meal.name, response);
                return response;
            }

            // If that fails, try FatSecret
            const fatSecretData = await fatSecretService.getMealNutritionData(meal);
            if (this.isValidNutritionData(fatSecretData)) {
                await nutritionCache.set(meal.name, fatSecretData);
                return fatSecretData;
            }

            // If both API calls fail, use the LLM nutrition data if available
            if (meal.nutrition) {
                const standardizedData = NutritionDataStandardizer.standardizeNutritionData({
                    mealName: meal.name,
                    nutrition: meal.nutrition
                });
                await nutritionCache.set(meal.name, standardizedData);
                return standardizedData;
            }

            return null;

        } catch (error) {
            logger.error('Error in getMealNutritionData:', {
                meal: meal.name,
                error: error.message,
                status: error.response?.status
            });
            
            // On error, try FatSecret as fallback
            try {
                const fatSecretData = await fatSecretService.getMealNutritionData(meal);
                if (this.isValidNutritionData(fatSecretData)) {
                    await nutritionCache.set(meal.name, fatSecretData);
                    return fatSecretData;
                }
            } catch (fallbackError) {
                logger.error('FatSecret fallback failed:', {
                    meal: meal.name,
                    error: fallbackError.message
                });
            }
            
            // If all else fails, use LLM nutrition data if available
            if (meal.nutrition) {
                const standardizedData = NutritionDataStandardizer.standardizeNutritionData({
                    mealName: meal.name,
                    nutrition: meal.nutrition
                });
                await nutritionCache.set(meal.name, standardizedData);
                return standardizedData;
            }
            
            return null;
        }
    }

    isValidNutritionData(data) {
        try {
            return data && 
                   typeof data.calories === 'number' &&
                   data.calories > 0 &&
                   data.macros &&
                   (data.macros.protein_g > 0 || data.macros.carbs_g > 0 || data.macros.fats_g > 0 || data.macros.fiber_g > 0 || data.macros.sugars_g > 0);
        } catch (error) {
            logger.error('Error validating nutrition data:', { error: error.message });
            return false;
        }
    }

    async getBatchMealNutritionData(meals) {
        const results = {};
        const missing = [];
    
        for (const [mealType, meal] of Object.entries(meals)) {
            const nutritionData = await this.getMealNutritionData(meal);
            if (nutritionData) {
                results[mealType] = nutritionData;
            } else {
                missing.push(mealType);
            }
        }
    
        return { results, missing };
    }
}

module.exports = new NutritionixService(); 