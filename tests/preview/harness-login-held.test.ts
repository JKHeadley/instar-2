// @ts-nocheck -- execute the launcher's exact collection block with synthetic custody readers.
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHeldSecrets, heldVerdict } from './tool-turn.mjs';
import { secretMaterialIn } from './reply-check.js';

const launcher = readFileSync('tests/preview/journal-agent.mjs', 'utf8');
const start = launcher.indexOf('    const heldSecrets = createHeldSecrets({');
const end = launcher.indexOf('    const heldSecretValues =', start);
const collect = new Function('createHeldSecrets', 'custodyHeldSources', 'custody', 'readRootMcp', 'root',
  'harnessLoginProfiles', 'readHarnessLogin', 'harnessCredentialValues', 'process',
  `${launcher.slice(start, end)}\nreturn heldSecrets;`);

it.each(['login', 'profile'])('isolates missing secondary %s custody and retains every readable value across later loss', source => {
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const profiles = [0, 1, 2].map(index => ({ reference: `member-${index}`, configDirectory: index }));
  const values = profiles.map((_, index) => `synthetic-${source}-credential-${index}-0123456789`);
  const missing = new Set([1]);
  const read = index => { if (missing.has(index)) throw Error('custody unreadable'); return values[index]; };
  const held = collect(createHeldSecrets, () => ({}), {}, () => null, 'unused', profiles,
    profile => source === 'login' ? read(profile.configDirectory) : '',
    index => source === 'profile' ? [read(index)] : [], { env: {} });
  expect(held().values).toEqual([values[0], values[2]]);
  expect(held().unavailable).toContain('custody unreadable');
  const encoded = Buffer.from(values[0]).toString('base64');
  expect(secretMaterialIn(encoded, held().values)).toBe(true);
  expect(heldVerdict(held)(encoded)).toBe('held');
  expect(heldVerdict(held)('ordinary outward request')).toBe('unavailable');
  missing.clear();
  expect(new Set(held().values)).toEqual(new Set(values));
  expect(heldVerdict(held)('ordinary outward request')).toBe('clear');
  missing.add(0); missing.add(1); missing.add(2);
  expect(new Set(held().values)).toEqual(new Set(values));
  expect(heldVerdict(held)(encoded)).toBe('held');
  expect(heldVerdict(held)('ordinary outward request')).toBe('unavailable');
});

it('replays recorded proof-room model and delivered shapes through the repaired collection and exact matcher', () => {
  // Existing read-only journal capture, updates 715672479–715672500: writer outputs, uncertain writer/review
  // states, Jev judgments (including undecided), reply reviews and delivered replies. No new model call.
  const recorded = JSON.parse(readFileSync('tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json', 'utf8'));
  const shapes = JSON.parse(readFileSync('tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', 'utf8')).otherShapes;
  expect(shapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided', 'jev-unsure',
    'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  const texts = [
    ...shapes.map(row => row.raw), // The empty historical candidate is not claimed as an empty Telegram delivery.
    ...recorded.writer.map(row => row.raw), ...recorded.review.map(row => row.raw),
    ...recorded.jevFaithfulness.map(row => row.raw),
    ...recorded.rows.filter(row => ['summary-uncertain', 'reply-review-state', 'reply-check', 'answer', 'intent'].includes(row.kind))
      .map(row => row.text ?? JSON.stringify(row)),
  ];
  const primary = 'synthetic-custody-replay-primary-0123456789';
  const held = collect(createHeldSecrets, () => ({}), {}, () => null, 'unused',
    [{ configDirectory: 'primary' }, { configDirectory: 'secondary' }],
    profile => { if (profile.configDirectory === 'secondary') throw Error('custody unreadable'); return primary; },
    () => [], { env: {} });
  const encoded = Buffer.from(primary).toString('base64');
  expect(texts.length).toBeGreaterThan(100);
  for (const text of texts) {
    expect(secretMaterialIn(text, held().values)).toBe(false);
    // Fault-injected companion, explicitly synthetic: a captured shape carrying an encoded held login.
    expect(secretMaterialIn(`${text}\n${encoded}`, held().values)).toBe(true);
    expect(heldVerdict(held)(`${text}\n${encoded}`)).toBe('held');
  }
});
