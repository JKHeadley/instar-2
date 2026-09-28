// Rules 78 and 84: the running agent's capability briefing is the register's generated
// inventory, delivered at every grounding boundary, and is not maintained by hand.
import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CAPABILITY_BRIEFING_PATH, CAPABILITY_LAUNCHER, capabilityBriefing, sourcePacket, SOURCE_PINS } from './briefing.js';

type Feature = { id: string; status: string; availability: string; userFacing: boolean; text: string | null };
const generated = JSON.parse(readFileSync(CAPABILITY_BRIEFING_PATH, 'utf8')) as { generation: string; commit: string; launchers: Record<string, Feature[]> };
const briefed = generated.launchers[CAPABILITY_LAUNCHER]!;
const limits = { providerAttempts: 16, expiresAt: 1791232800000 };

it('delivers every available generated feature, names switched-off ones, and omits unloaded ones', () => {
  const note = sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS, limits).sources.find(s => s.id === 'capability-note')!;
  expect(note.provenance).toMatchObject({ path: CAPABILITY_BRIEFING_PATH, launcher: CAPABILITY_LAUNCHER, generation: generated.generation, commit: generated.commit });
  for (const f of briefed.filter(f => f.availability === 'available')) expect(note.text).toContain(`- ${f.id}: ${f.text}`);
  for (const f of briefed.filter(f => f.availability === 'switched-off')) expect(note.text).toMatch(new RegExp(`switched off here[^\\n]*\\b${f.id}\\b`));
  for (const f of briefed.filter(f => f.availability === 'not-loaded')) expect(note.text).not.toContain(f.id);
  expect(note.text).toContain(`at most ${limits.providerAttempts} model attempts`);
  expect(briefed.filter(f => f.availability === 'available' && f.userFacing).map(f => f.id)).toEqual(expect.arrayContaining([
    'preview-conversation', 'preview-durable-memory', 'preview-requested-reminders', 'preview-requested-summaries']));
});

it('the generated briefing is current with every declared feature in the committed sidecars', () => {
  const sidecars = execFileSync('git', ['ls-files', '*.declarations.json', '*.parser.json'], { encoding: 'utf8' }).trim().split('\n');
  const declared = sidecars.flatMap(path => (JSON.parse(readFileSync(path, 'utf8')) as { id: string; kind: string; status: string }[])
    .filter(d => d.kind === 'features' && d.status !== 'retired').map(d => `${d.id}:${d.status}`)).sort();
  expect(briefed.map(f => `${f.id}:${f.status}`).sort()).toEqual(declared);
});

it('no preview source repeats a generated capability description by hand', () => {
  const sources = execFileSync('git', ['ls-files', 'tests/preview/*.ts', 'tests/preview/*.mjs'], { encoding: 'utf8' }).trim().split('\n')
    .filter(path => !path.endsWith('.test.ts'));
  for (const f of briefed.filter(f => f.text && f.availability === 'available'))
    for (const path of sources) expect(readFileSync(path, 'utf8'), `${path} repeats ${f.id}`).not.toContain(f.text!.slice(0, 60));
});

it('states an unavailable briefing honestly instead of guessing a list', () => {
  for (const read of [(): string => { throw Error('absent'); }, () => '{"launchers":{}}', () => 'not json']) {
    const { text, generation } = capabilityBriefing(read, limits);
    expect(generation).toBe('unavailable');
    expect(text).toContain('capability briefing is unavailable');
    for (const f of briefed) expect(text).not.toContain(f.id);
  }
});
