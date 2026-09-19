// @ts-nocheck -- child-process host for exact production admission durability cuts.
import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { decode } from '../../src/index.js';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { installedFixtureHost } from './production-boot-installed-fixture.js';
import { recordedCheckpoint } from './production-boot-checkpoint.js';
import { json, value } from '../facts/fixtures.js';

const reference = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
const durableJSON = (path, data) => {
  writeFileSync(path, JSON.stringify(data));
  const file = openSync(path, 'r');
  try { fsyncSync(file); } finally { closeSync(file); }
  const directory = openSync(dirname(path), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
};

function cutStorageIO() {
  let remaining = 0, renamedFactStore = false;
  return { io: { ...productionStorageIO, pid: process.pid,
    renameSync(from, to) {
      productionStorageIO.renameSync(from, to);
      if (remaining > 0 && to.endsWith('/facts.encrypted')) renamedFactStore = true;
    },
    fsyncSync(fd) {
      productionStorageIO.fsyncSync(fd);
      if (!renamedFactStore) return;
      renamedFactStore = false;
      if (--remaining === 0) process.kill(process.pid, 'SIGKILL');
    } },
    arm(factWrites) {
      if (remaining !== 0 || factWrites < 1) throw Error('durability cut already armed');
      remaining = factWrites;
    } };
}

function completedExit(installed, graph, ready) {
  const f = installed.f;
  const check = value(decode('Evidence', f.evidenceInput({ id: 'admission-lifecycle-exit-check',
    claim: { subject: f.run.exitTest.subject,
      predicate: `exit:${f.run.exitTest.check}:${f.run.exitTest.version}`,
      value: f.run.exitTest.acceptance }, freshFor: 1000 }), f.ctx.decode));
  const checkFact = f.append('evidence-record', json({ evidence: check })).fact;
  const result = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success',
    value: 'terminal admission lifecycle artifact', capacity: { kind: 'none' } }, f.ctx.decode));
  const resultFact = f.append('result-record', json({ result })).fact;
  const exit = { type: 'RunExit', schemaVersion: 1, id: 'admission-lifecycle-exit-proposal', run: f.id,
    expected: ready.head, proposer: f.owner, standing: reference(f.opening), frontier: ready.source.foldedThrough,
    at: f.deps.clock(), kind: 'completed', exitTest: f.run.exitTest, check: reference(checkFact),
    evidence: [{ type: 'Evidence', id: check.id, fact: reference(checkFact), field: 'evidence' }],
    result: { type: 'Result', id: 'admission-lifecycle-result', fact: reference(resultFact), field: 'result' },
    settledOperations: [] };
  const proposal = { type: 'RunTransition', schemaVersion: 1, id: 'admission-lifecycle-propose', run: f.id,
    expected: ready.head, trigger: reference(checkFact), kind: 'propose-exit', from: 'ready', to: 'closing',
    responsible: f.owner, standing: reference(f.opening), ownership: f.lease, generation: f.run.generation,
    at: f.deps.clock(), blockedOn: { kind: 'nothing' }, nextWake: f.run.nextWake, exit };
  const closing = value(graph.transition(proposal));
  return { ...proposal, id: 'admission-lifecycle-close', expected: closing.head, kind: 'close',
    from: 'closing', to: 'completed', exit: { ...exit, id: 'admission-lifecycle-exit-terminal', expected: closing.head } };
}

function recoveryProof(installed, stage) {
  const f = installed.f, graph = installed.application.owners.run;
  const facts = value(f.store.read());
  const admissionFacts = facts.filter(row => ['run-opening', 'run-transition', 'session-grounding'].includes(row.kind)
    && row.body.run === f.id);
  const verified = admissionFacts.map(fact => value(installed.fixtureAdmission.verify(reference(fact))).id);
  const accounting = value(f.effects.transport.inspect());
  const reservationRows = accounting.filter(row => row.record.type === 'AdmissionReservation');
  const latestReservations = [...new Map(reservationRows.map(row => [row.record.operation, row.record])).values()];
  const settled = new Set(accounting.filter(row => row.record.type === 'SettlementApplication').map(row => row.record.operation));
  let view, readRefusal;
  try { view = value(graph.read(f.id)); } catch (error) { readRefusal = String(error?.message ?? error); }
  return { stage, runCount: new Set(admissionFacts.filter(row => row.kind === 'run-opening').map(row => row.body.run)).size,
    openingFacts: admissionFacts.filter(row => row.kind === 'run-opening').length,
    admissionFacts: admissionFacts.length, verified, state: view?.state, readRefusal,
    reservationCount: latestReservations.length,
    reservationStates: latestReservations.map(row => row.state),
    uncertainReleased: latestReservations.some(row => row.state === 'closed' || settled.has(row.operation)),
    admissionWrites: accounting.filter(row => row.record.type === 'Lease' && row.record.operation === 'write'
      && row.record.command.startsWith('run-admission:')).length };
}

export async function createProductionHost() {
  const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const action = process.env.INSTAR_U5_ADMISSION_ACTION;
  const recovery = action === 'inspect'
    ? JSON.parse(readFileSync(join(input.storageRoot, 'admission-checkpoint.json'), 'utf8')) : undefined;
  const cut = cutStorageIO();
  const route = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
    automaticRetries: 0, environment: 'local-test', invoke: () => { throw Error('provider must not execute'); } };
  const fixture = installedFixtureHost(input.storageRoot, route, { recovery, storageIO: cut.io });
  return { ...fixture.host, async run(application) {
    const installed = fixture.state();
    installed.application = application;
    if (action === 'inspect') {
      durableJSON(join(input.storageRoot, 'admission-recovery-proof.json'), recoveryProof({ ...installed,
        fixtureAdmission: fixture.host.runAdmission }, recovery.stage));
      return;
    }
    installed.receive(application);
    const graph = application.owners.run;
    if (action === 'write-cut') {
      durableJSON(join(input.storageRoot, 'admission-checkpoint.json'), recordedCheckpoint(installed,
        'six-write-before-run-append-callback'));
      cut.arm(1);
      value(graph.open(installed.f.run));
    } else if (action === 'terminal-cut') {
      const ready = value(graph.open(installed.f.run));
      const close = completedExit(installed, graph, ready);
      durableJSON(join(input.storageRoot, 'admission-checkpoint.json'), recordedCheckpoint(installed,
        'terminal-run-closure-durable-append'));
      cut.arm(2);
      value(graph.transition(close));
    } else throw Error(`unknown admission lifecycle action: ${action}`);
    throw Error('SIGKILL durability cut was not reached');
  } };
}
