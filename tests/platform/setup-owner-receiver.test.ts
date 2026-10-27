import { afterEach, expect, it } from 'vitest';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Host receiving boundary, outside the pure core.
import { setupOwnerReceiver } from '../../scripts/setup-owner-receiver.mjs';
// @ts-expect-error Existing installed-owner client.
import { setupPreparationOwners } from '../../scripts/setup-supervisor-owners.mjs';
// @ts-expect-error Existing bounded Unix transport.
import { requestSocket } from '../../scripts/custody-platform/linux.mjs';
// @ts-expect-error Existing fixed owner protocol.
import { CHECKS, PRECHECKS, SCHEMA } from '../../scripts/setup-supervisor-protocol.mjs';

const checkpoint = { installation: 'test-installation', session: 'test-session', subject: 'a'.repeat(64),
  authority: 'test-preparation', step: 'key', phase: 'pre', operation: 'test-session:key', schema: SCHEMA };
type Checkpoint = typeof checkpoint;
type RecordShape = { checkpoint: Checkpoint & { frontier: string }; checks: {
  name: string; owner: string; observed: boolean; passed: boolean; receipt: string;
}[] };
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const request = (operation: string, cp = checkpoint, record?: unknown) => ({ kind: 'setup-owner-request', operation,
  checkpoint: cp, ...(record === undefined ? {} : { record }) });

// Protocol evidence fixture, NOT installed custody or production standing. Signed
// retained receipts exercise authenticity and corruption with real crypto and I/O.
// No fixture result is presented as key isolation, enrollment or recovery evidence.
function fixture(cp = checkpoint) {
  const root = mkdtempSync(join(tmpdir(), 'setup-receiving-')); roots.push(root);
  const path = join(root, 'receipt.json');
  const keys = generateKeyPairSync('ed25519');
  let count = 0, frontier = 'frontier:1', state = 'absent';
  const owner = cp.step === 'append' ? 'one-two' : 'custodian';
  const save = (record: RecordShape) => {
    const bytes = JSON.stringify(record);
    writeFileSync(path, JSON.stringify({ bytes, signature: sign(null, Buffer.from(bytes), keys.privateKey).toString('base64') }));
  };
  const record: RecordShape = { checkpoint: { ...cp, frontier }, checks: PRECHECKS[cp.step].map((name: string, index: number) =>
    ({ name, owner, observed: true, passed: true, receipt: `r${index + 1}` })) };
  save(record);
  const read = () => {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    if (!verify(null, Buffer.from(saved.bytes), keys.publicKey, Buffer.from(saved.signature, 'base64'))) throw Error('receipt signature');
    return JSON.parse(saved.bytes) as RecordShape;
  };
  const implementation = {
    async read() { return read(); },
    async reconcile() { return state; },
    async execute(received: Checkpoint, expected: string) {
      expect(received).toEqual(cp);
      if (expected !== frontier) throw Error('frontier changed');
      count++; state = 'executed'; return state;
    },
  };
  const receiver = setupOwnerReceiver({ owner, implementation });
  return { receiver, implementation, path, record, read, save, count: () => count,
    state: (value: string) => { state = value; }, frontier: (value: string) => { frontier = value; } };
}

