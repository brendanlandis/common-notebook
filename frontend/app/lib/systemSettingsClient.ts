/**
 * Write one of the caller's system settings from the browser.
 *
 * Deliberately has no read side and no cache. Time settings are resolved
 * server-side in `(main)/layout.tsx` and held in `DateTimeSettingsProvider`; a module
 * cache here would be a second copy of a value that already has an owner, which
 * is the shape of bug this replaced.
 *
 * After a successful save, update the provider so the UI reflects it without a
 * reload.
 */
export async function saveSystemSetting(title: string, value: string): Promise<boolean> {
  try {
    const response = await fetch('/api/system-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, value }),
    });
    return response.ok;
  } catch (e) {
    console.error(`Failed to save system setting "${title}":`, e);
    return false;
  }
}
