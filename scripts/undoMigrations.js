const sequelize = require('../Database/models/postgres/connection');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

async function undoMigrations() {
  try {
    logger.info('Starting migration rollback...');

    // Test database connection
    await sequelize.authenticate();
    logger.success('Database connection established successfully');

    // Get all migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.js'))
      .sort()
      .reverse(); // Reverse to undo in reverse order

    // Create SequelizeMeta table if it doesn't exist
    await sequelize.getQueryInterface().createTable('SequelizeMeta', {
      name: {
        type: sequelize.Sequelize.STRING,
        allowNull: false,
        unique: true
      }
    }).catch(() => {}); // Ignore error if table already exists

    // Get executed migrations
    const [executedMigrations] = await sequelize.query(
      'SELECT name FROM "SequelizeMeta" ORDER BY name DESC'
    );
    const executedMigrationNames = executedMigrations.map(m => m.name);

    // Undo migrations
    for (const file of migrationFiles) {
      if (executedMigrationNames.includes(file)) {
        logger.info(`Rolling back migration: ${file}`);
        const migration = require(path.join(migrationsDir, file));
        
        try {
          await migration.down(sequelize.getQueryInterface(), sequelize.Sequelize);
          await sequelize.query('DELETE FROM "SequelizeMeta" WHERE name = ?', {
            replacements: [file]
          });
          logger.success(`Successfully rolled back migration: ${file}`);
        } catch (error) {
          logger.error(`Error rolling back migration ${file}:`, error);
          throw error;
        }
      }
    }

    logger.success('Migration rollback completed successfully');
  } catch (error) {
    logger.error('Error during migration rollback:', error);
    process.exit(1);
  }
}

undoMigrations(); 