import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';

vi.mock('../src/mcp/firebase-admin.js', () => ({
  getAdminApp: vi.fn().mockReturnValue({}),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn().mockReturnValue({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user' }),
  }),
}));

class MockGoogleGenAI {
  interactions = {
    create: vi.fn().mockResolvedValue({
      output_text: '{"cost": 42.5, "fuelAmountLiters": 28, "brand": "Esso"}',
    }),
  };
}

vi.mock('@google/genai', () => ({
  GoogleGenAI: MockGoogleGenAI,
}));

function createMockReq(overrides: Partial<IncomingMessage> & { bodyData?: string } = {}): IncomingMessage {
  const { bodyData, ...rest } = overrides;
  const req = Object.assign(new EventEmitter(), {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    ...rest,
  }) as IncomingMessage;

  if (bodyData !== undefined) {
    process.nextTick(() => {
      req.emit('data', bodyData);
      req.emit('end');
    });
  } else {
    process.nextTick(() => req.emit('end'));
  }
  return req;
}

function createMockRes(): ServerResponse & { _statusCode: number; _body: string } {
  const res = {
    _statusCode: 0,
    _body: '',
    setHeader: vi.fn(),
    writeHead: vi.fn(function (this: { _statusCode: number }, code: number) { this._statusCode = code; }),
    end: vi.fn(function (this: { _body: string }, data?: string) { this._body = data ?? ''; }),
  };
  return res as unknown as ServerResponse & { _statusCode: number; _body: string };
}

describe('api/extract-receipt handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('returns 405 for non-POST requests', async () => {
    const handler = (await import('./extract-receipt.js')).default;
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await handler(req, res);
    expect(res._statusCode).toBe(405);
  });

  it('returns 401 without authorization header', async () => {
    const handler = (await import('./extract-receipt.js')).default;
    const req = createMockReq({ headers: {} });
    const res = createMockRes();
    await handler(req, res);
    expect(res._statusCode).toBe(401);
  });

  it('returns 400 without required body fields', async () => {
    const handler = (await import('./extract-receipt.js')).default;
    const req = createMockReq({ bodyData: JSON.stringify({}) });
    const res = createMockRes();
    await handler(req, res);
    expect(res._statusCode).toBe(400);
    expect(JSON.parse(res._body).error).toContain('Missing');
  });

  it('dynamically imports @google/genai without ESM errors', async () => {
    const handler = (await import('./extract-receipt.js')).default;
    const req = createMockReq({
      bodyData: JSON.stringify({ base64Data: 'abc123', mimeType: 'image/jpeg' }),
    });
    const res = createMockRes();
    await handler(req, res);
    expect(res._statusCode).toBe(200);
    const body = JSON.parse(res._body);
    expect(body).toEqual({ cost: 42.5, fuelAmountLiters: 28, brand: 'Esso' });
  });
});
