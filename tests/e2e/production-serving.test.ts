import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const record = (id: string, kind: string, value: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id, kind, body: { ...extra, record: value } });
const common = () => [
  { id: 'receipt:1', kind: 'intake-receipt', body: { capture: { reference: 'in:1' } } },
  { id: 'opening:1', kind: 'intake-admitted', body: { eventId: '1', receipt: 'receipt:1', binding: 'bound' } },
  record('runfact:1', 'run-opening', { id: 'run:1', opening: { id: 'opening:1' } }, { run: 'run:1' }),
  record('ground:1', 'session-grounding', { run: 'run:1' }),
  record('requestfact:1', 'judgment-provider-ProviderJudgmentRequest', { id: 'request:1', run: 'run:1' }),
];
const reply = () => [...common(),
  record('provider-claim', 'transport-AdmissionReservation', { run: 'run:1', state: 'dispatch-claimed' }),
  record('provider-response', 'judgment-provider-ProviderJudgmentAttemptRecord',
    { request: 'request:1', phase: 'response-observed' }),
  record('acceptance:1', 'judgment-provider-ProviderAnswerAcceptance',
    { request: 'request:1', capture: { reference: 'answer:1' } }),
  record('replyrun:1', 'run-opening', { id: 'reply:1', opening: { id: 'acceptance:1' } }, { run: 'reply:1' }),
  record('replyrequest:1', 'effect-EffectRequest', { id: 'reply-request', run: 'reply:1' }),
];

function withLedger(rows: unknown[], check: (root: string, run: (mode: string) => ReturnType<typeof spawnSync>) => void) {
  const root = mkdtempSync(join(tmpdir(), 'production-serving-'));
  try {
    writeFileSync(join(root, 'facts.json'), JSON.stringify(rows));
    writeFileSync(join(root, 'calls.json'), '[]');
    const run = (mode: string) => spawnSync(process.execPath,
      ['tests/e2e/production-serving-worker.mjs', root, mode],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    check(root, run);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const calls = (root: string): string[] => JSON.parse(readFileSync(join(root, 'calls.json'), 'utf8'));

describe('offline process restart at owner dispatch claims', () => {
  it('does not repeat an uncertain provider call', () => withLedger(common(), (root, run) => {
    expect(run('provider-kill').signal).toBe('SIGKILL');
    expect(run('resume').stdout).toBe('idle\n');
    expect(calls(root)).toEqual(['provider']);
  }));
  it('does not repeat an uncertain send', () => withLedger(reply(), (root, run) => {
    expect(run('reply-kill').signal).toBe('SIGKILL');
    expect(run('resume').stdout).toBe('idle\n');
    expect(calls(root)).toEqual(['sendMessage']);
  }));
  it('does not repeat a send after its response was recorded but its acknowledgement was lost', () =>
    withLedger(reply(), (root, run) => {
      expect(run('lost-ack').signal).toBe('SIGKILL');
      expect(run('resume').stdout).toBe('idle\n');
      expect(calls(root)).toEqual(['sendMessage']);
    }));
  it('stops before provider dispatch and refuses exhausted capacity', () => {
    for (const mode of ['stop', 'budget']) withLedger(common(), (root, run) => {
      expect(run(mode).stdout).toBe(`${mode === 'stop' ? 'stopped' : 'bound'}\n`);
      expect(calls(root)).toEqual([]);
    });
  });
});
