# Fuelog API Documentation

This document provides comprehensive documentation for the Fuelog API, specifically tailored for LLMs generating code to integrate with or consume these APIs. The codebase exposes both a standard REST API and a Model Context Protocol (MCP) server API.

## Authentication

Both the REST API and the MCP Server API require authentication via a Bearer token.

*   **Header:** `Authorization: Bearer <token>`
*   **Scopes:** Certain state-mutating requests (POST, PUT, DELETE) require specific scopes in the token's identity.
    *   `write:logs`: Required for modifying fuel logs.
    *   `write:vehicles`: Required for modifying vehicle details.

---

## REST API (`/api/rest`)

The REST API uses a single base endpoint (`/api/rest`) and routes requests based on the `type` query parameter. It supports cross-origin resource sharing (CORS).

### 1. Logs (`?type=logs`)

Manages fuel log entries.

#### `GET /api/rest?type=logs`
Retrieves a list of fuel logs for the authenticated user, ordered by newest first.
*   **Query Parameters:**
    *   `limit` (number, optional): Maximum number of entries to return. Defaults to `100`.
*   **Returns:** JSON object containing `{ logs: [ ... ] }`.

#### `POST /api/rest?type=logs`
Creates a new fuel log entry.
*   **Requires Scope:** `write:logs`
*   **Request Body (JSON):**
    *   `brand` (string, **required**): Fuel station / brand name.
    *   `cost` (number, **required**): Cost in the user's home currency.
    *   `distanceKm` (number, **required**): Distance driven since last fill-up in kilometers.
    *   `fuelAmountLiters` (number, **required**): Fuel amount added in liters.
    *   `currency` (string, optional): Transaction currency code (e.g., "GBP").
    *   `originalCost` (number, optional): Cost in the transaction currency.
    *   `exchangeRate` (number, optional): Exchange rate used.
    *   `vehicleId` (string, optional): ID of the associated vehicle.
    *   `latitude` (number, optional): GPS latitude.
    *   `longitude` (number, optional): GPS longitude.
    *   `timestamp` (string, optional): ISO 8601 datetime string. Defaults to current server time.
*   **Returns:** JSON object containing `{ id: "<new_log_id>" }` with status `201`.

#### `PUT /api/rest?type=logs&id=<log_id>`
Updates an existing fuel log entry.
*   **Requires Scope:** `write:logs`
*   **Query Parameters:**
    *   `id` (string, **required**): The ID of the log to update.
*   **Request Body (JSON):** Any combination of the fields accepted in the `POST` request (e.g., `brand`, `cost`, `distanceKm`, etc.).
*   **Returns:** JSON object containing `{ success: true }`.

#### `DELETE /api/rest?type=logs&id=<log_id>`
Deletes a fuel log entry.
*   **Requires Scope:** `write:logs`
*   **Query Parameters:**
    *   `id` (string, **required**): The ID of the log to delete.
*   **Returns:** JSON object containing `{ success: true }`.

### 2. Vehicles (`?type=vehicles`)

Manages vehicle profiles.

#### `GET /api/rest?type=vehicles`
Retrieves a list of vehicles for the authenticated user.
*   **Query Parameters:**
    *   `includeArchived` (boolean string, optional): If `'true'`, includes archived vehicles. Defaults to excluding them.
*   **Returns:** JSON object containing `{ vehicles: [ ... ] }`.

#### `POST /api/rest?type=vehicles`
Registers a new vehicle.
*   **Requires Scope:** `write:vehicles`
*   **Request Body (JSON):**
    *   `name` (string, **required**): Nickname for the vehicle.
    *   `make` (string, **required**): Manufacturer.
    *   `model` (string, **required**): Vehicle model.
    *   `year` (string, **required**): Model year.
    *   `fuelType` (string, **required**): Enum of `"Petrol"`, `"Diesel"`, `"Hybrid"`, or `"Electric"`.
    *   `isDefault` (boolean, optional): If `true`, sets this vehicle as the user's default.
*   **Returns:** JSON object containing `{ id: "<new_vehicle_id>" }` with status `201`.

#### `PUT /api/rest?type=vehicles&id=<vehicle_id>`
Updates an existing vehicle.
*   **Requires Scope:** `write:vehicles`
*   **Query Parameters:**
    *   `id` (string, **required**): The ID of the vehicle to update.
*   **Request Body (JSON):** Any combination of fields accepted in `POST`, plus:
    *   `isArchived` (boolean, optional): Set to `true` to archive the vehicle.
*   **Returns:** JSON object containing `{ success: true }`.

#### `DELETE /api/rest?type=vehicles&id=<vehicle_id>`
Deletes a vehicle profile.
*   **Requires Scope:** `write:vehicles`
*   **Query Parameters:**
    *   `id` (string, **required**): The ID of the vehicle to delete.
*   **Returns:** JSON object containing `{ success: true }`.

### 3. Analytics (`?type=analytics`)

Retrieves aggregated fuel efficiency and cost statistics.

#### `GET /api/rest?type=analytics`
*   **Query Parameters:**
    *   `vehicleId` (string, optional): Filter by a specific vehicle ID.
    *   `startDate` (string, optional): Filter from this date (ISO 8601).
    *   `endDate` (string, optional): Filter to this date (ISO 8601).
*   **Returns:** JSON object containing aggregated stats (`logCount`, `totalSpent`, `homeCurrency`, `totalFuelLiters`, `totalDistanceKm`, `efficiency`, `avgCostPerLiter`, `avgCostPerKm`, etc.).

