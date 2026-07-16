/**
 * The default value of every `system-setting`, and the list seeded onto a new
 * account.
 *
 * Rows are per-user, so a brand-new account has none and a seed failure leaves
 * some missing permanently. That is survivable only because this table is also
 * what readers fall back to: `getTimeZoneSettings()` resolves a missing row to the
 * value here, identically on the server and the client. Seeding's job is to make
 * the settings visible and editable in /settings from day one, not to make
 * readers correct.
 *
 * Keep this the only place a default lives. Readers take their values as
 * parameters (see `TimeZoneSettings`) — a module-level cache of a setting is how two
 * callers end up disagreeing about the same value, which is a bug this codebase
 * has already shipped once.
 *
 * These match production's values.
 */

export type SettingTitle =
  | 'timezone'
  | 'dayBoundaryHour'
  | 'completedTaskVisibilityMinutes'
  | 'autoDeclutter'
  | 'enableStuffProjects';

export const DEFAULT_SETTINGS: ReadonlyArray<{ title: SettingTitle; value: string }> = [
  { title: 'timezone', value: 'America/New_York' },
  { title: 'dayBoundaryHour', value: '4' },
  { title: 'completedTaskVisibilityMinutes', value: '15' },
  { title: 'autoDeclutter', value: 'true' },
  { title: 'enableStuffProjects', value: 'true' },
];

export function getDefault(title: SettingTitle): string {
  const setting = DEFAULT_SETTINGS.find((s) => s.title === title);
  if (!setting) throw new Error(`No default defined for system setting "${title}"`);
  return setting.value;
}
