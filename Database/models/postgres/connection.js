const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('postgresql://MGen_owner:npg_IZzaogK9uXQ8@ep-purple-sun-a1pl2mcg-pooler.ap-southeast-1.aws.neon.tech/MGen?sslmode=require', {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  logging: false
});

module.exports = sequelize; 