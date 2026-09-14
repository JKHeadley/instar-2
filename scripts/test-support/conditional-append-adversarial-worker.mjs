import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createConditionalAssemblyAppendPort, createAssemblyRuntime, createAssemblySpine } from '../../src/assembly/index.ts';
import { createFactStore } from '../../src/facts/index.ts';
import { boundary } from '../../src/facts/boundary.ts';
import { createTransportFileStorage } from '../transport-file-storage.mjs';
import { assemblyRuntimeFixture } from '../../tests/assembly/runtime-fixture.ts';
import { assemblyInput } from '../../tests/assembly/fixture.ts';
import { privateKey, value } from '../../tests/facts/fixtures.ts';

const [command, directory, json = '{}'] = process.argv.slice(2);
if (!command || !directory) throw new Error('command and directory required');
const options = JSON.parse(json);
mkdirSync(directory, { recursive: true });

const fixture = assemblyRuntimeFixture();
const pause = path => {
  writeFileSync(`${path}.ready`, 'ready');
  const started = Date.now();
  while (!existsSync(path)) {
    if (Date.now() - started > 60_000) throw new Error(`timed out waiting for ${path}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
};
const base = createTransportFileStorage(directory, run => boundary('ConditionalAppendAdversarialStorage', null, fixture.c, run));

if (command === 'init') {
  for (const row of fixture.storage.read()) value(base.append(JSON.stringify(row), base.read().at(-1)?.contentHash ?? null));
  process.stdout.write(`${JSON.stringify({ initialized: base.read().length })}\n`);
  process.exit(0);
}

let readCalls = 0;
const storage = {
  owner: 'part-ten',
  read() {
    readCalls += 1;
    const snapshot = base.read();
    if (options.pauseRead === readCalls) pause(join(directory, 'read-pause'));
    return snapshot;
  },
  append: base.append,
};
let currentCalls = 0;
let stopIssued = false;
const host = { ...fixture.host, current() {
  currentCalls += 1;
  if (options.stopCall === currentCalls) {
    fixture.stop();
    stopIssued = true;
  }
  return fixture.host.current();
} };
const store = createFactStore(fixture.context, storage);
const spine = createAssemblySpine(host, { context: fixture.context, privateKey }, store);
const runtime = createAssemblyRuntime({ ...fixture.composition, host, spine });
const rows = () => value(runtime.inspect()).filter(row => row.record.type === 'AdapterConformance');

if (command === 'read') {
  process.stdout.write(`${JSON.stringify({ rows: rows().map(row => ({
    id: row.record.id,
    adapter: row.record.adapter,
    mode: row.record.mode,
    fact: row.fact.id,
  })), sweep: value(store.sweep()).length })}\n`);
  process.exit(0);
}

if (command !== 'append') throw new Error(`unknown command: ${command}`);
const adapter = options.adapter ?? 'telegram:v1:bot:99';
const role = options.role ?? 'webhook';
const record = { ...assemblyInput('AdapterConformance'), id: options.id ?? `review:${role}`, adapter, mode: role };
const frontier = rows().filter(row => row.record.adapter === adapter).map(row => row.fact.id);
const outcome = createConditionalAssemblyAppendPort({
  host,
  author: { context: fixture.context, privateKey },
  storage,
}).appendIfSubjectFrontier('AdapterConformance', record, {
  subject: { type: 'AdapterConformance', field: 'adapter', value: adapter },
  facts: frontier,
});
process.stdout.write(`${JSON.stringify({
  readCalls,
  currentCalls,
  stopIssued,
  stopped: fixture.host.current().stopped,
  outcome,
  rows: rows().map(row => ({ id: row.record.id, adapter: row.record.adapter, mode: row.record.mode, fact: row.fact.id })),
})}\n`);
