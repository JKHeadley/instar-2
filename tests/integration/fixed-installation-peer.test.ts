/** Same-machine process/transport evidence only. It cannot close replication-peer. */
import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFixedPeerReplication } from '../../src/assembly/production-replication.js';
import { canonical } from '../../src/index.js';
import type { PeerDescriptor, PeerRequest } from '../../src/assembly/production-replication.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { hashBytes } from '../../src/facts/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
// @ts-expect-error fixed physical host is JavaScript outside the pure core.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const root = () => { const p = realpathSync(mkdtempSync(join(tmpdir(), 'instar-peer-local-'))); roots.push(p); return p; };
function setup(maxDiskBytes = 100000, capturePrefixes: readonly string[] = [], hashIntent = false) {
  const base = root(), f = factsFixture(), intent = hashIntent ? f.intentInput() : null;
  const baseContext = hashIntent ? { ...f.ctx, schemas: [{ ...f.schema, optional: ['intent'], fields: { ...f.schema.fields,
    intent: { kind: 'constitutional' as const, type: 'Intent' as const } } }] } : f.ctx;
  const first = hashIntent ? f.fact({ body: { identity: 'one', amount: '10', intent } }, baseContext) : f.fact();
  const second = f.next(first, {}, baseContext);
  const captures = Object.fromEntries(Object.entries(f.captures).map(([reference, bytes]) =>
    [reference, { hash: hashBytes(bytes), bytes, byteLength: Buffer.byteLength(bytes), status: 'available' as const }]));
  const context = { ...baseContext, captures };
  const descriptor: PeerDescriptor = { installation: 'install:local-test', studio: 'machine-a', laptop: 'm_cc2ec651a91f',
    store: 'facts:local-test', epoch: 0, trust: 'ssh:local-process-test', custody: 'policy:local-test',
    captureReferences: Object.keys(f.captures), capturePrefixes, limits: { maxRequestBytes: 100000, maxResponseBytes: 10000,
      maxFacts: 8, maxCaptures: Object.keys(f.captures).length + 1, maxCaptureBytes: 10000,
      maxDiskBytes, maxQueue: 1, timeoutMs: 3000, maxAttempts: 1 } };
  const config = join(base, 'installed-peer-config.mjs'), storeRoot = join(base, 'encrypted');
  const authInfo = join(base, 'ssh-user-auth'), clientPublicKey = 'ssh-ed25519 VEVTVEtFWQ==';
  writeFileSync(authInfo, `publickey ${clientPublicKey}\n`, { mode: 0o600 });
  const fixtureURL = pathToFileURL(join(process.cwd(), 'tests/facts/fixtures.ts')).href;
  const source = `import { factsFixture } from ${JSON.stringify(fixtureURL)};\n`
    + `import { decodeMeasurement, consumeResult } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'dist/index.js')).href)};\n`
    + `import { hashBytes } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'dist/facts/index.js')).href)};\n`
    + `export function openFixedPeerConfiguration() { const f = factsFixture(); ${hashIntent ? 'f.intentInput();' : ''}\n`
    + `const schemas = ${hashIntent ? "[{ ...f.schema, optional: ['intent'], fields: { ...f.schema.fields, intent: { kind: 'constitutional', type: 'Intent' } } }]" : 'f.ctx.schemas'};\n`
    + `const captures = Object.fromEntries(Object.entries(f.captures).map(([reference, bytes]) => [reference, { hash: hashBytes(bytes), bytes, byteLength: Buffer.byteLength(bytes), status: 'available' }]));\n`
    + `const receiverCaptures = ${hashIntent ? "Object.fromEntries(Object.entries(captures).map(([reference, capture]) => [reference, { ...capture, bytes: null, status: 'missing' }]))" : 'captures'};\n`
    + `return { descriptor: ${JSON.stringify(descriptor)}, machine: 'm_cc2ec651a91f', store: ${JSON.stringify(descriptor.store)}, policy: ${JSON.stringify(descriptor.custody)},\n`
    + `authenticatedStudio: 'machine-a', clientPublicKey: ${JSON.stringify(clientPublicKey)}, testProofMode: true, testFaultCut: null, root: ${JSON.stringify(storeRoot)}, key: new Uint8Array(32).fill(17), context: { ...f.ctx, schemas, captures: receiverCaptures, genesis: { ...f.ctx.genesis, clock: consumeResult(decodeMeasurement('clock', f.clockRaw(), f.ctx.decode), { Success: v => v, Refused: r => { throw Error(r.detail); } }) } }, boundary: f.c }; }\n`;
  writeFileSync(config, source, { mode: 0o600 });
  let pin = `sha256:${createHash('sha256').update(source).digest('hex')}`;
  const setCut = (cut: null | 'before-fsync' | 'after-fsync' | 'before-response' | 'after-response') => {
    const changed = source.replace('testFaultCut: null', `testFaultCut: ${JSON.stringify(cut)}`);
    writeFileSync(config, changed, { mode: 0o600 });
    pin = `sha256:${createHash('sha256').update(changed).digest('hex')}`;
  };
  const call = (request: PeerRequest, options: { timeout?: number; dropResponse?: boolean } = {}) => {
    const child = spawnSync(process.execPath, ['--loader', join(process.cwd(), 'scripts/slice-ts-loader.mjs'),
      join(process.cwd(), 'scripts/fixed-installation-peer.mjs')], { input: JSON.stringify(request),
      encoding: 'utf8', timeout: options.timeout ?? 3000, maxBuffer: 10000,
      env: { PATH: '/usr/bin:/bin', INSTAR_FIXED_PEER_CONFIG: config, INSTAR_FIXED_PEER_CONFIG_DIGEST: pin,
        SSH_USER_AUTH: authInfo, SSH_ORIGINAL_COMMAND: 'instar-fixed-peer-v1', INSTAR_FIXED_PEER_TEST_PROOF: '1' } });
    if (child.status !== 0) throw Error(`peer process refused ${child.status}`);
    if (options.dropResponse) throw Error('acknowledgment lost after peer fsync');
    return JSON.parse(child.stdout);
  };
  const local = { owner: 'part-ten' as const, read: () => [first, second],
    append: () => f.success({ kind: 'local-durable' as const }) };
  const make = (opts: { dropResponse?: boolean; descriptor?: PeerDescriptor;
    facts?: readonly (typeof first)[]; transformRequest?: (request: PeerRequest) => PeerRequest } = {}) => value(createFixedPeerReplication({
    descriptor: opts.descriptor ?? descriptor, local: opts.facts ? { ...local, read: () => opts.facts! } : local,
    context, captures: () => captures, boundary: f.c,
    transport: { owner: 'part-ten', exchange: request => ({ peer: descriptor.laptop, trust: descriptor.trust,
      response: call(opts.transformRequest?.(request) ?? request,
        opts.dropResponse === undefined ? {} : { dropResponse: opts.dropResponse }) }) } }));
  const disk = () => value(openProductionStorage({ root: storeRoot, machine: descriptor.laptop,
    key: new Uint8Array(32).fill(17), policy: descriptor.custody, store: descriptor.store,
    context: f.c, io: productionStorageIO }));
  return { f, first, second, descriptor, config, authInfo, storeRoot, context, captures, call, make, disk, setCut };
}
it('R3 local-process encrypted Laptop stand-in retains full prefix and captures across receiver restart', () => {
  const h = setup(), a = h.make();
  expect(value(a.durability.ensure([h.first, h.second]))).toHaveLength(2);
  const encrypted = readFileSync(join(h.storeRoot, 'facts.encrypted'), 'utf8');
  expect(encrypted).not.toContain(h.first.contentHash);
  const first = h.disk();
  expect(first.segment.read()).toHaveLength(2);
  let preserved = 0;
  for (const [reference, bytes] of Object.entries(h.f.captures)) {
    if (first.captures.read(reference) !== null) { preserved++; expect(first.captures.read(reference)).toBe(bytes); }
  }
  expect(preserved).toBeGreaterThan(0);
  first.close();
  expect(value(a.verify())).toHaveLength(2);
  const restarted = h.disk(); expect(restarted.segment.read()).toHaveLength(2); restarted.close();
});
it('R3 hash-addressed Intent.raw reaches encrypted cold receiver and survives process restart', () => {
  const h = setup(200000, [], true), rawHash = (h.first.body as { intent: { raw: string } }).intent.raw;
  expect(h.captures[rawHash]?.bytes).toBe(h.f.captures[rawHash]);
  expect(value(h.make().durability.ensure([h.first, h.second]))).toHaveLength(2);
  const reopened = h.disk();
  expect(reopened.captures.read(rawHash)).toBe(h.f.captures[rawHash]);
  expect(reopened.segment.read()).toHaveLength(2);
  reopened.close();
  expect(value(h.make().verify())).toHaveLength(2);
});
it('R3 local-process lost acknowledgment reconciles same bytes without duplicate history', () => {
  const h = setup();
  refused(h.make({ dropResponse: true }).durability.ensure([h.first, h.second]), 'acknowledgment lost');
  const before = h.disk(); expect(before.segment.read()).toHaveLength(2); before.close();
  expect(value(h.make().verify())).toHaveLength(2);
  const after = h.disk(); expect(after.segment.read()).toHaveLength(2); after.close();
});
it('R3 local-process store lock, disk reservation and corrupt config fail closed', () => {
  const h = setup(), held = h.disk();
  refused(h.make().durability.ensure([h.first, h.second]), 'peer process refused'); held.close();
  const exhausted = setup(Number.MAX_SAFE_INTEGER);
  refused(exhausted.make().durability.ensure([exhausted.first, exhausted.second]), 'peer process refused');
  writeFileSync(h.config, 'corrupt');
  refused(h.make().durability.ensure([h.first, h.second]), 'peer process refused');
});
it('R3 local-process wrong authenticated principal is denied before storage', () => {
  const h = setup(); writeFileSync(h.authInfo, 'publickey ssh-ed25519 T1RIRVJLRVk=\n');
  refused(h.make().durability.ensure([h.first, h.second]), 'peer process refused');
  expect(() => readFileSync(join(h.storeRoot, 'facts.encrypted'))).toThrow();
});
it.each(['before-fsync', 'after-fsync', 'before-response', 'after-response'] as const)(
  'R3 local-process crash %s reconciles only the same immutable prefix', cut => {
    const h = setup(); h.setCut(cut);
    refused(h.make().durability.ensure([h.first, h.second]), 'peer process refused');
    h.setCut(null);
    const reopened = h.disk();
    expect(reopened.segment.read().length).toBe(cut === 'before-fsync' ? 0 : cut === 'after-fsync' ? 1 : 2);
    reopened.close();
    expect(value(h.make().durability.ensure([h.first, h.second]))).toHaveLength(2);
    const restored = h.disk(); expect(restored.segment.read()).toHaveLength(2); restored.close();
  });
