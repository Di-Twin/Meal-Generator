const { Configuration, OpenAIApi } = require('openai');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

const generateMealPlan = async (userData) => {
  try {
    const prompt = `Generate a 7-day meal plan for a ${userData.age}-year-old ${userData.gender} with the following specifications:
    - Height: ${userData.height}cm
    - Weight: ${userData.weight}kg
    - Activity Level: ${userData.activity}
    - Goal: ${userData.goal}
    - Daily Calories: ${userData.dailyCalories}
    - Macro Split: ${JSON.stringify(userData.macroSplit)}
    - Cuisine Preference: ${userData.cuisinePreference}
    - Allergies: ${userData.allergies.join(', ')}
    - Foods to Avoid: ${userData.avoid.join(', ')}

    Please provide a detailed meal plan with:
    1. Breakfast, lunch, dinner, and snack for each day
    2. Ingredients and portions for each meal
    3. Nutritional information (calories, macros, micros)
    4. Total daily calories and macros
    5. Weekly shopping list`;

    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional nutritionist and meal planner. Provide detailed, accurate, and personalized meal plans."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const response = completion.data.choices[0].message.content;
    return JSON.parse(response);
  } catch (error) {
    logger.error('Error generating meal plan:', error);
    throw new AppError('Failed to generate meal plan', 500);
  }
};

module.exports = {
  generateMealPlan
}; 

