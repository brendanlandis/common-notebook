/**
 * The app's real content-type and component schemas, keyed by uid, for tests
 * that stand in for `strapi.getModel`. Named `*.test-*` so tsconfig leaves it
 * out of the server build along with the tests; vitest only collects `*.test.ts`.
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');

export type Models = Record<string, { attributes: Record<string, any> }>;

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function loadModels(): Models {
  const models: Models = {};

  const apis = path.join(SRC, 'api');
  for (const api of fs.readdirSync(apis)) {
    const contentTypes = path.join(apis, api, 'content-types');
    if (!fs.existsSync(contentTypes)) continue;
    for (const name of fs.readdirSync(contentTypes)) {
      const file = path.join(contentTypes, name, 'schema.json');
      if (fs.existsSync(file)) models[`api::${api}.${name}`] = readJson(file);
    }
  }

  const components = path.join(SRC, 'components');
  for (const category of fs.existsSync(components) ? fs.readdirSync(components) : []) {
    for (const file of fs.readdirSync(path.join(components, category))) {
      if (file.endsWith('.json')) {
        models[`${category}.${path.basename(file, '.json')}`] = readJson(
          path.join(components, category, file)
        );
      }
    }
  }

  return models;
}
