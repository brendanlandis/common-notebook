import { fetchAllPages, strapiFetch } from './strapiServer';

export const TOP_OF_MIND = 'top of mind';

interface StrapiProject {
  documentId: string;
}

/**
 * Demote every "top of mind" project to "normal", optionally sparing one.
 *
 * Three call sites had a copy of this, and all three had the same bug: they
 * fetched `/api/projects` with no pagination — so Strapi's `defaultLimit: 25`
 * applied — and then filtered on `importance` in JavaScript. Any project sorted
 * 26th or later was invisible to them. Prod has 27 projects, so promoting one
 * could silently leave an older "top of mind" in place.
 *
 * Filtering server-side and paging fixes it in one place. Idempotent: demoting an
 * already-normal project is a no-op, so retrying is safe.
 *
 * Every read and write is scoped to the caller by the backend's ownership
 * middleware; the token is all the tenancy this needs.
 *
 * Returns the documentIds it actually demoted, and only those — a project whose
 * write failed is left out. The callers hand that list to the browser, which
 * cannot otherwise know these rows changed: the demotions happen behind a
 * request that names a different project, so a client patching only the project
 * it PUT kept showing the old one as "top of mind" until the next real fetch.
 */
export async function demoteTopOfMindProjects(
  token: string,
  exceptDocumentId?: string
): Promise<string[]> {
  const projects = await fetchAllPages<StrapiProject>(
    token,
    `/api/projects?filters[importance][$eq]=${encodeURIComponent(TOP_OF_MIND)}`
  );

  const demoted: string[] = [];
  for (const project of projects) {
    if (project.documentId === exceptDocumentId) continue;

    const response = await strapiFetch(token, `/api/projects/${project.documentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { importance: 'normal' } }),
    });

    if (response.ok) demoted.push(project.documentId);
    else console.error(`Failed to demote project ${project.documentId}`);
  }

  return demoted;
}
