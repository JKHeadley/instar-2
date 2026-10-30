// Candidate only. Real journal + HTTP checkpoint, with recorded request paths and a local provider.
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { subscriptionDoorway, subscriptionPerDispatchToolsPolicy, subscriptionToolsPolicy } from '../../src/assembly/production-provider.js';
import { codexPerDispatchToolsPolicy, codexToolsPolicy } from '../../src/assembly/production-codex-provider.js';
import { encoded } from '../../src/assembly/boundary.js';
import { FULL_TOOLS_CLASS, PER_DISPATCH_TOOLS_CLASS, toolsPolicyClassVerdict } from './tools-policy-class.js';
import { openPreviewJournal, type JournalRecord } from './journal.js';
// @ts-expect-error host wiring is JavaScript
import { createAdmissionGate } from './admission-gate.mjs';
// @ts-expect-error host wiring is JavaScript
import { runToolTurn, toolPacketFits } from './tool-turn.mjs';

const recorded = JSON.parse(readFileSync('tests/preview/fixtures/model-gate-requests-2026-10-03.json', 'utf8')) as Record<string,
  { requests: [string, string][] }>;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const hash = (value: unknown) => (encoded(value) as { hash: string }).hash;

it.each([
  ['claude-code-subscription', subscriptionPerDispatchToolsPolicy, subscriptionToolsPolicy],
  ['codex-cli-subscription', codexPerDispatchToolsPolicy, codexToolsPolicy],
] as const)('successor %s is separate authority, preserving output/resource bounds and old policy resolution', (id, candidate, legacy) => {
  const policy = candidate('model'), old = legacy('model');
  expect(toolsPolicyClassVerdict(PER_DISPATCH_TOOLS_CLASS, policy, hash(policy))).toMatchObject({ kind: 'covered' });
  expect(toolsPolicyClassVerdict(FULL_TOOLS_CLASS, policy, hash(policy)).kind).toBe('outside');
  expect(toolsPolicyClassVerdict(FULL_TOOLS_CLASS, old, hash(old)).kind).toBe('covered');
  expect(toolsPolicyClassVerdict(PER_DISPATCH_TOOLS_CLASS, old, hash(old)).kind).toBe('outside');
  expect(policy.limits).not.toHaveProperty('maxTurns');
  expect(policy.args).not.toContain('--max-turns');
  for (const field of ['timeout', 'maxTokens', 'maxOutputBytes', 'maxCaptureBytes'] as const) expect(policy[field]).toBe(old[field]);
  const doorway = subscriptionDoorway(id, true);
  expect(doorway.toolsFraming).toBe(policy.framing);
  expect(doorway.policyFor('model', doorway.toolsFraming!)).toEqual(policy);
  expect(doorway.toolTurn).toMatchObject({ perDispatch: true });
  expect(subscriptionDoorway(id).toolsFraming).toBe(old.framing);
  const cyclic: Record<string, unknown> = { ...policy }; cyclic.self = cyclic;
  expect(toolsPolicyClassVerdict(PER_DISPATCH_TOOLS_CLASS, cyclic, hash(policy))).toEqual({ kind: 'outside', reason: 'the presented policy is not canonical' });
  expect(toolsPolicyClassVerdict(PER_DISPATCH_TOOLS_CLASS, { ...policy, extra: undefined }, hash(policy)).kind).toBe('outside');
  for (const changed of [{ ...policy, retries: 1 }, { ...policy, timeout: 300001 },
    { ...policy, modelRequests: 'none' }, { ...policy, limits: { ...policy.limits, maxTurns: 99 } },
    { ...policy, maxTokens: policy.maxTokens + 1 }])
    expect(toolsPolicyClassVerdict(PER_DISPATCH_TOOLS_CLASS, changed, hash(changed)).kind).toBe('outside');
});

