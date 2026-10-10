import { expect, it, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Shared installer and runner JavaScript.
import { configureTrust, setupTrustPolicy, setupMcp } from './trust-setup.mjs';
// @ts-expect-error Shared runner JavaScript.
import { admitEffect, TOOL_EFFECT_DEFAULTS } from './effect-doorway.mjs';
// @ts-expect-error Shared runner JavaScript.
import { readRootMcp } from './tool-turn.mjs';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const root = () => { const r = mkdtempSync(join(tmpdir(), 'trust-')); roots.push(r); return r; };
const request = () => ({ source: 'operator:setup:123', custodian: 'operator', recovery: 'revoke standing trust', resourceLevelUsd: 2,
  effects: [{ effect: 'tool:mcp', target: 'mcp__drafts__edit', recovery: 'restore previous draft revision',
    registration: { consequence: 'data', reversibility: 'reversible', reach: 'world', costUsd: 1 } },
  { effect: 'tool:mcp', target: 'mcp__mail__send', recovery: 'withdraw future permission',
    registration: { consequence: 'external', reversibility: 'irreversible', reach: 'world', costUsd: 0 } }],
  mcp: { mcpServers: { drafts: { command: 'draft-server', env: { TOKEN: { secretRef: 'draft-token' } } } }, reads: ['mcp__drafts__read'] } });
const load = (r: string) => JSON.parse(readFileSync(join(r, 'effect-policy.json'), 'utf8'));
it('writes once, reloads through real consumers, admits a declared reversible effect and refuses outward sends', () => {
  const r = root(), req = request(); configureTrust(r, 'setup', req);
  const before = readFileSync(join(r, 'effect-policy.json'), 'utf8'); configureTrust(r, 'setup', req);
  expect(readFileSync(join(r, 'effect-policy.json'), 'utf8')).toBe(before);
  const p = load(r);
  expect(p.grants.every((g: object) => !('expiresAt' in g))).toBe(true);
  expect(admitEffect({ effect: 'tool:mcp', target: 'mcp__drafts__edit' }, p).admitted).toBe(true);
  expect(admitEffect({ effect: 'tool:mcp', target: 'mcp__mail__send' }, p).admitted).toBe(false);
  expect(admitEffect({ effect: 'tool:mcp', target: 'mcp__other__edit' }, p).admitted).toBe(false);
  expect(readRootMcp(r).secrets).toEqual({ drafts: { TOKEN: 'draft-token' } });
  expect(() => configureTrust(r, 'setup', { ...req, resourceLevelUsd: 3 })).toThrow('different operator choices');
  expect(TOOL_EFFECT_DEFAULTS['tool:network-write'].reversibility).toBe('irreversible');
});
it('tightens cost and scope, rejects widening, and revoke is idempotent', () => {
  const r = root(), req = request(); configureTrust(r, 'setup', req);
  expect(() => configureTrust(r, 'tighten', { ...req, resourceLevelUsd: 3 })).toThrow('cannot widen');
  configureTrust(r, 'tighten', { ...req, resourceLevelUsd: 0.5 });
  expect(admitEffect({ effect: 'tool:mcp', target: 'mcp__drafts__edit' }, load(r)).admitted).toBe(false);
  configureTrust(r, 'tighten', { ...req, effects: [], mcp: { mcpServers: {}, reads: [] } });
  expect(load(r).grants).toEqual([]);
  configureTrust(r, 'revoke'); configureTrust(r, 'revoke');
  expect(load(r).registered).toEqual([]); expect(readRootMcp(r)).toBeNull();
});
it('rejects missing operator provenance, unbounded cost and literal env secrets', () => {
  expect(() => setupTrustPolicy({ ...request(), source: '' })).toThrow();
  expect(() => setupTrustPolicy({ ...request(), resourceLevelUsd: Infinity })).toThrow();
  expect(() => setupMcp({ mcpServers: { x: { command: 'x', env: { TOKEN: 'opaque-secret' } } } })).toThrow('secretRef');
});

// @ts-expect-error The real network admission path shares the policy decoder.
import { admitEgress } from './tool-admission.mjs';
it('limits reversible network registrations to an exact method and route; other writes stay irreversible', () => {
  const base = request();
  const scoped = { ...base, effects: [{ effect: 'tool:network-write', target: 'drafts.example',
    request: { method: 'PATCH', path: '/owned-draft/1' }, recovery: 'restore prior draft',
    registration: { consequence: 'data', reversibility: 'reversible', reach: 'world', costUsd: 0 } }] };
  const policy = setupTrustPolicy(scoped), config = { effectPolicy: policy, operations: [] };
  const input = { host: 'drafts.example', method: 'PATCH', path: '/owned-draft/1' };
  expect(admitEgress(input, config, 0).decision).toBe('allow');
  expect(admitEgress({ ...input, path: '/send' }, config, 0).decision).toBe('deny');
  expect(admitEgress({ ...input, method: 'DELETE' }, config, 0).decision).toBe('deny');
  expect(admitEgress({ ...input, headers: { 'x-http-method-override': 'POST' } }, config, 0).decision).toBe('deny');
  expect(() => setupTrustPolicy({ ...scoped, effects: [{ ...scoped.effects[0], request: undefined }] })).toThrow('exact request');
});

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
it('runs the shipped setup CLI unattended and the runner reads its resulting configuration', () => {
  const r = root(), input = join(r, 'operator-request.json'); writeFileSync(input, JSON.stringify(request()));
  const result = spawnSync(process.execPath, ['scripts/setup-standing-trust.mjs', 'setup', r, input], { encoding: 'utf8' });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(admitEffect({ effect: 'tool:mcp', target: 'mcp__drafts__edit' }, load(r)).admitted).toBe(true);
});

it('replays real summary, Jev, reviewer and delivered/empty outputs without turning model text into setup authority', () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
    otherShapes: { kind: string; id: string; raw: string; source: string }[] };
  expect(captured.otherShapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
    'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  const r = root(); configureTrust(r, 'setup', request());
  const before = readFileSync(join(r, 'effect-policy.json'), 'utf8');
  for (const row of captured.otherShapes) {
    let output: unknown; try { output = JSON.parse(row.raw); } catch { output = row.raw; }
    expect(() => configureTrust(r, 'setup', output), `${row.kind}: ${row.id}`).toThrow();
    expect(readFileSync(join(r, 'effect-policy.json'), 'utf8')).toBe(before);
  }
});
