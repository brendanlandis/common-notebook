import { PRACTICE_SYSTEM_KEY } from './worlds';

/**
 * Worlds every new account starts with.
 *
 * Only the ones the *code* needs, not a starter set of buckets — a new user's
 * `day job` and `make music` are theirs to invent, and guessing at them would
 * be furniture they have to clear out. A world belongs here when something in
 * the app stops working without it, which today means exactly one.
 *
 * `practice and study` is that case. `isPracticeMaterial` matches on the
 * `systemKey`, so without this world there is no way for a user to *make* one
 * that the practice feature recognizes: `systemKey` is not something the worlds
 * UI exposes, and a world they create by hand called "practice and study" is an
 * ordinary world with an ordinary title. The feature would be unreachable, and
 * silently so — material would look like ordinary tasks with checkboxes.
 *
 * The title is the user's and can be renamed freely; `systemKey` is the stable
 * handle the code matches on, which is the whole reason the two are separate
 * fields.
 *
 * `stuff` is deliberately *not* here. It is gated behind `enableStuffProjects`
 * and predates the worlds collection, so existing accounts have one and new
 * ones do not — a real gap, but a different one, and seeding it here would turn
 * a shopping-list feature on for everybody by surprise.
 */
export const DEFAULT_WORLDS: ReadonlyArray<{
  title: string;
  systemKey: string;
  position: number;
}> = [{ title: 'practice and study', systemKey: PRACTICE_SYSTEM_KEY, position: 0 }];
