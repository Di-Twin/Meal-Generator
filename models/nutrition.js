const { DataTypes } = require('sequelize');
const sequelize = require('../Database/models/postgres/connection');

const Nutrition = sequelize.define('Nutrition', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  foodDescription: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  normalizedDescription: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  nutritionData: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  totalNutrition: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Nutrition;