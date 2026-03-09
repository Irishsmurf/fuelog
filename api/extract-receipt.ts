import type { IncomingMessage, ServerResponse } from 'http';
import { getAdminApp } from '../src/mcp/firebase-admin.js';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

function handleCors(req: IncomingMessage, res: ServerResponse): boolean {
  const allowedOrigin = process.env.CORS_ORIGIN || 'https://fuel.paddez.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

function sendResponse(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON payload')); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendResponse(res, 405, { error: 'Method not allowed' });
  }

  // Verify Firebase ID token
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return sendResponse(res, 401, { error: 'Missing Authorization header' });
  }
  const idToken = authHeader.slice(7).trim();

  try {
    const adminApp = getAdminApp();
    await getAuth(adminApp).verifyIdToken(idToken);
  } catch {
    return sendResponse(res, 401, { error: 'Invalid or expired ID token' });
  }

  // Parse request body
  let body: { base64Data?: string; mimeType?: string };
  try {
    body = await readBody(req) as typeof body;
  } catch (e: unknown) {
    return sendResponse(res, 400, { error: (e as Error).message });
  }

  const { base64Data, mimeType } = body;
  if (!base64Data || !mimeType) {
    return sendResponse(res, 400, { error: 'Missing base64Data or mimeType' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendResponse(res, 500, { error: 'Gemini API key is not configured on the server' });
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

    const text = result.response.text();
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\n([\s\S]*?)\n```/s);
    if (jsonMatch?.[1]) jsonText = jsonMatch[1];

    const parsed = JSON.parse(jsonText);
    return sendResponse(res, 200, {
      cost: typeof parsed.cost === 'number' ? parsed.cost : null,
      fuelAmountLiters: typeof parsed.fuelAmountLiters === 'number' ? parsed.fuelAmountLiters : null,
      brand: typeof parsed.brand === 'string' ? parsed.brand : null,
    });
  } catch (err) {
    console.error('[extract-receipt] error', err);
    return sendResponse(res, 500, { error: 'Failed to extract data from receipt' });
  }
}
