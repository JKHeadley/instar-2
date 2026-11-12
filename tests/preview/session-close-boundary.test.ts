import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createOrdinaryLane, sentinelCycle } from './live-sentinels.js';
import { appendRun, readRuns, redactedRunCause } from './self-state.js';
import { redact } from '../../src/recall/redact.js';
import { SESSION_WORK_CLOSE_NOT_OPEN } from '../../src/assembly/production-session-work.js';
import { successiveWorld, offlineProfile } from './successive-fixture.js';
// @ts-ignore -- physical launcher test harness.
import { cutoverHarness } from './journal-cutover-harness.mjs';

const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const temporary = () => { const root = mkdtempSync(join(tmpdir(), 'close-boundary-')); roots.push(root); return root; };

it.each([SESSION_WORK_CLOSE_NOT_OPEN, 'another journal refusal token=private-fixture-value'])(
  'the shipped maintenance boundary keeps the ordinary lane serving after repeated %s', async message => {
    const path = join(temporary(), 'runs.jsonl'), stderr: string[] = [];
    let clock = 1000, drains = 0, maintenance = 0, fail = true;
    appendRun(path, { v: 1, launch: 1000, pid: 123 });
    const reporterBody = host.split('  const reportMaintenanceFailure = error => {')[1]!.split('\n  let handoff =')[0]!;
    const lane = createOrdinaryLane({ elapsed: () => clock, peerCurrent: () => true, after: () => {} });
    const cycleBody = host.split('    const workCycle = (requested = false, wake = false) => {')[1]!
      .split('\n    // One disposable wake')[0]!;
    const workCycle = Function('journal', 'ownerHeld', 'activationMatchesJournal', 'activation', 'sentinels',
      'sentinelCycle', 'lane', 'sentinelTick', 'sentinelSteps', 'conversationSession', 'sessionWork', 'worker',
      'redactedRunCause', 'scrubRunText', 'process', 'appendRun', 'runsPath', 'launchedAt', 'wallNow',
      `let maintenanceCause = null; const reportMaintenanceFailure = error => {${reporterBody}
       return (requested = false, wake = false) => {${cycleBody}`)(
      { view: { stop: null }, readOnly: false }, () => true, () => true, {}, { observeWork: () => {} },
      sentinelCycle, lane, () => {}, [], true,
      { port: { maintain: async () => { maintenance++; if (fail) throw Error(message); } } },
      { drain: async () => { drains++; }, sendRequested: async () => {}, workObligations: async () => {} }, redactedRunCause, (text: string) => redact(text).text,
      { stderr: { write: (text: string) => stderr.push(text) } }, appendRun, path, 1000, () => clock);
    // Eight ordinary failures used to latch a fatal lane error; the ninth remains serviceable now.
    for (let n = 0; n < 9; n++) { workCycle(); await lane.settle(); clock += 300000; }
    expect(maintenance).toBe(9); expect(drains).toBe(9); expect(lane.error()).toBeNull();
    expect(stderr).toHaveLength(1);
    expect(stderr.join('')).toContain('runner maintenance refused: Error:');
    expect(stderr.join('')).not.toContain('private-fixture-value');
    const log = readRuns(path);
    expect(log.unreadable).toBe(0); expect(log.launches[0]?.exit).toBeUndefined();
    expect(log.launches[0]?.maintenanceFailure?.cause).toBe(redactedRunCause(Error(message)));
    fail = false; workCycle(); await lane.settle();
    fail = true; workCycle(); await lane.settle();
    expect(stderr).toHaveLength(2); expect(drains).toBe(11);
  });

it('redacts complete multiline secrets before selecting the error first line, including held secrets', () => {
  expect(redactedRunCause(new TypeError('token=fixture-secret-value\nprivate stack')))
    .toBe('TypeError: token=[redacted credential]');
  expect(redactedRunCause(new Error('-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----')))
    .not.toContain('fixture');
  expect(redactedRunCause(Error('opaque value'), text => text.replace('opaque value', '[held secret]')))
    .toBe('Error: [held secret]');
  expect(redactedRunCause(Error('opaque value'), () => { throw Error('custody unavailable'); }))
    .toBe('Error: cause unavailable');
  expect(redactedRunCause('token=fixture-secret-value')).toBe('ThrownValue: token=[redacted credential]');
});

it('the real launcher writes a redacted error class and first line in its exit row and stderr', async () => {
  const root = temporary(), loader = join(root, 'exit-loader.mjs');
  const marker = '    runs = readRuns(runsPath);';
  expect(host).toContain(marker);
  writeFileSync(loader, `export async function load(url, context, next) {
    const result = await next(url, context);
    if (!url.endsWith('/tests/preview/journal-agent.mjs')) return result;
    const source = String(result.source);
    return { ...result, source: source.replace(${JSON.stringify(marker)}, ${JSON.stringify(marker + " throw new TypeError('token=fixture-secret-value\\nprivate stack');")}) };
  }`);
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  const run = await harness.runLive(1, [], { NODE_OPTIONS: `--loader ${pathToFileURL(loader).href}` });
  expect(run.status).not.toBe(0);
  expect(run.stderr).toContain('TypeError: token=[redacted credential]');
  expect(run.stderr).not.toContain('fixture-secret-value'); expect(run.stderr).not.toContain('private stack');
  const log = readRuns(join(harness.liveRoot, 'runs.jsonl'));
  expect(log.unreadable).toBe(0);
  expect(log.launches.at(-1)).toMatchObject({ reason: 'error (details suppressed)', cause: 'TypeError: token=[redacted credential]' });
}, 60000);
