import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createFactStore } from '../../src/facts/index.js';
import {
  createTelegramReplyOperationAdapter, installTelegramReplyOperation,
} from '../../src/conversation/index.js';
import { createEffectDoorway, createEffectSpine } from '../../src/effects/index.js';
import { createTransportAuthority, createTransportSpine } from '../../src/transport/index.js';
// @ts-expect-error Reference fsync host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference fsync capture host is JavaScript, outside pure core compilation.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';
// @ts-expect-error Reference replica host is JavaScript, outside pure core compilation.
import { createEffectReplicaStorage } from '../../scripts/effect-replica-storage.mjs';
import { privateKey } from '../facts/fixtures.js';
import { value } from '../intake/fixtures.js';
import { telegramPreparedOutbound } from './round5-fixture.js';

const [directory, phase, mode] = process.argv.slice(2);
if (!directory || !phase || !mode) throw new Error('directory, phase and mode are required');
mkdirSync(directory, { recursive: true });
const durable = (file: string, data: unknown) => {
  const fd = openSync(file, 'w');
  writeFileSync(fd, JSON.stringify(data));
  fsyncSync(fd);
  closeSync(fd);
};
const cut = (boundary: string) => {
  if (mode === 'write' && phase === boundary) {
    durable(join(directory, 'cut.json'), { phase, boundary, pid: process.pid });
    process.kill(process.pid, 'SIGKILL');
  }
};
const fixture = telegramPreparedOutbound();
const meta = join(directory, 'meta.json');
const callsFile = join(directory, 'calls.json');
const recordSend = () => {
  const calls = existsSync(callsFile) ? JSON.parse(readFileSync(callsFile, 'utf8')) as object[] : [];
  calls.push({ pid: process.pid, mode });
  durable(callsFile, calls);
};

if (mode === 'write') {
  durable(meta, { sourceDirectory: fixture.effects.directory, request: fixture.request, fence: fixture.effects.fence });
  cut('prepared');
  const transport = { ...fixture.effects.transport,
    claim(...args: Parameters<typeof fixture.effects.transport.claim>) {
      const claimed = fixture.effects.transport.claim(...args);
      cut('claimed');
      return claimed;
    },
    consume(...args: Parameters<typeof fixture.effects.transport.consume>) {
      const consumed = fixture.effects.transport.consume(...args);
      cut('consumed');
      return consumed;
    },
  };
  const spine = { ...fixture.effects.spine,
    append(...args: Parameters<typeof fixture.effects.spine.append>) {
      const appended = fixture.effects.spine.append(...args);
      const record = args[0];
      if (record.type === 'OperationObservation' && record.stage === 'executor-accepted') cut('acceptance');
      if (record.type === 'OperationObservation' && record.stage === 'response') cut('response');
      return appended;
    },
  };
  const durability = { ...fixture.effects.composition.durability,
    ensure(facts: Parameters<typeof fixture.effects.composition.durability.ensure>[0]) {
      const ensured = fixture.effects.composition.durability.ensure(facts);
      if (facts.some(row => row.kind === 'effect-OperationObservation'
        && (row.body as { record: { stage?: string } }).record.stage === 'executor-accepted')) cut('acceptance-durable');
      else if (facts.some(row => row.kind === 'transport-AdmissionReservation'
        && (row.body as { record: { state?: string } }).record.state === 'dispatch-claimed')) cut('claim-durable');
      return ensured;
    },
  };
  const adapter = { ...fixture.adapter,
    invoke(input: Parameters<typeof fixture.adapter.invoke>[0]) {
      cut('before-provider');
      const invoked = fixture.adapter.invoke(input);
      if (fixture.telegram.calls.send.length) recordSend();
      cut('after-provider');
      return invoked;
    },
  };
  const doorway = createEffectDoorway({ ...fixture.effects.composition, transport, spine, durability,
    adapter, assessment: null });
  durable(join(directory, 'uncut-result.json'), doorway.dispatch(fixture.request, fixture.effects.fence));
  throw new Error('requested cut was not reached');
}

const saved = JSON.parse(readFileSync(meta, 'utf8')) as {
  sourceDirectory: string;
  request: typeof fixture.request;
  fence: typeof fixture.effects.fence;
};
const root = saved.sourceDirectory;
const result = <T>(run: () => T) => fixture.telegram.intake.f.success(run());
const custody = createEffectFileCaptures([join(root, 'origin-captures'), join(root, 'peer-captures')], result);
const host = { ...fixture.effects.host, capture: custody.capture };
const context = { ...fixture.effects.ctx, get captures() { return custody.captures; } };
const peer = createFactStore(context, createTransportFileStorage(join(root, 'peer'), result));
const replicas = createEffectReplicaStorage(join(root, 'origin'), { id: 'fixture-peer-directory', store: peer }, result);
const store = createFactStore(context, replicas.storage);
const spine = createEffectSpine(host, { context, privateKey }, store);
const transportHost = {
  domain: 'conversation:1',
  machine: host.machine,
  incarnation: host.incarnation,
  authorityIncarnation: 'authority:1',
  principal: host.principal,
  scope: host.scope,
  maxLeaseTerm: 1000,
  budget: 100,
  monotonic: () => 100,
  current: () => ({
    decode: host.current().decode,
    clock: host.current().clock,
    generation: host.current().decode.register.generation,
    stopped: false,
  }),
};
const transport = createTransportAuthority(transportHost,
  createTransportSpine(transportHost, { context, privateKey }, store), host.boundary);
const before = value(store.read());
const definition = (before.find(row => row.kind === 'effect-OperationDefinition'
  && (row.body as { record: { id?: string } }).record.id === saved.request.definition)!.body as unknown as {
    record: Parameters<typeof installTelegramReplyOperation>[0] & { speaker: string; scopeDigest: string };
  }).record;
const readmitted = value(fixture.telegram.admit());
value(installTelegramReplyOperation({
  id: definition.id,
  generation: definition.generation,
  admitted: readmitted,
  target: fixture.target,
  speaker: definition.speaker,
  scopeDigest: definition.scopeDigest,
  durability: definition.durability,
  replicas: definition.replicas,
  lossModel: definition.lossModel,
  verificationBar: definition.verificationBar,
}, host, spine));
const concrete = createTelegramReplyOperationAdapter(readmitted, fixture.telegram.api, fixture.target, host.boundary);
const adapter = { ...concrete,
  invoke(input: Parameters<typeof concrete.invoke>[0]) {
    const invoked = concrete.invoke(input);
    if (fixture.telegram.calls.send.length) recordSend();
    return invoked;
  },
};
const doorway = createEffectDoorway({ host, spine, transport, durability: replicas.durability,
  custody: custody.custody, adapter, assessment: null });
const dispatch = doorway.dispatch(saved.request, saved.fence);
const facts = value(store.read());
const records = facts.map(row => (row.body as { record?: Record<string, unknown> }).record).filter(Boolean) as Record<string, unknown>[];
const report = {
  phase,
  pid: process.pid,
  result: dispatch,
  calls: existsSync(callsFile) ? (JSON.parse(readFileSync(callsFile, 'utf8')) as object[]).length : 0,
  reservations: records.filter(row => row.type === 'AdmissionReservation')
    .map(row => ({ operation: row.operation, state: row.state, digest: row.digest })),
  observations: records.filter(row => row.type === 'OperationObservation')
    .map(row => ({ operation: row.operation, stage: row.stage, digest: row.digest })),
  settlements: records.filter(row => row.type === 'EffectSettlement').length,
};
durable(join(directory, 'recovered.json'), report);
console.log(JSON.stringify(report));