---

## MCP Server API (`/api/mcp`)

The Model Context Protocol (MCP) server allows conversational AI agents to interact directly with the Fuelog backend via a Streamable HTTP Server Transport (`/api/mcp`).

### Registered Tools

*   **`list_logs`**: List fuel log entries.
    *   `limit` (number, optional, default: 100): Max entries.
    *   `vehicleId` (string, optional): Filter by vehicle.
    *   `startDate` (string, optional): ISO 8601 start date.
    *   `endDate` (string, optional): ISO 8601 end date.
    *   `brand` (string, optional): Filter by brand.
*   **`log_fuel`**: Create a new fuel log entry.
    *   *Requires `write:logs` scope.*
    *   `brand` (string): Fuel station name.
    *   `cost` (number): Cost in home currency.
    *   `distanceKm` (number): Distance driven since last fill.
    *   `fuelAmountLiters` (number): Liters added.
    *   `currency` (string, optional): Alternate currency code.
    *   `originalCost` (number, optional): Cost in alternate currency.
    *   `exchangeRate` (number, optional): Exchange rate used.
    *   `vehicleId` (string, optional): Associated vehicle.
    *   `timestamp` (string, optional): ISO 8601 datetime.
    *   `latitude` (number, optional): GPS latitude.
    *   `longitude` (number, optional): GPS longitude.
*   **`edit_fuel_log`**: Update existing log.
    *   *Requires `write:logs` scope.*
    *   `logId` (string): ID to update.
    *   `brand`, `cost`, `distanceKm`, `fuelAmountLiters`, `currency`, `originalCost`, `exchangeRate`, `vehicleId` (all optional parameters for updating).
*   **`delete_fuel_log`**: Permanently delete a log.
    *   *Requires `write:logs` scope.*
    *   `logId` (string): ID to delete.
    *   `confirm` (literal boolean `true`): Must be set to true.
*   **`list_vehicles`**: List user's vehicles.
    *   `includeArchived` (boolean, optional, default: false).
*   **`add_vehicle`**: Register a new vehicle.
    *   *Requires `write:vehicles` scope.*
    *   `name` (string), `make` (string), `model` (string), `year` (string).
    *   `fuelType` (enum: `"Petrol"`, `"Diesel"`, `"Hybrid"`, `"Electric"`).
    *   `isDefault` (boolean, optional).
*   **`update_vehicle`**: Update or archive a vehicle.
    *   *Requires `write:vehicles` scope.*
    *   `vehicleId` (string).
    *   `name`, `make`, `model`, `year`, `fuelType`, `isDefault`, `isArchived` (all optional updates).
*   **`get_analytics`**: Compute efficiency stats.
    *   `vehicleId`, `startDate`, `endDate` (all optional string filters).
*   **`compare_vehicles`**: Compare efficiency across vehicles.
    *   `vehicleIds` (array of strings, optional).
    *   `startDate`, `endDate` (optional string filters).

### Registered Resources

Resources provide static or semi-static views of data using `fuelog://` URIs.

*   **`fuel-logs`** (`fuelog://logs`): All fuel log entries (up to 200).
*   **`fuel-log`** (`fuelog://logs/{id}`): A specific log by ID.
*   **`vehicles`** (`fuelog://vehicles`): All registered vehicles.
*   **`vehicle`** (`fuelog://vehicles/{id}`): A specific vehicle by ID.
*   **`analytics-summary`** (`fuelog://analytics/summary`): Aggregated lifetime statistics.
*   **`analytics-monthly`** (`fuelog://analytics/monthly`): Month-by-month breakdown of stats.
*   **`analytics-vehicles`** (`fuelog://analytics/vehicles`): Per-vehicle statistical breakdown.
*   **`profile`** (`fuelog://profile`): User profile data (e.g., home currency).

### Registered Prompts

Prompts provide structured templates for analysis tasks.

*   **`monthly_report`**: Generates a detailed monthly report.
    *   `month` (string, YYYY-MM format).
    *   `vehicleId` (string, optional).
*   **`trend_analysis`**: Analyzes efficiency trends over time.
    *   `startDate` (string, ISO 8601).
    *   `endDate` (string, ISO 8601).
    *   `metric` (enum: `"kml"`, `"mpg"`, `"l100km"`, `"cost"`, optional).
    *   `vehicleId` (string, optional).
*   **`cost_optimization`**: Identifies patterns to reduce costs.
    *   `period` (enum: `"last_month"`, `"last_quarter"`, `"last_year"`, optional, defaults to `"last_quarter"`).

---

## Example LLM Integration Scenarios

### Scenario 1: LLM Generating a REST API call to Log Fuel
If an LLM needs to generate a fetch request to log fuel via the REST API based on the prompt "Log €50 of petrol at Shell, drove 400km, filled 35 liters for vehicle 123", it should generate:

```javascript
const response = await fetch('https://api.fuelog.app/api/rest?type=logs', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    brand: 'Shell',
    cost: 50.00,
    distanceKm: 400,
    fuelAmountLiters: 35.0,
    vehicleId: '123'
  })
});
```

### Scenario 2: LLM Using MCP to Fetch Monthly Report
If an agent has access to the MCP server, and the user asks "Generate my fuel report for March 2025", the LLM should invoke the `getPrompt` JSON-RPC method:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/get",
  "params": {
    "name": "monthly_report",
    "arguments": {
      "month": "2025-03"
    }
  }
}
```
The server will respond with the aggregated prompt text injected with the user's data for that month.
