import { describe, it, expect, vi, beforeEach } from 'vitest';

// Observe whether the reset ran by mocking its collaborators. `fetchAllPages`
// is the first thing performMoonPhaseReset does, so its call count tells us
// whether the reset body executed; `upsertSystemSetting` tells us whether the
// watermark was stamped.
const getSystemSetting = vi.fn();
const upsertSystemSetting = vi.fn();
const fetchAllPages = vi.fn();
const strapiFetch = vi.fn();
vi.mock('./strapiServer', () => ({
  getSystemSetting: (...a: unknown[]) => getSystemSetting(...a),
  upsertSystemSetting: (...a: unknown[]) => upsertSystemSetting(...a),
  fetchAllPages: (...a: unknown[]) => fetchAllPages(...a),
  strapiFetch: (...a: unknown[]) => strapiFetch(...a),
  getTimeZoneSettings: async () => ({ timezone: 'America/New_York', dayBoundaryHour: 4 }),
}));

// The astronomy itself is covered unmocked in `moonPhase.test.ts`. Here it is a
// switch, so that these tests are about the gate and the arming, not the moon.
const hasNewMoonSince = vi.fn();
vi.mock('./moonPhase', () => ({
  hasNewMoonSince: (...a: unknown[]) => hasNewMoonSince(...a),
}));

const demoteTopOfMindProjects = vi.fn();
vi.mock('./projectImportance', () => ({
  demoteTopOfMindProjects: (...a: unknown[]) => demoteTopOfMindProjects(...a),
}));

let mod: typeof import('./moonPhaseReset');

/** Make getSystemSetting resolve per title. */
function setSettings({ auto, moon }: { auto: unknown; moon: unknown }) {
  getSystemSetting.mockImplementation((_token: string, title: string) =>
    Promise.resolve(title === 'autoDeclutter' ? auto : moon),
  );
}

/** An account armed long enough ago that a moon could plausibly have passed. */
const ARMED = { date: '2026-05-17' };

let userKeyCounter = 0;

beforeEach(async () => {
  vi.clearAllMocks();
  upsertSystemSetting.mockResolvedValue(true);
  fetchAllPages.mockResolvedValue([]); // no soon tasks → performMoonPhaseReset is cheap
  // Resolves the documentIds it demoted; performMoonPhaseReset takes .length.
  demoteTopOfMindProjects.mockResolvedValue([]);
  vi.resetModules();
  mod = await import('./moonPhaseReset');
  userKeyCounter += 1;
});

describe('runMoonPhaseResetIfDue — autoDeclutter gate', () => {
  it('skips the reset when autoDeclutter is "false", without checking the moon', async () => {
    setSettings({ auto: { value: 'false' }, moon: ARMED });
    await mod.runMoonPhaseResetIfDue('token', `off-${userKeyCounter}`);
    expect(hasNewMoonSince).not.toHaveBeenCalled();
    expect(fetchAllPages).not.toHaveBeenCalled();
    expect(upsertSystemSetting).not.toHaveBeenCalled();
  });

  it('runs the reset when the setting is unset (default on) and a new moon is due', async () => {
    // Opt-out: an absent autoDeclutter row means enabled. The account must
    // already be armed, or the never-armed branch below takes precedence.
    setSettings({ auto: null, moon: ARMED });
    hasNewMoonSince.mockReturnValue(true);
    await mod.runMoonPhaseResetIfDue('token', `unset-${userKeyCounter}`);
    expect(fetchAllPages).toHaveBeenCalled(); // reset body executed
    expect(demoteTopOfMindProjects).toHaveBeenCalled();
    expect(upsertSystemSetting).toHaveBeenCalled(); // watermark re-stamped
  });

  it('runs the reset when autoDeclutter is explicitly "true" and due', async () => {
    setSettings({ auto: { value: 'true' }, moon: ARMED });
    hasNewMoonSince.mockReturnValue(true);
    await mod.runMoonPhaseResetIfDue('token', `on-${userKeyCounter}`);
    expect(fetchAllPages).toHaveBeenCalled();
  });

  it('does nothing when enabled but no new moon is due', async () => {
    setSettings({ auto: { value: 'true' }, moon: ARMED });
    hasNewMoonSince.mockReturnValue(false);
    await mod.runMoonPhaseResetIfDue('token', `notdue-${userKeyCounter}`);
    expect(fetchAllPages).not.toHaveBeenCalled();
    expect(upsertSystemSetting).not.toHaveBeenCalled();
  });
});

