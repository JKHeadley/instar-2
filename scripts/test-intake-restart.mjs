// Isolated contract harness, not a shipped transport or the part-ten production assembly.
// All credentials are deterministic test identities supplied by the test through stdin.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync, writeSync } from 'node:fs';
import { sign } from 'node:crypto';
import { join } from 'node:path';
import { consumeResult, decode, decodeMeasurement, defineDecoder } from '@instar/constitutional-types';
import { createFactStore, hashBytes, prepareSnapshot } from '@instar/constitutional-types/facts';
import { generateRegister, decodeShape } from '@instar/constitutional-types/register';
import { createIntakePort, intakeDedupDefinition, intakeWorkRegistration, intakeStopRegistration } from '@instar/constitutional-types/intake';
import { checkpoint, foldProjection } from '@instar/constitutional-types/projections';

const seed = JSON.parse(readFileSync(0, 'utf8'));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(`${r.reason}: ${r.detail}`); } });
const dir = seed.directory, segmentPath = join(dir, 'segment.jsonl'), capturesDir = join(dir, 'captures');
mkdirSync(capturesDir, { recursive: true });
function durableFile(path, data) {
  const fd = openSync(path, 'w', 0o600);
  try { writeFileSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
  const directory = openSync(path === segmentPath ? dir : capturesDir, 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}
if (!existsSync(segmentPath)) durableFile(segmentPath, seed.frames.map(f => JSON.stringify(f)).join('\n') + '\n');
const context = seed.context;
context.decode = { ...context.decode, principals: [], grants: [], revocations: [], directives: [], authorizations: [] };
context.grants = []; context.revocations = [];
for (const name of readdirSync(capturesDir)) {
  const bytes = readFileSync(join(capturesDir, name), 'utf8'), hash = hashBytes(bytes);
  context.captures[hash] = { hash, bytes, status: 'available', byteLength: Buffer.byteLength(bytes) };
  context.decode.captures[hash] = bytes;
}
function restoreProvenance(p, c) {
  return take(decode('Provenance', { type: 'Provenance', schemaVersion: 1, adapter: p.adapter, method: p.method,
    record: p.record, verifiedAt: p.verifiedAt, machine: p.machine,
    evidence: { kind: 'signature', keyId: 'host', signature: sign(null, Buffer.from(c.captures[p.record.reference]), seed.privateKey).toString('hex') } }, c));
}
const observerProvenance = restoreProvenance(seed.observer.provenance, context.decode);
const observer = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id: seed.observer.id, kind: 'system' }, { ...context.decode, provenance: observerProvenance }));
context.decode.principals.push(observer);
context.genesis.clock = take(decodeMeasurement('clock', context.genesis.clock, context.decode));
context.schemas = context.schemas.map(s => ({ ...s, scope: take(decode('Scope', s.scope, context.decode)) }));
const regContext = seed.registerContext;
regContext.provenance = restoreProvenance(regContext.provenance, regContext.types);
regContext.shape = take(decodeShape(regContext.shape, regContext));
const register = take(generateRegister(seed.registerInput, regContext));
const b = { site: 'intake.admit', preserved: 'isolated:intake', register: context.decode.register };
context.ownedBodies = [take(intakeWorkRegistration(b, observer.id)), take(intakeStopRegistration(b, observer.id))];
function success(value) {
  const decoder = take(defineDecoder({ name: 'IsolatedDurabilityReceipt', owner: 'part-ten-test-provider', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {}, decodeCurrent: () => ({ ok: true, value }) }, b.preserved));
  return decoder.decode({ type: decoder.name, schemaVersion: 1 }, b);
}
const storage = { owner: 'part-ten', read: () => readFileSync(segmentPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)),
  append(bytes, expected) {
    const head = storage.read().at(-1)?.contentHash ?? null;
    if (head !== expected) throw new Error('compare-head mismatch');
    const fd = openSync(segmentPath, 'a', 0o600);
    try { writeSync(fd, bytes + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
    if (seed.cut === JSON.parse(bytes).kind) process.exit(86);
    return success({ kind: 'local-durable' });
  } };
const now = take(decodeMeasurement('clock', { ...context.genesis.clock, value: seed.at, at: seed.at }, context.decode));
const generation = () => ({ reference: context.decode.register.generation, kinds: [...new Set(context.schemas.map(s => s.kind))],
  lineages: Object.fromEntries([...new Set(['machine-a', ...storage.read().map(f => f.machine)])].map(machine =>
    [machine, { head: storage.read().filter(f => f.machine === machine).at(-1)?.segment ?? null, observedAt: seed.at, closed: false }])) });
const port = take(createIntakePort({
  adapter: { id: 'host', authenticate: (_raw, route) => success({ ...seed.evidence, channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch }), parse: raw => JSON.parse(raw) },
  capture: { owner: 'part-ten', preserve(raw) {
    const hash = hashBytes(raw); durableFile(join(capturesDir, hash.slice(7)), raw);
    if (seed.cut === 'capture') process.exit(86);
    context.captures[hash] = { hash, bytes: raw, status: 'available', byteLength: Buffer.byteLength(raw) };
    context.decode.captures[hash] = raw; return success({ reference: hash, hash });
  } }, storage, context: () => context,
  author: { machine: 'machine-a', principal: observer, provenance: observerProvenance, privateKey: seed.privateKey },
  clock: () => now, governance: { register, context: regContext }, scope: context.schemas.find(s => s.kind === 'intake-admitted').scope,
  workOwner: 'slice-run-owner', holdMaxAge: 1000, holdMaxActive: 2, dedupGeneration: generation, dedupStalenessBound: 1000,
}));
// Recovery receives neither lost caller bytes nor route; only the durable spine.
const result = seed.recover ? port.recover(storage.read().find(f => f.kind === 'intake-receipt').id) : port.receive(seed.raw, seed.route);
const outcome = consumeResult(result, { Success: v => v.kind, Refused: r => `Refused:${r.detail}` });
const facts = take(createFactStore(context, storage).read());
const snapshot = take(prepareSnapshot(facts, { ...context, facts }));
const definition = intakeDedupDefinition(generation().kinds, 1000);
const first = checkpoint(take(foldProjection(definition, snapshot, generation(), b)));
const rebuilt = checkpoint(take(foldProjection(definition, snapshot, generation(), b)));
console.log(JSON.stringify({ outcome, kinds: facts.map(f => f.kind), admitted: facts.filter(f => f.kind === 'intake-admitted').map(f => f.body.logicalId),
  arrivals: facts.filter(f => f.kind === 'intake-admitted').map(f => ({ at: f.body.intent.receivedAt.value, channel: f.body.channel, sender: f.body.sender, eventId: f.body.eventId })),
  stops: facts.filter(f => f.kind === 'intake-stop').map(f => f.id), hash: first.hash, rebuilt: first.hash === rebuilt.hash,
  taint: first.view.taint, contextLivePrincipals: context.decode.principals.map(p => p.id) }));
