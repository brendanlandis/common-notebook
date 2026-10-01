import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// jest-dom's matchers on Vitest's expect, and their types on its Assertion.
import '@testing-library/jest-dom/vitest';
import { TEST_JWT_SECRET } from './app/lib/testTokens';

// Tokens are verified against JWT_SECRET; tests sign theirs with the same one.
process.env.JWT_SECRET = TEST_JWT_SECRET;

// Cleanup after each test
afterEach(() => {
  cleanup();
});
