// Turn a title into a URL-friendly slug. Intentionally ASCII-only and simple:
// lowercase, collapse any run of non-alphanumerics to a single hyphen, and trim
// leading/trailing hyphens. The backend project lifecycle uses the identical
// algorithm so the client-side preview matches what gets stored (modulo the
// per-owner uniqueness suffix the server may append).
export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
