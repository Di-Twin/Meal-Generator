const logger = require('./logger');

class NutritionDataStandardizer {
    static standardizeNutritionData(data, source) {
        try {
            if (!data) {
                throw new Error('No data provided for standardization');
            }

            // If data is a string, try to parse it
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    logger.error('Failed to parse nutrition data string:', { error: e.message });
                    throw new Error('Invalid nutrition data format');
                }
            }

            // Handle different data sources
            if (source === 'nutritionix') {
                return this.standardizeNutritionixData(data);
            } else if (source === 'fatsecret') {
                return this.standardizeFatSecretData(data);
            } else {
                // If no source specified, try to detect format
                if (data.foods) {
                    return this.standardizeNutritionixData(data);
                } else if (data.food) {
                    return this.standardizeFatSecretData(data);
                } else if (data.nutrition) {
                    return this.standardizeLLMData(data);
                }
            }

            throw new Error('Unrecognized nutrition data format');
        } catch (error) {
            logger.error('Error standardizing nutrition data:', { error: error.message });
            throw error;
        }
    }

    static standardizeNutritionixData(data) {
        try {
            // Handle both single food and multiple foods response
            const food = Array.isArray(data.foods) ? data.foods[0] : data;
            
            if (!food) {
                throw new Error('No food data found in Nutritionix response');
            }

            // Extract nutrition values with fallbacks
            const calories = food.nf_calories || food.calories || 0;
            const protein = food.nf_protein || food.protein || 0;
            const carbs = food.nf_total_carbohydrate || food.carbohydrates || 0;
            const fats = food.nf_total_fat || food.fat || 0;
            const fiber = food.nf_dietary_fiber || food.fiber || 0;
            const sugars = food.nf_sugars || food.sugar || 0;

            const standardizedData = {
                food_name: food.food_name || food.mealName || 'Unknown',
                calories: calories,
                macros: {
                    protein_g: protein,
                    carbs_g: carbs,
                    fats_g: fats,
                    fiber_g: fiber,
                    sugars_g: sugars
                },
                vitamins: {
                    vitamin_A_mcg: food.nf_vitamin_a_dv || food.vitamin_a || 0,
                    vitamin_C_mg: food.nf_vitamin_c_dv || food.vitamin_c || 0
                },
                minerals: {
                    calcium_mg: food.nf_calcium_dv || food.calcium || 0,
                    iron_mg: food.nf_iron_dv || food.iron || 0,
                    potassium_mg: food.nf_potassium || food.potassium || 0,
                    sodium_mg: food.nf_sodium || food.sodium || 0
                }
            };

            // Validate the standardized data
            this.validateNutritionData(standardizedData);
            
            // Round all nutrition values
            return this.roundNutritionValues(standardizedData);
        } catch (error) {
            logger.error('Error standardizing Nutritionix data:', { error: error.message });
            throw new Error('Invalid Nutritionix data format');
        }
    }

    static standardizeFatSecretData(data) {
        try {
            // Handle both direct food data and search response
            const food = data.food || (data.foods_search?.results?.food?.[0]) || data;
            
            if (!food) {
                throw new Error('No food data found in FatSecret response');
            }

            // Get the first serving with nutrition data
            const serving = Array.isArray(food.servings?.serving) 
                ? food.servings.serving[0] 
                : food.servings?.serving;

            if (!serving) {
                throw new Error('No serving data found in FatSecret response');
            }

            const standardizedData = {
                food_name: food.food_name || 'Unknown',
                calories: parseFloat(serving.calories) || 0,
                macros: {
                    protein_g: parseFloat(serving.protein) || 0,
                    carbs_g: parseFloat(serving.carbohydrate) || 0,
                    fats_g: parseFloat(serving.fat) || 0,
                    fiber_g: parseFloat(serving.fiber) || 0,
                    sugars_g: parseFloat(serving.sugar) || 0
                },
                vitamins: {
                    vitamin_A_mcg: parseFloat(serving.vitamin_a) || 0,
                    vitamin_C_mg: parseFloat(serving.vitamin_c) || 0
                },
                minerals: {
                    calcium_mg: parseFloat(serving.calcium) || 0,
                    iron_mg: parseFloat(serving.iron) || 0,
                    potassium_mg: parseFloat(serving.potassium) || 0,
                    sodium_mg: parseFloat(serving.sodium) || 0
                }
            };

            // Validate the standardized data
            this.validateNutritionData(standardizedData);
            
            // Round all nutrition values
            return this.roundNutritionValues(standardizedData);
        } catch (error) {
            logger.error('Error standardizing FatSecret data:', { 
                error: error.message,
                data: JSON.stringify(data, null, 2)
            });
            throw new Error('Invalid FatSecret data format');
        }
    }

    static standardizeLLMData(data) {
        try {
            const nutrition = data.nutrition || {};
            const macros = nutrition.macros || {};
            const vitamins = nutrition.vitamins || {};
            const minerals = nutrition.minerals || {};

            const standardizedData = {
                food_name: data.mealName || data.food_name || 'Unknown',
                calories: nutrition.calories || 0,
                macros: {
                    protein_g: macros.protein_g || 0,
                    carbs_g: macros.carbs_g || 0,
                    fats_g: macros.fats_g || 0,
                    fiber_g: macros.fiber_g || 0,
                    sugars_g: macros.sugars_g || 0
                },
                vitamins: {
                    vitamin_A_mcg: vitamins.vitamin_A_mcg || 0,
                    vitamin_C_mg: vitamins.vitamin_C_mg || 0
                },
                minerals: {
                    calcium_mg: minerals.calcium_mg || 0,
                    iron_mg: minerals.iron_mg || 0,
                    potassium_mg: minerals.potassium_mg || 0,
                    sodium_mg: minerals.sodium_mg || 0
                }
            };

            // Validate the standardized data
            this.validateNutritionData(standardizedData);
            
            // Round all nutrition values
            return this.roundNutritionValues(standardizedData);
        } catch (error) {
            logger.error('Error standardizing LLM data:', { error: error.message });
            throw new Error('Invalid LLM data format');
        }
    }

    static validateNutritionData(data) {
        if (!data) {
            throw new Error('No nutrition data provided for validation');
        }

        // Check for required fields
        if (typeof data.calories !== 'number' || isNaN(data.calories)) {
            throw new Error('Invalid calories value');
        }

        if (!data.macros || typeof data.macros !== 'object') {
            throw new Error('Invalid macros data');
        }

        // Validate all numeric values
        const validateNumeric = (value, field) => {
            if (typeof value !== 'number' || isNaN(value)) {
                throw new Error(`Invalid ${field} value`);
            }
            return value;
        };

        // Validate macros
        validateNumeric(data.macros.protein_g, 'protein');
        validateNumeric(data.macros.carbs_g, 'carbs');
        validateNumeric(data.macros.fats_g, 'fats');
        validateNumeric(data.macros.fiber_g, 'fiber');
        validateNumeric(data.macros.sugars_g, 'sugars');

        // Validate vitamins
        validateNumeric(data.vitamins.vitamin_A_mcg, 'vitamin A');
        validateNumeric(data.vitamins.vitamin_C_mg, 'vitamin C');

        // Validate minerals
        validateNumeric(data.minerals.calcium_mg, 'calcium');
        validateNumeric(data.minerals.iron_mg, 'iron');
        validateNumeric(data.minerals.potassium_mg, 'potassium');
        validateNumeric(data.minerals.sodium_mg, 'sodium');

        // Check for at least one non-zero nutrition value
        const hasValidNutrition = 
            data.calories > 0 ||
            (data.macros.protein_g > 0) ||
            (data.macros.carbs_g > 0) ||
            (data.macros.fats_g > 0) ||
            (data.macros.fiber_g > 0) ||
            (data.macros.sugars_g > 0);

        if (!hasValidNutrition) {
            throw new Error('No valid nutrition values found');
        }

        return true;
    }

    static roundNutritionValues(data) {
        const round = (value) => {
            if (value === null || value === undefined) return 0;
            return Math.round(value * 100) / 100;
        };

        return {
            ...data,
            calories: round(data.calories),
            macros: {
                protein_g: round(data.macros.protein_g),
                carbs_g: round(data.macros.carbs_g),
                fats_g: round(data.macros.fats_g),
                fiber_g: round(data.macros.fiber_g),
                sugars_g: round(data.macros.sugars_g)
            },
            vitamins: {
                vitamin_A_mcg: round(data.vitamins.vitamin_A_mcg),
                vitamin_C_mg: round(data.vitamins.vitamin_C_mg)
            },
            minerals: {
                calcium_mg: round(data.minerals.calcium_mg),
                iron_mg: round(data.minerals.iron_mg),
                potassium_mg: round(data.minerals.potassium_mg),
                sodium_mg: round(data.minerals.sodium_mg)
            }
        };
    }
}

module.exports = NutritionDataStandardizer; 