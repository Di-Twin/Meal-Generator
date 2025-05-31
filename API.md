# Meal Generator API Documentation

## Base URL
```
http://localhost:3000/api
```

## Endpoints

### Generate Meal Plan
```http
POST /meal-plans
```

Request Body:
```json
{
  "name": "string",
  "age": "number",
  "gender": "string",
  "height": "number",
  "weight": "number",
  "activity": "string",
  "goal": "string",
  "dailyCalories": "number",
  "macroSplit": {
    "protein": "number",
    "carbs": "number",
    "fats": "number"
  },
  "allergies": ["string"],
  "avoid": ["string"]
}
```

Response (201 Created):
```json
{
  "success": true,
  "message": "Meal plan generated successfully",
  "data": {
    "id": "uuid",
    "planData": {
      "dailyMeals": [
        {
          "day": "string",
          "meals": [
            {
              "name": "string",
              "ingredients": ["string"],
              "instructions": ["string"],
              "nutrition": {
                "calories": "number",
                "protein": "number",
                "carbs": "number",
                "fats": "number"
              }
            }
          ],
          "dailyMacros": {
            "calories": "number",
            "protein": "number",
            "carbs": "number",
            "fats": "number"
          }
        }
      ],
      "weeklyMacros": {
        "calories": "number",
        "protein": "number",
        "carbs": "number",
        "fats": "number"
      }
    },
    "startDate": "date",
    "endDate": "date",
    "status": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

### Get Current Meal Plan
```http
GET /meal-plans/current
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Meal plan retrieved successfully",
  "data": {
    "id": "uuid",
    "planData": {
      "dailyMeals": [
        {
          "day": "string",
          "meals": [
            {
              "name": "string",
              "ingredients": ["string"],
              "instructions": ["string"],
              "nutrition": {
                "calories": "number",
                "protein": "number",
                "carbs": "number",
                "fats": "number"
              }
            }
          ],
          "dailyMacros": {
            "calories": "number",
            "protein": "number",
            "carbs": "number",
            "fats": "number"
          }
        }
      ],
      "weeklyMacros": {
        "calories": "number",
        "protein": "number",
        "carbs": "number",
        "fats": "number"
      }
    },
    "startDate": "date",
    "endDate": "date",
    "status": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

### Update Meal Plan
```http
PATCH /meal-plans/:id
```

Request Body:
```json
{
  "status": "string"
}
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Meal plan updated successfully",
  "data": {
    "id": "uuid",
    "planData": {
      "dailyMeals": [
        {
          "day": "string",
          "meals": [
            {
              "name": "string",
              "ingredients": ["string"],
              "instructions": ["string"],
              "nutrition": {
                "calories": "number",
                "protein": "number",
                "carbs": "number",
                "fats": "number"
              }
            }
          ],
          "dailyMacros": {
            "calories": "number",
            "protein": "number",
            "carbs": "number",
            "fats": "number"
          }
        }
      ],
      "weeklyMacros": {
        "calories": "number",
        "protein": "number",
        "carbs": "number",
        "fats": "number"
      }
    },
    "startDate": "date",
    "endDate": "date",
    "status": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

### Delete Meal Plan
```http
DELETE /meal-plans/:id
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Meal plan deleted successfully"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request data",
  "errors": ["string"]
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Data Types

### Status Values
- `active`: The meal plan is currently active
- `completed`: The meal plan has been completed
- `cancelled`: The meal plan has been cancelled

### Gender Values
- `male`
- `female`
- `other`

### Activity Levels
- `sedentary`: Little or no exercise
- `light`: Light exercise 1-3 days/week
- `moderate`: Moderate exercise 3-5 days/week
- `active`: Hard exercise 6-7 days/week
- `very_active`: Very hard exercise & physical job or training twice per day

### Goal Values
- `weight_loss`: Reduce body weight
- `weight_maintenance`: Maintain current weight
- `weight_gain`: Increase body weight
- `muscle_gain`: Build muscle mass

## Rate Limiting
The API implements rate limiting to prevent abuse. The current limits are:
- 100 requests per minute per IP address
- 1000 requests per hour per IP address

## Caching
The API implements caching for frequently accessed data to improve performance. Cache duration is set to 5 minutes for meal plan data. 