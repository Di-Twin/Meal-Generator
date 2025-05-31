const axios = require('axios');
const logger = require('../utils/logger');
const fatSecretLimiter = require('../utils/rateLimiter');
const nutritionCache = require('../utils/nutritionCache');
const config = require('../config');

class FatSecretService {
    constructor() {
        this.baseURL = 'https://platform.fatsecret.com/rest';
        this.tokenURL = 'https://oauth.fatsecret.com/connect/token';
        this.clientId = config.fatSecret.clientId;
        this.clientSecret = config.fatSecret.clientSecret;
        this.accessToken = null;
        this.tokenExpiry = null;
        this.tokenRefreshTimeout = null;
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second

        logger.info('FatSecretService initialized with client ID:', { 
            clientId: this.clientId.substring(0, 4) + '...' 
        });
    }

    async verifyConnection() {
        try {
            logger.info('Verifying FatSecret API connection...');
            
            // Test meal for verification
            const testMeal = {
                name: "Grilled Chicken Salad",
                ingredients: "chicken breast, mixed greens, cherry tomatoes, cucumber, olive oil"
            };

            const nutritionData = await this.getMealNutritionData(testMeal);
            
            if (nutritionData) {
                logger.info('FatSecret API connection verified successfully:', {
                    mealName: nutritionData.mealName,
                    calories: nutritionData.nutrition.calories
                });
                return true;
            } else {
                logger.error('FatSecret API verification failed: No nutrition data received');
                return false;
            }
        } catch (error) {
            logger.error('FatSecret API verification failed:', {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            return false;
        }
    }

    async getAccessToken() {
        try {
            // Check if we have a valid token
            if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) { // 5 minutes buffer
                return this.accessToken;
            }

            logger.info('Requesting new FatSecret access token');
            
            // Log request details (excluding sensitive data)
            logger.debug('Token request details:', {
                url: this.tokenURL,
                grantType: 'client_credentials',
                scope: 'basic nlp', // Changed from 'food.nlp' to 'basic nlp'
                clientIdPrefix: this.clientId.substring(0, 4) + '...'
            });

            const response = await axios.post(
                this.tokenURL,
                'grant_type=client_credentials&scope=basic nlp', // Changed from 'food.nlp' to 'basic nlp'
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    auth: {
                        username: this.clientId,
                        password: this.clientSecret
                    }
                }
            );

            if (!response.data.access_token) {
                throw new Error('No access token in response');
            }

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            // Schedule token refresh
            this.scheduleTokenRefresh(response.data.expires_in);
            
            logger.info('Successfully obtained FatSecret access token');
            return this.accessToken;
        } catch (error) {
            // Enhanced error logging
            const errorDetails = {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                clientIdPrefix: this.clientId ? this.clientId.substring(0, 4) + '...' : 'not set'
            };

            if (error.response?.status === 400) {
                if (error.response?.data?.error === 'invalid_client') {
                    logger.error('Invalid FatSecret client credentials:', errorDetails);
                    throw new Error('Invalid FatSecret client credentials. Please check your FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET');
                } else if (error.response?.data?.error === 'invalid_scope') {
                    logger.error('Invalid FatSecret scope:', errorDetails);
                    throw new Error('Invalid FatSecret scope. Please check the API documentation for correct scope format.');
                }
            }

            logger.error('Error getting FatSecret access token:', errorDetails);
            throw new Error('Failed to authenticate with FatSecret API');
        }
    }

    scheduleTokenRefresh(expiresIn) {
        // Clear any existing refresh timeout
        if (this.tokenRefreshTimeout) {
            clearTimeout(this.tokenRefreshTimeout);
        }

        // Schedule refresh 5 minutes before expiry
        const refreshTime = (expiresIn - 300) * 1000; // Convert to milliseconds
        this.tokenRefreshTimeout = setTimeout(async () => {
            try {
                logger.info('Refreshing FatSecret access token before expiry');
                await this.getAccessToken();
            } catch (error) {
                logger.error('Failed to refresh token:', error);
                // Retry after a delay
                setTimeout(() => this.scheduleTokenRefresh(expiresIn), 60000);
            }
        }, refreshTime);
    }

    async getMealNutritionData(meal) {
        try {
            const token = await this.getAccessToken();
            logger.info('Getting nutrition data for meal:', { name: meal.name });

            // Create a natural language description of the meal
            const mealDescription = `${meal.name} with ${meal.ingredients}`;
            
            const response = await axios.post(
                `${this.baseURL}/natural-language-processing/v1`,
                {
                    user_input: mealDescription,
                    region: 'US',
                    language: 'en',
                    include_food_data: true
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.food_response || response.data.food_response.length === 0) {
                logger.warn('No nutrition data found for meal:', { name: meal.name });
                return null;
            }

            // Extract and combine nutrition data from all foods in the meal
            const totalNutrition = this.extractTotalNutrition(response.data);
            
            logger.info('Successfully retrieved nutrition data for meal:', { 
                name: meal.name,
                calories: totalNutrition.calories
            });

            return {
                mealName: meal.name,
                nutrition: totalNutrition,
                foods: response.data.food_response.map(food => ({
                    name: food.food_entry_name,
                    nutrition: food.eaten.total_nutritional_content
                }))
            };
        } catch (error) {
            logger.error('Error getting meal nutrition data:', {
                meal: meal.name,
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            return null;
        }
    }

    extractTotalNutrition(response) {
        if (!response || !response.food_response) {
            return null;
        }

        const totalNutrition = {
            calories: 0,
            carbohydrate: 0,
            protein: 0,
            fat: 0,
            saturated_fat: 0,
            polyunsaturated_fat: 0,
            monounsaturated_fat: 0,
            cholesterol: 0,
            sodium: 0,
            potassium: 0,
            fiber: 0,
            sugar: 0,
            vitamin_a: 0,
            vitamin_c: 0,
            calcium: 0,
            iron: 0
        };

        response.food_response.forEach(food => {
            if (food.eaten && food.eaten.total_nutritional_content) {
                const nutrition = food.eaten.total_nutritional_content;
                Object.keys(totalNutrition).forEach(key => {
                    if (nutrition[key]) {
                        totalNutrition[key] += parseFloat(nutrition[key]);
                    }
                });
            }
        });

        return totalNutrition;
    }

    async getBatchMealNutritionData(meals) {
        logger.info('Getting batch nutrition data for multiple meals');
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

        logger.info('Batch meal nutrition data retrieval complete:', {
            found: Object.keys(results).length,
            missing: missing.length
        });

        return {
            results,
            missing
        };
    }
}

module.exports = new FatSecretService();