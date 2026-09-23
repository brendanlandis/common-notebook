import { describe, expect, it } from 'vitest';
import { PASSWORD_TOO_LONG, PASSWORD_TOO_SHORT, passwordProblem } from './passwordRules';

describe('passwordProblem', () => {
  it('wants at least 8 characters', () => {
    expect(passwordProblem('seven77')).toBe(PASSWORD_TOO_SHORT);
    expect(passwordProblem('eight888')).toBeNull();
  });

  it('allows 72 bytes, the most bcrypt reads', () => {
    expect(passwordProblem('a'.repeat(72))).toBeNull();
    expect(passwordProblem('a'.repeat(73))).toBe(PASSWORD_TOO_LONG);
  });

  it('counts bytes, not characters: accents take two and emoji four', () => {
    expect(passwordProblem('é'.repeat(36))).toBeNull();
    expect(passwordProblem('é'.repeat(37))).toBe(PASSWORD_TOO_LONG);
    expect(passwordProblem('🎸'.repeat(18))).toBeNull();
    expect(passwordProblem('🎸'.repeat(19))).toBe(PASSWORD_TOO_LONG);
  });
});
