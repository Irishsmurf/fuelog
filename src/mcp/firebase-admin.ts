import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let _app: App | null = null;
let _db: Firestore | null = null;

export function getAdminApp(): App {
  if (_app) return _app;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID env vars are required');

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is required');

  const serviceAccount = JSON.parse(
    Buffer.from(serviceAccountJson, 'base64').toString('utf8')
  );

  if (getApps().length > 0) {
    _app = getApps()[0];
  } else {
    _app = initializeApp({ credential: cert(serviceAccount), projectId });
  }
  return _app;
}

export function getAdminDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  return _db;
}
