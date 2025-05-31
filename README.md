# Meal Generator

An AI-powered meal plan generator with nutrition tracking using the FatSecret API.

## Features

- AI-powered meal plan generation
- Nutrition tracking and analysis
- Integration with FatSecret API for accurate nutrition data
- User profile management
- Meal plan history and tracking

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 12.0
- OpenAI API key
- FatSecret API credentials

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd meal-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meal_generator
DB_USER=postgres
DB_PASSWORD=your_password

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# FatSecret API
FATSECRET_API_KEY=your_fatsecret_api_key
FATSECRET_API_SECRET=your_fatsecret_api_secret
```

4. Set up the database:
```bash
# Create database and run migrations
npm run setup
```

## Development

Start the development server:
```bash
npm run dev
```

## Production

Start the production server:
```bash
npm start
```

## Testing

Run tests:
```bash
npm test
```

## API Documentation

### Meal Plans

#### Generate Meal Plan
```http
POST /api/meal-plans
Content-Type: application/json

{
  "name": "string",
  "age": number,
  "gender": "male" | "female",
  "height": number,
  "weight": number,
  "activity": "sedentary" | "light" | "moderate" | "active" | "very_active",
  "goal": "lose" | "maintain" | "gain",
  "dailyCalories": number,
  "macroSplit": {
    "protein": number,
    "carbs": number,
    "fat": number
  }
}
```

#### Get Meal Plan
```http
GET /api/meal-plans/:id
```

#### Update Meal Plan
```http
PATCH /api/meal-plans/:id
Content-Type: application/json

{
  "status": "active" | "completed" | "cancelled"
}
```

#### Delete Meal Plan
```http
DELETE /api/meal-plans/:id
```

## Error Handling

The API uses standard HTTP status codes and returns error responses in the following format:
```json
{
  "status": "error",
  "message": "Error message",
  "stack": "Error stack trace (development only)"
}
```

## Security

- All API endpoints are protected with authentication
- Environment variables are used for sensitive configuration
- Input validation is performed on all requests
- Rate limiting is implemented to prevent abuse

## Logging

Logs are written to:
- Console (development)
- `logs/error.log` (error logs)
- `logs/combined.log` (all logs)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.