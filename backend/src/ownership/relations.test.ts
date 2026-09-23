import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { collectOwnedTargets, namedTargets, type TargetRef } from './relations';
import { OWNED_CONTENT_TYPES } from './rule';
import { loadModels } from './schemas.test-support';

const MODELS = loadModels();
const getModel = (uid: string) => MODELS[uid];
const isOwned = (uid: string) => (OWNED_CONTENT_TYPES as readonly string[]).includes(uid);

/** Every shape Strapi accepts that links rows, and the rows it names. */
const LINKING: Array<[string, unknown, TargetRef[]]> = [
  ['a numeric id', 5, [{ id: 5 }]],
  ['a numeric string, which Strapi reads as an id', '5', [{ id: 5 }]],
  ['a documentId', 'abc123', [{ documentId: 'abc123' }]],
  ['longhand id', { id: 5 }, [{ id: 5 }]],
  ['longhand documentId', { documentId: 'abc' }, [{ documentId: 'abc' }]],
  ['longhand with both: the documentId wins', { id: 5, documentId: 'abc' }, [{ documentId: 'abc' }]],
  ['a mixed list', [1, 'abc', { id: 2 }], [{ id: 1 }, { documentId: 'abc' }, { id: 2 }]],
  ['connect, a list', { connect: [{ id: 1 }, 'abc'] }, [{ id: 1 }, { documentId: 'abc' }]],
  ['connect, a single value', { connect: { documentId: 'abc' } }, [{ documentId: 'abc' }]],
  ['connect with a position', { connect: [{ id: 1, position: { before: 2 } }] }, [{ id: 1 }]],
  ['set', { set: [{ documentId: 'x' }, 3] }, [{ documentId: 'x' }, { id: 3 }]],
  ['set and connect together', { set: [1], connect: [2] }, [{ id: 1 }, { id: 2 }]],
  ['connect beside a disconnect', { connect: [1], disconnect: [2] }, [{ id: 1 }]],
];

/** Shapes Strapi accepts that link nothing. */
const NOT_LINKING: Array<[string, unknown]> = [
  ['null', null],
  ['undefined', undefined],
  ['an empty list', []],
  ['disconnect alone', { disconnect: [{ id: 9 }, 'abc'] }],
  ['an empty connect', { connect: [] }],
];

describe('namedTargets', () => {
  it.each(LINKING)('names the rows linked by %s', (_label, value, refs) => {
    expect(namedTargets(value)).toEqual(refs);
  });

  it.each(NOT_LINKING)('names nothing for %s', (_label, value) => {
    expect(namedTargets(value)).toEqual([]);
  });

  it.each([['12abc'], [-1], [0], [1.5], [{ id: 'abc' }], [{ id: -2 }], [{ connect: ['7x'] }]])(
    'refuses an id that is not a plain positive integer: %j',
    (value) => {
      // Strapi hands numeric ids to the database without a lookup, so an id
      // that isn't clean would be left to the database's coercion rules.
      expect(() => namedTargets(value)).toThrow(expect.objectContaining({ name: 'NotFoundError' }));
    }
  );

  it.each([[{}], [{ foo: 1 }], [true], [''], [{ set: null }]])(
    'rejects a shape it does not recognize: %j',
    (value) => {
      expect(() => namedTargets(value)).toThrow(expect.objectContaining({ name: 'ValidationError' }));
    }
  );
});

