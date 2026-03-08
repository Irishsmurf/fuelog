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

export function createMcpServer(identity: TokenIdentity): McpServer {
  const server = new McpServer(
    { name: 'fuelog', version: '1.0.0' },
    { capabilities: { resources: {}, tools: {}, prompts: {}, logging: {} } }
  );

  const { userId } = identity;

  // Resources
  registerLogResources(server, userId);
  registerVehicleResources(server, userId);
  registerProfileResource(server, userId);
  registerAnalyticsResources(server, userId);

  // Tools
  registerFuelLogTools(server, userId, identity);
  registerVehicleTools(server, userId, identity);
  registerAnalyticsTools(server, userId);

  // Prompts
  registerPrompts(server, userId);

  return server;
}
