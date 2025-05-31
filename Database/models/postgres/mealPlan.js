const { DataTypes } = require('sequelize');
const sequelize = require('./connection');

const MealPlan = sequelize.define('MealPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  planData: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  }
}, {
  tableName: 'meal_plans',
  timestamps: true,
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['startDate', 'endDate']
    }
  ]
});

module.exports = MealPlan; 