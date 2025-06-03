const LLMService = require('../services/llmService');
const { generateMealPlanPrompt } = require('../prompts/mealPlanPrompt');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const MealPlan = require('../Database/models/postgres/mealPlan');
const nutritionixService = require('../services/nutritionixService');
const { v4: uuidv4 } = require('uuid');
const fatsecretService = require('../services/fatsecretService');

class MealPlanController {
  static async generatePlan(req, res) {
    try {
      logger.info('Generating new meal plan', { requestId: req.requestId });
      
      // Ensure req.body exists and has the required data
      if (!req.body || typeof req.body !== 'object') {
        logger.error('Invalid request body:', { 
          requestId: req.requestId,
          body: req.body 
        });
        throw new AppError('Invalid request body', 400);
      }

      const userData = req.body;
      
      // Parse macro split - handle both string and object formats
      let macroSplit;
      if (typeof userData.macroSplit === 'string') {
        macroSplit = userData.macroSplit.split('-').map(Number);
      } else if (typeof userData.macroSplit === 'object') {
        macroSplit = [
          userData.macroSplit.carbs || 0,
          userData.macroSplit.protein || 0,
          userData.macroSplit.fat || 0
        ];
      } else {
        throw new AppError('Invalid macro split format. Use format "40-30-30" or object with carbs, protein, fat properties', 400);
      }

      if (macroSplit.length !== 3 || macroSplit.reduce((a, b) => a + b) !== 100) {
        throw new AppError('Invalid macro split. Values must sum to 100%', 400);
      }

      // Calculate macro targets in grams
      const dailyCalories = userData.dailyCalories;
      const macroTargets = {
        carbs_g: Math.round((dailyCalories * (macroSplit[0] / 100)) / 4), // 4 calories per gram
        protein_g: Math.round((dailyCalories * (macroSplit[1] / 100)) / 4), // 4 calories per gram
        fats_g: Math.round((dailyCalories * (macroSplit[2] / 100)) / 9) // 9 calories per gram
      };

      logger.debug('Calculated macro targets:', {
        requestId: req.requestId,
        dailyCalories,
        macroTargets
      });

      // Log sanitized user data (excluding sensitive information)
      logger.debug('Received user data:', { 
        requestId: req.requestId,
        name: userData.name, 
        age: userData.age,
        gender: userData.gender,
        height: userData.height,
        weight: userData.weight,
        activity: userData.activity,
        goal: userData.goal,
        dailyCalories: userData.dailyCalories,
        macroSplit: userData.macroSplit,
        macroTargets,
        allergies: userData.allergies,
        avoid: userData.avoid,
        cuisinePreference: userData.cuisinePreference,
        numberOfDays: userData.numberOfDays || 1 // Default to 1 day if not specified
      });

      // Validate user data
      const validationErrors = MealPlanController.validateUserData(userData);
      if (validationErrors.length > 0) {
        logger.warn('Validation errors:', { 
          requestId: req.requestId,
          errors: validationErrors 
        });
        throw new AppError(`Invalid user data: ${validationErrors.join(', ')}`, 400);
      }

      logger.info('User data validated successfully', { requestId: req.requestId });
      const sanitizedUserData = MealPlanController.sanitizeUserData(userData);
      logger.debug('Sanitized user data:', { 
        requestId: req.requestId,
        data: sanitizedUserData 
      });

      // Generate meal plan
      logger.info('Generating meal plan prompt', { requestId: req.requestId });
      const prompt = generateMealPlanPrompt({
        ...sanitizedUserData,
        macroTargets,
        targetCalories: dailyCalories
      });
      
      logger.info('Generating meal plan with LLM', { requestId: req.requestId });
      const mealPlanData = await LLMService.generateMealPlan(prompt);
      
      if (!mealPlanData || !mealPlanData.days || !Array.isArray(mealPlanData.days)) {
        logger.error('Invalid meal plan data from LLM:', { 
          requestId: req.requestId,
          data: mealPlanData 
        });
        throw new AppError('Failed to generate valid meal plan data', 500);
      }

      // Limit to requested number of days
      mealPlanData.days = mealPlanData.days.slice(0, userData.numberOfDays || 1);

      // Enrich with nutrition data
      logger.info('Fetching nutrition data for meals', { requestId: req.requestId });
      const enrichedMealPlan = await MealPlanController.enrichMealPlanWithNutrition(mealPlanData);
      logger.info('Nutrition data fetched successfully', { requestId: req.requestId });

      // Validate total calories and macros
      for (const day of enrichedMealPlan.days) {
        const dailyNutrition = day.daily_nutrition;
        const calorieDiff = Math.abs(dailyNutrition.calories - dailyCalories);
        const macroDiffs = {
          carbs: Math.abs(dailyNutrition.macros.carbs_g - macroTargets.carbs_g),
          protein: Math.abs(dailyNutrition.macros.protein_g - macroTargets.protein_g),
          fats: Math.abs(dailyNutrition.macros.fats_g - macroTargets.fats_g)
        };

        // Log any significant deviations
        if (calorieDiff > 100) {
          logger.warn('Significant calorie deviation:', {
            day: day.day,
            target: dailyCalories,
            actual: dailyNutrition.calories,
            difference: calorieDiff
          });
        }

        Object.entries(macroDiffs).forEach(([macro, diff]) => {
          if (diff > 10) {
            logger.warn(`Significant ${macro} deviation:`, {
              day: day.day,
              target: macroTargets[`${macro}_g`],
              actual: dailyNutrition.macros[`${macro}_g`],
              difference: diff
            });
          }
        });
      }

      // Create meal plan in database
      logger.info('Creating meal plan in database', { requestId: req.requestId });
      const mealPlan = await MealPlan.create({
        id: uuidv4(),
        planData: enrichedMealPlan,
        startDate: new Date(),
        endDate: new Date(Date.now() + (userData.numberOfDays || 1) * 24 * 60 * 60 * 1000),
        status: 'active',
        userId: userData.userId
      });

      if (!mealPlan) {
        logger.error('Failed to create meal plan in database:', { 
          requestId: req.requestId,
          data: enrichedMealPlan 
        });
        throw new AppError('Failed to save meal plan', 500);
      }

      logger.info('Meal plan generated successfully:', { 
        requestId: req.requestId,
        id: mealPlan.id 
      });

      // Return the response data instead of sending it
      return {
        success: true,
        message: 'Meal plan generated successfully',
        data: {
          id: mealPlan.id,
          startDate: mealPlan.startDate,
          endDate: mealPlan.endDate,
          status: mealPlan.status,
          planData: mealPlan.planData
        }
      };

    } catch (error) {
      // Log detailed error information
      logger.error('Error in generatePlan:', { 
        requestId: req.requestId,
        error: error.message,
        stack: error.stack,
        body: req.body,
        statusCode: error.statusCode || 500
      });

      // Handle specific error types
      if (error instanceof AppError) {
        throw error; // Pass through AppError instances
      }

      // Handle database errors
      if (error.name === 'SequelizeError') {
        throw new AppError('Database error occurred', 500);
      }

      // Handle LLM service errors
      if (error.name === 'LLMServiceError') {
        throw new AppError('Failed to generate meal plan with AI service', 503);
      }

      // Handle nutrition service errors
      if (error.name === 'NutritionServiceError') {
        throw new AppError('Failed to fetch nutrition data', 503);
      }

      // Handle any other unexpected errors
      throw new AppError(
        error.message || 'An unexpected error occurred while generating meal plan',
        error.statusCode || 500
      );
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
    const LLMService = require('../services/llmService');

    for (const day of mealPlanData.days) {
      logger.debug('Processing day:', { day: day.day });
      const enrichedMeals = {};
      
      for (const [mealType, meal] of Object.entries(day.meals)) {
        logger.info('Fetching nutrition data for meal:', { 
          mealType, 
          name: meal.name,
          provider: 'Nutritionix' // Initial provider
        });
        
        // Try to get nutrition data from Nutritionix first
        let nutritionData = await nutritionixService.getMealNutritionData(meal);
        
        // Validate nutrition data
        if (!this.isValidNutritionData(nutritionData)) {
          logger.warn('Invalid nutrition data from Nutritionix, trying FatSecret:', { 
            mealType, 
            name: meal.name,
            nutritionData,
            provider: 'Nutritionix'
          });
          
          // Try FatSecret as backup
          try {
            logger.info('Attempting to fetch nutrition data from FatSecret:', {
              mealType,
              name: meal.name,
              provider: 'FatSecret'
            });
            
            const fatSecretData = await fatsecretService.getMealNutritionData(meal);
            if (this.isValidNutritionData(fatSecretData)) {
              nutritionData = fatSecretData;
              logger.info('Successfully got nutrition data from FatSecret:', { 
                mealType, 
                name: meal.name,
                provider: 'FatSecret',
                calories: fatSecretData.calories
              });
            } else {
              logger.warn('Invalid nutrition data from FatSecret:', {
                mealType,
                name: meal.name,
                provider: 'FatSecret',
                nutritionData: fatSecretData
              });
            }
          } catch (fatSecretError) {
            logger.warn('FatSecret nutrition data fetch failed:', { 
              mealType, 
              name: meal.name,
              provider: 'FatSecret',
              error: fatSecretError.message 
            });
          }
        } else {
          logger.info('Successfully got nutrition data from Nutritionix:', {
            mealType,
            name: meal.name,
            provider: 'Nutritionix',
            calories: nutritionData.calories
          });
        }

        // If still no valid nutrition data, use LLM fallback
        if (!this.isValidNutritionData(nutritionData)) {
          logger.warn('No valid nutrition data from APIs, using LLM fallback for meal:', { 
            mealType, 
            name: meal.name,
            provider: 'LLM'
          });
          
          try {
            const llmNutrition = await LLMService.estimateNutrition(meal);
            if (this.isValidNutritionData(llmNutrition)) {
              nutritionData = llmNutrition;
              logger.info('Successfully got nutrition data from LLM fallback:', { 
                mealType, 
                name: meal.name,
                provider: 'LLM',
                calories: llmNutrition.calories
              });
            } else {
              logger.warn('LLM fallback returned invalid nutrition data:', { 
                mealType, 
                name: meal.name,
                provider: 'LLM',
                nutritionData: llmNutrition 
              });
            }
          } catch (llmError) {
            logger.error('Error using LLM fallback for nutrition:', { 
              mealType, 
              name: meal.name,
              provider: 'LLM',
              error: llmError.message 
            });
          }
        }

        // If we still don't have valid nutrition data, use estimated values
        if (!this.isValidNutritionData(nutritionData)) {
          logger.warn('No valid nutrition data available after all attempts, using estimated values:', { 
            mealType, 
            name: meal.name,
            provider: 'Estimated',
            estimatedCalories: meal.estimated_calories || 0
          });
          
          // Use estimated calories to create basic nutrition data
          const estimatedCalories = meal.estimated_calories || 0;
          nutritionData = {
            calories: estimatedCalories,
            macros: {
              protein_g: Math.round((estimatedCalories * 0.2) / 4), // 20% of calories from protein
              carbs_g: Math.round((estimatedCalories * 0.5) / 4),  // 50% of calories from carbs
              fats_g: Math.round((estimatedCalories * 0.3) / 9),   // 30% of calories from fat
              fiber_g: Math.round(estimatedCalories / 100),        // Rough estimate
              sugars_g: Math.round(estimatedCalories / 50)         // Rough estimate
            },
            vitamins: {
              vitamin_A_mcg: Math.round(estimatedCalories / 10),   // Rough estimate
              vitamin_C_mg: Math.round(estimatedCalories / 20)     // Rough estimate
            },
            minerals: {
              calcium_mg: Math.round(estimatedCalories / 2),       // Rough estimate
              iron_mg: Math.round(estimatedCalories / 100),        // Rough estimate
              potassium_mg: Math.round(estimatedCalories),         // Rough estimate
              sodium_mg: Math.round(estimatedCalories / 2)         // Rough estimate
            }
          };
          
          logger.info('Using estimated nutrition data:', { 
            mealType, 
            name: meal.name,
            provider: 'Estimated',
            nutritionData 
          });
        }

        // Round nutrition values to 2 decimal places
        nutritionData = this.roundNutritionValues(nutritionData);
        
        enrichedMeals[mealType] = {
          ...meal,
          nutrition: nutritionData
        };
      }

      // Calculate daily totals
      const dailyTotals = this.calculateDailyTotals(enrichedMeals);
      enrichedDays.push({
        ...day,
        meals: enrichedMeals,
        daily_nutrition: dailyTotals,
        total_day_calories: dailyTotals.calories
      });
    }

    logger.info('Meal plan enrichment completed');
    return {
      ...mealPlanData,
      days: enrichedDays
    };
  }

  static isValidNutritionData(nutritionData) {
    if (!nutritionData) return false;
    
    // Check if calories exist and are positive
    if (!nutritionData.calories || nutritionData.calories <= 0) return false;
    
    // Check if macros exist and are valid
    if (!nutritionData.macros) return false;
    const requiredMacros = ['protein_g', 'carbs_g', 'fats_g'];
    for (const macro of requiredMacros) {
      if (!nutritionData.macros[macro] || nutritionData.macros[macro] < 0) return false;
    }
    
    return true;
  }

  static roundNutritionValues(nutritionData) {
    const rounded = { ...nutritionData };
    
    // Round calories
    rounded.calories = Math.round(rounded.calories * 100) / 100;
    
    // Round macros
    if (rounded.macros) {
      Object.keys(rounded.macros).forEach(key => {
        rounded.macros[key] = Math.round(rounded.macros[key] * 100) / 100;
      });
    }
    
    // Round vitamins
    if (rounded.vitamins) {
      Object.keys(rounded.vitamins).forEach(key => {
        rounded.vitamins[key] = Math.round(rounded.vitamins[key] * 100) / 100;
      });
    }
    
    // Round minerals
    if (rounded.minerals) {
      Object.keys(rounded.minerals).forEach(key => {
        rounded.minerals[key] = Math.round(rounded.minerals[key] * 100) / 100;
      });
    }
    
    return rounded;
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
        vitamin_C_mg: 0
      },
      minerals: {
        calcium_mg: 0,
        iron_mg: 0,
        potassium_mg: 0,
        sodium_mg: 0
      }
    };

