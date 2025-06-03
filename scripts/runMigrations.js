const sequelize = require('../Database/models/postgres/connection');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

async function runMigrations() {
    try {
        logger.info('Starting database migrations...');

        // Test database connection
        await sequelize.authenticate();
        logger.info('Database connection established successfully');

        // Get all migration files
        const migrationsDir = path.join(__dirname, '..', 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.js'))
            .sort();

        // Create migrations table if it doesn't exist
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
                "name" VARCHAR(255) NOT NULL PRIMARY KEY
            );
        `);

        // Get executed migrations
        const [executedMigrations] = await sequelize.query(
            'SELECT name FROM "SequelizeMeta" ORDER BY name;'
        );
        const executedMigrationNames = executedMigrations.map(m => m.name);

        // Run pending migrations
        for (const file of migrationFiles) {
            if (!executedMigrationNames.includes(file)) {
                logger.info(`Running migration: ${file}`);
                const migration = require(path.join(migrationsDir, file));
                
                try {
                    await migration.up(sequelize.getQueryInterface());
                    await sequelize.query(
                        'INSERT INTO "SequelizeMeta" (name) VALUES ($1);',
                        { bind: [file] }
                    );
                    logger.info(`Migration ${file} completed successfully`);
                } catch (error) {
                    logger.error(`Migration ${file} failed:`, { error: error.message });
                    throw error;
                }
            }
        }

        logger.info('All migrations completed successfully');
    } catch (error) {
        logger.error('Migration failed:', { error: error.message });
        process.exit(1);
    }
}

// Run migrations
runMigrations(); 