import { config } from 'zod/v4/core';

// Runs before any page code. The page policy forbids eval, and zod compiles its
// object parsers with `new Function` when it can. Its probe for that, on every
// page, gets reported as a violation even though zod catches the refusal.
config({ jitless: true });
