const NutritionCache = require('../../utils/nutritionCache');

describe('Nutrition Cache', () => {
  let nutritionCache;

  beforeEach(() => {
    nutritionCache = new NutritionCache();
  });

  describe('getKey', () => {
    it('should normalize food descriptions', () => {
      expect(nutritionCache.getKey('  Apple  ')).toBe('apple');
      expect(nutritionCache.getKey('Granny Smith Apple')).toBe('granny smith apple');
      expect(nutritionCache.getKey('Apple\nBanana')).toBe('apple banana');
    });
  });

  describe('get and set', () => {
    it('should store and retrieve data', () => {
      const mockData = { calories: 100 };
      nutritionCache.set('apple', mockData);
      expect(nutritionCache.get('apple')).toBe(mockData);
    });

    it('should return undefined for non-existent keys', () => {
      expect(nutritionCache.get('nonexistent')).toBeUndefined();
    });

    it('should handle normalized keys', () => {
      const mockData = { calories: 100 };
      nutritionCache.set('  Apple  ', mockData);
      expect(nutritionCache.get('apple')).toBe(mockData);
    });
  });

  describe('getBatchNutrition', () => {
    it('should return cached and missing ingredients', async () => {
      const mockData = { calories: 100 };
      nutritionCache.set('apple', mockData);

      const result = await nutritionCache.getBatchNutrition(['apple', 'banana']);
      expect(result).toEqual({
        cached: {
          apple: mockData
        },
        missing: ['banana']
      });
    });

    it('should handle empty ingredient list', async () => {
      const result = await nutritionCache.getBatchNutrition([]);
      expect(result).toEqual({
        cached: {},
        missing: []
      });
    });

    it('should handle all cached ingredients', async () => {
      const mockData1 = { calories: 100 };
      const mockData2 = { calories: 200 };
      nutritionCache.set('apple', mockData1);
      nutritionCache.set('banana', mockData2);

      const result = await nutritionCache.getBatchNutrition(['apple', 'banana']);
      expect(result).toEqual({
        cached: {
          apple: mockData1,
          banana: mockData2
        },
        missing: []
      });
    });
  });
}); 