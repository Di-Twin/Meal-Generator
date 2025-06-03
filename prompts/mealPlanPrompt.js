const logger = require('../utils/logger');

const generateMealPlanPrompt = (userData) => {
  const {
    name,
    age,
    gender,
    height,
    weight,
    activity,
    goal,
    dailyCalories,
    macroTargets,
    allergies,
    avoid,
    cuisinePreference,
    numberOfDays = 1
  } = userData;

  logger.info('Generating meal plan prompt', { name: name });
  
  const prompt = {
    system: `You are a professional nutritionist and chef specializing in ${cuisinePreference} cuisine. Create a detailed meal plan that meets the following requirements:

1. Daily Calorie Target: ${dailyCalories} calories (MUST BE EXACT)
2. Macro Split (MUST BE EXACT):
   - Carbs: ${macroTargets.carbs_g}g (${Math.round((macroTargets.carbs_g * 4 / dailyCalories) * 100)}% of calories)
   - Protein: ${macroTargets.protein_g}g (${Math.round((macroTargets.protein_g * 4 / dailyCalories) * 100)}% of calories)
   - Fats: ${macroTargets.fats_g}g (${Math.round((macroTargets.fats_g * 9 / dailyCalories) * 100)}% of calories)

3. Dietary Restrictions:
   - Allergies: ${allergies.join(', ') || 'None'}
   - Foods to Avoid: ${avoid.join(', ') || 'None'}

4. Meal Structure (MUST FOLLOW EXACTLY):
   - Breakfast: 25-30% of daily calories (${Math.round(dailyCalories * 0.25)}-${Math.round(dailyCalories * 0.35)} calories)
   - Lunch: 30-35% of daily calories (${Math.round(dailyCalories * 0.30)}-${Math.round(dailyCalories * 0.30)} calories)
   - Dinner: 30-35% of daily calories (${Math.round(dailyCalories * 0.20)}-${Math.round(dailyCalories * 0.25)} calories)
   - Snack: 10-15% of daily calories (${Math.round(dailyCalories * 0.10)}-${Math.round(dailyCalories * 0.15)} calories)

5. Cuisine Preference: ${cuisinePreference}

6. Health Goals: ${goal}

CRITICAL REQUIREMENTS:
1. Total daily calories MUST equal exactly ${dailyCalories}
2. Macro split MUST match exactly: ${macroTargets.carbs_g}g carbs, ${macroTargets.protein_g}g protein, ${macroTargets.fats_g}g fat
3. Each meal's calories MUST fall within its specified range
4. All meals MUST be ${cuisinePreference} style
5. NO ingredients from allergies or avoid lists
6. All nutrition values MUST be positive numbers

IMPORTANT: You must respond with a JSON object in the following exact structure:
{
  "days": [
    {
      "day": "Day 1",
      "meals": {
        "breakfast": {
          "name": "string",
          "description": "string",
          "ingredients": "string (comma-separated with quantities)",
          "estimated_calories": number,
          "nutrition": {
            "calories": number,
            "macros": {
              "protein_g": number,
              "carbs_g": number,
              "fats_g": number,
              "fiber_g": number,
              "sugars_g": number
            },
            "vitamins": {
              "vitamin_A_mcg": number,
              "vitamin_C_mg": number
            },
            "minerals": {
              "calcium_mg": number,
              "iron_mg": number,
              "potassium_mg": number,
              "sodium_mg": number
            }
          }
        },
        "lunch": { /* same structure as breakfast */ },
        "dinner": { /* same structure as breakfast */ },
        "snack": { /* same structure as breakfast */ }
      },
      "total_day_calories": number,
      "daily_nutrition": {
        "calories": number,
        "macros": {
          "protein_g": number,
          "carbs_g": number,
          "fats_g": number,
          "fiber_g": number,
          "sugars_g": number
        },
        "vitamins": {
          "vitamin_A_mcg": number,
          "vitamin_C_mg": number
        },
        "minerals": {
          "calcium_mg": number,
          "iron_mg": number,
          "potassium_mg": number,
          "sodium_mg": number
        }
      },
      "summary": "string"
    }
  ]
}

Before returning the response, verify that:
1. Total calories = ${dailyCalories}
2. Total macros match exactly: ${macroTargets.carbs_g}g carbs, ${macroTargets.protein_g}g protein, ${macroTargets.fats_g}g fat
3. Each meal's calories are within their specified ranges
4. All meals are ${cuisinePreference} style
5. No restricted ingredients are used`,
    user: `Create a ${numberOfDays}-day meal plan for:
Name: ${name}
Age: ${age}
Gender: ${gender}
Height: ${height} cm
Weight: ${weight} kg
Activity Level: ${activity}
Goal: ${goal}
Daily Calories: ${dailyCalories}
Cuisine Preference: ${cuisinePreference}

The meal plan must be in ${cuisinePreference} style and strictly follow the macro split and calorie requirements.`
  };
  
  logger.debug('Generated prompt:', { 
    systemLength: prompt.system.length,
    userLength: prompt.user.length
  });
  
  return prompt;
};

module.exports = { generateMealPlanPrompt };