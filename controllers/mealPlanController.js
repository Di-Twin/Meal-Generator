const LLMService = require('../services/llmService');
const { generateMealPlanPrompt } = require('../prompts/mealPlanPrompt');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const MealPlan = require('../Database/models/postgres/mealPlan');
const fatSecretService = require('../services/fatsecretService');
const { v4: uuidv4 } = require('uuid');

class MealPlanController {
  static async generatePlan(req, res) {
    try {
      logger.info('Generating new meal plan');
      const userData = req.body;
      logger.debug('Received user data:', { name: userData.name, age: userData.age });

      const validationErrors = MealPlanController.validateUserData(userData);
      if (validationErrors.length > 0) {
        logger.warn('Validation errors:', { errors: validationErrors });
        throw new AppError(`Invalid user data: ${validationErrors.join(', ')}`, 400);
      }

      logger.info('User data validated successfully');
      const sanitizedUserData = MealPlanController.sanitizeUserData(userData);
      logger.debug('Sanitized user data:', sanitizedUserData);

      logger.info('Generating meal plan prompt');
      const prompt = generateMealPlanPrompt(sanitizedUserData);
      logger.info('Generating meal plan with LLM');
      const mealPlanData = await LLMService.generateMealPlan(prompt);

      logger.info('Fetching nutrition data for meals');
      const enrichedMealPlan = await MealPlanController.enrichMealPlanWithNutrition(mealPlanData);
      logger.info('Nutrition data fetched successfully');

      logger.info('Creating meal plan in database');
      const mealPlan = await MealPlan.create({
        id: uuidv4(),
        planData: enrichedMealPlan,
        startDate: new Date(),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      logger.info('Meal plan generated successfully:', { id: mealPlan.id });
      res.status(201).json({
        success: true,
        message: 'Meal plan generated successfully',
        data: mealPlan
      });
    } catch (error) {
      logger.error('Error in generatePlan:', { error: error.message, stack: error.stack });
      throw new AppError(error.message || 'Failed to generate meal plan', error.statusCode || 500);
    }
  }

  static async getCurrentPlan(req, res) {
    try {
      logger.info('Retrieving current meal plan');
      const mealPlan = await MealPlan.findOne({
        where: {
          status: 'active'
        },
        order: [['createdAt', 'DESC']]
      });

      if (!mealPlan) {
        logger.warn('No active meal plan found');
        throw new AppError('No active meal plan found', 404);
      }

      logger.info('Current meal plan retrieved successfully:', { id: mealPlan.id });
      res.status(200).json({
        success: true,
        message: 'Meal plan retrieved successfully',
        data: mealPlan
      });
    } catch (error) {
      logger.error('Error in getCurrentPlan:', { error: error.message, stack: error.stack });
      throw new AppError(error.message || 'Failed to retrieve meal plan', error.statusCode || 500);
    }
  }

  static async updatePlan(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      logger.info('Updating meal plan:', { id, status });
      
      if (!['active', 'completed', 'cancelled'].includes(status)) {
        logger.warn('Invalid status value:', { status });
        throw new AppError('Invalid status value', 400);
      }

      const mealPlan = await MealPlan.findByPk(id);
      if (!mealPlan) {
        logger.warn('Meal plan not found:', { id });
        throw new AppError('Meal plan not found', 404);
      }

      logger.info('Updating meal plan status:', { id, oldStatus: mealPlan.status, newStatus: status });
      await mealPlan.update({ status });
      
      logger.info('Meal plan updated successfully:', { id });
      res.status(200).json({
        success: true,
        message: 'Meal plan updated successfully',
        data: mealPlan
      });
    } catch (error) {
      logger.error('Error in updatePlan:', { error: error.message, stack: error.stack });
      throw new AppError(error.message || 'Failed to update meal plan', error.statusCode || 500);
    }
  }

  static async deletePlan(req, res) {
    try {
      const { id } = req.params;
      logger.info('Deleting meal plan:', { id });
      
      const mealPlan = await MealPlan.findByPk(id);
      if (!mealPlan) {
        logger.warn('Meal plan not found:', { id });
        throw new AppError('Meal plan not found', 404);
      }

      logger.info('Deleting meal plan from database:', { id });
      await mealPlan.destroy();
      
      logger.info('Meal plan deleted successfully:', { id });
      res.status(200).json({
        success: true,
        message: 'Meal plan deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deletePlan:', { error: error.message, stack: error.stack });
      throw new AppError(error.message || 'Failed to delete meal plan', error.statusCode || 500);
    }
  }

  static validateUserData(userData) {
    logger.debug('Validating user data');
    const errors = [];
    const requiredFields = ['name', 'age', 'gender', 'height', 'weight', 'activity', 'goal', 'dailyCalories', 'macroSplit'];
    
    for (const field of requiredFields) {
      if (!userData[field]) {
        logger.debug('Missing required field:', { field });
        errors.push(`${field} is required`);
      }
    }
    
    if (userData.age && (isNaN(userData.age) || userData.age < 1 || userData.age > 120)) {
      logger.debug('Invalid age:', { age: userData.age });
      errors.push('age must be a number between 1 and 120');
    }
    
    if (userData.height && (isNaN(userData.height) || userData.height < 50 || userData.height > 300)) {
      logger.debug('Invalid height:', { height: userData.height });
      errors.push('height must be a number between 50 and 300 cm');
    }
    
    if (userData.weight && (isNaN(userData.weight) || userData.weight < 20 || userData.weight > 500)) {
      logger.debug('Invalid weight:', { weight: userData.weight });
      errors.push('weight must be a number between 20 and 500 kg');
    }
    
    if (userData.dailyCalories && (isNaN(userData.dailyCalories) || userData.dailyCalories < 500 || userData.dailyCalories > 10000)) {
      logger.debug('Invalid daily calories:', { calories: userData.dailyCalories });
      errors.push('dailyCalories must be a number between 500 and 10000');
    }
    
    const validGenders = ['male', 'female', 'other'];
    if (userData.gender && !validGenders.includes(userData.gender.toLowerCase())) {
      logger.debug('Invalid gender:', { gender: userData.gender });
      errors.push(`gender must be one of: ${validGenders.join(', ')}`);
    }
    
    const validActivityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
    if (userData.activity && !validActivityLevels.includes(userData.activity.toLowerCase())) {
      logger.debug('Invalid activity level:', { activity: userData.activity });
      errors.push(`activity must be one of: ${validActivityLevels.join(', ')}`);
    }
    
    const validGoals = ['weight_loss', 'weight_maintenance', 'weight_gain', 'muscle_gain'];
    if (userData.goal && !validGoals.includes(userData.goal.toLowerCase())) {
      logger.debug('Invalid goal:', { goal: userData.goal });
      errors.push(`goal must be one of: ${validGoals.join(', ')}`);
    }
    
    logger.debug('Validation complete:', { errorCount: errors.length });
    return errors;
  }
  
  static sanitizeUserData(userData) {
    logger.debug('Sanitizing user data');
    const sanitized = { ...userData };
    
    const numericFields = ['age', 'height', 'weight', 'dailyCalories'];
    for (const field of numericFields) {
      if (sanitized[field]) {
        sanitized[field] = Number(sanitized[field]);
        logger.debug('Converted to number:', { field, value: sanitized[field] });
      }
    }
    
    const enumFields = ['gender', 'activity', 'goal'];
    for (const field of enumFields) {
      if (sanitized[field]) {
        sanitized[field] = sanitized[field].toLowerCase();
        logger.debug('Converted to lowercase:', { field, value: sanitized[field] });
      }
    }
    
    if (!Array.isArray(sanitized.allergies)) {
      sanitized.allergies = sanitized.allergies ? [sanitized.allergies] : [];
      logger.debug('Normalized allergies array:', { allergies: sanitized.allergies });
    }
    
    if (!Array.isArray(sanitized.avoid)) {
      sanitized.avoid = sanitized.avoid ? [sanitized.avoid] : [];
      logger.debug('Normalized avoid array:', { avoid: sanitized.avoid });
    }
    
    logger.debug('Sanitization complete:', sanitized);
    return sanitized;
  }

  static async enrichMealPlanWithNutrition(mealPlanData) {
    logger.info('Starting meal plan enrichment with nutrition data');
    const enrichedDays = [];

    for (const day of mealPlanData.days) {
      logger.debug('Processing day:', { day: day.day });
      
      logger.info('Fetching nutrition data for meals:', { 
        meals: Object.keys(day.meals).join(', ')
      });
      
      const { results: nutritionResults, missing } = await fatSecretService.getBatchMealNutritionData(day.meals);
      
      if (missing.length > 0) {
        logger.warn('Missing nutrition data for some meals:', { 
          missing 
        });
      }

      const enrichedMeals = {};
      for (const [mealType, meal] of Object.entries(day.meals)) {
        const nutritionData = nutritionResults[mealType];
        if (!nutritionData) {
          logger.warn('No nutrition data available for meal:', { mealType, name: meal.name });
          enrichedMeals[mealType] = meal;
          continue;
        }

        const enrichedMeal = {
          ...meal,
          nutrition_data: nutritionData.foods,
          total_nutrition: {
            calories: nutritionData.nutrition.calories,
            macros: {
              protein_g: nutritionData.nutrition.protein,
              carbs_g: nutritionData.nutrition.carbohydrate,
              fats_g: nutritionData.nutrition.fat,
              fiber_g: nutritionData.nutrition.fiber,
              sugars_g: nutritionData.nutrition.sugar
            },
            vitamins: {
              vitamin_A_mcg: nutritionData.nutrition.vitamin_a,
              vitamin_C_mg: nutritionData.nutrition.vitamin_c
            },
            minerals: {
              calcium_mg: nutritionData.nutrition.calcium,
              iron_mg: nutritionData.nutrition.iron,
              potassium_mg: nutritionData.nutrition.potassium,
              sodium_mg: nutritionData.nutrition.sodium
            }
          }
        };

        enrichedMeals[mealType] = enrichedMeal;
      }

      // Calculate daily totals
      const dailyTotals = this.calculateDailyTotals(enrichedMeals);
      
      enrichedDays.push({
        ...day,
        meals: enrichedMeals,
        total_day_calories: dailyTotals.calories,
        daily_macros: dailyTotals.macros,
        daily_micros_vitamins: dailyTotals.vitamins,
        daily_micros_minerals: dailyTotals.minerals
      });
    }

    logger.info('Meal plan enrichment completed');
    return {
      ...mealPlanData,
      days: enrichedDays
    };
  }

  static calculateTotalNutrition(nutritionResults) {
    const totals = {
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
        vitamin_B1_mg: 0,
        vitamin_B2_mg: 0,
        vitamin_B3_mg: 0,
        vitamin_B5_mg: 0,
        vitamin_B6_mg: 0,
        vitamin_B7_mcg: 0,
        vitamin_B9_mcg: 0,
        vitamin_B12_mcg: 0,
        vitamin_C_mg: 0,
        vitamin_D_mcg: 0,
        vitamin_E_mg: 0,
        vitamin_K_mcg: 0
      },
      minerals: {
        calcium_mg: 0,
        iron_mg: 0,
        magnesium_mg: 0,
        potassium_mg: 0,
        sodium_mg: 0,
        zinc_mg: 0,
        phosphorus_mg: 0,
        copper_mg: 0,
        selenium_mcg: 0,
        manganese_mg: 0,
        iodine_mcg: 0
      }
    };

    for (const nutrition of Object.values(nutritionResults)) {
      if (!nutrition) continue;

      const n = nutrition.nutrition;
      totals.calories += parseFloat(n.calories) || 0;
      
      // Macros
      totals.macros.protein_g += parseFloat(n.protein) || 0;
      totals.macros.carbs_g += parseFloat(n.carbohydrate) || 0;
      totals.macros.fats_g += parseFloat(n.fat) || 0;
      totals.macros.fiber_g += parseFloat(n.fiber) || 0;
      totals.macros.sugars_g += parseFloat(n.sugar) || 0;

      // Vitamins
      totals.vitamins.vitamin_A_mcg += parseFloat(n.vitamin_a) || 0;
      totals.vitamins.vitamin_C_mg += parseFloat(n.vitamin_c) || 0;

      // Minerals
      totals.minerals.calcium_mg += parseFloat(n.calcium) || 0;
      totals.minerals.iron_mg += parseFloat(n.iron) || 0;
      totals.minerals.potassium_mg += parseFloat(n.potassium) || 0;
      totals.minerals.sodium_mg += parseFloat(n.sodium) || 0;
    }

    return totals;
  }

  static calculateDailyTotals(meals) {
    const totals = {
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
        vitamin_B1_mg: 0,
        vitamin_B2_mg: 0,
        vitamin_B3_mg: 0,
        vitamin_B5_mg: 0,
        vitamin_B6_mg: 0,
        vitamin_B7_mcg: 0,
        vitamin_B9_mcg: 0,
        vitamin_B12_mcg: 0,
        vitamin_C_mg: 0,
        vitamin_D_mcg: 0,
        vitamin_E_mg: 0,
        vitamin_K_mcg: 0
      },
      minerals: {
        calcium_mg: 0,
        iron_mg: 0,
        magnesium_mg: 0,
        potassium_mg: 0,
        sodium_mg: 0,
        zinc_mg: 0,
        phosphorus_mg: 0,
        copper_mg: 0,
        selenium_mcg: 0,
        manganese_mg: 0,
        iodine_mcg: 0
      }
    };

    for (const meal of Object.values(meals)) {
      if (!meal.total_nutrition) continue;

      const n = meal.total_nutrition;
      totals.calories += n.calories;
      
      // Add macros
      Object.keys(totals.macros).forEach(key => {
        totals.macros[key] += n.macros[key] || 0;
      });

      // Add vitamins
      Object.keys(totals.vitamins).forEach(key => {
        totals.vitamins[key] += n.vitamins[key] || 0;
      });

      // Add minerals
      Object.keys(totals.minerals).forEach(key => {
        totals.minerals[key] += n.minerals[key] || 0;
      });
    }

    return totals;
  }
}

module.exports = MealPlanController; 