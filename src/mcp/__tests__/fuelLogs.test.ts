// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const allLogs = vi.hoisted(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] }));

vi.mock('../firebase-admin.js', () => {
  // Fake query that honours startAfter/limit over an ordered in-memory list.
  const makeQuery = (start = 0, max = Infinity) => ({
    where: () => makeQuery(start, max),
    orderBy: () => makeQuery(start, max),
    startAfter: (cursor: { id: string }) => makeQuery(allLogs.docs.findIndex(d => d.id === cursor.id) + 1, max),
    limit: (n: number) => makeQuery(start, n),
    get: async () => ({ docs: allLogs.docs.slice(start, start + max) }),
  });
  return { getAdminDb: () => ({ collection: () => makeQuery() }) };
});

import { registerFuelLogTools } from '../tools/fuelLogs.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

function captureTools() {
  const tools: Record<string, ToolHandler> = {};
  const server = { registerTool: (name: string, _def: unknown, fn: ToolHandler) => { tools[name] = fn; } };
  registerFuelLogTools(server as unknown as McpServer, 'u1', { userId: 'u1', scopes: ['read:logs'], tokenId: 't' });
  return tools;
}

describe('MCP list_logs', () => {
  beforeEach(() => {
    // 450 logs, newest first; only every 50th is a "Circle K".
    allLogs.docs = Array.from({ length: 450 }, (_, i) => ({
      id: `log${i}`,
      data: () => ({ userId: 'u1', brand: i % 50 === 0 ? 'Circle K' : 'Esso', cost: 50 }),
    }));
  });

  it('applies the limit to matching logs, not to the logs scanned', async () => {
    const { list_logs } = captureTools();
    const result = await list_logs({ limit: 5, brand: 'circle' });
    const logs = JSON.parse(result.content[0].text);
    expect(logs).toHaveLength(5);
    expect(logs.every((l: { brand: string }) => l.brand === 'Circle K')).toBe(true);
    expect(logs.map((l: { id: string }) => l.id)).toEqual(['log0', 'log50', 'log100', 'log150', 'log200']);
  });

  it('returns all matches when there are fewer than the limit', async () => {
    const { list_logs } = captureTools();
    const logs = JSON.parse((await list_logs({ limit: 100, brand: 'circle' })).content[0].text);
    expect(logs).toHaveLength(9);
  });

  it('without a brand filter returns exactly `limit` logs', async () => {
    const { list_logs } = captureTools();
    const logs = JSON.parse((await list_logs({ limit: 7 })).content[0].text);
    expect(logs).toHaveLength(7);
  });
});

describe('MCP read scopes', () => {
  it('list_logs refuses a token without read:logs', async () => {
    const tools: Record<string, ToolHandler> = {};
    const server = { registerTool: (name: string, _def: unknown, fn: ToolHandler) => { tools[name] = fn; } };
    registerFuelLogTools(server as unknown as McpServer, 'u1', { userId: 'u1', scopes: ['write:logs'], tokenId: 't' });
    const result = await tools.list_logs({ limit: 5 }) as unknown as { isError?: boolean };
    expect(result.isError).toBe(true);
  });

  it('createMcpServer exposes no log/vehicle resources to a write-only token', async () => {
    const { createMcpServer } = await import('../server.js');
    const writeOnly = createMcpServer({ userId: 'u1', scopes: ['write:logs', 'write:vehicles'], tokenId: 't' });
    const full = createMcpServer({ userId: 'u1', scopes: ['read:logs', 'read:vehicles'], tokenId: 't' });
    const names = (s: unknown) => Object.keys((s as { _registeredResources: Record<string, unknown> })._registeredResources ?? {});
    expect(names(writeOnly)).not.toContain('fuelog://logs');
    expect(names(full)).toContain('fuelog://logs');
  });
});
