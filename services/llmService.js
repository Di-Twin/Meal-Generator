const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

class LLMService {
  static async generateMealPlan(prompt) {
    try {
      logger.info('Starting meal plan generation with LLM...');
      logger.debug('Sending prompt to LLM API:', { system: prompt.system.substring(0, 100) + '...' });
      
      // Add retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let parsedJson = null;
      let lastError = null;
      
      while (attempts < maxAttempts && !parsedJson) {
        try {
          attempts++;
          logger.info(`Attempt ${attempts}/${maxAttempts} for meal plan generation`);
          
          const completion = await openai.chat.completions.create({
            model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
            messages: [
              { 
                role: 'system', 
                content: prompt.system + '\n\nYou MUST respond with valid, complete JSON only. No markdown, no explanations, just the JSON object. Ensure all properties are properly quoted and all values are properly formatted.' 
              },
              { role: 'user', content: prompt.user },
            ],
            temperature: 0.3 + (attempts * 0.1), // Slightly increase temperature with each retry
            max_tokens: 7000,
            response_format: { type: "json_object" }, // Force JSON response if the API supports it
          });
      
          logger.info('Received response from LLM API');
          
          let response = completion.choices[0].message.content;
          logger.debug('Raw LLM response:', { 
            attempt: attempts,
            preview: response.substring(0, 200) + '...',
            length: response.length
          });
          
          if (!response || response.trim().length === 0) {
            throw new Error('Received empty response from LLM');
          }
          
          logger.info('Cleaning JSON response...', { attempt: attempts });
          response = this.cleanJsonResponse(response);
          logger.debug('Cleaned response:', { 
            attempt: attempts,
            preview: response.substring(0, 200) + '...',
            length: response.length
          });
          
          logger.info('Parsing JSON response...', { attempt: attempts });
          parsedJson = JSON.parse(response);
          
          // Validate the parsed JSON structure
          if (!this.isValidMealPlanStructure(parsedJson)) {
            const validationError = new Error('Invalid meal plan structure');
            logger.warn('Meal plan validation failed:', { 
              attempt: attempts,
              error: validationError.message,
              data: JSON.stringify(parsedJson).substring(0, 200) + '...'
            });
            throw validationError;
          }
          
          logger.info('JSON parsed successfully', { attempt: attempts });
          
        } catch (attemptError) {
          lastError = attemptError;
          logger.warn(`Attempt ${attempts}/${maxAttempts} failed:`, { 
            error: attemptError.message,
            stack: attemptError.stack,
            attempt: attempts
          });
          
          if (attempts >= maxAttempts) {
            // If all attempts failed, use a minimal valid structure
            logger.warn('All attempts failed, using fallback structure', {
              lastError: lastError.message,
              totalAttempts: attempts
            });
            parsedJson = {
              days: [{
                day: "Day 1",
                meals: {
                  breakfast: {
                    name: "Oatmeal with Fruits",
                    ingredients: "oats, milk, banana, honey",
                    description: "A healthy breakfast with complex carbs and natural sweetness",
                    estimated_calories: 350
                  },
                  lunch: {
                    name: "Grilled Chicken Salad",
                    ingredients: "chicken breast, mixed greens, cherry tomatoes, cucumber, olive oil",
                    description: "A protein-rich salad with fresh vegetables",
                    estimated_calories: 450
                  },
                  dinner: {
                    name: "Baked Salmon with Vegetables",
                    ingredients: "salmon fillet, broccoli, sweet potato, olive oil",
                    description: "Omega-3 rich fish with roasted vegetables",
                    estimated_calories: 550
                  },
                  snack: {
                    name: "Greek Yogurt with Berries",
                    ingredients: "Greek yogurt, mixed berries, honey",
                    description: "Protein-rich snack with antioxidants",
                    estimated_calories: 200
                  }
                },
                total_day_calories: 1550,
                summary: "A balanced day of meals with good protein distribution and healthy fats"
              }]
            };
          }
          
          // Wait a bit before retrying
          if (attempts < maxAttempts) {
            const delay = 1000 * attempts; // Increase delay with each retry
            logger.info(`Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      return parsedJson;
    } catch (error) {
      logger.error('Error generating meal plan:', { 
        error: error.message, 
        stack: error.stack,
        lastError: lastError?.message
      });
      throw new Error('Failed to generate meal plan');
    }
  }
  
  static cleanJsonResponse(response) {
    try {
    logger.info('Starting JSON cleaning process...');
    
      // First try to parse as is
      try {
        const json = JSON.parse(response);
        if (this.isValidMealPlanStructure(json)) {
          return response;
        }
      } catch (e) {
        logger.debug('Initial parse failed, proceeding with cleaning');
      }
      
      // Remove any markdown code block markers
      response = response.replace(/```json\n?|\n?```/g, '');
      
      // Remove any leading/trailing whitespace
      response = response.trim();
      
      // If the response starts with a BOM, remove it
      if (response.charCodeAt(0) === 0xFEFF) {
        response = response.slice(1);
      }

      // Fix common JSON formatting issues
      response = response
        // Fix unquoted property names
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
        // Fix single quotes to double quotes
        .replace(/'/g, '"')
        // Fix trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix missing commas between properties
        .replace(/"\s*}\s*"/g, '", "')
        // Fix missing quotes around values
        .replace(/:\s*([^",\{\}\[\]\s][^",\{\}\[\]]*?)(\s*[,}])/g, ':"$1"$2');

      // Try to find a valid JSON object
      const jsonPattern = /\{[\s\S]*\}/;
      const match = response.match(jsonPattern);
      
      if (match) {
      logger.info('Found JSON object pattern');
        response = match[0];
        
        // Validate the JSON structure
        try {
          const parsed = JSON.parse(response);
          if (this.isValidMealPlanStructure(parsed)) {
            logger.info('Successfully cleaned and validated JSON');
            return response;
          } else {
            logger.warn('JSON structure is invalid after cleaning');
          }
        } catch (parseError) {
          logger.warn('Failed to parse cleaned JSON:', { error: parseError.message });
        }
      }
      
      // If we get here, try to extract just the days array
      const daysPattern = /"days"\s*:\s*\[([\s\S]*?)\]/;
      const daysMatch = response.match(daysPattern);
      
      if (daysMatch) {
        logger.info('Found days array, attempting to reconstruct JSON');
        try {
          const daysJson = `{"days": [${daysMatch[1]}]}`;
          const parsed = JSON.parse(daysJson);
          if (parsed.days && Array.isArray(parsed.days)) {
            logger.info('Successfully extracted days array');
            return daysJson;
          }
        } catch (parseError) {
          logger.warn('Failed to parse days array:', { error: parseError.message });
        }
      }
      
      // If all else fails, try to extract individual meals and reconstruct
      const mealPattern = /"meals"\s*:\s*\{([\s\S]*?)\}/;
      const mealMatch = response.match(mealPattern);
      
      if (mealMatch) {
        logger.info('Found meals object, attempting to reconstruct JSON');
        try {
          const mealsJson = `{"days": [{"day": "Day 1", "meals": {${mealMatch[1]}}}]}`;
          const parsed = JSON.parse(mealsJson);
          if (parsed.days && Array.isArray(parsed.days)) {
            logger.info('Successfully extracted meals object');
            return mealsJson;
          }
        } catch (parseError) {
          logger.warn('Failed to parse meals object:', { error: parseError.message });
      }
    }
    
    logger.warn('Could not extract valid JSON, returning original text');
      return response;
    } catch (error) {
      logger.error('Error cleaning JSON response:', { error: error.message });
      return response;
    }
  }

  static isValidMealPlanStructure(data) {
    try {
      if (!data || typeof data !== 'object') {
        logger.warn('Invalid data type:', { type: typeof data });
        return false;
      }
      
      if (!data.days || !Array.isArray(data.days)) {
        logger.warn('Invalid days array:', { days: data.days });
        return false;
      }
      
      if (data.days.length === 0) {
        logger.warn('Empty days array');
        return false;
      }
      
      for (const day of data.days) {
        if (!day.day || !day.meals) {
          logger.warn('Invalid day structure:', { day });
          return false;
        }
        
        if (!day.meals.breakfast || !day.meals.lunch || !day.meals.dinner || !day.meals.snack) {
          logger.warn('Missing meals in day:', { meals: day.meals });
          return false;
        }
        
        for (const [mealType, meal] of Object.entries(day.meals)) {
          if (!meal.name || !meal.ingredients || !meal.description || typeof meal.estimated_calories !== 'number') {
            logger.warn('Invalid meal structure:', { mealType, meal });
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error validating meal plan structure:', { error: error.message });
      return false;
    }
  }

  static async estimateNutrition(meal) {
    const logger = require('../utils/logger');
    try {
      logger.info('Estimating nutrition with LLM fallback', { meal: meal.name });
      
      // Build a detailed prompt for nutrition estimation
      const prompt = {
        system: `You are a clinical dietitian with expertise in nutrition analysis. Given a meal's details, estimate its nutritional content as accurately as possible.

Requirements:
1. All values must be positive numbers
2. Calories must be realistic for the meal size
3. Macros must sum up to a reasonable percentage of total calories
4. Values should be rounded to 2 decimal places

Respond with valid JSON in this exact schema:
{
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
}`,
        user: `Meal Name: ${meal.name}
Ingredients: ${meal.ingredients}
Description: ${meal.description}

Please provide accurate nutrition data based on the ingredients and typical serving sizes. Consider:
1. The main ingredients and their quantities
2. Cooking methods mentioned
3. Typical portion sizes
4. Common nutritional values for similar meals`
      };

      const completion = await openai.chat.completions.create({
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: 0.3,
        max_tokens: 7000,
        response_format: { type: "json_object" }
      });

      let response = completion.choices[0].message.content;
      
      // Clean and parse the response
      response = this.cleanJsonResponse(response);
      const nutritionData = JSON.parse(response);

      // Validate the nutrition data
      if (!this.isValidNutritionData(nutritionData)) {
        logger.warn('LLM returned invalid nutrition data:', { 
          meal: meal.name,
          nutritionData 
        });
        return null;
      }

      // Round all values to 2 decimal places
      return this.roundNutritionValues(nutritionData);

    } catch (error) {
      logger.error('Error estimating nutrition with LLM:', { 
        meal: meal.name, 
        error: error.message 
      });
      return null;
    }
  }

  static isValidNutritionData(nutritionData) {
    if (!nutritionData) return false;
    
    // Check required fields
    const requiredFields = ['calories', 'macros'];
    for (const field of requiredFields) {
      if (!nutritionData[field]) return false;
    }
    
    // Check calories
    if (typeof nutritionData.calories !== 'number' || nutritionData.calories <= 0) return false;
    
    // Check macros
    const requiredMacros = ['protein_g', 'carbs_g', 'fats_g'];
    for (const macro of requiredMacros) {
      if (typeof nutritionData.macros[macro] !== 'number' || nutritionData.macros[macro] < 0) return false;
    }
    
    // Validate macro percentages (should be roughly 100% of calories)
    const proteinCalories = nutritionData.macros.protein_g * 4;
    const carbsCalories = nutritionData.macros.carbs_g * 4;
    const fatCalories = nutritionData.macros.fats_g * 9;
    const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;
    
    // Allow for some margin of error (80-120% of total calories)
    const calorieRange = {
      min: nutritionData.calories * 0.8,
      max: nutritionData.calories * 1.2
    };
    
    if (totalMacroCalories < calorieRange.min || totalMacroCalories > calorieRange.max) {
      return false;
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
}

module.exports = LLMService;