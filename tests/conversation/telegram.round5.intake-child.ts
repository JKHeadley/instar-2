import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import {
  createTelegramIngress, createTelegramIntakeAdapter, extractTelegramUpdate,
} from '../../src/conversation/index.js';
// @ts-expect-error Reference fsync host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference fsync capture host is JavaScript, outside pure core compilation.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';

const [directory, phase, mode] = process.argv.slice(2);
if (!directory || !phase || !mode) throw new Error('directory, phase and mode are required');
mkdirSync(directory, { recursive: true });
const fixture = conversationFixture({ initialOffset: 100 });
const raw = telegramUpdate(100);
fixture.bind(extractTelegramUpdate(raw, fixture.declaration).route);
const result = <T>(run: () => T) => fixture.intake.f.success(run());
const durable = (file: string, data: unknown) => {
  const fd = openSync(file, 'w');
  writeFileSync(fd, JSON.stringify(data));
  fsyncSync(fd);
  closeSync(fd);
};
const storage = createTransportFileStorage(join(directory, 'facts'), result);
if (!storage.read().length) {
  for (const fact of fixture.intake.frames) {
    const prior = storage.read();
    value(storage.append(JSON.stringify(fact), prior.at(-1)?.contentHash ?? null));
  }
}
const evidence = join(directory, 'evidence.json');
if (existsSync(evidence)) Object.assign(fixture.intake.context.captures,
  JSON.parse(readFileSync(evidence, 'utf8')) as object);
const custody = createEffectFileCaptures([join(directory, 'capture-a'), join(directory, 'capture-b')], result);
Object.assign(fixture.intake.context.captures, custody.captures);
for (const capture of Object.values(custody.captures) as { bytes: string | null; hash: string }[]) {
  if (capture.bytes !== null) fixture.intake.f.captures[capture.hash] = capture.bytes;
}
fixture.intake.syncCaptures();
const kill = (boundary: string) => {
  if (mode === 'write' && phase === boundary) {
    durable(evidence, fixture.intake.context.captures);
    durable(join(directory, 'cut.json'), { phase, boundary, pid: process.pid });
    process.kill(process.pid, 'SIGKILL');
  }
};
const wrappedStorage = { ...storage,
  append(bytes: string, expected: string | null) {
    const kind = (JSON.parse(bytes) as { kind: string }).kind;
    const appended = storage.append(bytes, expected);
    if (kind === 'intake-receipt') kill('after-receipt');
    if (kind === 'intake-admitted') kill('after-admit');
    return appended;
  },
};
const adapter = createTelegramIntakeAdapter(fixture.admitted, fixture.api);
Object.assign(fixture.intake.deps, {
  storage: wrappedStorage,
  adapter,
  governance: fixture.governed.governance,
  capture: {
    owner: 'part-ten',
    preserve(bytes: string) {
      kill('before-capture');
      const captured = custody.capture(bytes);
      Object.assign(fixture.intake.context.captures, custody.captures);
      for (const capture of Object.values(custody.captures) as { bytes: string | null; hash: string }[]) {
        if (capture.bytes !== null) fixture.intake.f.captures[capture.hash] = capture.bytes;
      }
      fixture.intake.syncCaptures();
      kill('after-capture');
      return captured;
    },
  },
  dedupGeneration: () => ({
    reference: fixture.intake.context.decode.register.generation,
    kinds: [...new Set(fixture.intake.context.schemas.map(schema => schema.kind))],
    lineages: { 'machine-a': { head: storage.read().at(-1)?.segment ?? null, observedAt: 100, closed: false } },
  }),
});
const intake = value(createIntakePort(fixture.intake.deps));
const facts = createFactStore(fixture.intake.context, wrappedStorage);
const ingress = createTelegramIngress({
  boundary: fixture.admissionDependencies.boundary,
  admitted: fixture.admitted,
  api: fixture.api,
  intake,
  facts,
  observer: fixture.intake.deps.author.principal.id,
});

if (mode === 'write') {
  if (phase.startsWith('mismatch-')) {
    const route = { ...extractTelegramUpdate(raw, fixture.declaration).route };
    const field = phase.slice('mismatch-'.length);
    if (field === 'chat') route.channel = route.channel.replace('-1001', '-9999');
    if (field === 'topic') route.channel = route.channel.replace('topic:42', 'topic:43');
    if (field === 'sender') route.sender = 'telegram:v1:user:999';
    durable(join(directory, 'refusal.json'), intake.receive(raw, route));
    kill(phase);
  }
  fixture.queue(raw);
  durable(join(directory, 'cycle.json'), ingress.pollOnce());
  kill('after-poll-return');
  fixture.queue();
  ingress.pollOnce();
  durable(join(directory, 'poll-calls.json'), fixture.calls.poll);
  kill('after-next-poll');
  throw new Error('requested cut was not reached');
}

const before = value(facts.read());
const offsetBeforeRecovery = value(ingress.currentOffset());
const receipts = before.filter(row => row.kind === 'intake-receipt');
const recovery = receipts.length ? intake.recover(receipts[0]!.id) : null;
if (!receipts.length) {
  fixture.queue(raw);
  value(ingress.pollOnce());
}
const after = value(facts.read());
const report = {
  phase,
  pid: process.pid,
  offsetBeforeRecovery,
  receiptsBefore: receipts.length,
  admissionsBefore: before.filter(row => row.kind === 'intake-admitted').length,
  recovery,
  offsetAfterRecovery: value(ingress.currentOffset()),
  admissionsAfter: after.filter(row => row.kind === 'intake-admitted').length,
  holdsAfter: after.filter(row => row.kind === 'intake-held').length,
  captures: Object.keys(custody.captures).length,
};
durable(join(directory, 'recovered.json'), report);
console.log(JSON.stringify(report));
