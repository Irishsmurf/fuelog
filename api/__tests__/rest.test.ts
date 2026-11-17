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

describe('REST API input validation', () => {
  type Handlers = Record<string, (arg?: unknown) => void>;

  function makeReq(method: string, url: string, body?: unknown): IncomingMessage {
    const handlers: Handlers = {};
    const req = {
      method,
      url,
      headers: { authorization: 'Bearer valid_token', host: 'localhost' },
      on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
        handlers[event] = cb;
        if (event === 'end') {
          queueMicrotask(() => {
            if (body !== undefined) handlers.data?.(Buffer.from(JSON.stringify(body)));
            handlers.end?.();
          });
        }
        return req;
      }),
    };
    return req as unknown as IncomingMessage;
  }

  function makeRes() {
    return { setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn(), headersSent: false } as unknown as ServerResponse & {
      writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>;
    };
  }

  const docRef = {
    get: vi.fn(),
    update: vi.fn(),
  };
  const collection = {
    add: vi.fn(),
    doc: vi.fn(() => docRef),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    get: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const { hasScope } = await import('../../src/mcp/auth.js');
    const { getAdminDb } = await import('../../src/mcp/firebase-admin.js');
    vi.mocked(validateToken).mockResolvedValue({ userId: 'user123', scopes: ['write:logs', 'write:vehicles'], tokenId: 't' });
    vi.mocked(hasScope).mockReturnValue(true);
    collection.doc.mockReturnValue(docRef);
    collection.where.mockReturnValue(collection);
    collection.orderBy.mockReturnValue(collection);
    collection.limit.mockReturnValue(collection);
    collection.get.mockResolvedValue({ docs: [] });
    collection.add.mockResolvedValue({ id: 'new-log' });
    docRef.get.mockResolvedValue({ exists: true, data: () => ({ userId: 'user123' }) });
    docRef.update.mockResolvedValue(undefined);
    vi.mocked(getAdminDb).mockReturnValue({ collection: () => collection } as never);
  });

  it('rejects a log with a string cost (400, nothing written)', async () => {
    const res = makeRes();
    await handler(makeReq('POST', '/api/rest?type=logs', { brand: 'X', cost: '60', distanceKm: 500, fuelAmountLiters: 40 }), res);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    expect(collection.add).not.toHaveBeenCalled();
  });

  it('returns 400 (not 500) for an invalid timestamp', async () => {
    const res = makeRes();
    await handler(makeReq('POST', '/api/rest?type=logs', { brand: 'X', cost: 60, distanceKm: 500, fuelAmountLiters: 40, timestamp: 'nope' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  });

  it('creates a valid log owned by the caller, ignoring a spoofed userId', async () => {
    const res = makeRes();
    await handler(makeReq('POST', '/api/rest?type=logs', { brand: 'X', cost: 60, distanceKm: 500, fuelAmountLiters: 40, userId: 'victim' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.anything());
    expect(collection.add).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user123', cost: 60, source: 'api', schemaVersion: 2 }));
  });

  it('only writes allowlisted fields on log update', async () => {
    const res = makeRes();
    await handler(makeReq('PUT', '/api/rest?type=logs&id=l1', { cost: 70, userId: 'victim', stationId: 'evil' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    expect(docRef.update).toHaveBeenCalledWith({ cost: 70 });
  });

  it('rejects an update with no updatable fields', async () => {
    const res = makeRes();
    await handler(makeReq('PUT', '/api/rest?type=logs&id=l1', { userId: 'victim' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    expect(docRef.update).not.toHaveBeenCalled();
  });

  it('caps the list limit', async () => {
    const res = makeRes();
    await handler(makeReq('GET', '/api/rest?type=logs&limit=999999'), res);
    expect(collection.limit).toHaveBeenCalledWith(500);
  });

  it('rejects a vehicle update that tries to change ownership only', async () => {
    const res = makeRes();
    await handler(makeReq('PUT', '/api/rest?type=vehicles&id=v1', { userId: 'victim' }), res);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    expect(docRef.update).not.toHaveBeenCalled();
  });

  it('rejects invalid analytics dates', async () => {
    const res = makeRes();
    await handler(makeReq('GET', '/api/rest?type=analytics&startDate=garbage'), res);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  });

  describe('read scopes and vehicle deletes', () => {
    const scopesOnly = async (granted: string[]) => {
      const { hasScope } = await import('../../src/mcp/auth.js');
      vi.mocked(hasScope).mockImplementation((_id, scope) => granted.includes(scope));
    };

    it('rejects reading logs without read:logs (write-only token)', async () => {
      await scopesOnly(['write:logs']);
      const res = makeRes();
      await handler(makeReq('GET', '/api/rest?type=logs'), res);
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
      expect(collection.get).not.toHaveBeenCalled();
    });

    it('rejects reading vehicles without read:vehicles', async () => {
      await scopesOnly(['read:logs', 'write:vehicles']);
      const res = makeRes();
      await handler(makeReq('GET', '/api/rest?type=vehicles'), res);
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
    });

    it('rejects analytics without read:logs', async () => {
      await scopesOnly(['read:vehicles']);
      const res = makeRes();
      await handler(makeReq('GET', '/api/rest?type=analytics'), res);
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
    });

    it('allows reading logs with read:logs', async () => {
      await scopesOnly(['read:logs']);
      const res = makeRes();
      await handler(makeReq('GET', '/api/rest?type=logs'), res);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
    });

    it('refuses to delete a vehicle that still has logs (409)', async () => {
      await scopesOnly(['write:vehicles']);
      const del = vi.fn();
      (docRef as unknown as { delete: typeof del }).delete = del;
      (collection as unknown as { count: () => unknown }).count = () => ({ get: async () => ({ data: () => ({ count: 3 }) }) });
      const res = makeRes();
      await handler(makeReq('DELETE', '/api/rest?type=vehicles&id=v1'), res);
      expect(res.writeHead).toHaveBeenCalledWith(409, expect.anything());
      expect(del).not.toHaveBeenCalled();
    });
  });
});