it.each(['claude-code-subscription', 'codex-cli-subscription'].flatMap(id => [12, 13].map(requests => ({ id, requests }))))('$id admits twelve requests and refuses beyond the installation allowance ($requests requested)', async ({ id, requests }) => {
  const root = mkdtempSync(join(tmpdir(), 'per-dispatch-')); roots.push(root);
  const key = new Uint8Array(32).fill(7), path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:test',
    configurationDigest: 'sha256:test', expires: 1000000, maxCalls: 12, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 };
  const journal = openPreviewJournal(path, key, genesis);
  // Same already-reserved base call the worker provides to runToolTurn.
  journal.append({ kind: 'legacy-call', at: 1 });
  const doorway = subscriptionDoorway(id, true), framework = doorway.toolTurn!.framework!;
  const received: string[] = [];
  const upstream = createServer((req, res) => { req.resume(); req.on('end', () => {
    // The actual consumer sees a call only after its durable journal reservation.
    expect(journal.view.calls).toBe(received.length + 1);
    received.push(req.url!); res.end('answer');
  }); });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const port = (upstream.address() as { port: number }).port;
  const gate = await createAdmissionGate({ append: () => {}, effects: {}, stopped: () => false, now: () => 10,
    upstreams: { [framework]: { host: '127.0.0.1', port, secure: false } } });
  const callPath = recorded[framework]!.requests.find(([method, requestPath]) => method === 'POST' && !requestPath.includes('count_tokens'))![1];
  let openedTransport: string | undefined;
  const observedGate = { ...gate, open: (claim: string, options: { edge: { transport: string } }) => {
    openedTransport = options.edge.transport; gate.open(claim, options);
  } };
  try {
    const run = runToolTurn({ journal, root, id: 'telegram:12345678:update:9', prepared: '{}', promptLimit: 32768,
      deniedRoots: [root], operations: [], now: () => 10, stopped: () => false, redactText: (text: string) => text,
      admission: doorway.toolTurn, system: doorway.toolTurn!.system, gate: observedGate,
      scratch: (turn: string) => { const volume = join(turn, 'vol'); mkdirSync(volume, { recursive: true }); return volume; },
      detach: () => true, fallback: () => { throw Error('unexpected fallback'); },
      invoke: async (turn: { gate: string }) => {
        for (let ordinal = 1; ordinal <= requests; ordinal++)
          expect((await fetch(`${turn.gate}${callPath}`, { method: 'POST', body: '{}' })).status).toBe(ordinal <= 12 ? 200 : 400);
        return { state: 'complete', value: 'answer' };
      } });
    if (requests === 12) expect((await run).result).toEqual({ state: 'complete', value: 'answer' });
    else await expect(run).rejects.toThrow(/reserved allowance/u);
    expect(openedTransport).toBe(`${framework} on this machine`);
    expect(received).toHaveLength(12);
    expect(journal.view.calls).toBe(12);
    expect(journal.view.toolTurns).toMatchObject({ invocations: 1, reservedCalls: 11, open: [], dispatchOrdinals: {} });
    journal.compact();
    const replayed = openPreviewJournal(path, key, genesis);
    expect(replayed.view.calls).toBe(12);
    expect(replayed.view.toolTurns).toEqual(journal.view.toolTurns);
    expect(toolPacketFits(journal.view, true)).toBe(false);
  } finally { await gate.stop(); await new Promise<void>(resolve => upstream.close(() => resolve())); }
});

it('incremental journal reservations refuse past budget, duplicates and unknown attempts', () => {
  const root = mkdtempSync(join(tmpdir(), 'per-dispatch-')); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(7), { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:test', configurationDigest: 'sha256:test', expires: 1000,
    maxCalls: 2, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  journal.append({ kind: 'legacy-call', at: 1 });
  const id = 'telegram:12345678:update:9';
  journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, perDispatch: true, calls: 0, at: 2 });
  const row: JournalRecord = { kind: 'tool-turn', phase: 'call-reserved', id, attempt: 0, ordinal: 1, at: 3 };
  journal.append(row);
  expect(() => journal.append(row)).toThrow();
  expect(() => journal.append({ ...row, attempt: 1 })).toThrow();
  journal.append({ ...row, ordinal: 2 });
  expect(() => journal.append({ ...row, ordinal: 3 })).toThrow();
  expect(journal.view.calls).toBe(2);
});
