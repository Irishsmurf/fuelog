import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerLogResources } from './resources/logs.js';
import { registerVehicleResources } from './resources/vehicles.js';
import { registerProfileResource } from './resources/profile.js';
import { registerAnalyticsResources } from './resources/analytics.js';
import { registerFuelLogTools } from './tools/fuelLogs.js';
import { registerVehicleTools } from './tools/vehicles.js';
import { registerAnalyticsTools } from './tools/analytics.js';
import { registerPrompts } from './prompts/index.js';
import type { TokenIdentity } from './auth.js';
import { hasScope } from './auth.js';

export function createMcpServer(identity: TokenIdentity): McpServer {
  const server = new McpServer(
    { name: 'fuelog', version: '1.0.0' },
    { capabilities: { resources: {}, tools: {}, prompts: {}, logging: {} } }
  );

  const { userId } = identity;

  // Resources are only exposed for the read scopes the token was granted
  // (a write-only token must not be able to read data).
  const canReadLogs = hasScope(identity, 'read:logs');
  const canReadVehicles = hasScope(identity, 'read:vehicles');
  if (canReadLogs) registerLogResources(server, userId);
  if (canReadVehicles) registerVehicleResources(server, userId);
  registerProfileResource(server, userId);
  if (canReadLogs) registerAnalyticsResources(server, userId);

  // Tools check their own scopes per call.
  registerFuelLogTools(server, userId, identity);
  registerVehicleTools(server, userId, identity);
  if (canReadLogs) registerAnalyticsTools(server, userId);

  // Prompts read the user's logs.
  if (canReadLogs) registerPrompts(server, userId);

  return server;
}
