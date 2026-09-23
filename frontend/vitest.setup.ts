import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { TEST_JWT_SECRET } from './app/lib/testTokens';

// Tokens are verified against JWT_SECRET; tests sign theirs with the same one.
process.env.JWT_SECRET = TEST_JWT_SECRET;

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});
