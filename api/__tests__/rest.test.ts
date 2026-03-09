import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import handler from '../rest';
import { validateToken } from '../../src/mcp/auth.js';

// Mock dependencies
vi.mock('../../src/mcp/auth.js', () => ({
  validateToken: vi.fn(),
  hasScope: vi.fn(),
}));

vi.mock('../../src/mcp/firebase-admin.js', () => ({
  getAdminDb: vi.fn(),
}));

describe('REST API Handler', () => {
  let req: Partial<IncomingMessage>;
  let res: Partial<ServerResponse>;

  beforeEach(() => {
    req = {
      method: 'GET',
      headers: {},
      url: '/',
      on: vi.fn(),
    };
    res = {
      setHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    };
    vi.resetAllMocks();
  });

  it('handles CORS OPTIONS preflight', async () => {
    req.method = 'OPTIONS';
    await handler(req as IncomingMessage, res as ServerResponse);
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.any(String));
    expect(res.writeHead).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('rejects requests without authorization header', async () => {
    req.method = 'GET';
    await handler(req as IncomingMessage, res as ServerResponse);
    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Missing Authorization'));
  });

  it('rejects requests with invalid token', async () => {
    req.headers = { authorization: 'Bearer invalid_token' };
    vi.mocked(validateToken).mockResolvedValueOnce(null);

    await handler(req as IncomingMessage, res as ServerResponse);

    expect(validateToken).toHaveBeenCalledWith('invalid_token');
    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Invalid or revoked token'));
  });

  it('returns 400 for invalid or missing type parameter', async () => {
    req.headers = { authorization: 'Bearer valid_token' };
    vi.mocked(validateToken).mockResolvedValueOnce({ userId: 'user123', scopes: [], tokenId: 'token123' });
    req.url = '/'; // No type param

    await handler(req as IncomingMessage, res as ServerResponse);

    expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing type parameter'));
  });
});
