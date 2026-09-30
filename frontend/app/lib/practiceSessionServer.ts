import { strapiFetch } from './strapiServer';
import { noteBlocks, parseSegments, type PracticeSegment } from './practiceSession';

export { noteBlocks };

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
  material?: { documentId: string; title?: string; tempo?: number | null } | null;
  session?: { documentId: string; date?: string | null } | null;
}

/**
 * What a log is read with wherever the timer needs to know where it stands: its
 * piece and that piece's subject, and its session with the session's subject and
 * every stretch in it — the "switch to" list and the note after stop both come
 * from that one read.
 */
export const LOG_POPULATE =
  'populate[material][populate][0]=project' +
  '&populate[session][populate][subject][fields][0]=title' +
  '&populate[session][populate][practice_logs][fields][0]=duration' +
  '&populate[session][populate][practice_logs][fields][1]=stop' +
  '&populate[session][populate][practice_logs][fields][2]=start' +
  '&populate[session][populate][practice_logs][fields][3]=segments' +
  '&populate[session][populate][practice_logs][fields][4]=tempoReached' +
  '&populate[session][populate][practice_logs][populate][material][fields][0]=title' +
  '&populate[session][populate][practice_logs][populate][material][fields][1]=tempo' +
  '&populate[session][populate][practice_logs][populate][material][fields][2]=goalTempo';

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
  documentId: string,
  populate = ''
): Promise<PracticeLogRow | null> {
  const response = await strapiFetch(
    token,
    `/api/practice-logs/${documentId}${populate ? `?${populate}` : ''}`
  );
  if (!response.ok) return null;
  const body = await response.json();
  return (body.data as PracticeLogRow) ?? null;
}

/**
 * The session's segments, already normalized.
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
      `&pagination[pageSize]=1&${LOG_POPULATE}`
  );
  if (!response.ok) return null;
  const body = await response.json();
  return (body.data?.[0] as PracticeLogRow) ?? null;
}

/**
 * The subject a piece belongs to: its project's documentId, or null for a piece
 * with no project. A session is filed under it.
 */
export async function subjectOf(token: string, material: string): Promise<string | null> {
  const response = await strapiFetch(
    token,
    `/api/tasks/${encodeURIComponent(material)}?populate[project][fields][0]=documentId`
  );
  if (!response.ok) return null;
  const body = await response.json();
  return body.data?.project?.documentId ?? null;
}

/**
 * Open a new sitting for `subject` on the effective day `date`. The owner is
 * stamped by the ownership middleware, as on every owned type.
 */
export async function createPracticeSession(
  token: string,
  { date, subject }: { date: string; subject: string | null }
): Promise<{ documentId: string } | null> {
  const response = await strapiFetch(token, '/api/practice-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { date, subject, notes: null } }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return (body.data as { documentId: string }) ?? null;
}


/**
 * Save what was written about one piece's stretch: its note and the tempo
 * reached. The tempo reached also becomes the piece's current tempo — "at 140,
 * goal 160" moves when you reach 150 — so the next session starts from it.
 */
export async function writeLogNote(
  token: string,
  documentId: string,
  { notes, tempoReached }: { notes?: string | null; tempoReached?: number | null }
): Promise<PracticeLogRow | null> {
  const data: Record<string, unknown> = {};
  if (notes !== undefined) data.notes = noteBlocks(notes);
  if (tempoReached !== undefined) data.tempoReached = tempoReached;
  const row = await writeSession(token, documentId, data);
  if (!row) return null;

  if (tempoReached) {
    const withMaterial = await fetchSession(token, documentId, 'populate[material][fields][0]=documentId');
    const material = withMaterial?.material?.documentId;
    if (material) {
      await strapiFetch(token, `/api/tasks/${material}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { tempo: tempoReached } }),
      });
    }
  }
  return row;
}
