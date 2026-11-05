import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CartographerNode, CartographerReader } from '../../../src/recall/cartographer/contracts.js';
/** Fixture adapter only: exact committed Git objects, with disposable test descriptions. */
export class CartographerTree implements CartographerReader {
  private nodes = new Map<string, CartographerNode>();
  constructor(private readonly config: { projectDir: string; stateDir: string }) {
    const file = join(config.stateDir, 'fixture.json');
    if (existsSync(file)) this.nodes = new Map(JSON.parse(readFileSync(file, 'utf8')) as [string, CartographerNode][]);
  }
  scaffold() {
    const rows = execFileSync('git', ['ls-tree', '-r', '-t', '-z', 'HEAD'], { cwd: this.config.projectDir, encoding: 'utf8' }).split('\0').filter(Boolean);
    const entries = [{ path: '', kind: 'dir' as const }, ...rows.map(row => ({ path: row.slice(row.indexOf('\t') + 1), kind: row.includes(' tree ') ? 'dir' as const : 'file' as const }))];
    for (const e of entries) this.nodes.set(e.path, { path: e.path, kind: e.kind, summary: '', summaryUpdatedAt: null, codeHash: null,
      codeRev: null, children: entries.filter(n => n.path !== '' && (n.path.includes('/') ? n.path.slice(0, n.path.lastIndexOf('/')) : '') === e.path).map(n => n.path), builtinKind: 'cartographer-node' });
    this.save();
  }
  private save() { writeFileSync(join(this.config.stateDir, 'fixture.json'), JSON.stringify([...this.nodes])); }
  getNode(path: string) { return this.nodes.get(path) ?? null; }
  getChildren(path: string, limit = 10000) { return (this.nodes.get(path)?.children ?? []).slice(0, limit).map(p => this.nodes.get(p)!); }
  currentOidMap(paths?: readonly string[]) {
    const rows = execFileSync('git', ['ls-tree', '-r', '-t', '-z', 'HEAD'], { cwd: this.config.projectDir, encoding: 'utf8' }).split('\0').filter(Boolean);
    const map = new Map(rows.map(r => [r.slice(r.indexOf('\t') + 1), r.split(/[ \t]/)[2]!]));
    map.set('', execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: this.config.projectDir, encoding: 'utf8' }).trim());
    return paths ? new Map(paths.filter(p => map.has(p)).map(p => [p, map.get(p)!])) : map;
  }
  setSummary(path: string, summary: string) { const n = this.nodes.get(path)!; this.nodes.set(path, { ...n, summary, codeHash: this.currentOidMap().get(path)!, summaryUpdatedAt: '2026-11-05T00:00Z' }); this.save(); }
}
