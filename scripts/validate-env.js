#!/usr/bin/env node

/**
 * Validates that required server-side environment variables are set.
 * Run this before deploying to catch missing config early.
 *
 * Firebase deploys authenticate with either Workload Identity Federation
 * (OIDC; GCP_WORKLOAD_IDENTITY_PROVIDER and GCP_SERVICE_ACCOUNT set) or the
 * legacy FIREBASE_TOKEN. One of the two must be configured.
 */

const REQUIRED = ['FIREBASE_PROJECT_ID', 'GEMINI_API_KEY'];

const missing = REQUIRED.filter(key => !process.env[key]);

const usesOidc = !!process.env.GCP_WORKLOAD_IDENTITY_PROVIDER;
if (usesOidc && !process.env.GCP_SERVICE_ACCOUNT) {
  missing.push('GCP_SERVICE_ACCOUNT (required with GCP_WORKLOAD_IDENTITY_PROVIDER)');
}
if (!usesOidc && !process.env.FIREBASE_TOKEN) {
  missing.push('FIREBASE_TOKEN (or configure OIDC: GCP_WORKLOAD_IDENTITY_PROVIDER + GCP_SERVICE_ACCOUNT)');
}

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`   - ${key}`));
  process.exit(1);
}

console.log(`✅ All required environment variables are set (Firebase auth: ${usesOidc ? 'OIDC' : 'FIREBASE_TOKEN'}).`);
