# Meal Generator API Documentation

## Overview
The Meal Generator API provides endpoints for generating personalized meal plans and analyzing nutrition data. The API integrates with Nutritionix and FatSecret APIs for nutrition data and uses AI for meal plan generation.

## Base URL
```
https://your-domain.com/api
```

## Authentication
All endpoints require API keys in the request headers:
```
x-app-id: YOUR_APP_ID
x-app-key: YOUR_APP_KEY
```

## Rate Limiting
- 100 requests per 15 minutes per IP address
- Rate limit headers included in response

## Endpoints

### 1. Meal Plans

#### 1.1 Generate Meal Plan
```http
POST /api/meal-plans
```

**Request Body:**
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
  "macroSplit": "object",
  "allergies": "string[]",
  "avoid": "string[]",
  "cuisinePreference": "string",
  "numberOfDays": "number"  // Number of days for the meal plan (default: 7)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Meal plan generated successfully",
  "data": {
    "id": "string",
    "startDate": "date",
    "endDate": "date",
    "status": "string",
    "planData": {
      "days": [
        {
          "day": "string",
          "meals": {
            "breakfast": {
              "name": "string",
              "ingredients": "string",
              "description": "string",
              "estimatedCalories": "number",
              "nutrition": {
                "calories": "number",
                "macros": {
                  "protein_g": "number",
                  "carbs_g": "number",
                  "fats_g": "number",
                  "fiber_g": "number",
                  "sugars_g": "number"
                },
                "vitamins": {
                  "vitamin_A_mcg": "number",
                  "vitamin_C_mg": "number"
                },
                "minerals": {
                  "calcium_mg": "number",
                  "iron_mg": "number",
                  "potassium_mg": "number",
                  "sodium_mg": "number"
                }
              }
            }
          },
          "daily_nutrition": {
            "calories": "number",
            "macros": {
              "protein_g": "number",
              "carbs_g": "number",
              "fats_g": "number",
              "fiber_g": "number",
              "sugars_g": "number"
            },
            "vitamins": {
              "vitamin_A_mcg": "number",
              "vitamin_C_mg": "number"
            },
            "minerals": {
              "calcium_mg": "number",
              "iron_mg": "number",
              "potassium_mg": "number",
              "sodium_mg": "number"
            }
          }
        }
      ]
    }
  }
}
```

#### 1.2 Get Current Meal Plan
```http
GET /api/meal-plans/current
```

**Response:** Same as Generate Meal Plan response

#### 1.3 Get Meal Plan by ID
```http
GET /api/meal-plans/:id
```

**Response:** Same as Generate Meal Plan response

#### 1.4 Update Meal Plan Status
```http
PATCH /api/meal-plans/:id
```

**Request Body:**
```json
{
  "status": "string" // One of: "active", "completed", "cancelled"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Meal plan updated successfully",
  "data": {
    "id": "string",
    "status": "string"
  }
}
```

#### 1.5 Delete Meal Plan
```http
DELETE /api/meal-plans/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Meal plan deleted successfully"
}
```

### 2. Nutrition Analysis

#### 2.1 Analyze Single Meal
```http
POST /api/nutrition/analyze
```

**Request Body:**
```json
{
  "name": "string",
  "ingredients": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mealName": "string",
    "nutrition": {
      "calories": "number",
      "macros": {
        "protein_g": "number",
        "carbs_g": "number",
        "fats_g": "number",
        "fiber_g": "number",
        "sugars_g": "number"
      },
      "vitamins": {
        "vitamin_A_mcg": "number",
        "vitamin_C_mg": "number"
      },
      "minerals": {
        "calcium_mg": "number",
        "iron_mg": "number",
        "potassium_mg": "number",
        "sodium_mg": "number"
      }
    }
  }
}
```

#### 2.2 Batch Nutrition Analysis
```http
POST /api/nutrition/analyze-batch
```

**Request Body:**
```json
{
  "meals": {
    "mealType": {
      "name": "string",
      "ingredients": "string"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": {
      "mealType": {
        "mealName": "string",
        "nutrition": {
          "calories": "number",
          "macros": {
            "protein_g": "number",
            "carbs_g": "number",
            "fats_g": "number",
            "fiber_g": "number",
            "sugars_g": "number"
          },
          "vitamins": {
            "vitamin_A_mcg": "number",
            "vitamin_C_mg": "number"
          },
          "minerals": {
            "calcium_mg": "number",
            "iron_mg": "number",
            "potassium_mg": "number",
            "sodium_mg": "number"
          }
        }
      }
    },
    "missing": ["string"]
  }
}
```

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "string",
  "error": "string" // Optional
}
```

Common error codes:
- 400: Bad Request - Invalid input data
- 401: Unauthorized - Invalid or missing API keys
- 403: Forbidden - Insufficient permissions
- 404: Not Found - Resource not found
- 429: Too Many Requests - Rate limit exceeded
- 500: Internal Server Error - Server-side error
- 503: Service Unavailable - External service (Nutritionix/FatSecret) unavailable

## Data Types

### Activity Levels
- sedentary
- light
- moderate
- active
- very_active

### Goals
- weight_loss
- weight_maintenance
- weight_gain
- muscle_gain

### Genders
- male
- female
- other

### Meal Types
- breakfast
- lunch
- dinner
- snack

### Status Values
- active
- completed
- cancelled 