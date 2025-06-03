// DEPRECATED: This file is for development/testing only and should NOT be present in production builds. Safe to remove for production readiness.
// DEV-ONLY: This service is for local development/testing and should NOT be used in production.
const logger = require('../utils/logger');

// Dummy user data
const dummyUsers = [
  {
    id: '1',
    name: 'John Doe',
    age: 30,
    gender: 'male',
    height: 175,
    weight: 75,
    activityLevel: 'moderate',
    fitnessGoal: 'weight_loss',
    dailyCalories: 2000,
    macroSplit: '40-30-30',
    cuisinePreference: 'Indian',
    allergies: ['peanuts'],
    foodPreferences: {
      avoid: ['pork', 'shellfish']
    }
  },
  {
    id: '2',
    name: 'Jane Smith',
    age: 28,
    gender: 'female',
    height: 165,
    weight: 60,
    activityLevel: 'active',
    fitnessGoal: 'muscle_gain',
    dailyCalories: 2200,
    macroSplit: '30-40-30',
    cuisinePreference: 'asian',
    allergies: ['lactose'],
    foodPreferences: {
      avoid: ['beef']
    }
  }
];

class DummyDataService {
  constructor() {
    this.users = new Map(dummyUsers.map(user => [user.id, user]));
    this.mealPlans = new Map();
    logger.warn('DummyDataService initialized (DEV-ONLY) with', this.users.size, 'users');
  }

  // User methods
  getUser(userId) {
    logger.debug(`Getting user with ID: ${userId}`);
    const user = this.users.get(userId);
    logger.debug(user ? `User ${userId} found` : `User ${userId} not found`);
    return user;
  }

  getAllUsers() {
    logger.debug('Getting all users');
    return Array.from(this.users.values());
  }

  // Meal plan methods
  saveMealPlan(userId, mealPlan) {
    logger.debug(`Saving meal plan for user ${userId}...`);
    const userMealPlans = this.mealPlans.get(userId) || [];
    const newMealPlan = {
      ...mealPlan,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    userMealPlans.push(newMealPlan);
    this.mealPlans.set(userId, userMealPlans);
    logger.debug(`Meal plan saved with ID: ${newMealPlan.id}`);
    return userMealPlans[userMealPlans.length - 1];
  }

  getMealPlans(userId) {
    logger.debug(`Getting all meal plans for user ${userId}`);
    const plans = this.mealPlans.get(userId) || [];
    logger.debug(`Found ${plans.length} meal plans for user ${userId}`);
    return plans;
  }

  getActiveMealPlan(userId) {
    logger.debug(`Getting active meal plan for user ${userId}`);
    const userMealPlans = this.mealPlans.get(userId) || [];
    const activePlan = userMealPlans.find(plan => plan.status === 'active');
    logger.debug(activePlan ? `Active plan found with ID: ${activePlan.id}` : `No active plan found for user ${userId}`);
    return activePlan;
  }

  updateMealPlan(userId, planId, updates) {
    const userMealPlans = this.mealPlans.get(userId) || [];
    const planIndex = userMealPlans.findIndex(plan => plan.id === planId);
    
    if (planIndex === -1) {
      return null;
    }

    userMealPlans[planIndex] = {
      ...userMealPlans[planIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.mealPlans.set(userId, userMealPlans);
    return userMealPlans[planIndex];
  }
}

module.exports = new DummyDataService();