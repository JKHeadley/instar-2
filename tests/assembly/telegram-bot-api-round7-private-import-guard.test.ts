// Re-review 6 finding G01 (2026-09-17). GRANT U3-A lets exactly one private sibling edge exist: the custodian's
// named import of registerTelegramIdentityCaptureResolver from ../conversation/telegram.js. The assembly checker
// recognises that edge and nothing near it; these are the reviewer's thirteen substituted forms, kept permanently.
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { inspectAssemblyCore } from '../../scripts/check-assembly-contracts.mjs';

const path = 'src/assembly/telegram-bot-api-custodian.ts';
const edge = "import { registerTelegramIdentityCaptureResolver } from '../conversation/telegram.js';";
const sources = (): Record<string, string> => Object.fromEntries(readdirSync('src/assembly').filter(name => name.endsWith('.ts'))
  .map(name => [`src/assembly/${name}`, readFileSync(`src/assembly/${name}`, 'utf8')]));
const refused = (issues: string[]) => issues.some(issue => issue.includes('private sibling import'));

it('G01 the exact granted registration import is the only private sibling edge the assembly checker accepts', () => {
  const tree = sources();
  expect(tree[path]!.split(edge).length).toBe(2);
  expect(inspectAssemblyCore(tree)).toEqual([]);
});

it.each([
  ['other symbol', "import { extractTelegramUpdate } from '../conversation/telegram.js';"],
  ['additional symbol', "import { registerTelegramIdentityCaptureResolver, extractTelegramUpdate } from '../conversation/telegram.js';"],
  ['alias', "import { registerTelegramIdentityCaptureResolver as resolver } from '../conversation/telegram.js';"],
  ['wrong module', "import { registerTelegramIdentityCaptureResolver } from '../conversation/other.js';"],
  ['namespace import', "import * as all from '../conversation/telegram.js';"],
  ['default import', "import resolver from '../conversation/telegram.js';"],
  ['default plus named', "import resolver, { registerTelegramIdentityCaptureResolver } from '../conversation/telegram.js';"],
  ['side-effect import', "import '../conversation/telegram.js';"],
  ['named re-export', "export { registerTelegramIdentityCaptureResolver } from '../conversation/telegram.js';"],
  ['star re-export', "export * from '../conversation/telegram.js';"],
  ['type clause', "import type { registerTelegramIdentityCaptureResolver } from '../conversation/telegram.js';"],
  ['type binding', "import { type registerTelegramIdentityCaptureResolver } from '../conversation/telegram.js';"],
])('G01 substituted form is still refused: %s', (_name, line) => {
  const tree = sources();
  expect(refused(inspectAssemblyCore({ ...tree, [path]: tree[path]!.replace(edge, line) }))).toBe(true);
});

it('G01 the same import from any other Part Ten file is still refused', () => {
  const tree = sources();
  expect(refused(inspectAssemblyCore({ ...tree, [path]: tree[path]!.replace(edge, ''), 'src/assembly/other.ts': edge }))).toBe(true);
});
