# Fuelog REST API

The Fuelog REST API allows you to interact with your fuel logs, vehicles, and analytics programmatically. It is a serverless API hosted on Vercel at `/api/rest`.

## Authentication

All requests to the REST API must be authenticated using a Bearer token. You can generate an API token from the "API Access" section on your Profile page within the Fuelog app.

When making a request, include the token in the `Authorization` header:

```http
Authorization: Bearer <your_token_here>
```

Tokens are scoped, meaning they may only have permissions for specific actions (e.g., `read:logs`, `write:logs`, `read:vehicles`, `write:vehicles`). If your token lacks the required scope for an endpoint, you will receive a `403 Forbidden` error.

## Base URL

```text
https://<your-fuelog-app-domain>/api/rest
```

---

## Logs (`type=logs`)

Manage your fuel logs.

### Get Logs
Retrieve a list of your fuel logs, ordered by newest first.

*   **URL:** `/api/rest?type=logs`
*   **Method:** `GET`
*   **Example (cURL):**
    ```bash
    curl -X GET "https://<your-fuelog-app-domain>/api/rest?type=logs&limit=5" \
      -H "Authorization: Bearer <your_token_here>"
    ```
*   **Query Parameters:**
    *   `limit` (optional): The maximum number of logs to return. Defaults to 100.
*   **Required Scope:** `read:logs`
*   **Response:**
    ```json
    {
      "logs": [
        {
          "id": "abc123xyz",
          "userId": "user_id_123",
          "timestamp": "2024-03-15T10:00:00.000Z",
          "brand": "Shell",
          "cost": 65.50,
          "distanceKm": 450,
          "fuelAmountLiters": 40.2,
          "vehicleId": "veh_456"
        }
      ]
    }
    ```

### Create Log
Create a new fuel log entry.

*   **URL:** `/api/rest?type=logs`
*   **Method:** `POST`
*   **Example (cURL):**
    ```bash
    curl -X POST "https://<your-fuelog-app-domain>/api/rest?type=logs" \
      -H "Authorization: Bearer <your_token_here>" \
      -H "Content-Type: application/json" \
      -d '{
        "brand": "Shell",
        "cost": 65.50,
        "distanceKm": 450,
        "fuelAmountLiters": 40.2
      }'
    ```
*   **Required Scope:** `write:logs`
*   **Request Body:**
    *   `brand` (string, required): Filling station brand.
    *   `cost` (number, required): Total cost of the transaction.
    *   `distanceKm` (number, required): Distance traveled since the last fill-up.
    *   `fuelAmountLiters` (number, required): Amount of fuel added.
    *   `timestamp` (string, optional): ISO string date of the fill-up. Defaults to current time.
    *   `currency` (string, optional): The currency of the transaction (e.g., "EUR", "USD").
    *   `originalCost` (number, optional): The cost in the original transaction currency (if different from home currency).
    *   `exchangeRate` (number, optional): The exchange rate applied (if applicable).
    *   `vehicleId` (string, optional): The ID of the associated vehicle.
    *   `latitude` (number, optional): GPS latitude.
    *   `longitude` (number, optional): GPS longitude.
*   **Response:** `201 Created`
    ```json
    {
      "id": "new_log_id"
    }
    ```

### Update Log
Update an existing fuel log entry.

*   **URL:** `/api/rest?type=logs&id=<log_id>`
*   **Method:** `PUT`
*   **Example (cURL):**
    ```bash
    curl -X PUT "https://<your-fuelog-app-domain>/api/rest?type=logs&id=abc123xyz" \
      -H "Authorization: Bearer <your_token_here>" \
      -H "Content-Type: application/json" \
      -d '{
        "cost": 67.50,
        "fuelAmountLiters": 41.5
      }'
    ```
*   **Required Scope:** `write:logs`
*   **Request Body:** Provide only the fields you wish to update (e.g., `brand`, `cost`, `timestamp`). Internal fields (`id`, `userId`) will be ignored.
*   **Response:** `200 OK`
    ```json
    {
      "success": true
    }
    ```

### Delete Log
Delete a specific fuel log entry.

*   **URL:** `/api/rest?type=logs&id=<log_id>`
*   **Method:** `DELETE`
*   **Example (cURL):**
    ```bash
    curl -X DELETE "https://<your-fuelog-app-domain>/api/rest?type=logs&id=abc123xyz" \
      -H "Authorization: Bearer <your_token_here>"
    ```
*   **Required Scope:** `write:logs`
*   **Response:** `200 OK`
    ```json
    {
      "success": true
    }
    ```

---

## Vehicles (`type=vehicles`)

Manage the vehicles associated with your account.

### Get Vehicles
Retrieve a list of your vehicles.

*   **URL:** `/api/rest?type=vehicles`
*   **Method:** `GET`
*   **Example (cURL):**
    ```bash
    curl -X GET "https://<your-fuelog-app-domain>/api/rest?type=vehicles" \
      -H "Authorization: Bearer <your_token_here>"
    ```
