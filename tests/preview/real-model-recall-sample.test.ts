import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { RECALL_CASES, runRealModelRecallSample } from './real-model-recall-sample.js';

it('skips the command without both the live flag and preview login profile', () => {
  const command = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/real-model-recall-sample.mjs'];
  for (const flags of [[], ['--live'], ['--login-profile', '/missing/profile.json']]) {
    const output = execFileSync(process.execPath, [...command, ...flags], { encoding: 'utf8' });
    expect(output).toContain('SKIP real model recall sample');
  }
  const refused = spawnSync(process.execPath, [...command, '--live', '--login-profile', '/missing/profile.json',
    '--activation-record', '/missing/activation.json', '--output', '/tmp/new-recall-report.json'], { encoding: 'utf8' });
  expect(refused.status).not.toBe(0);
  expect(refused.stdout).not.toContain('SKIP');
});

it('scores 20 one-shot answers from a replayed 120-turn fixture and records packet evidence for misses', async () => {
  const packets: string[] = [];
  const report = await runRealModelRecallSample('claude-sonnet-5', async prepared => {
    const envelope = JSON.parse(prepared) as { messages: { role: string; content: string }[] };
    const context = envelope.messages.find(item => item.role === 'context')?.content;
    expect(context).toBeTruthy();
    const packet = JSON.parse(context!) as { packet: { historyMode: string; summary: { through: number } } };
    expect(packet.packet.historyMode).toBe('summary-plus-recent');
    expect(packet.packet.summary.through).toBe(120);
    packets.push(context!);
    const item = RECALL_CASES[packets.length - 1]!;
    if (item.id === 'stable-14') return { state: 'rejected' } as const;
    if (item.id === 'corrected-01') return { state: 'complete', text: 'ORIGINAL-01' } as const;
    if (item.id === 'forgotten-09') return { state: 'uncertain' } as const;
    return { state: 'complete', text: item.expected ?? 'I do not know the label; it was forgotten.' } as const;
  });
  expect(report.fixture).toMatchObject({ turns: 120, facts: 30, corrections: 8, forgets: 5 });
  expect(report.calls).toBe(20);
  expect(report.total).toBe(20);
  expect(report.correct).toBe(17);
  expect(report.accuracy).toBe(0.85);
  expect(report.misses.map(item => item.id)).toEqual(['stable-14', 'corrected-01', 'forgotten-09']);
  expect(report.misses[0]?.state).toBe('rejected');
  expect(report.misses[1]?.packet).toMatchObject({ mode: 'summary-plus-recent', summaryThrough: 120,
    expectedVisible: true, staleVisible: true });
  expect(report.misses[2]?.packet).toMatchObject({ expectedVisible: false, staleVisible: false });
  expect(report.misses.every(item => item.packet.sha256.length === 64 && item.packet.bytes > 0)).toBe(true);
  expect(report.misses.every(item => createHash('sha256').update(item.packet.raw).digest('hex') === item.packet.sha256)).toBe(true);
  expect(report.cases.every(item => createHash('sha256').update(item.packet).digest('hex') === item.packetSha256)).toBe(true);
  expect(packets).toHaveLength(20);
}, 120_000);
