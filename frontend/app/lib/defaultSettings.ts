import { upsertSystemSetting } from './strapiServer';

/**
 * Settings every account needs on day one.
 *
 * `system-setting` rows are per-user now, so a brand-new account has none. The
 * app does have fallbacks, but they disagree: `dayBoundaryConfig.ts` defaults the
 * day boundary to 0 (midnight) and is what `dateUtils.ts` and
 * `layoutTransformers.ts` read, while `timezoneConfig.ts` defaults it to 4 and is
 * what `dayBoundaryHelpers.ts` reads. A user with no row silently gets both.
 *
 * Seeding the rows at redemption sidesteps that: every module then reads the same
 * stored value. It also makes the settings visible and editable from day one
 * rather than implicit.
 *
 * These match production's values, and `4` matches `timezoneConfig`'s intent.
 */
export const DEFAULT_SETTINGS: ReadonlyArray<{ title: string; value: string }> = [
  { title: 'timezone', value: 'America/New_York' },
  { title: 'dayBoundaryHour', value: '4' },
  { title: 'completedTaskVisibilityMinutes', value: '15' },
  { title: 'autoDeclutter', value: 'true' },
];

/**
 * Seed a newly created user's settings. Best-effort: a failure leaves the app on
 * its fallbacks rather than blocking account creation.
 */
export async function seedDefaultSettings(accessToken: string): Promise<void> {
  for (const setting of DEFAULT_SETTINGS) {
    try {
      const ok = await upsertSystemSetting(accessToken, setting.title, { value: setting.value });
      if (!ok) console.error(`Failed to seed default setting ${setting.title}`);
    } catch (error) {
      console.error(`Failed to seed default setting ${setting.title}:`, error);
    }
  }
}
