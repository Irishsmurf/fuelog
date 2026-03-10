// functions/src/index.ts
// Initialise Firebase Admin SDK once for all functions
import { initializeApp, getApps } from 'firebase-admin/app';

if (getApps().length === 0) {
    initializeApp();
}

// Export all Cloud Functions
export { cleanupExpiredTokens } from './tokenCleanup';
export { sendMonthlySummary } from './monthlySummary';
export { processReceipt } from './receiptProcessing';
export { sendWeeklyDigest } from './weeklyDigest';