    let validMeals = 0;
    for (const [mealType, meal] of Object.entries(meals)) {
      if (!meal.nutrition || !this.isValidNutritionData(meal.nutrition)) {
        logger.warn('Skipping invalid nutrition data for meal:', { 
          mealType, 
          name: meal.name 
        });
        continue;
      }

      const n = meal.nutrition;
      validMeals++;
      
      // Add calories
      totals.calories += n.calories || 0;
      
      // Add macros
      if (n.macros) {
        Object.keys(totals.macros).forEach(key => {
          totals.macros[key] += n.macros[key] || 0;
        });
      }

      // Add vitamins
      if (n.vitamins) {
        Object.keys(totals.vitamins).forEach(key => {
          totals.vitamins[key] += n.vitamins[key] || 0;
        });
      }

      // Add minerals
      if (n.minerals) {
        Object.keys(totals.minerals).forEach(key => {
          totals.minerals[key] += n.minerals[key] || 0;
        });
      }

      // Validate consistency between estimated_calories and nutrition data
      if (meal.estimated_calories && n.calories) {
        const difference = Math.abs(meal.estimated_calories - n.calories);
        if (difference > 50) { // Allow 50 calorie difference
          logger.warn('Calorie mismatch between estimated and nutrition data:', {
            mealType,
            name: meal.name,
            estimated: meal.estimated_calories,
            actual: n.calories,
            difference
          });
          // Update estimated_calories to match nutrition data
          meal.estimated_calories = n.calories;
        }
      }
    }

    // Round all values to 2 decimal places
    Object.keys(totals).forEach(key => {
      if (typeof totals[key] === 'number') {
        totals[key] = Math.round(totals[key] * 100) / 100;
      } else if (typeof totals[key] === 'object') {
        Object.keys(totals[key]).forEach(subKey => {
          totals[key][subKey] = Math.round(totals[key][subKey] * 100) / 100;
        });
      }
    });

    // Update total_day_calories to match calculated total
    if (validMeals > 0) {
      meals.total_day_calories = totals.calories;
    }

    return totals;
  }
}

module.exports = MealPlanController;