*   **Query Parameters:**
    *   `includeArchived` (optional): If `"true"`, archived vehicles will be included in the response. Defaults to false.
*   **Required Scope:** `read:vehicles`
*   **Response:**
    ```json
    {
      "vehicles": [
        {
          "id": "veh_456",
          "userId": "user_id_123",
          "name": "My Daily Driver",
          "make": "Volkswagen",
          "model": "Polo",
          "year": 2013,
          "fuelType": "Petrol",
          "isDefault": true,
          "isArchived": false
        }
      ]
    }
    ```

### Create Vehicle
Add a new vehicle to your account.

*   **URL:** `/api/rest?type=vehicles`
*   **Method:** `POST`
*   **Example (cURL):**
    ```bash
    curl -X POST "https://<your-fuelog-app-domain>/api/rest?type=vehicles" \
      -H "Authorization: Bearer <your_token_here>" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "My Daily Driver",
        "make": "Volkswagen",
        "model": "Polo",
        "year": 2013,
        "fuelType": "Petrol"
      }'
    ```
*   **Required Scope:** `write:vehicles`
*   **Request Body:**
    *   `name` (string, required): A nickname for the vehicle.
    *   `make` (string, required): Vehicle manufacturer (e.g., "Ford").
    *   `model` (string, required): Vehicle model (e.g., "Focus").
    *   `year` (number/string, required): Manufacturing year.
    *   `fuelType` (string, required): Type of fuel used (e.g., "Petrol", "Diesel").
    *   `isDefault` (boolean, optional): Set to `true` to make this the default vehicle. (Will unset any previously default vehicle).
*   **Response:** `201 Created`
    ```json
    {
      "id": "new_vehicle_id"
    }
    ```

### Update Vehicle
Update details for an existing vehicle.

*   **URL:** `/api/rest?type=vehicles&id=<vehicle_id>`
*   **Method:** `PUT`
*   **Example (cURL):**
    ```bash
    curl -X PUT "https://<your-fuelog-app-domain>/api/rest?type=vehicles&id=veh_456" \
      -H "Authorization: Bearer <your_token_here>" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Weekend Car",
        "isDefault": false
      }'
    ```
*   **Required Scope:** `write:vehicles`
*   **Request Body:** Provide the fields you want to update.
*   **Response:** `200 OK`
    ```json
    {
      "success": true
    }
    ```

### Delete Vehicle
Delete a vehicle from your account.

*   **URL:** `/api/rest?type=vehicles&id=<vehicle_id>`
*   **Method:** `DELETE`
*   **Example (cURL):**
    ```bash
    curl -X DELETE "https://<your-fuelog-app-domain>/api/rest?type=vehicles&id=veh_456" \
      -H "Authorization: Bearer <your_token_here>"
    ```
*   **Required Scope:** `write:vehicles`
*   **Response:** `200 OK`
    ```json
    {
      "success": true
    }
    ```

---

## Analytics (`type=analytics`)

Retrieve aggregated metrics and fuel efficiency calculations.

### Get Analytics Summary
Get statistics like total spent, average efficiency, and total fuel consumed.

*   **URL:** `/api/rest?type=analytics`
*   **Method:** `GET`
*   **Example (cURL):**
    ```bash
    curl -X GET "https://<your-fuelog-app-domain>/api/rest?type=analytics&startDate=2024-01-01&endDate=2024-12-31" \
      -H "Authorization: Bearer <your_token_here>"
    ```
*   **Query Parameters:**
    *   `vehicleId` (optional): Filter analytics to a specific vehicle.
    *   `startDate` (optional): Filter logs starting from this date (format: `YYYY-MM-DD`).
    *   `endDate` (optional): Filter logs up to this date (format: `YYYY-MM-DD`).
*   **Required Scope:** `read:logs`
*   **Response:**
    ```json
    {
      "logCount": 42,
      "totalSpent": 2540.50,
      "homeCurrency": "EUR",
      "totalFuelLiters": 1500.25,
      "totalDistanceKm": 21000,
      "efficiency": {
        "kml": 13.99,
        "l100km": 7.14,
        "mpgUK": 39.54
      },
      "avgCostPerLiter": 1.69,
      "avgCostPerKm": 0.1210,
      "filters": {
        "vehicleId": null,
        "startDate": null,
        "endDate": null
      }
    }
    ```

---

## Error Codes

*   `400 Bad Request`: Missing required parameters, invalid JSON payload, or unsupported `type`.
*   `401 Unauthorized`: Missing or invalid `Authorization` header. Token might be revoked.
*   `403 Forbidden`: Token does not have the required scope for the action.
*   `404 Not Found`: The requested log or vehicle does not exist, or does not belong to the user.
*   `500 Internal Server Error`: An unexpected error occurred on the server.