it('R3 local-process immutable identity collision and corrupt capture/frame never acknowledge', () => {
  const h = setup(); value(h.make().durability.ensure([h.first, h.second]));
  const changed = h.f.fact({ body: { identity: 'one', amount: '20' } });
  refused(h.make({ facts: [changed, h.f.next(changed)] }).durability.ensure([changed, h.f.next(changed)]),
    'peer process refused');
  refused(h.make({ transformRequest: request => ({ ...request,
    captures: request.captures.map((c, i) => i === 0 ? { ...c, bytes: 'corrupt' } : c) }) })
    .durability.ensure([h.first, h.second]), 'peer process refused');
  refused(h.make({ transformRequest: request => ({ ...request, prefixDigest: 'sha256:' + '0'.repeat(64) }) })
    .durability.ensure([h.first, h.second]), 'peer process refused');
  refused(h.make({ transformRequest: request => ({ ...request, root: '/tmp/unapproved' }) })
    .durability.ensure([h.first, h.second]), 'peer process refused');
  const retained = h.disk(); expect(retained.segment.read()).toHaveLength(2); retained.close();
});
it('R3 repeated invalid envelopes retain the admitted prefix without orphan captures across restarts', () => {
  const h = setup(100000, ['orphan:']);
  value(h.make().durability.ensure([h.first, h.second]));
  const third = h.f.next(h.second), orphanBytes = 'x'.repeat(9000);
  for (let i = 0; i < 12; i++) {
    const bad = h.make({ facts: [h.first, h.second, third], transformRequest: request => {
      const facts = [...request.facts]; facts[2] = { ...facts[2]!, signature: '0'.repeat(128) };
      const prefixDigest = hashBytes(value(canonical(facts.map(f => ({ id: f.id, hash: f.contentHash,
        bytes: value(canonical(f)).bytes })))).bytes);
      return { ...request, facts, prefixDigest, captures: [...request.captures,
        { reference: `orphan:${i}`, hash: hashBytes(orphanBytes), bytes: orphanBytes }] };
    } });
    refused(bad.durability.ensure([h.first, h.second, third]), 'peer process refused');
  }
  const reopened = h.disk();
  expect(reopened.segment.read()).toHaveLength(2);
  for (let i = 0; i < 12; i++) expect(reopened.captures.read(`orphan:${i}`)).toBeNull();
  reopened.close();
  expect(value(h.make().verify())).toHaveLength(2);
  const retainedArtifact = join(h.storeRoot, '.pending-retained-failed-write');
  writeFileSync(retainedArtifact, 'z'.repeat(90000));
  refused(h.make().verify(), 'peer process refused');
  rmSync(retainedArtifact);
  expect(value(h.make().verify())).toHaveLength(2);
});
