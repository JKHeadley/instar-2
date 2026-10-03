// Rule 36 / observer #106: the native loop's live run (tests/integration/native-loop-live.test.ts, fixtures/native-loop/live-2026-10-03,
// real claude-sonnet-5 outputs under the native framing) replayed offline. Each recorded raw Decision is parsed by the shipped
// path (parseModelJson, conclusionText, parseNativeStep) to the recorded value, and the recorded steps drive runNativeLoop
// through the real admission hook to the recorded admission decisions, kinds and results.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { conclusionText, parseModelJson } from './model-json.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { runToolTurn } from './tool-turn.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { parseNativeStep, runNativeLoop } from './native-loop.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createResourceOwner } from '../../scripts/resource-owner.mjs';

const RECORD = join(__dirname, 'fixtures/native-loop/live-2026-10-03');
const load = (name: string) => JSON.parse(readFileSync(join(RECORD, `${name}.json`), 'utf8'));
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const plainScratch = (turn: string) => { mkdirSync(join(turn, 'vol'), { mode: 0o700 }); return realpathSync(join(turn, 'vol')); };
let owner: unknown;
beforeAll(async () => { owner = createResourceOwner(); await (owner as { attach: (o: object) => Promise<unknown> }).attach({}); });
const rows = (text: string) => text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

async function replay(name: string, stopOnBash = false) {
  const record = load(name), root = realpathSync(mkdtempSync(join(tmpdir(), 'native-replay-'))); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(4), { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:replay', configurationDigest: 'sha256:replay', expires: 9_999_999_999_999,
    maxCalls: 40, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  let stop = false, state = '';
  const outcome = await runToolTurn({ journal, root, id: 'telegram:12345678:update:1', prepared: record.prepared, promptLimit: 32768,
    deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations, now: () => 1, redactText: (t: string) => t,
    fallback: async () => ({ result: 'fallback' }), scratch: plainScratch, detach: () => true,
    invoke: async (turn: { stateDirectory: string }) => {
      state = turn.stateDirectory;
      const watch = stopOnBash ? setInterval(() => { try { if (readFileSync(join(state, 'admission.jsonl'), 'utf8').includes('"tool":"Bash"')) stop = true; } catch { /* not yet */ } }, 20) : undefined;
      try {
        return await runNativeLoop({ turn, prepared: record.prepared, promptLimit: 32768, stopped: () => stop, resources: owner,
          step: async (_envelope: string, index: number) => {
            const step = record.steps[index];
            return step.value === null ? { state: step.state } : { state: step.state, value: step.value };
          } });
      } finally { clearInterval(watch); }
    } });
  return { record, outcome, admission: rows(readFileSync(join(state, 'admission.jsonl'), 'utf8')) };
}
/** Decision, kind and tool of every admission, without the per-run ids and paths. */
const shape = (admission: Array<Record<string, unknown>>) => admission.filter(row => row.phase === 'pre')
  .map(row => [row.tool, row.decision, row.kind ?? null]);

it('every recorded raw step parses through the shipped path to its recorded value and kind', () => {
  const kinds: string[] = [];
  for (const name of ['task', 'scope', 'stop']) for (const step of load(name).steps) {
    const parsed = parseModelJson(step.raw, { wrapped: 'accept' });
    expect(parsed.ok).toBe(true);
    const text = conclusionText((parsed as unknown as { value: { conclusion: { value: unknown } } }).value.conclusion.value as never);
    expect(text).toBe(step.value);
    kinds.push(parseNativeStep(text).kind);
  }
  // Each run's first step requested tools; each answered run's last step is its answer.
  expect(kinds).toEqual(['calls', 'answer', 'calls', 'answer', 'calls']);
});

it('the task run replays to the same admissions, the same file and the same reported value', async () => {
  const { record, outcome, admission } = await replay('task');
  expect(shape(admission)).toEqual(shape(rows(record.admission)));
  const bash = admission.find(row => row.phase === 'post' && row.tool === 'Bash');
  expect(JSON.parse(String(bash?.result)).stdout).toBe(JSON.parse(String(rows(record.admission).find(row => row.phase === 'post' && row.tool === 'Bash')?.result)).stdout);
  expect(outcome.result).toMatchObject({ value: record.answer, native: { ended: 'answered', calls: 2 } });
});

it('the scope run replays to the same refusals (outside read, unregistered web effect) and a shell with no network', async () => {
  const { record, admission } = await replay('scope');
  expect(shape(admission)).toEqual(shape(rows(record.admission)));
  expect(shape(admission)).toEqual([['Read', 'deny', 'scope'], ['WebFetch', 'deny', 'network'], ['Bash', 'allow', null]]);
  expect(String(admission.find(row => row.phase === 'post')?.result)).toMatch(/curl-exit: [1-9]/u);
});

it('the stop run replays to a stopped turn whose command was interrupted', async () => {
  const { record, outcome, admission } = await replay('stop', true);
  expect(shape(admission)).toEqual(shape(rows(record.admission)));
  expect(outcome.result.native).toMatchObject({ ended: 'stopped' });
  expect(JSON.parse(String(admission.find(row => row.phase === 'post')?.result))).toMatchObject({ interrupted: 'stopped' });
});
