# Meal Generator

An AI-powered meal planning and nutrition tracking application that helps users generate personalized meal plans based on their dietary preferences and nutritional goals.

## Features

- AI-powered meal plan generation
- Nutrition data tracking and analysis
- Integration with Nutritionix and FatSecret APIs
- Caching system for nutrition data
- Database storage for persistent data
- Comprehensive logging system
- Rotating API keys for Nutritionix to handle rate limits

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Redis (v6 or higher)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meal_generator
DB_USER=your_username
DB_PASSWORD=your_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Nutritionix API Keys (Multiple keys for rate limit handling)
NUTRITIONIX_APP_ID_1=your_nutritionix_app_id_1
NUTRITIONIX_APP_KEY_1=your_nutritionix_app_key_1
NUTRITIONIX_APP_ID_2=your_nutritionix_app_id_2
NUTRITIONIX_APP_KEY_2=your_nutritionix_app_key_2
NUTRITIONIX_APP_ID_3=your_nutritionix_app_id_3
NUTRITIONIX_APP_KEY_3=your_nutritionix_app_key_3
NUTRITIONIX_APP_ID_4=your_nutritionix_app_id_4
NUTRITIONIX_APP_KEY_4=your_nutritionix_app_key_4
NUTRITIONIX_APP_ID_5=your_nutritionix_app_id_5
NUTRITIONIX_APP_KEY_5=your_nutritionix_app_key_5
NUTRITIONIX_APP_ID_6=your_nutritionix_app_id_6
NUTRITIONIX_APP_KEY_6=your_nutritionix_app_key_6
NUTRITIONIX_APP_ID_7=your_nutritionix_app_id_7
NUTRITIONIX_APP_KEY_7=your_nutritionix_app_key_7
NUTRITIONIX_APP_ID_8=your_nutritionix_app_id_8
NUTRITIONIX_APP_KEY_8=your_nutritionix_app_key_8
NUTRITIONIX_APP_ID_9=your_nutritionix_app_id_9
NUTRITIONIX_APP_KEY_9=your_nutritionix_app_key_9
NUTRITIONIX_APP_ID_10=your_nutritionix_app_id_10
NUTRITIONIX_APP_KEY_10=your_nutritionix_app_key_10

# FatSecret API
FATSECRET_API_KEY=your_fatsecret_api_key
FATSECRET_API_SECRET=your_fatsecret_api_secret

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Meal-Generator
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create the database
createdb meal_generator

# Run migrations
npm run migrate
```

4. Start the application:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Key Rotation

The application implements an automatic API key rotation system for Nutritionix to handle rate limits:

- Each Nutritionix API key has a daily limit of 200 requests
- The system automatically rotates through 10 different API keys
- When a key reaches its limit, the system automatically switches to the next available key
- Request counts are reset every 24 hours
- The system maintains a count of requests per key and total requests across all keys

## Database Migrations

The application uses Sequelize migrations to manage database schema changes.

To run migrations:
```bash
npm run migrate
```

To undo migrations:
```bash
npm run migrate:undo
```

## API Documentation

The API documentation is available in the `API.md` file. It includes detailed information about:
- Available endpoints
- Request/response formats
- Authentication requirements
- Rate limiting
- Error handling

## Caching System

The application implements a two-level caching system:
1. Redis for fast in-memory caching
2. PostgreSQL for persistent storage

Nutrition data is cached to reduce API calls and improve response times. The cache is automatically updated based on:
- Cache expiration time
- Hit count
- Last update time

## Logging

The application uses Winston for logging with the following features:
- Console and file logging
- Different log levels (error, warn, info, debug)
- Log rotation
- Structured logging format

Logs are stored in the `logs` directory.

## Testing

Run tests using:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

