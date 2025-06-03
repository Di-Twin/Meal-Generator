const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const nutritionCache = require('../utils/nutritionCache');
const NutritionDataStandardizer = require('../utils/nutritionDataStandardizer');

class FatSecretService {
    constructor() {
        this.baseUrl = 'https://platform.fatsecret.com/rest/server.api';
        this.tokenUrl = 'https://oauth.fatsecret.com/connect/token';
        this.clientId = config.fatsecret.clientId;
        this.clientSecret = config.fatsecret.clientSecret;
        this.accessToken = null;
        this.tokenExpiry = null;
        
        if (!this.clientId || !this.clientSecret) {
            logger.warn('FatSecret credentials not configured. API features will be disabled.');
        }
    }

    async verifyConnection() {
        try {
            if (!this.clientId || !this.clientSecret) {
                throw new Error('FatSecret API credentials not configured');
            }

            // First verify we can get an access token
            const token = await this.getAccessToken();
            if (!token) {
                throw new Error('Failed to obtain access token');
            }

            // Make a test API call to search for "apple"
            const searchResponse = await this.searchFood('apple');
            if (!searchResponse?.foods_search?.results?.food?.length) {
                throw new Error('Invalid search response');
            }

            // Get detailed nutrition data for the first food item
            const foodId = searchResponse.foods_search.results.food[0].food_id;
            const foodData = await this.getFoodNutrition(foodId);
            
            if (!foodData?.food) {
                throw new Error('Invalid food data response');
            }

            // Standardize the nutrition data
            const standardizedData = NutritionDataStandardizer.standardizeNutritionData(foodData, 'fatsecret');
            
            // Verify we got valid nutrition data
            if (!standardizedData || !standardizedData.calories) {
                throw new Error('No valid nutrition values found');
            }

            logger.info('FatSecret API verification successful', {
                food_name: standardizedData.food_name,
                calories: standardizedData.calories
            });

            return true;
        } catch (error) {
            logger.error('FatSecret API verification failed:', { error: error.message });
            return false;
        }
    }

    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return this.accessToken;
            }

        if (!this.clientId || !this.clientSecret) {
            throw new Error('FatSecret credentials not configured');
        }

        try {
            const response = await axios.post(
                this.tokenUrl,
                new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    scope: 'premier'
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            logger.debug('FatSecret token response:', response.data);

            if (response.status === 200 && response.data.access_token) {
                this.accessToken = response.data.access_token;
                this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
                return this.accessToken;
            }

            throw new Error('Failed to obtain access token: Invalid response');
        } catch (error) {
            if (error.response?.status === 401) {
                throw new Error('Invalid FatSecret credentials');
            }
            logger.error('Token request failed:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
            throw new Error(`Failed to obtain access token: ${error.message}`);
        }
    }

    async searchFood(query) {
        try {
            const token = await this.getAccessToken();
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${token}`
                },
                body: new URLSearchParams({
                    method: 'foods.search.v3',
                    format: 'json',
                    search_expression: query,
                    max_results: 1
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            if (!data?.foods_search?.results?.food) {
                throw new Error('Invalid search response format');
            }

            return data;
        } catch (error) {
            logger.error('Error searching FatSecret API:', { error: error.message });
            throw error;
        }
    }

    async getFoodNutrition(foodId) {
        try {
            const token = await this.getAccessToken();
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${token}`
                },
                body: new URLSearchParams({
                    method: 'food.get.v3',
                format: 'json',
                    food_id: foodId
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            if (!data?.food) {
                throw new Error('Invalid food data response format');
            }

            return data;
        } catch (error) {
            logger.error('Error getting food nutrition from FatSecret API:', { error: error.message });
            throw error;
        }
    }

    async getNutritionData(foodName) {
        try {
            const foods = await this.searchFood(foodName);
            if (!foods || foods.length === 0) {
                return null;
            }

            const food = Array.isArray(foods) ? foods[0] : foods;
            const token = await this.getAccessToken();
            const response = await axios.post(this.baseUrl, null, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    method: 'food.get.v3',
                    food_id: food.food_id,
                    format: 'json'
                }
            });

            if (response.status === 200 && response.data.food) {
                return NutritionDataStandardizer.standardizeNutritionData(response.data, 'fatsecret');
            }

            return null;
        } catch (error) {
            logger.error('Error getting nutrition data from FatSecret:', { error: error.message });
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

            // If meal has ingredients, calculate nutrition from ingredients
            if (meal.ingredients) {
                const ingredients = meal.ingredients.split(',').map(i => i.trim());
                const batchData = await this.getBatchNutritionData(ingredients);
                
                if (batchData.results && Object.keys(batchData.results).length > 0) {
                    const combinedData = this.combineNutritionData(batchData.results);
                    await nutritionCache.set(meal.name, combinedData, 'fatsecret');
                    return combinedData;
                }
            }

            // If that fails, try to get data for the whole meal
            const response = await this.getNutritionData(meal.name);
            if (response) {
                await nutritionCache.set(meal.name, response, 'fatsecret');
                return response;
            }

            return null;
        } catch (error) {
            logger.error('Error in getMealNutritionData:', { error: error.message });
            return null;
        }
    }

    async getBatchNutritionData(ingredients) {
        const results = {};
        const missing = [];
    
        for (const ingredient of ingredients) {
            try {
                // Extract quantity and unit if present (e.g., "1 cup", "2 tbsp")
                const match = ingredient.match(/^(\d+(?:\.\d+)?)\s*(cup|tbsp|tsp|oz|g|ml|piece|medium|large|small)?\s+(.+)$/i);
                let quantity = 1;
                let unit = '';
                let ingredientName = ingredient;

                if (match) {
                    quantity = parseFloat(match[1]);
                    unit = match[2] || '';
                    ingredientName = match[3].trim();
                }

                const nutritionData = await this.getNutritionData(ingredientName);
            if (nutritionData) {
                    // Adjust nutrition values based on quantity
                    const adjustedData = this.adjustNutritionForQuantity(nutritionData, quantity, unit);
                    results[ingredient] = adjustedData;
            } else {
                    missing.push(ingredient);
                }
            } catch (error) {
                logger.error(`Error processing ingredient ${ingredient}:`, { error: error.message });
                missing.push(ingredient);
            }
        }

        return { results, missing };
    }

    adjustNutritionForQuantity(data, quantity, unit) {
        const multiplier = this.getQuantityMultiplier(quantity, unit);
        const adjusted = { ...data };

        // Adjust all nutrition values
        adjusted.calories *= multiplier;
        adjusted.macros.protein_g *= multiplier;
        adjusted.macros.carbs_g *= multiplier;
        adjusted.macros.fats_g *= multiplier;
        adjusted.macros.fiber_g *= multiplier;
        adjusted.macros.sugars_g *= multiplier;
        adjusted.vitamins.vitamin_A_mcg *= multiplier;
        adjusted.vitamins.vitamin_C_mg *= multiplier;
        adjusted.minerals.calcium_mg *= multiplier;
        adjusted.minerals.iron_mg *= multiplier;
        adjusted.minerals.potassium_mg *= multiplier;
        adjusted.minerals.sodium_mg *= multiplier;

        return NutritionDataStandardizer.roundNutritionValues(adjusted);
    }

    getQuantityMultiplier(quantity, unit) {
        // Default multipliers based on common serving sizes
        const multipliers = {
            'cup': 1,
            'tbsp': 0.0625, // 1/16 cup
            'tsp': 0.0208,  // 1/48 cup
            'oz': 0.125,    // 1/8 cup
            'g': 0.0042,    // 1/240 cup
            'ml': 0.0042,   // 1/240 cup
            'piece': 1,
            'medium': 1,
            'large': 1.5,
            'small': 0.75
        };

        return quantity * (multipliers[unit.toLowerCase()] || 1);
    }

    combineNutritionData(nutritionData) {
        const combined = {
            food_name: 'Combined Meal',
            calories: 0,
            macros: {
                protein_g: 0,
                carbs_g: 0,
                fats_g: 0,
                fiber_g: 0,
                sugars_g: 0
            },
            vitamins: {
                vitamin_A_mcg: 0,
                vitamin_C_mg: 0
            },
            minerals: {
                calcium_mg: 0,
                iron_mg: 0,
                potassium_mg: 0,
                sodium_mg: 0
            }
        };

        // Sum up all nutrition values
        Object.values(nutritionData).forEach(data => {
            if (!data) return;

            // Add calories
            combined.calories += data.calories || 0;

            // Add macros
            if (data.macros) {
                combined.macros.protein_g += data.macros.protein_g || 0;
                combined.macros.carbs_g += data.macros.carbs_g || 0;
                combined.macros.fats_g += data.macros.fats_g || 0;
                combined.macros.fiber_g += data.macros.fiber_g || 0;
                combined.macros.sugars_g += data.macros.sugars_g || 0;
            }

            // Add vitamins
            if (data.vitamins) {
                combined.vitamins.vitamin_A_mcg += data.vitamins.vitamin_A_mcg || 0;
                combined.vitamins.vitamin_C_mg += data.vitamins.vitamin_C_mg || 0;
            }

            // Add minerals
            if (data.minerals) {
                combined.minerals.calcium_mg += data.minerals.calcium_mg || 0;
                combined.minerals.iron_mg += data.minerals.iron_mg || 0;
                combined.minerals.potassium_mg += data.minerals.potassium_mg || 0;
                combined.minerals.sodium_mg += data.minerals.sodium_mg || 0;
            }
        });

        // Round all values to 2 decimal places
        const rounded = NutritionDataStandardizer.roundNutritionValues(combined);

        // Validate the combined data
        try {
            NutritionDataStandardizer.validateNutritionData(rounded);
        } catch (error) {
            logger.error('Invalid combined nutrition data:', { error: error.message });
            throw error;
        }

        return rounded;
    }
}

module.exports = new FatSecretService();