# Fuelog REST API

The Fuelog REST API allows you to interact with your fuel logs, vehicles, and analytics programmatically. It is a serverless API hosted on Vercel at `/api/rest`.

## Authentication

All requests to the REST API must be authenticated using a Bearer token. You can generate an API token from the "API Access" section on your Profile page within the Fuelog app.

When making a request, include the token in the `Authorization` header:

```http
Authorization: Bearer <your_token_here>
```

Tokens are scoped: `read:logs`, `write:logs`, `read:vehicles`, `write:vehicles`. Reading logs or analytics requires `read:logs`; reading vehicles requires `read:vehicles`; creating, updating or deleting requires the matching `write:*` scope. A token without the required scope receives `403 Forbidden`.


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
    *   `limit` (optional): The maximum number of logs to return. Defaults to 100, capped at 500.
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
    *   `brand` (string, required): Filling station brand (1–200 characters).
    *   `cost` (number, required, ≥ 0): Total cost **in your home currency**. The API does not convert currencies; send `originalCost`, `currency` and `exchangeRate` yourself for a foreign-currency fill-up.
    *   `distanceKm` (number, required, ≥ 0): Distance traveled since the last fill-up. The API does not derive it from `odometerKm`.
    *   `fuelAmountLiters` (number, required, > 0): Amount of fuel added.
    *   `timestamp` (string, optional): ISO string date of the fill-up. Defaults to current time.
    *   `currency` (string, optional): 3-letter ISO code of the currency paid (e.g., "USD").
    *   `originalCost` (number, optional): The cost in `currency`.
    *   `exchangeRate` (number, optional, > 0): Units of home currency per 1 unit of `currency`, so `cost = originalCost × exchangeRate`.
    *   `vehicleId` (string, optional): The ID of the associated vehicle.
    *   `odometerKm` (number, optional, ≥ 0): Odometer reading at the fill-up.
    *   `latitude` (number, optional, −90 to 90): GPS latitude.
    *   `longitude` (number, optional, −180 to 180): GPS longitude.
    *   `fillType` (string, optional): `full` (tank filled up) or `partial`. Efficiency is only exact between two full fills.
    *   `missedPrevious` (boolean, optional): `true` if a fill-up before this one was not logged.
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
*   **Request Body:** Any of the Create Log fields; provide only those you wish to update. Other fields (`id`, `userId`, `stationId`, …) are ignored. A body with no updatable fields returns `400`.
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
          "year": "2013",
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
    *   `year` (number/string, required): Manufacturing year. Stored as a string.
    *   `fuelType` (string, required): One of `Petrol`, `Diesel`, `Hybrid`, `Electric`.
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
*   **Request Body:** Any of the Create Vehicle fields, plus `isArchived` (boolean). Setting `isDefault: true` unsets the previous default.
*   **Response:** `200 OK`
    ```json
    {
      "success": true
    }
    ```

### Delete Vehicle
Delete a vehicle from your account. The API does not check for logs that reference the vehicle; those logs keep the stale `vehicleId`. (The app refuses to delete a vehicle with logs and suggests archiving instead, e.g. `PUT` with `{"isArchived": true}`.)

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
    *   `startDate` (optional): Filter logs starting from this date (format: `YYYY-MM-DD`, UTC).
    *   `endDate` (optional): Filter logs up to the end of this date (format: `YYYY-MM-DD`, UTC).
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

*   `400 Bad Request`: Missing required parameters, invalid JSON payload, unsupported `type`, or a body that fails validation (wrong types, out-of-range values, invalid dates). The `error` message names the offending fields. Only documented fields are written; anything else in the body (e.g. `userId`, `stationId`) is ignored.
*   `401 Unauthorized`: Missing or invalid `Authorization` header. Token might be revoked.
*   `403 Forbidden`: Token does not have the required scope for the action.
*   `404 Not Found`: The requested log or vehicle does not exist, or does not belong to the user.
*   `500 Internal Server Error`: An unexpected error occurred on the server.