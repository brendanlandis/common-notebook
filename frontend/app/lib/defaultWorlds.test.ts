import { describe, it, expect } from 'vitest';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { PRACTICE_SYSTEM_KEY, isPracticeWorld } from './worlds';
import type { World } from '../types/index';

/**
 * The seed list is short by design, so these mostly guard against it growing
 * into a starter set of buckets someone then has to delete.
 */
describe('DEFAULT_WORLDS', () => {
  it('seeds the practice world with the handle the code matches on', () => {
    // This is the entire point. `systemKey` is not exposed by the worlds UI, so
    // a user cannot create a world the practice feature recognises — without
    // this the feature is unreachable, and silently so.
    const practice = DEFAULT_WORLDS.find((w) => w.systemKey === PRACTICE_SYSTEM_KEY);
    expect(practice).toBeDefined();
    expect(isPracticeWorld({ systemKey: practice!.systemKey } as World)).toBe(true);
  });

  it('seeds only worlds the code needs, not a starter set', () => {
    // A new user's own buckets are theirs to invent; anything seeded here is
    // furniture they have to clear out.
    expect(DEFAULT_WORLDS.every((w) => w.systemKey.length > 0)).toBe(true);
  });

  it('does not seed stuff, which is gated behind a setting', () => {
    // Seeding it would switch the shopping-list features on for everyone by
    // surprise. The gap for new accounts is real but separate.
    expect(DEFAULT_WORLDS.some((w) => w.systemKey === 'stuff')).toBe(false);
  });

  it('gives every seeded world a distinct handle', () => {
    // Two worlds sharing a systemKey would make every lookup pick one at random.
    const keys = DEFAULT_WORLDS.map((w) => w.systemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
