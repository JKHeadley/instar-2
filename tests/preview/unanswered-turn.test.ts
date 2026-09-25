import { mkdtempSync, realpathSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { decideUnansweredTurn } from '../../src/sentinels/unanswered-turn.js';
import { stage2CompositionFixture } from './stage2-fixture.js';
import { createPreviewComposition } from './composition.js';
import { stage2HistoricalStatus } from './stage2-owners.js';
// @ts-expect-error Physical storage host remains JavaScript.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const base = { id: 'turn', recordedAt: 0, disposition: 'admitted-bound', phase: 'intake-preserved',
  held: true, failureClass: 'limit' as const, resetHint: '10:30pm' };

it('selects only unanswered eligible turns after three minutes', () => {
  const input = { turns: [base], stopped: false, expiresAt: 500000 };
  expect(decideUnansweredTurn(input, 179999)).toBeNull();
  expect(decideUnansweredTurn(input, 180000)?.text).toContain('10:30pm');
  expect(decideUnansweredTurn({ ...input, turns: [{ ...base, phase: 'api-accepted' }] }, 180000)).toBeNull();
  expect(decideUnansweredTurn({ ...input, turns: [{ ...base, phase: 'dispatch-outcome-unknown' }] }, 180000)).toBeNull();
  expect(decideUnansweredTurn({ ...input, turns: [{ ...base, disposition: 'held' }] }, 180000)).toBeNull();
  expect(decideUnansweredTurn({ ...input, stopped: true }, 180000)).toBeNull();
  expect(decideUnansweredTurn(input, 500000)).toBeNull();
});

it('never resends after SIGKILL between prepare and physical dispatch', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'notice-crash-'))); roots.push(root);
  const command = (mode: string) => spawnSync(process.execPath,
    ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/notice-crash-fixture.mjs', root, mode],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 30000 });
  const crashed = command('crash');
  expect(crashed.signal).toBe('SIGKILL');
  expect(existsSync(join(root, 'sends.log'))).toBe(false);
  const state = JSON.parse(readFileSync(join(root, 'preview-state.json'), 'utf8'));
  expect(Object.values(state.turns)[0]).toMatchObject({ phase: 'dispatch-outcome-unknown' });
  const restart = command('check');
  expect(restart.status).toBe(0);
  expect(existsSync(join(root, 'sends.log'))).toBe(false);
}, 60000);

it('sends one notice for a held Stage 2 limit without a second model call', async () => {
  const s = stage2CompositionFixture({ terminal: JSON.stringify({ type: 'result', subtype: 'error', is_error: true,
    result: "You've hit your usage limit; resets in 5 minutes" }) }); roots.push(s.root);
  const c = await s.create();
  try { c.pollOnce(); await c.resume(); } finally { c.close(); }
  const held = s.state.read();
  const turn = Object.values(held.turns)[0]!;
  expect(turn.failureClass).toBe('limit');
  expect(s.models).toHaveLength(1);
  s.time(turn.recordedAt + 180000);
  const decision = decideUnansweredTurn({ turns: [{ ...turn, held: true }], stopped: false,
    expiresAt: held.trial.expiresAt }, s.now());
  expect(decision).not.toBeNull();
  const notice = createPreviewComposition({ configuration: s.configuration, state: s.state, noticeOnly: true,
    storageKey: new Uint8Array(32).fill(19), storageIO: productionStorageIO, telegramIO: s.telegramIO,
    now: () => 100, resolveSecret: () => '8820318295:synthetic_recorded_test_only_value' });
  try { (notice as any).dispatchNotice(decision!.turnId, decision!.text); } finally { notice.close(); }
  expect(s.calls.filter((call: any) => call.method === 'sendMessage')).toHaveLength(1);
  expect(s.models).toHaveLength(1);
  expect(s.state.read().turns[turn.id]?.phase).toBe('api-accepted');
  expect(stage2HistoricalStatus(s.root, s.state.read(), s.configuration).phase).toBe('held');
}, 60000);

it('uses the existing prepared reply operation for one fixed notice', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'notice-deliver-'))); roots.push(root);
  const delivered = spawnSync(process.execPath,
    ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/notice-crash-fixture.mjs', root, 'deliver'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 30000 });
  expect(delivered.status, delivered.stderr).toBe(0);
  expect(readFileSync(join(root, 'sends.log'), 'utf8')).toBe('send\n');
  const state = JSON.parse(readFileSync(join(root, 'preview-state.json'), 'utf8'));
  expect(Object.values(state.turns)[0]).toMatchObject({ phase: 'api-accepted' });
}, 60000);