describe("agrees with Strapi's own relation parser", () => {
  // Not exported by @strapi/core, so it's loaded by path. If an upgrade moves or
  // rewrites it, this fails: re-check relations.ts against the new parser before
  // shipping, since the ownership check is only as good as that agreement.
  const require = createRequire(import.meta.url);
  const coreDist = path.dirname(require.resolve('@strapi/core'));
  const { mapRelation } = require(
    path.join(coreDist, 'services/document-service/transform/relations/utils/map-relation.js')
  );

  /** The rows Strapi would link: its `set` and `connect`, never `disconnect`. */
  async function strapiTargets(value: unknown): Promise<TargetRef[]> {
    const mapped = await mapRelation((relation: any) => relation, value);
    const linked = [...(mapped?.set ?? []), ...(mapped?.connect ?? [])];
    return linked.map((relation: any) =>
      relation.documentId ? { documentId: String(relation.documentId) } : { id: Number(relation.id) }
    );
  }

  it.each(LINKING)('names the same rows for %s', async (_label, value, refs) => {
    expect(await strapiTargets(value)).toEqual(refs);
  });

  it.each(NOT_LINKING)('links nothing for %s either', async (_label, value) => {
    expect(await strapiTargets(value)).toEqual([]);
  });
});

describe('collectOwnedTargets', () => {
  const collect = (uid: string, data: unknown) =>
    Object.fromEntries(collectOwnedTargets(getModel, uid, data, isOwned));

  it('groups the owned rows a task links to by type, skipping the owner', () => {
    expect(
      collect('api::task.task', {
        title: 'x',
        project: 'p1',
        practice_logs: { connect: [1] },
        owner: 5,
      })
    ).toEqual({
      'api::project.project': [{ documentId: 'p1' }],
      'api::practice-log.practice-log': [{ id: 1 }],
    });
  });

  it('finds relations inside a repeatable component: a view section’s worlds', () => {
    expect(
      collect('api::view.view', { name: 'v', sections: [{ worlds: ['w1'] }, { worlds: [{ id: 2 }] }] })
    ).toEqual({ 'api::world.world': [{ documentId: 'w1' }, { id: 2 }] });
  });

  it('finds every relation between owned types in the real schemas', () => {
    // Guards the walk against a schema it hasn't met: add a relation between
    // owned types and it must be found here, or this fails.
    for (const uid of OWNED_CONTENT_TYPES) {
      const attributes = MODELS[uid]?.attributes ?? {};
      for (const [name, attribute] of Object.entries(attributes)) {
        if (attribute.type === 'relation' && isOwned(attribute.target)) {
          expect(collect(uid, { [name]: 'doc1' }), `${uid}.${name}`).toEqual({
            [attribute.target]: [{ documentId: 'doc1' }],
          });
        }
        if (attribute.type === 'component') {
          for (const [inner, innerAttribute] of Object.entries(MODELS[attribute.component].attributes)) {
            if ((innerAttribute as any).type === 'relation' && isOwned((innerAttribute as any).target)) {
              expect(collect(uid, { [name]: [{ [inner]: 'doc1' }] }), `${uid}.${name}.${inner}`).toEqual({
                [(innerAttribute as any).target]: [{ documentId: 'doc1' }],
              });
            }
          }
        }
      }
    }
  });

  it('walks a dynamic zone by each item’s component', () => {
    const models: Record<string, any> = {
      'api::page.page': { attributes: { blocks: { type: 'dynamiczone', components: ['shared.link'] } } },
      'shared.link': {
        attributes: { task: { type: 'relation', relation: 'oneToOne', target: 'api::task.task' } },
      },
    };
    const found = collectOwnedTargets(
      (uid) => models[uid],
      'api::page.page',
      { blocks: [{ __component: 'shared.link', task: 't1' }] },
      isOwned
    );
    expect(Object.fromEntries(found)).toEqual({ 'api::task.task': [{ documentId: 't1' }] });
  });

  it('fails closed on a morph relation, which names its target per value', () => {
    const models: Record<string, any> = {
      'api::note.note': { attributes: { about: { type: 'relation', relation: 'morphToOne' } } },
    };
    expect(() =>
      collectOwnedTargets((uid) => models[uid], 'api::note.note', { about: { id: 1 } }, isOwned)
    ).toThrow(expect.objectContaining({ name: 'ForbiddenError' }));
  });

  it('fails closed on a model it cannot read', () => {
    expect(() => collectOwnedTargets(() => undefined, 'api::gone.gone', { a: 1 }, isOwned)).toThrow(
      expect.objectContaining({ name: 'ValidationError' })
    );
  });
});
