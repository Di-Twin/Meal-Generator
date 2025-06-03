const sequelize = require('../Database/models/postgres/connection');

module.exports = {
    up: async (queryInterface) => {
        await queryInterface.createTable('nutrition_data', {
            id: {
                type: sequelize.Sequelize.UUID,
                defaultValue: sequelize.Sequelize.UUIDV4,
                primaryKey: true
            },
            foodDescription: {
                type: sequelize.Sequelize.STRING,
                allowNull: false
            },
            normalizedDescription: {
                type: sequelize.Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            nutritionData: {
                type: sequelize.Sequelize.JSONB,
                allowNull: false
            },
            totalNutrition: {
                type: sequelize.Sequelize.JSONB,
                allowNull: true
            },
            lastUpdated: {
                type: sequelize.Sequelize.DATE,
                defaultValue: sequelize.Sequelize.NOW
            },
            hitCount: {
                type: sequelize.Sequelize.INTEGER,
                defaultValue: 0
            },
            createdAt: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            }
        });

        await queryInterface.addIndex('nutrition_data', ['normalizedDescription']);
        await queryInterface.addIndex('nutrition_data', ['lastUpdated']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('nutrition_data');
    }
}; 