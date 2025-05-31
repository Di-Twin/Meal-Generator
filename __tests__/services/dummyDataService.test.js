const dummyDataService = require('../../services/dummyDataService');

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

describe('Dummy Data Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service to initial state
    dummyDataService.users = new Map(dummyDataService.users);
    dummyDataService.mealPlans = new Map();
  });

  describe('User methods', () => {
    it('should get user by id', () => {
      const user = dummyDataService.getUser('1');
      expect(user).toBeDefined();
      expect(user.name).toBe('John Doe');
    });

    it('should get all users', () => {
      const users = dummyDataService.getAllUsers();
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('John Doe');
      expect(users[1].name).toBe('Jane Smith');
    });
  });

  describe('Meal plan methods', () => {
    it('should save meal plan', () => {
      const mealPlan = {
        planData: { days: [] },
        startDate: new Date(),
        endDate: new Date(),
        status: 'active'
      };

      const savedPlan = dummyDataService.saveMealPlan('1', mealPlan);
      expect(savedPlan).toHaveProperty('id');
      expect(savedPlan).toHaveProperty('createdAt');
      expect(savedPlan.status).toBe('active');
    });

    it('should get meal plans for user', () => {
      const mealPlan = {
        planData: { days: [] },
        startDate: new Date(),
        endDate: new Date(),
        status: 'active'
      };

      dummyDataService.saveMealPlan('1', mealPlan);
      const plans = dummyDataService.getMealPlans('1');
      expect(plans).toHaveLength(1);
      expect(plans[0].status).toBe('active');
    });

    it('should get active meal plan', () => {
      const activePlan = {
        planData: { days: [] },
        startDate: new Date(),
        endDate: new Date(),
        status: 'active'
      };

      const completedPlan = {
        planData: { days: [] },
        startDate: new Date(),
        endDate: new Date(),
        status: 'completed'
      };

      dummyDataService.saveMealPlan('1', activePlan);
      dummyDataService.saveMealPlan('1', completedPlan);

      const active = dummyDataService.getActiveMealPlan('1');
      expect(active).toBeDefined();
      expect(active.status).toBe('active');
    });

    it('should update meal plan', () => {
      const mealPlan = {
        planData: { days: [] },
        startDate: new Date(),
        endDate: new Date(),
        status: 'active'
      };

      const savedPlan = dummyDataService.saveMealPlan('1', mealPlan);
      const updatedPlan = dummyDataService.updateMealPlan('1', savedPlan.id, { status: 'completed' });

      expect(updatedPlan.status).toBe('completed');
      expect(updatedPlan).toHaveProperty('updatedAt');
    });
  });

  describe('Local storage methods', () => {
    it('should save to local storage', () => {
      const mealPlan = {
        planData: { days: [] },
        startDate: new Date(),
        endDate: new Date(),
        status: 'active'
      };

      dummyDataService.saveMealPlan('1', mealPlan);
      dummyDataService.saveToLocalStorage();

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'dummyUsers',
        expect.any(String)
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'dummyMealPlans',
        expect.any(String)
      );
    });

    it('should load from local storage', () => {
      const mockUsers = JSON.stringify([['1', { id: '1', name: 'Test User' }]]);
      const mockMealPlans = JSON.stringify([['1', [{ id: '1', status: 'active' }]]]);

      localStorage.getItem.mockImplementation((key) => {
        if (key === 'dummyUsers') return mockUsers;
        if (key === 'dummyMealPlans') return mockMealPlans;
        return null;
      });

      dummyDataService.loadFromLocalStorage();

      expect(localStorage.getItem).toHaveBeenCalledWith('dummyUsers');
      expect(localStorage.getItem).toHaveBeenCalledWith('dummyMealPlans');
    });
  });
}); 