#!/usr/bin/env node

/**
 * Validates that required server-side environment variables are set.
 * Run this before deploying to catch missing config early.
 */

const REQUIRED = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GEMINI_API_KEY',
];

const missing = REQUIRED.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`   - ${key}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set.');
