import { describe, it, expect } from 'vitest';
import { navigate } from '../../../src/recall/cartographer/navigator.js';
import type { CartographerReader, CartographerNode } from '../../../src/recall/cartographer/contracts.js';
const node = (path: string, children: string[] = []): CartographerNode => ({ path, kind: children.length ? 'dir' : 'file',
  children, summary: 'TelegramAdapter handles delivery and messaging', summaryUpdatedAt: null,
  codeHash: 'a'.repeat(40), codeRev: 'b'.repeat(40), builtinKind: 'cartographer-node' });
describe('actual read accounting', () => {
  it('charges the root, siblings and path-only peek before reading, on a wide tree', () => {
    const children = Array.from({ length: 100000 }, (_, i) => `Telegram${i}.ts`);
    let reads = 0; let oidPaths: readonly string[] = [];
    const reader: CartographerReader = { getNode: p => { reads++; if (reads > 3) throw new Error('read budget escaped'); return p === '' ? node('', children) : node(p); },
      getChildren: () => { throw new Error('unbounded sibling read'); },
      currentOidMap: paths => { oidPaths = paths; return new Map(paths.map(p => [p, 'a'.repeat(40)])); } };
    const m = navigate(reader, 'Telegram', { maxNodesVisited: 3 });
    expect(reads).toBe(3); expect(m.nodesVisited).toBe(reads); expect(m.nodesTruncated).toBe(99998);
    expect(m.truncated).toBe(true); expect(oidPaths).toEqual(m.scored.map(n => n.path));
  });
  it('does not peek below the depth bound and a zero read budget makes no reads', () => {
    const reads: string[] = [];
    const reader: CartographerReader = { getNode: p => { reads.push(p); if (p === '') return node('', ['src']);
      if (p === 'src') return node('src', ['src/deep']); throw new Error('depth escaped'); }, getChildren: () => [], currentOidMap: () => new Map() };
    expect(navigate(reader, 'Telegram', { maxNodesVisited: 0 }).nodesVisited).toBe(0); expect(reads).toEqual([]);
    expect(navigate(reader, 'Telegram', { maxDepth: 1 }).nodesVisited).toBe(2); expect(reads).toEqual(['', 'src']);
  });
  it('charges missing nodes and still reaches later siblings without inventing truncation', () => {
    const reads: string[] = [];
    const reader: CartographerReader = { getNode: p => { reads.push(p); return p === '' ? node('', ['gone.ts', 'TelegramAdapter.ts'])
      : p === 'gone.ts' ? null : node(p); }, getChildren: () => [], currentOidMap: () => new Map() };
    const result = navigate(reader, 'TelegramAdapter', { maxNodesVisited: 3 });
    expect(reads).toEqual(['', 'gone.ts', 'TelegramAdapter.ts']); expect(result.nodesVisited).toBe(3);
    expect(result.scored.map(n => n.path)).toContain('TelegramAdapter.ts');
    expect(result.nodesTruncated).toBe(0); expect(result.truncated).toBe(false);
  });
  it.each([NaN, Infinity, -1, 1.5])('refuses invalid read bound %s before I/O', maxNodesVisited => {
    const reader: CartographerReader = { getNode: () => { throw new Error('I/O occurred'); }, getChildren: () => [], currentOidMap: () => new Map() };
    expect(() => navigate(reader, 'Telegram', { maxNodesVisited })).toThrow(RangeError);
  });
});
