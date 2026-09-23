/**
 * Which owned rows a write links to, so the middleware can check they are the
 * caller's too.
 *
 * The middleware owner-checks the row being written, but a write also names
 * other rows through its relations, and Strapi resolves those with no owner
 * filter: a documentId through an unscoped query, a numeric id with no lookup at
 * all. Populate then reads them back, also unscoped. Unchecked, a user could link
 * their task to someone else's project and read that project in the reply.
 *
 * The shapes accepted here are the ones Strapi 5's `mapRelation` accepts
 * (@strapi/core, document-service/transform/relations/utils/map-relation.js).
 * Anything else is rejected rather than guessed at, so a shape a later Strapi
 * adds fails loudly instead of slipping past. `relations.test.ts` runs Strapi's
 * own parser over the same cases and fails if the two disagree.
 */

import { errors } from '@strapi/utils';

const { ForbiddenError, NotFoundError, ValidationError } = errors;

export type TargetRef = { id: number } | { documentId: string };

/** The attribute metadata this module reads; a subset of Strapi's schema. */
interface Model {
  attributes: Record<string, any>;
}

export type GetModel = (uid: string) => Model | undefined;

const notFound = () => new NotFoundError('Relation target not found');

/**
 * An internal id. Strapi passes numeric ids to the database without looking them
 * up, so anything but a plain positive integer is refused rather than left to
 * the database's coercion rules.
 */
function idRef(value: unknown): TargetRef {
  const text = String(value);
  if (!/^\d+$/.test(text) || Number(text) < 1) throw notFound();
  return { id: Number(text) };
}

/**
 * The rows a relation value links to. `disconnect` is left out on purpose: it
 * only unlinks, from a row the middleware has already owner-checked, and it is
 * how an existing cross-owner link gets cleaned up.
 */
export function namedTargets(value: unknown): TargetRef[] {
  // null | undefined: clears the relation, links nothing.
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) return value.flatMap(namedTargets);

  if (typeof value === 'object') {
    const relation = value as Record<string, unknown>;
    // Longhand. Strapi takes the documentId when both are given.
    if ('id' in relation || 'documentId' in relation) {
      if (relation.documentId) return [{ documentId: String(relation.documentId) }];
      return [idRef(relation.id)];
    }
    // { set, connect, disconnect }, each a single value or a list. Strapi tests
    // these for truthiness, so `{ set: null }` names nothing.
    if (relation.set || relation.connect || relation.disconnect) {
      return [...namedTargets(relation.set ?? null), ...namedTargets(relation.connect ?? null)];
    }
    throw new ValidationError('Unrecognized relation value');
  }

  // Shorthand. Strapi reads anything `parseInt` accepts as an id, so "12" is one.
  if (typeof value === 'number' || typeof value === 'string') {
    if (!Number.isNaN(parseInt(String(value), 10))) return [idRef(value)];
    if (value === '') throw new ValidationError('Unrecognized relation value');
    return [{ documentId: value as string }];
  }

  throw new ValidationError('Unrecognized relation value');
}

/**
 * Every owned row `data` links to, grouped by content type. Walks the model's
 * attributes, into components and dynamic zones, so a relation inside a
 * component (a view's sections → worlds) is found too.
 */
export function collectOwnedTargets(
  getModel: GetModel,
  uid: string,
  data: unknown,
  isOwned: (uid: string) => boolean,
  found: Map<string, TargetRef[]> = new Map()
): Map<string, TargetRef[]> {
  if (!data || typeof data !== 'object') return found;

  const model = getModel(uid);
  if (!model) throw new ValidationError(`Unknown model ${uid}`);

  for (const [key, value] of Object.entries(data)) {
    const attribute = model.attributes[key];
    if (!attribute || value === undefined) continue;

    if (attribute.type === 'relation') {
      if (String(attribute.relation).startsWith('morph')) {
        // None exist today. A morph relation names its target type per value,
        // which this check doesn't read, so fail closed until it does.
        if (value !== null) throw new ForbiddenError(`Relation ${key} is not supported`);
        continue;
      }
      if (!isOwned(attribute.target)) continue;
      const refs = namedTargets(value);
      if (refs.length) found.set(attribute.target, [...(found.get(attribute.target) ?? []), ...refs]);
      continue;
    }

    if (attribute.type === 'component') {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) collectOwnedTargets(getModel, attribute.component, item, isOwned, found);
      continue;
    }

    if (attribute.type === 'dynamiczone') {
      for (const item of Array.isArray(value) ? value : []) {
        if (item && typeof item === 'object') {
          collectOwnedTargets(getModel, (item as any).__component, item, isOwned, found);
        }
      }
    }
  }

  return found;
}
