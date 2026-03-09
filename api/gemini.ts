import type { IncomingMessage, ServerResponse } from 'http';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '../src/mcp/firebase-admin.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
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

async function verifyFirebaseIdToken(idToken: string): Promise<string | null> {
  try {
    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
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

  const uid = await verifyFirebaseIdToken(idToken);
  if (!uid) {
    return sendResponse(res, 401, { error: 'Invalid or expired Firebase ID token' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendResponse(res, 500, { error: 'Gemini API key not configured' });
  }

  let body: { mimeType?: string; base64Data?: string };
  try {
    body = await readBody(req);
  } catch {
    return sendResponse(res, 400, { error: 'Invalid JSON payload' });
  }

  const { mimeType, base64Data } = body;
  if (!mimeType || !base64Data) {
    return sendResponse(res, 400, { error: 'Missing mimeType or base64Data' });
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

    const data = JSON.parse(jsonText);
    return sendResponse(res, 200, {
      cost: data.cost ?? null,
      fuelAmountLiters: data.fuelAmountLiters ?? null,
      brand: data.brand ?? null,
    });
  } catch (error) {
    console.error('[Gemini] extraction error', error);
    return sendResponse(res, 500, { error: 'Failed to extract receipt data' });
  }
}
