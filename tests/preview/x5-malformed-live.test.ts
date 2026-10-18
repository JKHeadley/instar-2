/** Check X5 on rc-2 7d2ba68b (plan #612): every group-B run in proof room 1 counted malformed answers.
 *
 * Every case replays recorded bytes (Rule 106): the answer, reply-review and reply-revision outputs of the four failing
 * runs (B-proofroom-20261006-174539, -180502, -181749 and -183101), read from read-only copies of their room journals.
 * Under rc-2's reader ten of them were malformed, and they fall into three classes:
 *  - six quoted text inside `reasoning` without escaping the quotes, which sb-w4-d1chold now reads (`reasoning-quotes`);
 *  - two are not the model's answer at all, only its last part. Their turn passed the 2048-token per-message cap,
 *    the CLI resumed in a second message, and the JSON result carried that second message alone. 715674603 starts
 *    mid-string; 715674595 starts "Finishing the thought:". The provider now gives a tool turn a per-message cap
 *    equal to its whole-turn bound (production-provider-tools.test.ts), so the CLI no longer splits such an answer;
 *  - two are the model's own slips, and stay counted: 715674602 never closes its object, after an unescaped quoted
 *    address inside `answer`, and requested-action:0 writes `answer` beside `fulfilled`.
 * The reader never guesses a fragment into an answer: each of the two fragments stays malformed here. */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { readAnswer } from './answer-reading.js';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS, subscriptionToolsPolicy } from '../../src/assembly/production-provider.js';

type Case = { root: string; id: string; role: 'answer' | 'reply-review'; attempt: number; outputTokens: number | null;
  rc2: string; branch: string; output: string };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/x5-malformed-live-2026-10-06.json', import.meta.url), 'utf8')) as { cases: Case[] };
const read = (item: Case) => readAnswer(item.output, { wrapped: item.role === 'answer' ? 'accept' : 'refuse', evidence: [item.id] });
const shown = (item: Case) => { const reading = read(item); return `${reading.ok ? 'ok' : 'malformed'}/${reading.shape}`; };
const ROOM = { b174539: 'proofroom1-q-20261006-174418' } as const;
const find = (id: string, attempt = 1, root?: string) => {
  const found = fixture.cases.filter(item => item.id.endsWith(id) && item.attempt === attempt && (root === undefined || item.root === root));
  expect(found, `${id} attempt ${attempt}`).toHaveLength(1);
  return found[0]!;
};

it('reads every recorded output exactly as recorded: the three classes, and the well-formed controls unchanged', () => {
  for (const item of fixture.cases) expect(shown(item), `${item.id} attempt ${item.attempt}`).toBe(item.branch);
  expect(fixture.cases.filter(item => item.rc2.startsWith('malformed/'))).toHaveLength(10);
  const rescued = fixture.cases.filter(item => item.rc2.startsWith('malformed/') && item.branch.startsWith('ok/'));
  expect(rescued.map(item => item.branch)).toEqual(Array(6).fill('ok/reasoning-quotes'));
  // Well-formed and tolerated answers read exactly as they did on rc-2.
  for (const item of fixture.cases.filter(item => item.rc2.startsWith('ok/'))) expect(shown(item)).toBe(item.rc2);
  expect(fixture.cases.filter(item => item.rc2 === 'ok/bare').length).toBeGreaterThanOrEqual(3);
});

it('the two fragments came from turns over the per-message cap, and stay refused: the reader never guesses them into an answer', () => {
  const fragments = [find(':update:715674603'), find(':update:715674595')];
  for (const item of fragments) {
    expect(item.outputTokens).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    // The provider's tool-turn bound admits each whole turn, so the per-message cap no longer cuts it.
    expect(item.outputTokens).toBeLessThanOrEqual(subscriptionToolsPolicy('claude-sonnet-5').maxTokens);
    expect(read(item).ok).toBe(false);
  }
  expect(fragments[0]!.output.startsWith('"later today,')).toBe(true);
  expect(shown(fragments[0]!)).toBe('malformed/not-json');
  expect(fragments[1]!.output.startsWith('{"reasoning":"Finishing the thought:')).toBe(true);
  expect(shown(fragments[1]!)).toBe('malformed/truncated');
  // Each format re-ask returned a whole answer under the cap.
  for (const id of [':update:715674603', ':update:715674595']) {
    const retry = find(id, 2);
    expect(retry.outputTokens).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS); expect(read(retry).ok).toBe(true);
  }
});

it('a genuine slip under the cap is still counted malformed: an unclosed object, and "answer" beside "fulfilled"', () => {
  const unclosed = find(':update:715674602');
  expect(unclosed.outputTokens).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(unclosed.output.startsWith('{"reasoning":')).toBe(true);
  expect(read(unclosed)).toMatchObject({ ok: false, shape: 'truncated' });
  const beside = find('requested-action:0', 1, ROOM.b174539);
  expect(read(beside)).toMatchObject({ ok: false, shape: 'bare-wrong-fields',
    defect: expect.stringContaining('"answer" was written beside other fields (fulfilled)') });
  // Their re-asks were read.
  expect(read(find(':update:715674602', 2)).ok).toBe(true);
  expect(read(find('requested-action:0', 2, ROOM.b174539)).ok).toBe(true);
});