it('receives the existing bridge over a real bounded socket, authenticates retained bytes and reconciles once', async () => {
  const f = fixture(), socket = join(roots[0]!, 'owner.sock');
  const server = createServer({ allowHalfOpen: true }, peer => {
    const chunks: Buffer[] = []; let size = 0;
    peer.setTimeout(2000, () => peer.destroy()); peer.on('error', () => peer.destroy());
    peer.on('data', bytes => { size += bytes.length; if (size > 16384) peer.destroy(); else chunks.push(bytes); });
    peer.on('end', async () => {
      try { peer.end(JSON.stringify(await f.receiver.request(JSON.parse(Buffer.concat(chunks).toString('utf8'))))); }
      catch { peer.destroy(); }
    });
  });
  server.listen(socket); await once(server, 'listening');
  try {
    const broker = { install() {}, verify() {}, start() {}, stop() {}, status: () => ({ state: 'running' }),
      request: (value: unknown) => requestSocket(socket, value) };
    const owners = setupPreparationOwners({ broker, facts: { request() { throw Error('wrong owner'); } } });
    const record = await owners.inspect(checkpoint);
    expect(record).toEqual(f.read());
    expect(await owners.authenticate(record, checkpoint)).toBe(true);
    expect(await owners.reconcile(checkpoint)).toBe('absent');
    expect(await owners.execute(checkpoint)).toBe('executed');
    expect(await owners.execute(checkpoint)).toBe('executed');
    expect(f.count()).toBe(1);
    expect(await owners.reconcile(checkpoint)).toBe('executed');
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

it('authenticates failed evidence without turning it into execution authority', async () => {
  const f = fixture(); f.record.checks[0]!.passed = false; f.save(f.record);
  expect(await f.receiver.request(request('authenticate', checkpoint, f.record))).toBe(true);
  expect(await f.receiver.request(request('execute'))).toMatchObject({ state: 'refused', reason: 'owner-check-failed' });
  const forged = structuredClone(f.record); forged.checks[0]!.passed = true;
  expect(await f.receiver.request(request('authenticate', checkpoint, forged))).toBe(false);
  f.record.checks[0]!.observed = false; f.save(f.record);
  expect(await f.receiver.request(request('authenticate', checkpoint, f.record))).toBe(true);
  expect(await f.receiver.request(request('execute'))).toMatchObject({ state: 'refused' });
  expect(f.count()).toBe(0);
});

it('rejects altered bindings, receipt substitutions, missing checks, changed frontier and corrupt storage', async () => {
  const f = fixture();
  for (const field of ['installation', 'session', 'subject', 'authority', 'operation', 'schema', 'frontier'] as const) {
    const changed = structuredClone(f.record); changed.checkpoint[field] = 'changed';
    expect(await f.receiver.request(request('authenticate', checkpoint, changed))).toBe(false);
  }
  for (const change of [(r: RecordShape) => r.checks.pop(), (r: RecordShape) => { r.checks[0]!.receipt = 'r99'; },
    (r: RecordShape) => { r.checks[0]!.owner = 'one-two'; }]) {
    const changed = structuredClone(f.record); change(changed);
    expect(await f.receiver.request(request('authenticate', checkpoint, changed))).toBe(false);
  }
  const old = f.read(); f.record.checkpoint.frontier = 'frontier:2'; f.save(f.record);
  expect(await f.receiver.request(request('authenticate', checkpoint, old))).toBe(false);
  const saved = JSON.parse(readFileSync(f.path, 'utf8')); saved.bytes += ' ';
  writeFileSync(f.path, JSON.stringify(saved));
  expect(await f.receiver.request(request('authenticate', checkpoint, f.record))).toBe(false);
  expect(await f.receiver.request(request('inspect'))).toMatchObject({ state: 'refused', reason: 'owner-unavailable' });
});

it('keeps custody and append receivers separate and refuses caller authority or paths', async () => {
  const f = fixture();
  for (const value of [null, [], 'execute', {}, { ...request('execute'), path: '/outside' },
    { ...request('execute'), uid: 0 }, { ...request('execute'), accepted: true },
    request('export-key'), request('execute', { ...checkpoint, step: 'append' }),
    request('execute', { ...checkpoint, phase: 'post' }), request('reconcile', { ...checkpoint, phase: 'post' }),
    request('inspect', { ...checkpoint, subject: 'invalid' }),
    request('inspect', { ...checkpoint, operation: 'x'.repeat(161) }),
    request('inspect', { ...checkpoint, frontier: 'caller' } as Checkpoint),
    request('inspect', { ...checkpoint, step: 'toString' }),
    request('inspect', checkpoint, f.record)])
    expect(await f.receiver.request(value)).toMatchObject({ state: 'refused', reason: 'request-shape' });
  expect(await f.receiver.request({ payload: 'x'.repeat(16384) })).toMatchObject({ state: 'refused', reason: 'request-bound' });
  const cp = { ...checkpoint, step: 'append' }, facts = fixture(cp);
  expect(await facts.receiver.request(request('inspect', cp))).toEqual(facts.record);
  expect(await facts.receiver.request(request('execute', cp))).toBe('executed');
  expect(await facts.receiver.request(request('inspect'))).toMatchObject({ state: 'refused' });
  expect(f.count()).toBe(0);
});

it('does not repeat an uncertain effect, and passes the observed frontier to atomic owner enforcement', async () => {
  const f = fixture(); f.state('uncertain');
  expect(await f.receiver.request(request('execute'))).toBe('uncertain');
  expect(await f.receiver.request(request('reconcile'))).toBe('uncertain');
  expect(f.count()).toBe(0);
  f.state('absent'); f.frontier('frontier:2');
  expect(await f.receiver.request(request('execute'))).toBe('uncertain');
  expect(f.count()).toBe(0);
  const implementation = { ...f.implementation, async execute() { return 'executed'; } };
  const receiver = setupOwnerReceiver({ owner: 'custodian', implementation });
  expect(await receiver.request(request('execute'))).toBe('uncertain'); // no durable completion
});

it('detaches input before awaiting and refuses concurrent work without a request queue', async () => {
  const f = fixture(); let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const implementation = { ...f.implementation, async read() { await wait; return f.read(); } };
  const receiver = setupOwnerReceiver({ owner: 'custodian', implementation });
  const mutable = request('inspect', { ...checkpoint });
  const pending = receiver.request(mutable); mutable.checkpoint.installation = 'attacker';
  expect(await receiver.request(request('execute'))).toMatchObject({ state: 'refused', reason: 'owner-busy' });
  release(); expect(await pending).toEqual(f.record);
  expect(await receiver.request(request('inspect'))).toEqual(f.record);
  expect(f.count()).toBe(0);
});

it('admits post-check reads for each owner step but never uses a post record for execution', async () => {
  for (const step of Object.keys(CHECKS)) {
    const cp = { ...checkpoint, step, phase: 'post' }, f = fixture(cp);
    f.record.checks = CHECKS[step].map((name: string, index: number) =>
      ({ name, owner: step === 'append' ? 'one-two' : 'custodian', observed: true, passed: true, receipt: `r${index + 1}` }));
    f.save(f.record);
    expect(await f.receiver.request(request('inspect', cp))).toEqual(f.record);
    expect(await f.receiver.request(request('authenticate', cp, f.record))).toBe(true);
    expect(await f.receiver.request(request('execute', cp))).toMatchObject({ state: 'refused' });
  }
});

it('refuses missing owner implementations and never exposes internal error text', async () => {
  for (const owner of ['custodian', 'one-two', 'caller'])
    expect(() => setupOwnerReceiver({ owner, implementation: {} })).toThrow('installed owner');
  const implementation = { async read() { throw Error('PRIVATE_DIAGNOSTIC'); }, async reconcile() { return 'absent'; },
    async execute() { throw Error('PRIVATE_DIAGNOSTIC'); } };
  const receiver = setupOwnerReceiver({ owner: 'custodian', implementation });
  expect(JSON.stringify(await receiver.request(request('inspect')))).not.toContain('PRIVATE_DIAGNOSTIC');
  expect(await receiver.request(request('execute'))).toBe('uncertain');
});

it('refuses real recorded model and empty reply shapes as owner evidence', async () => {
  const f = fixture();
  const corpus = JSON.parse(readFileSync('tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', 'utf8'));
  for (const row of corpus.otherShapes) {
    let record: unknown = row.raw;
    try { record = JSON.parse(row.raw); } catch { /* Empty and non-JSON replies stay raw. */ }
    expect(await f.receiver.request(request('authenticate', checkpoint, record))).toBe(false);
  }
  expect(f.count()).toBe(0);
});