describe('runMoonPhaseResetIfDue — arming', () => {
  /**
   * The reported bug: auto-declutter decluttered the instant it was on, instead
   * of waiting for the next new moon. An account with no watermark used to fall
   * into a 30-day backward search that always found a moon, so a fresh account's
   * "soon" flags were wiped on its very first task-list load.
   */
  it('arms instead of decluttering when the account has never been armed', async () => {
    setSettings({ auto: { value: 'true' }, moon: null });

    await mod.runMoonPhaseResetIfDue('token', `never-${userKeyCounter}`);

    expect(fetchAllPages).not.toHaveBeenCalled(); // nothing decluttered
    expect(demoteTopOfMindProjects).not.toHaveBeenCalled();
    expect(upsertSystemSetting).toHaveBeenCalledWith(
      'token',
      'moonPhaseLastResetDate',
      { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    );
  });

  it('does not even ask the moon when there is no watermark', async () => {
    // "Has a new moon passed since nothing?" has no answer; the fix is that the
    // question is never asked rather than answered wrongly.
    setSettings({ auto: { value: 'true' }, moon: null });
    await mod.runMoonPhaseResetIfDue('token', `noask-${userKeyCounter}`);
    expect(hasNewMoonSince).not.toHaveBeenCalled();
  });

  it('a row with no date counts as never armed', async () => {
    setSettings({ auto: { value: 'true' }, moon: { date: null } });
    await mod.runMoonPhaseResetIfDue('token', `nodate-${userKeyCounter}`);
    expect(fetchAllPages).not.toHaveBeenCalled();
    expect(upsertSystemSetting).toHaveBeenCalled();
  });

  it('still catches up a moon that passed while the app went unused', async () => {
    // Armed the whole time and a moon passed: the declutter is owed, just late.
    setSettings({ auto: { value: 'true' }, moon: ARMED });
    hasNewMoonSince.mockReturnValue(true);
    await mod.runMoonPhaseResetIfDue('token', `catchup-${userKeyCounter}`);
    expect(fetchAllPages).toHaveBeenCalled();
    expect(upsertSystemSetting).toHaveBeenCalled(); // re-armed, so it fires once
  });
});

describe('setAutoDeclutter', () => {
  it('arms the watermark when switched on, and declutters nothing', async () => {
    // The missing piece: nothing recorded when auto-declutter was turned on, so
    // "enable" was indistinguishable from "a moon is overdue".
    setSettings({ auto: { value: 'false' }, moon: null });

    await mod.setAutoDeclutter('token', true);

    expect(upsertSystemSetting).toHaveBeenCalledWith('token', 'autoDeclutter', { value: 'true' });
    expect(upsertSystemSetting).toHaveBeenCalledWith(
      'token',
      'moonPhaseLastResetDate',
      { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    );
    expect(fetchAllPages).not.toHaveBeenCalled();
    expect(demoteTopOfMindProjects).not.toHaveBeenCalled();
  });

  it('does not re-arm when it was already enabled', async () => {
    // Re-stamping on every save would walk the watermark forward and postpone
    // the declutter indefinitely.
    setSettings({ auto: { value: 'true' }, moon: ARMED });

    await mod.setAutoDeclutter('token', true);

    expect(upsertSystemSetting).toHaveBeenCalledTimes(1);
    expect(upsertSystemSetting).toHaveBeenCalledWith('token', 'autoDeclutter', { value: 'true' });
  });

  it('treats an unset setting as already enabled and does not arm', async () => {
    // Opt-out default: unset means on, so seeding 'true' is not a transition.
    // A fresh account is armed by runMoonPhaseResetIfDue instead.
    setSettings({ auto: null, moon: null });

    await mod.setAutoDeclutter('token', true);

    expect(upsertSystemSetting).toHaveBeenCalledTimes(1);
    expect(upsertSystemSetting).toHaveBeenCalledWith('token', 'autoDeclutter', { value: 'true' });
  });

  it('writes the value without arming when switched off', async () => {
    setSettings({ auto: { value: 'true' }, moon: ARMED });

    await mod.setAutoDeclutter('token', false);

    expect(upsertSystemSetting).toHaveBeenCalledTimes(1);
    expect(upsertSystemSetting).toHaveBeenCalledWith('token', 'autoDeclutter', { value: 'false' });
  });

  it('reports failure and does not arm when the value cannot be written', async () => {
    setSettings({ auto: { value: 'false' }, moon: null });
    upsertSystemSetting.mockResolvedValue(false);

    await expect(mod.setAutoDeclutter('token', true)).resolves.toBe(false);
    expect(upsertSystemSetting).toHaveBeenCalledTimes(1); // no watermark stamp
  });
});
