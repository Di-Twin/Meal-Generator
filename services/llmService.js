const OpenAI = require('openai');
const config = require('../../../config');

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouter.apiKey,
  defaultHeaders: {
    "HTTP-Referer": config.openRouter.siteUrl,
    "X-Title": config.openRouter.siteName,
  },
});

class LLMService {
  static async generateMealPlan(prompt) {
    try {
      const completion = await openai.chat.completions.create({
        model: "deepseek/deepseek-r1-distill-qwen-32b:free",
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const response = completion.choices[0].message.content;
      return JSON.parse(response);
    } catch (error) {
      console.error('Error generating meal plan:', error);
      throw new Error('Failed to generate meal plan');
    }
  }
}

module.exports = LLMService; 