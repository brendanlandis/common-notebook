import { describe, it, expect } from 'vitest';
import { BETA_PATHS, isBetaPath } from './betaConfig';

describe('isBetaPath', () => {
  it('matches an exact beta path', () => {
    expect(isBetaPath('/review')).toBe(true);
  });

  it('matches a descendant of a beta path', () => {
    expect(isBetaPath('/review/daily')).toBe(true);
  });

  it('does not match a path that merely shares a prefix', () => {
    expect(isBetaPath('/reviewer')).toBe(false);
  });

  it('does not match non-beta paths', () => {
    expect(isBetaPath('/')).toBe(false);
    expect(isBetaPath('/view/done')).toBe(false);
    expect(isBetaPath('/settings')).toBe(false);
  });

  it('no longer gates /practice, which left beta on 2026-09-30', () => {
    expect(BETA_PATHS).not.toContain('/practice');
    expect(isBetaPath('/practice')).toBe(false);
  });
});
