const fatSecretService = require('../services/fatsecretService');
const nutritionCache = require('../utils/nutritionCache');
const Nutrition = require('../models/nutrition');
const { AppError } = require('../middleware/errorHandler');

class NutritionController {
    async getNutritionData(req, res) {
        try {
            const { foodDescription } = req.body;

            if (!foodDescription) {
                return res.status(400).json({
                    success: false,
                    message: 'Food description is required'
                });
            }

            // First check cache (both in-memory and database)
            let nutritionData = await nutritionCache.get(foodDescription);
            let totalNutrition;
            let source = 'cache';
            
            if (!nutritionData) {
                // If not in cache, fetch from FatSecret API
                nutritionData = await fatSecretService.getNutritionData(foodDescription);
                totalNutrition = fatSecretService.extractTotalNutrition(nutritionData);
                source = 'api';
                
                // Store in cache with total nutrition
                await nutritionCache.set(foodDescription, nutritionData, totalNutrition);
            } else {
                // Extract total nutrition from cached data
                totalNutrition = fatSecretService.extractTotalNutrition(nutritionData);
            }

            return res.status(200).json({
                success: true,
                data: {
                    detailed: nutritionData,
                    total: totalNutrition,
                    source: source
                }
            });
        } catch (error) {
            console.error('Error in getNutritionData:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get nutrition data',
                error: error.message
            });
        }
    }
    
    async getBatchNutritionData(req, res) {
        try {
            const { ingredients } = req.body;
            
            if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid ingredients array is required'
                });
            }
            
            // Get batch nutrition data
            const batchResults = await fatSecretService.getBatchNutritionData(ingredients);
            
            // Process results
            const processedResults = {};
            for (const [ingredient, data] of Object.entries(batchResults)) {
                if (data) {
                    processedResults[ingredient] = {
                        detailed: data,
                        total: fatSecretService.extractTotalNutrition(data)
                    };
                } else {
                    processedResults[ingredient] = null;
                }
            }
            
            return res.status(200).json({
                success: true,
                data: processedResults
            });
        } catch (error) {
            console.error('Error in getBatchNutritionData:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get batch nutrition data',
                error: error.message
            });
        }
    }
    
    // Add a new endpoint to clear cache for testing
    async clearNutritionCache(req, res) {
        try {
            const { foodDescription } = req.body;
            await nutritionCache.clear(foodDescription);
            
            return res.status(200).json({
                success: true,
                message: foodDescription 
                    ? `Cache cleared for: ${foodDescription}`
                    : 'All nutrition cache cleared'
            });
        } catch (error) {
            console.error('Error clearing cache:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to clear cache',
                error: error.message
            });
        }
    }
}

module.exports = new NutritionController();