'use strict';

/**
 * Pure transform: one populated `todo` document → the `data` payload for creating
 * the equivalent `task`, plus the source timestamps to re-apply afterward.
 *
 * Side-effect free (no Strapi, no I/O) so it can be unit-tested without booting
 * Strapi. The orchestration (migrate-todos-to-tasks.js) calls this, creates the
 * task via the document service, then restores the timestamps with a direct
 * column write.
 *
 * `todo` and `task` are field-identical — `task` was created in the Content-Type
 * Builder as a 1:1 copy — with a single deliberate difference: `task.long`
 * defaults to `false` (todo had no default), so a null/absent `long` is
 * normalized to `false` here.
 */

// Every scalar attribute shared by todo and task, copied verbatim. `long` is
// handled separately (default normalization); `owner`/`project` are relations.
const SCALAR_FIELDS = [
  'title',
  'description', // blocks — a JSON array, copied by value
  'completed',
  'completedAt',
  'dueDate',
  'isRecurring',
  'recurrenceType',
  'recurrenceInterval',
  'recurrenceDayOfWeek',
  'recurrenceDayOfMonth',
  'recurrenceWeekOfMonth',
  'recurrenceDayOfWeekMonthly',
  'recurrenceMonth',
  'displayDate',
  'displayDateOffset',
  'trackingUrl',
  'purchaseUrl',
  'price',
  'wishListCategory',
  'soon',
  'workSessions', // json — copied by value
];

/**
 * @param {object} todo a todo document loaded with `populate: ['owner','project']`
 * @returns {{ data: object, timestamps: object, sourceDocumentId: string|null }}
 */
function todoToTaskData(todo) {
  if (!todo || typeof todo !== 'object') {
    throw new TypeError('todoToTaskData: expected a todo object');
  }

  const data = {};
  for (const field of SCALAR_FIELDS) {
    // Copy present keys only; leave absent (undefined) keys for Strapi defaults.
    // An explicit null is a real value ("no due date") and is copied through.
    if (todo[field] !== undefined) data[field] = todo[field];
  }

  // task.long defaults to false (todo had none); normalize null/undefined → false.
  data.long = todo.long ?? false;

  // Relations, connected by the identifiers the document service accepts: owner
  // by numeric user id (matches backfill-owner.js), project by documentId. Both
  // may legitimately be absent — an incidental todo has no project. Ownerless
  // rows are guarded against by the orchestration, not silently created here.
  data.owner = todo.owner?.id ?? null;
  data.project = todo.project?.documentId ?? null;

  return {
    data,
    // Re-applied after create because the document service stamps
    // createdAt/updatedAt to "now", and a todo view sorts by creationDate.
    timestamps: {
      createdAt: todo.createdAt ?? null,
      updatedAt: todo.updatedAt ?? null,
      publishedAt: todo.publishedAt ?? null,
    },
    // Carried for dry-run mapping output and post-run verification only.
    sourceDocumentId: todo.documentId ?? null,
  };
}

module.exports = { todoToTaskData, SCALAR_FIELDS };
