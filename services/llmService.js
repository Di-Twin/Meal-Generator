const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

class LLMService {
  static async generateMealPlan(prompt) {
    try {
      logger.info('Starting meal plan generation with LLM...');
      logger.debug('Sending prompt to LLM API:', { system: prompt.system.substring(0, 100) + '...' });
      
      const completion = await openai.chat.completions.create({
        model: 'qwen/qwen3-30b-a3b:free',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0.5,
        max_tokens: 15000,
      });

      logger.info('Received response from LLM API');
      
      let response = completion.choices[0].message.content;
      logger.debug('Raw LLM response:', { preview: response.substring(0, 200) + '...' });
      
      logger.info('Cleaning JSON response...');
      response = this.cleanJsonResponse(response);
      logger.debug('Cleaned response:', { preview: response.substring(0, 200) + '...' });
      
      logger.info('Parsing JSON response...');
      const parsedJson = JSON.parse(response);
      logger.info('JSON parsed successfully');
      
      return parsedJson;
    } catch (error) {
      logger.error('Error generating meal plan:', { error: error.message, stack: error.stack });
      throw new Error('Failed to generate meal plan');
    }
  }
  
  static cleanJsonResponse(text) {
    logger.info('Starting JSON cleaning process...');
    
    const jsonCodeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
    const codeBlockMatch = text.match(jsonCodeBlockRegex);
    
    if (codeBlockMatch && codeBlockMatch[1]) {
      logger.info('Found markdown code block, extracting JSON content...');
      const potentialJson = codeBlockMatch[1].trim();
      
      if (/^\s*[{\[]/.test(potentialJson)) {
        logger.info('Extracted content appears to be JSON');
        return this.validateAndFixJson(potentialJson);
      }
    }
    
    logger.info('No valid JSON in code blocks, searching for JSON patterns...');
    const jsonObjectRegex = /({[\s\S]*})/;
    const jsonArrayRegex = /(\[[\s\S]*\])/;
    
    const objectMatch = text.match(jsonObjectRegex);
    const arrayMatch = text.match(jsonArrayRegex);
    
    if (objectMatch && objectMatch[1]) {
      logger.info('Found JSON object pattern');
      return this.validateAndFixJson(objectMatch[1].trim());
    }
    
    if (arrayMatch && arrayMatch[1]) {
      logger.info('Found JSON array pattern');
      return this.validateAndFixJson(arrayMatch[1].trim());
    }
    
    logger.info('Searching for expected schema patterns...');
    if (text.includes('"days"') || text.includes('\'days\'')) {
      const daysIndex = Math.max(text.indexOf('"days"'), text.indexOf('\'days\''));
      if (daysIndex > -1) {
        const startIndex = text.lastIndexOf('{', daysIndex);
        if (startIndex > -1) {
          let bracketCount = 1;
          let endIndex = startIndex + 1;
          
          while (bracketCount > 0 && endIndex < text.length) {
            if (text[endIndex] === '{') bracketCount += 1;
            if (text[endIndex] === '}') bracketCount -= 1;
            endIndex += 1;
          }
          
          if (bracketCount === 0) {
            logger.info('Extracted JSON using schema pattern matching');
            return this.validateAndFixJson(text.substring(startIndex, endIndex).trim());
          }
        }
      }
    }
    
    logger.warn('Could not extract valid JSON, returning original text');
    return this.validateAndFixJson(text.trim());
  }

  static validateAndFixJson(jsonString) {
    try {
      logger.info('Attempting to parse JSON as is...');
      JSON.parse(jsonString);
      return jsonString;
    } catch (error) {
      logger.info('Initial JSON parse failed, attempting to fix common issues...');
      
      let fixedJson = jsonString
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
        .replace(/'/g, '"')
        .replace(/}(\s*){/g, '},{')
        .replace(/](\s*)\[/g, '],[')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        .replace(/,+/g, ',')
        .replace(/,\s*([}\]])/g, '$1');

      try {
        logger.info('Attempting to parse fixed JSON...');
        JSON.parse(fixedJson);
        logger.info('Successfully fixed JSON');
        return fixedJson;
      } catch (fixError) {
        logger.error('Failed to fix JSON:', { error: fixError.message });
        throw new Error('Invalid JSON response from LLM');
      }
    }
  }
}

module.exports = LLMService;