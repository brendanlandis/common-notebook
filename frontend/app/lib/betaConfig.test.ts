import { describe, it, expect } from 'vitest';
import { BETA_PATHS, isBetaPath } from './betaConfig';

describe('isBetaPath', () => {
  it('matches an exact beta path', () => {
    expect(isBetaPath('/practice')).toBe(true);
  });

  it('matches a descendant of a beta path', () => {
    expect(isBetaPath('/practice/session/123')).toBe(true);
  });

  it('does not match a path that merely shares a prefix', () => {
    expect(isBetaPath('/practiceroom')).toBe(false);
  });

  it('does not match non-beta paths', () => {
    expect(isBetaPath('/')).toBe(false);
    expect(isBetaPath('/todo')).toBe(false);
    expect(isBetaPath('/settings')).toBe(false);
  });

  it('keeps /practice in the beta list', () => {
    expect(BETA_PATHS).toContain('/practice');
  });
});
