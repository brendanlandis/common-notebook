/**
 * The shape of a calendar subscription as the browser is allowed to see it.
 *
 * **`icsUrl` is deliberately absent, and that is this module's whole job.** A
 * Google secret ICS URL is a bearer credential: anyone holding the link can read
 * that entire calendar, with no account, no audit trail, and no revocation short
 * of rotating the link and re-adding it everywhere it's used.
 *
 * It cannot be marked `private` in the Strapi schema, because private fields are
 * stripped from *every* response — including the ones this app's own server
 * makes — which would leave the poller unable to read the URL it exists to
 * fetch. So the protection is a line of code rather than a schema flag, which
 * means it is exactly the kind of thing a later "just return the row" tidy-up
 * deletes without noticing. Hence a named function, a test, and this note.
 */

export interface CalendarRow {
  documentId: string;
  name: string;
  icsUrl?: string;
  color?: string | null;
  position?: number | null;
  defaultState?: 'show' | 'hide' | 'unset' | null;
}

export interface ClientCalendar {
  documentId: string;
  name: string;
  color: string | null;
  position: number | null;
  defaultState: 'show' | 'hide' | 'unset';
  /** Whether a URL is set — all the browser needs to know about it. */
  hasUrl: boolean;
}

export function toClientCalendar(row: CalendarRow): ClientCalendar {
  return {
    documentId: row.documentId,
    name: row.name,
    color: row.color ?? null,
    position: row.position ?? null,
    // Unset is a real, visible state — the review is finished when nothing is
    // unset — so a missing value must not arrive as null and get rendered as
    // something other than "no opinion yet".
    defaultState: row.defaultState ?? 'unset',
    hasUrl: Boolean(row.icsUrl),
  };
}
