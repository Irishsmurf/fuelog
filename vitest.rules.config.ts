import { defineConfig } from 'vitest/config';

// Security-rules tests. These need the Firestore emulator, so they run via
// `npm run test:rules` (firebase emulators:exec) rather than the default suite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['firebase/__tests__/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
