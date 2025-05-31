const axios = require('axios');
const fatSecretService = require('../../services/fatsecretService');
const nutritionCache = require('../../utils/nutritionCache');

// Mock axios
jest.mock('axios');

// Mock nutritionCache
jest.mock('../../utils/nutritionCache');

describe('FatSecret Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FATSECRET_CLIENT_ID = 'test_client_id';
    process.env.FATSECRET_CLIENT_SECRET = 'test_client_secret';
  });

  describe('getAccessToken', () => {
    it('should return cached token if valid', async () => {
      const mockToken = 'valid_token';
      fatSecretService.accessToken = mockToken;
      fatSecretService.tokenExpiry = Date.now() + 3600000; // 1 hour from now

      const token = await fatSecretService.getAccessToken();
      expect(token).toBe(mockToken);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should fetch new token if expired', async () => {
      const mockToken = 'new_token';
      axios.post.mockResolvedValueOnce({
        data: {
          access_token: mockToken,
          expires_in: 3600
        }
      });

      const token = await fatSecretService.getAccessToken();
      expect(token).toBe(mockToken);
      expect(axios.post).toHaveBeenCalledWith(
        'https://oauth.fatsecret.com/connect/token',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('getNutritionData', () => {
    it('should return cached data if available', async () => {
      const mockData = { food_response: [] };
      nutritionCache.get.mockReturnValue(mockData);

      const result = await fatSecretService.getNutritionData('apple');
      expect(result).toBe(mockData);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should fetch new data if not cached', async () => {
      const mockData = { food_response: [] };
      axios.post.mockResolvedValueOnce({ data: mockData });

      const result = await fatSecretService.getNutritionData('apple');
      expect(result).toBe(mockData);
      expect(nutritionCache.set).toHaveBeenCalledWith('apple', mockData);
    });

    it('should handle API errors gracefully', async () => {
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      await expect(fatSecretService.getNutritionData('apple'))
        .rejects
        .toThrow('Failed to get nutrition data from FatSecret API');
    });
  });

  describe('extractTotalNutrition', () => {
    it('should correctly extract nutrition data', () => {
      const mockResponse = {
        food_response: [{
          eaten: {
            total_nutritional_content: {
              calories: 100,
              protein: 5,
              carbohydrate: 20,
              fat: 2
            }
          }
        }]
      };

      const result = fatSecretService.extractTotalNutrition(mockResponse);
      expect(result).toEqual({
        calories: 100,
        protein: 5,
        carbohydrate: 20,
        fat: 2,
        saturated_fat: 0,
        polyunsaturated_fat: 0,
        monounsaturated_fat: 0,
        cholesterol: 0,
        sodium: 0,
        potassium: 0,
        fiber: 0,
        sugar: 0,
        vitamin_a: 0,
        vitamin_c: 0,
        calcium: 0,
        iron: 0
      });
    });

    it('should return null for invalid response', () => {
      expect(fatSecretService.extractTotalNutrition(null)).toBeNull();
      expect(fatSecretService.extractTotalNutrition({})).toBeNull();
    });
  });
}); 