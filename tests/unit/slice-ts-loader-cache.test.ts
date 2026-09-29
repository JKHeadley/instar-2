import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The slice loader caches transpiled output by input digest. The digest names the intended input;
// it does not vouch for the stored output, so a damaged entry must be a miss and be re-transpiled —
// never executed. Each case loads a module, damages the one cache entry it produced, and loads again.

type Load = (url: string, context: { format: string }, next: () => never) => Promise<{ source: string }>;
const unreachable = (): never => { throw Error('the loader delegated a .ts module'); };
const saved = process.env.INSTAR_SLICE_TS_CACHE;
afterEach(() => {
  if (saved === undefined) delete process.env.INSTAR_SLICE_TS_CACHE; else process.env.INSTAR_SLICE_TS_CACHE = saved;
});

const setup = async () => {
  const root = mkdtempSync(join(tmpdir(), 'slice-ts-cache-'));
  const cache = join(root, 'cache');
  process.env.INSTAR_SLICE_TS_CACHE = cache;
  vi.resetModules();
  const loader: string = new URL('../../scripts/slice-ts-loader.mjs', import.meta.url).href;
  const { load } = await import(loader) as { load: Load };
  const module = (name: string, text: string) => {
    const path = join(root, name); writeFileSync(path, text); return pathToFileURL(path).href;
  };
  const entries = (): string[] => {
    const found: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) walk(path); else if (!entry.endsWith('.pending')) found.push(path);
      }
    };
    walk(cache);
    return found.sort();
  };
  const run = async (url: string) => (await load(url, { format: 'module' }, unreachable)).source;
  return { module, entries, run };
};

const expectAnswer41 = (source: string) => {
  expect(source).toContain('answer = 41');
  expect(source).not.toContain(': number');
};

describe('slice-ts-loader transpile cache', () => {
  it('serves an intact entry from the cache', async () => {
    const { module, entries, run } = await setup();
    const url = module('a.ts', 'export const answer: number = 41;\n');
    const first = await run(url);
    expectAnswer41(first);
    expect(entries()).toHaveLength(1);
    expect(await run(url)).toBe(first);
  });

  const damage: Array<[string, (bytes: string) => string]> = [
    ['an empty entry', () => ''],
    ['a truncated entry', bytes => bytes.slice(0, Math.floor(bytes.length / 2))],
    ['substituted executable output', () => 'export const answer = 99;\n'],
    ['invalid JavaScript', () => 'export const = ;\n'],
    ['a record whose output was altered but whose digest was not', bytes => bytes.replace('answer = 41', 'answer = 99')],
  ];
  for (const [name, corrupt] of damage) {
    it(`re-transpiles instead of executing ${name}`, async () => {
      const { module, entries, run } = await setup();
      const url = module('a.ts', 'export const answer: number = 41;\n');
      await run(url);
      const found = entries();
      expect(found).toHaveLength(1);
      const entry = found[0] as string;
      writeFileSync(entry, corrupt(readFileSync(entry, 'utf8')));
      const source = await run(url);
      expectAnswer41(source);
      expect(source).not.toContain('answer = 99');
      // The miss republishes a good entry, so the next load is an intact hit again.
      expect(await run(url)).toBe(source);
    });
  }

  it('re-transpiles instead of executing a valid record copied under the wrong key', async () => {
    const { module, entries, run } = await setup();
    const a = module('a.ts', 'export const answer: number = 41;\n');
    await run(a);
    const entryA = entries()[0] as string;
    const b = module('b.ts', 'export const answer: number = 99;\n');
    await run(b);
    const entryB = entries().find(path => path !== entryA);
    expect(entryB).toBeDefined();
    writeFileSync(entryA, readFileSync(entryB as string, 'utf8'));
    const source = await run(a);
    expectAnswer41(source);
    expect(source).not.toContain('answer = 99');
  });
});
