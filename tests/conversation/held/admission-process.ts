/**
 * HELD: P12-NF-16/18/46 cross-process one-admitted-mode arm.
 * Expected to fail until Part Ten SEAM-LEDGER row 99 lands. This source is not
 * a Vitest passing test and must not be counted as one.
 */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { admitTelegramAdapter } from '../../../src/conversation/index.js';
import { value } from '../../intake/fixtures.js';
import { conversationFixture } from '../fixture.js';

const [directory, mode] = process.argv.slice(2);
if (!directory || !mode) throw new Error('usage: admission-process.mjs <directory> <seed|long-poll|webhook>');
const exchangeDirectory: string = directory;
const admissionMode: string = mode;
const sleep = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
function wait(file: string): void {
  const end = Date.now() + 60_000;
  while (!existsSync(file)) {
    if (Date.now() > end) throw new Error(`barrier timeout ${file}`);
    sleep();
  }
}
function durable(file: string, body: unknown): void {
  const descriptor = openSync(file, 'w');
  writeFileSync(descriptor, JSON.stringify(body));
  fsyncSync(descriptor);
  closeSync(descriptor);
}

const fixture = conversationFixture({ mode: 'webhook', skipInitialAdmission: true });
const factsFile = join(exchangeDirectory, 'facts.json');
function lock(): void {
  const end = Date.now() + 60_000;
  while (true) {
    try { mkdirSync(join(exchangeDirectory, 'lock')); return; } catch {
      if (Date.now() > end) throw new Error('lock timeout');
      sleep();
    }
  }
}
function locked<T>(operation: () => T): T {
  lock();
  try { return operation(); } finally { rmdirSync(join(exchangeDirectory, 'lock')); }
}
function refresh(): void {
  fixture.assembly.raw.splice(0, fixture.assembly.raw.length,
    ...JSON.parse(readFileSync(factsFile, 'utf8')) as unknown[]);
}
if (admissionMode === 'seed') {
  durable(factsFile, fixture.assembly.raw);
  process.exit(0);
}

const assembly = {
  ...fixture.assembly.runtime,
  inspectCurrent() {
    return locked(() => { refresh(); return fixture.assembly.runtime.inspectCurrent(); });
  },
  record(name: any, input: any) {
    if (name === 'AdapterConformance') {
      durable(join(exchangeDirectory, `${admissionMode}.ready`), { pid: process.pid, mode: admissionMode });
      wait(join(exchangeDirectory, `${admissionMode}.release`));
    }
    return locked(() => {
      refresh();
      const result = fixture.assembly.runtime.record(name, input);
      durable(factsFile, fixture.assembly.raw);
      return result;
    });
  },
} as unknown as typeof fixture.assembly.runtime;
const history = {
  ...fixture.admissionDependencies.history,
  lookup(reference: string) {
    return locked(() => { refresh(); return fixture.admissionDependencies.history.lookup(reference); });
  },
};
const verification = {
  ...fixture.verification,
  inspect() {
    return locked(() => { refresh(); return fixture.verification.inspect(); });
  },
};
const { recordedEndpointChoice: _choice, ...longPollDeclaration } = fixture.declaration;
const result = admitTelegramAdapter(admissionMode === 'webhook' ? fixture.declaration : longPollDeclaration, {
  ...fixture.admissionDependencies, assembly, history, verification,
});
const rows = locked(() => {
  refresh();
  return value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
    row.record.type === 'AdapterConformance').map(row => ({
      mode: row.record.type === 'AdapterConformance' ? row.record.mode : '',
      disposition: row.record.type === 'AdapterConformance' ? row.record.disposition : '',
      taint: row.taint, conflicts: row.conflicts,
    }));
});
durable(join(exchangeDirectory, `${admissionMode}.result.json`), {
  pid: process.pid, mode: admissionMode, kind: result.kind,
  detail: result.kind === 'Refused' ? result.detail : '', rows,
});
