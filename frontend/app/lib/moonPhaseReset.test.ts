import { describe, it, expect, vi, beforeEach } from 'vitest';

// Observe whether the reset ran by mocking its collaborators. `fetchAllPages`
// is the first thing performMoonPhaseReset does, so its call count tells us
// whether the reset body executed; `upsertSystemSetting` tells us whether the
// last-reset date was stamped.
const getSystemSetting = vi.fn();
const upsertSystemSetting = vi.fn();
const fetchAllPages = vi.fn();
const strapiFetch = vi.fn();
vi.mock('./strapiServer', () => ({
  getSystemSetting: (...a: unknown[]) => getSystemSetting(...a),
  upsertSystemSetting: (...a: unknown[]) => upsertSystemSetting(...a),
  fetchAllPages: (...a: unknown[]) => fetchAllPages(...a),
  strapiFetch: (...a: unknown[]) => strapiFetch(...a),
}));

const hasNewMoonSinceDate = vi.fn();
vi.mock('./moonPhase', () => ({
  hasNewMoonSinceDate: (...a: unknown[]) => hasNewMoonSinceDate(...a),
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

let userKeyCounter = 0;

describe('runMoonPhaseResetIfDue — autoDeclutter gate', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    upsertSystemSetting.mockResolvedValue(true);
    fetchAllPages.mockResolvedValue([]); // no soon tasks → performMoonPhaseReset is cheap
    demoteTopOfMindProjects.mockResolvedValue(0);
    vi.resetModules();
    mod = await import('./moonPhaseReset');
    userKeyCounter += 1;
  });

  it('skips the reset when autoDeclutter is "false", without checking the moon', async () => {
    setSettings({ auto: { value: 'false' }, moon: null });
    await mod.runMoonPhaseResetIfDue('token', `off-${userKeyCounter}`);
    expect(hasNewMoonSinceDate).not.toHaveBeenCalled();
    expect(fetchAllPages).not.toHaveBeenCalled();
    expect(upsertSystemSetting).not.toHaveBeenCalled();
  });

  it('runs the reset when the setting is unset (default on) and a new moon is due', async () => {
    setSettings({ auto: null, moon: null });
    hasNewMoonSinceDate.mockReturnValue(true);
    await mod.runMoonPhaseResetIfDue('token', `unset-${userKeyCounter}`);
    expect(fetchAllPages).toHaveBeenCalled(); // reset body executed
    expect(demoteTopOfMindProjects).toHaveBeenCalled();
    expect(upsertSystemSetting).toHaveBeenCalled(); // date stamped
  });

  it('runs the reset when autoDeclutter is explicitly "true" and due', async () => {
    setSettings({ auto: { value: 'true' }, moon: null });
    hasNewMoonSinceDate.mockReturnValue(true);
    await mod.runMoonPhaseResetIfDue('token', `on-${userKeyCounter}`);
    expect(fetchAllPages).toHaveBeenCalled();
  });

  it('does nothing when enabled but no new moon is due', async () => {
    setSettings({ auto: { value: 'true' }, moon: null });
    hasNewMoonSinceDate.mockReturnValue(false);
    await mod.runMoonPhaseResetIfDue('token', `notdue-${userKeyCounter}`);
    expect(fetchAllPages).not.toHaveBeenCalled();
    expect(upsertSystemSetting).not.toHaveBeenCalled();
  });
});
