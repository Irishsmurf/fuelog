# Fuelog MCP Integration

Connect Claude Desktop (or any MCP-compatible LLM client) to your Fuelog fuel data via the Model Context Protocol.

## Overview

The MCP server is deployed as a Vercel serverless function at `/api/mcp` on the same domain as your Fuelog app. Authentication uses Bearer tokens that you generate from the Fuelog profile page.

## Step 1: Get an API Token

1. Log in to Fuelog and go to the **Profile** page
2. Scroll to the **API Access** section at the bottom
3. Click **New token**, give it a name (e.g. "Claude Desktop"), select the permissions you want, and click **Generate token**
4. Copy the token — it will only be shown once

## Step 2: Get Firebase Service Account Credentials

The MCP server needs Firebase Admin SDK credentials to access Firestore. You need to provide these as a Vercel environment variable.

1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. Click the gear icon → **Project settings** → **Service accounts**
3. Click **Generate new private key** → Download the JSON file
4. Base64-encode it:
   ```bash
   base64 -i service-account.json | tr -d '\n'
   ```
5. Add the following environment variables to your Vercel project (Settings → Environment Variables):
   - `FIREBASE_PROJECT_ID` — your Firebase project ID (e.g. `fuelog-abc12`)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — the base64-encoded service account JSON from above

## Step 3: Configure Claude Desktop

Add the following to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fuelog": {
      "url": "https://your-fuelog-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer flog_your_token_here"
      }
    }
  }
}
```

The Fuelog token creation modal also generates this config snippet pre-filled with your token and the correct URL — just copy and paste it.

Restart Claude Desktop after saving.

## What You Can Do

Once connected, you can ask Claude things like:

- *"Show me my fuel logs from last month"*
- *"What's my average fuel efficiency this year?"*
- *"Log a fill-up: 45 litres at Shell for €72, 380km since last fill"*
- *"Generate a monthly fuel report for March 2025"*
- *"Compare the fuel efficiency of my two cars"*
- *"What fuel station brands do I use most, and which is cheapest?"*

## Available MCP Capabilities

### Resources (read-only data)

| URI | Description |
|-----|-------------|
| `fuelog://logs` | All fuel logs (newest first, up to 200) |
| `fuelog://logs/{id}` | Single fuel log by ID |
| `fuelog://vehicles` | All vehicles |
| `fuelog://vehicles/{id}` | Single vehicle by ID |
| `fuelog://profile` | User profile (home currency) |
| `fuelog://analytics/summary` | Lifetime aggregated stats |
| `fuelog://analytics/monthly` | Month-by-month breakdown |
| `fuelog://analytics/vehicles` | Per-vehicle efficiency stats |

### Tools (actions)

| Tool | Description | Scopes Required |
|------|-------------|-----------------|
| `list_logs` | Query logs with filters | `read:logs` |
| `log_fuel` | Create a new fuel log | `write:logs` |
| `edit_fuel_log` | Update an existing log | `write:logs` |
| `delete_fuel_log` | Delete a log | `write:logs` |
| `list_vehicles` | List vehicles | `read:vehicles` |
| `add_vehicle` | Create a new vehicle | `write:vehicles` |
| `update_vehicle` | Update or archive a vehicle | `write:vehicles` |
| `get_analytics` | Compute stats for a period | `read:logs` |
| `compare_vehicles` | Compare vehicles efficiency | `read:logs` |

### Prompts (guided analysis)

| Prompt | Description |
|--------|-------------|
| `monthly_report` | Detailed monthly fuel consumption report |
| `trend_analysis` | Efficiency and cost trends over a period |
| `cost_optimization` | Identify patterns to reduce fuel costs |

## Token Scopes

When creating a token, you can limit what actions it can perform:

| Scope | What it allows |
|-------|---------------|
| `read:logs` | Read fuel log entries and analytics |
| `write:logs` | Create, edit, and delete fuel logs |
| `read:vehicles` | Read vehicle information |
| `write:vehicles` | Create and update vehicles |

For read-only access (recommended for most LLM use cases), select only `read:logs` and `read:vehicles`.

## Security

- API tokens are generated client-side using the Web Crypto API
- Only the SHA-256 hash of your token is stored in Firestore — the raw token is never persisted
- Tokens can be revoked instantly from the Profile page
- Each token is scoped to specific permissions
- The MCP server uses Firebase Admin SDK and enforces userId-based data isolation at the application layer

## Troubleshooting

**"Invalid or revoked token"** — The token may have been revoked or typed incorrectly. Generate a new one from the Profile page.

**"Missing Authorization header"** — Make sure your MCP client config includes `"Authorization": "Bearer <token>"` in the headers.

**No data returned** — Make sure you have fuel logs in Fuelog and the token has `read:logs` scope.

**Tools fail with "required scope" error** — The token doesn't have write permissions. Generate a new token with `write:logs` or `write:vehicles` scope.
