import { strapiFetch } from './strapiServer';
import { parseSegments, type PracticeSegment } from './practiceSession';

/**
 * Server-side plumbing for the practice session intent endpoints.
 *
 * The client never computes a duration and never writes `segments` wholesale.
 * It says *what it meant* — pause, resume, stop — and the server reads the row,
 * applies the change and writes it back. That division exists because a session
 * is shared between devices: you start on your phone and stop on your computer
 * an hour later. A client that PUT the array it believed in would let the phone
 * in your pocket clobber the computer's stop with a stale view of the world.
 */

export interface PracticeLogRow {
  documentId: string;
  start: string | null;
  stop: string | null;
  duration: number | null;
  date: string | null;
  segments: unknown;
}

/**
 * One writer at a time per session, and in order.
 *
 * Strapi has no compare-and-set, so every intent here is a read-modify-write and
 * two overlapping ones lose an update — two devices double-tapping pause would
 * both read "running" and both write a stop, or worse, a pause and a resume
 * would interleave into a session that is neither.
 *
 * Chained rather than shared. The moon-phase mutex hands the *same* promise to
 * every concurrent caller because they all want the same job done once; here the
 * callers want different things done, so they queue instead of collapsing. In
 * process, exactly like `api/auth/rate-limiter.ts` and for the same reason:
 * correct on the single-process droplet, and behind multiple instances the real
 * fix is a conditional update the database does not expose.
 *
 * A rejected write must not wedge the session — the next intent runs regardless,
 * which is safe because they are all idempotent.
 */
const chains = new Map<string, Promise<unknown>>();

export function withSessionLock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  // `then(run, run)` rather than `.catch().then()`: the predecessor's outcome is
  // irrelevant, and this runs `run` exactly once either way.
  const result = previous.then(run, run);

  // Track a settled, never-rejecting tail so the map cannot accumulate unhandled
  // rejections, and drop the key once this is the last one out.
  const tail = result.then(
    () => {},
    () => {}
  );
  chains.set(key, tail);
  void tail.then(() => {
    if (chains.get(key) === tail) chains.delete(key);
  });

  return result;
}

/** The session row, or null when Strapi will not give it to us. */
export async function fetchSession(
  token: string,
  documentId: string
): Promise<PracticeLogRow | null> {
  const response = await strapiFetch(token, `/api/practice-logs/${documentId}`);
  if (!response.ok) return null;
  const body = await response.json();
  return (body.data as PracticeLogRow) ?? null;
}

/**
 * The session's segments, already normalised.
 *
 * Falls back to a single segment spanning `start`→`stop` when the column is
 * empty but the row plainly describes a session. Nothing writes that shape today
 * — the create route always stamps a first segment — but a row made any other
 * way (a fixture, the Strapi admin, a future importer) would otherwise measure
 * as zero minutes while displaying a perfectly good start time, which is a
 * silent wrong answer rather than a visible one.
 */
export function segmentsOf(row: PracticeLogRow): PracticeSegment[] {
  const parsed = parseSegments(row.segments);
  if (parsed.length > 0 || !row.start) return parsed;
  return [{ start: row.start, stop: row.stop ?? null }];
}

/**
 * Is this session finished?
 *
 * Truthiness rather than `!== null`, because "no stop" reaches us as `null` from
 * Strapi and as `undefined` from anything that simply omitted the key. Treating
 * those differently would make a *running* session read as finished, which turns
 * every subsequent stop into a no-op and strands the session open forever.
 */
export function isFinished(row: PracticeLogRow): boolean {
  return Boolean(row.stop);
}

export async function writeSession(
  token: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<PracticeLogRow | null> {
  const response = await strapiFetch(token, `/api/practice-logs/${documentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return (body.data as PracticeLogRow) ?? null;
}

/**
 * The one session that is still open, if there is one.
 *
 * "Open" is `stop == null`, which is how `activeSession` has always been
 * derived — but asked of *every* session rather than of one material's, because
 * the modal has to answer "is anything running?" from pages where no material is
 * in scope. Only one may be open at a time; if the data disagrees, the most
 * recently started one wins and the rest are left for the correction control.
 */
export async function fetchOpenSession(token: string): Promise<PracticeLogRow | null> {
  const response = await strapiFetch(
    token,
    '/api/practice-logs?filters[stop][$null]=true&sort[0]=start:desc' +
      '&pagination[pageSize]=1&populate[material][populate][0]=project'
  );
  if (!response.ok) return null;
  const body = await response.json();
  return (body.data?.[0] as PracticeLogRow) ?? null;
}
