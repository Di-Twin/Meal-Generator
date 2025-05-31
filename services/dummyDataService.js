const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

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
    console.log('DummyDataService initialized with', this.users.size, 'users');
  }

  // User methods
  getUser(userId) {
    console.log(`Getting user with ID: ${userId}`);
    const user = this.users.get(userId);
    console.log(user ? `User ${userId} found` : `User ${userId} not found`);
    return user;
  }

  getAllUsers() {
    console.log('Getting all users');
    return Array.from(this.users.values());
  }

  // Meal plan methods
  saveMealPlan(userId, mealPlan) {
    console.log(`Saving meal plan for user ${userId}...`);
    const userMealPlans = this.mealPlans.get(userId) || [];
    const newMealPlan = {
      ...mealPlan,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    userMealPlans.push(newMealPlan);
    this.mealPlans.set(userId, userMealPlans);
    console.log(`Meal plan saved with ID: ${newMealPlan.id}`);
    return userMealPlans[userMealPlans.length - 1];
  }

  getMealPlans(userId) {
    console.log(`Getting all meal plans for user ${userId}`);
    const plans = this.mealPlans.get(userId) || [];
    console.log(`Found ${plans.length} meal plans for user ${userId}`);
    return plans;
  }

  getActiveMealPlan(userId) {
    console.log(`Getting active meal plan for user ${userId}`);
    const userMealPlans = this.mealPlans.get(userId) || [];
    const activePlan = userMealPlans.find(plan => plan.status === 'active');
    console.log(activePlan ? `Active plan found with ID: ${activePlan.id}` : `No active plan found for user ${userId}`);
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

  // Local storage methods
  async saveToLocalStorage() {
    try {
      const dataDir = path.join(__dirname, '../data');
      await fs.mkdir(dataDir, { recursive: true });

      const usersData = JSON.stringify(Array.from(this.users.entries()));
      const mealPlansData = JSON.stringify(Array.from(this.mealPlans.entries()));

      await fs.writeFile(path.join(dataDir, 'users.json'), usersData);
      await fs.writeFile(path.join(dataDir, 'mealPlans.json'), mealPlansData);
      
      logger.info('Data saved to files successfully');
    } catch (error) {
      logger.error('Error saving to files:', error);
    }
  }

  async loadFromLocalStorage() {
    try {
      const dataDir = path.join(__dirname, '../data');
      
      const usersData = await fs.readFile(path.join(dataDir, 'users.json'), 'utf8');
      const mealPlansData = await fs.readFile(path.join(dataDir, 'mealPlans.json'), 'utf8');

      if (usersData) {
        this.users = new Map(JSON.parse(usersData));
      }
      if (mealPlansData) {
        this.mealPlans = new Map(JSON.parse(mealPlansData));
      }
      
      logger.info('Data loaded from files successfully');
    } catch (error) {
      logger.error('Error loading from files:', error);
    }
  }
}

module.exports = new DummyDataService();