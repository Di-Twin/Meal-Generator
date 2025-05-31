const nutritionController = require('../../controllers/nutritionController');
const fatSecretService = require('../../services/fatsecretService');

// Mock fatSecretService
jest.mock('../../services/fatsecretService');

describe('Nutrition Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {
        foodDescription: 'apple'
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('getNutritionData', () => {
    it('should return nutrition data successfully', async () => {
      const mockNutritionData = {
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

      fatSecretService.getNutritionData.mockResolvedValueOnce(mockNutritionData);

      await nutritionController.getNutritionData(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          detailed: mockNutritionData,
          total: expect.any(Object)
        }
      });
    });

    it('should handle missing food description', async () => {
      mockReq.body.foodDescription = '';

      await nutritionController.getNutritionData(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Food description is required'
      });
    });

    it('should handle API errors', async () => {
      fatSecretService.getNutritionData.mockRejectedValueOnce(new Error('API Error'));

      await nutritionController.getNutritionData(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get nutrition data'
      });
    });
  });
}); 