const LLMService = require('../services/llmService');
const { generateMealPlanPrompt } = require('../prompts/mealPlanPrompt');
const MealPlan = require('../models/mealPlan');
const User = require('../../../../Database/models/postgres/user');
const UserProfile = require('../../../../Database/models/postgres/userProfile');

class MealPlanController {
  static async generateMealPlan(req, res) {
    try {
      const userId = req.user.id; // Assuming you have authentication middleware

      // Fetch user and profile data
      const user = await User.findByPk(userId);
      const userProfile = await UserProfile.findOne({ where: { userId } });

      if (!user || !userProfile) {
        return res.status(404).json({ error: 'User or profile not found' });
      }

      // Prepare user data for prompt
      const userData = {
        name: user.name,
        age: userProfile.age,
        gender: userProfile.gender,
        height: userProfile.height,
        weight: userProfile.weight,
        activity: userProfile.activityLevel,
        goal: userProfile.fitnessGoal,
        dailyCalories: userProfile.dailyCalories,
        macroSplit: userProfile.macroSplit,
        cuisinePreference: userProfile.cuisinePreference,
        allergies: userProfile.allergies || [],
        avoid: userProfile.foodPreferences?.avoid || []
      };

      // Generate prompt
      const prompt = generateMealPlanPrompt(userData);

      // Generate meal plan using LLM
      const mealPlanData = await LLMService.generateMealPlan(prompt);

      // Save meal plan to database
      const mealPlan = await MealPlan.create({
        userId,
        planData: mealPlanData,
        startDate: new Date(),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        status: 'active'
      });

      return res.status(200).json({
        message: 'Meal plan generated successfully',
        data: mealPlan
      });
    } catch (error) {
      console.error('Error in generateMealPlan:', error);
      return res.status(500).json({ error: 'Failed to generate meal plan' });
    }
  }

  static async getMealPlan(req, res) {
    try {
      const userId = req.user.id;
      const mealPlan = await MealPlan.findOne({
        where: {
          userId,
          status: 'active'
        },
        order: [['createdAt', 'DESC']]
      });

      if (!mealPlan) {
        return res.status(404).json({ error: 'No active meal plan found' });
      }

      return res.status(200).json({
        message: 'Meal plan retrieved successfully',
        data: mealPlan
      });
    } catch (error) {
      console.error('Error in getMealPlan:', error);
      return res.status(500).json({ error: 'Failed to retrieve meal plan' });
    }
  }
}

module.exports = MealPlanController; 