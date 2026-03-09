import type { IncomingMessage, ServerResponse } from 'http';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb } from '../src/mcp/firebase-admin.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ~10MB raw body limit (base64 of a ~7.5MB image)
const MAX_BODY_BYTES = 10 * 1024 * 1024;
// ~4MB base64 limit (~3MB image after decoding)
const MAX_BASE64_BYTES = 4 * 1024 * 1024;

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    let byteLength = 0;
    req.on('data', (chunk: Buffer) => {
      byteLength += chunk.length;
      if (byteLength > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON payload')); }
    });
    req.on('error', reject);
  });
}

function sendResponse(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email: string | undefined } | null> {
  try {
    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  } catch (error) {
    console.error('[Gemini] Firebase ID token verification failed:', error);
    return null;
  }
}

async function isInternalTester(email: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    const snap = await db.collection('testers').doc(email).get();
    return snap.exists;
  } catch (error) {
    console.error('[Gemini] Tester check failed:', error);
    return false;
  }
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

function parseString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const allowedOrigin = process.env.CORS_ORIGIN || 'https://fuel.paddez.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendResponse(res, 405, { error: 'Method not allowed' });
  }

  // Authenticate via Firebase ID token
  const authHeader = req.headers['authorization'];
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return sendResponse(res, 401, { error: 'Missing Authorization: Bearer <id_token> header' });
  }

  const identity = await verifyFirebaseIdToken(idToken);
  if (!identity) {
    return sendResponse(res, 401, { error: 'Invalid or expired Firebase ID token' });
  }

  // Authorise: only internal testers may use this endpoint
  if (!identity.email || !(await isInternalTester(identity.email))) {
    return sendResponse(res, 403, { error: 'This feature is not available for your account' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendResponse(res, 500, { error: 'Gemini API key not configured' });
  }

  let body: { mimeType?: string; base64Data?: string };
  try {
    body = await readBody(req);
  } catch (error: any) {
    return sendResponse(res, 400, { error: error.message || 'Invalid request body' });
  }

  const { mimeType, base64Data } = body;
  if (!mimeType || !base64Data) {
    return sendResponse(res, 400, { error: 'Missing mimeType or base64Data' });
  }

  if (base64Data.length > MAX_BASE64_BYTES) {
    return sendResponse(res, 413, { error: 'Image too large. Maximum size is ~3MB.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Analyze this receipt image and extract the following information for a fuel purchase:
      1. Total Cost (as a number)
      2. Fuel Amount in Liters (as a number)
      3. Filling Station Brand Name (as a string)

      Return ONLY a raw JSON object with exactly these keys: "cost", "fuelAmountLiters", "brand".
      If a value cannot be found, use null.
      Do not use markdown formatting like \`\`\`json.
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } },
    ]);

    const text = result.response.text().trim();
    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/s);
    if (jsonMatch?.[1]) jsonText = jsonMatch[1];

    const raw = JSON.parse(jsonText);
    return sendResponse(res, 200, {
      cost: parseNumber(raw.cost),
      fuelAmountLiters: parseNumber(raw.fuelAmountLiters),
      brand: parseString(raw.brand),
    });
  } catch (error) {
    console.error('[Gemini] extraction error', error);
    return sendResponse(res, 500, { error: 'Failed to extract receipt data' });
  }
}
