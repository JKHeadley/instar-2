// Rules 78 and 84: the running agent's capability briefing is the register's generated
// inventory, delivered at every grounding boundary, and is not maintained by hand.
import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CAPABILITY_BRIEFING_PATH, CAPABILITY_LAUNCHER, capabilityBriefing, sourcePacket, SOURCE_PINS, SOURCE_EXCERPTS } from './briefing.js';

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
    'preview-conversation', 'preview-durable-memory', 'preview-requested-actions']));
});

// Rule 84 asks that every feature be described, not described at length: the briefing rides every live turn
// inside the approved context bound, so each text is one short line and its README Details line keeps the rest.
it('every briefed feature text is one short line', () => {
  for (const f of briefed.filter(f => f.text)) expect(f.text!.length, f.id).toBeLessThanOrEqual(130);
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

it('the read-only inspection path shows the generated capability note and its register provenance, for the last persisted turn and a next-turn probe', async () => {
  const { mkdtempSync, realpathSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const { createJournalWorker, openPreviewJournal } = await import('./journal-test-worker.js');
  const { prepareJournalEnvelope } = await import('./journal-envelope.js');
  const key = new Uint8Array(32).fill(23);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-capability-inspect-')));
  const inspect = (...args: string[]) => {
    const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'inspect', ...args, '--root', root],
    { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, encoding: 'utf8', timeout: 20000 });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout);
  };
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 60000, cursor: 0 });
    const sources = sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS, { providerAttempts: 20, expiresAt: 9999999999999 }).sources;
    const worker = createJournalWorker(journal, { now: Date.now, stopped: () => false, sources,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', Date.now()),
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'What can you do?', date: 1790000060 } }]);
    await worker.drain(); journal.close();
    const source = JSON.parse(readFileSync('generated/source.json', 'utf8')) as { generation: string };
    const out = inspect('--text', 'What can you do?', '--model', 'claude-sonnet-5');
    for (const note of [out.last.capabilityNote, out.next.capabilityNote]) {
      expect(note.provenance).toMatchObject({ path: CAPABILITY_BRIEFING_PATH, launcher: CAPABILITY_LAUNCHER, generation: source.generation, commit: generated.commit });
      expect(note.text).toContain('- preview-requested-actions: ');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('keeps the purpose and pillars verbatim and refuses either changed excerpt after the fixed-text trim', () => {
  const read = (path: string) => readFileSync(path, 'utf8');
  const sources = sourcePacket(read, SOURCE_PINS, limits).sources;
  expect(sources.map(source => source.id)).toEqual(['purpose:purpose', 'purpose:coherency', 'capability-note']);
  for (const excerpt of SOURCE_EXCERPTS) {
    const source = sources.find(item => item.id === excerpt.id)!;
    const document = read(excerpt.path);
    const from = document.indexOf(excerpt.start), to = document.indexOf(excerpt.end, from) + excerpt.end.length;
    expect(source.text).toBe(document.slice(from, to));
    expect(source.provenance.excerptSha256).toBe(SOURCE_PINS[excerpt.id]);
    expect(source.provenance.firstLine).toBe(document.slice(0, from).split('\n').length);
    expect(source.provenance).not.toHaveProperty('fileSha256');
    expect(() => sourcePacket(path => path === excerpt.path
      ? document.slice(0, from + excerpt.start.length) + 'changed' + document.slice(from + excerpt.start.length)
      : read(path), SOURCE_PINS, limits)).toThrow(`source excerpt ${excerpt.id} changed`);
  }
});

it('briefs the installation identity with and without the generated register, preserving tool and runtime limits', () => {
  for (const tools of [false, true]) for (const available of [false, true]) {
    const read = available ? (path: string) => readFileSync(path, 'utf8') : () => { throw Error('absent'); };
    const { text } = capabilityBriefing(read, { ...limits, tools });
    expect(text).toContain("This is Instar in the operator's direct Telegram chat and its topics.");
    expect(text).not.toMatch(/PREVIEW trial|This trial|Instar 2\.0/u);
    expect(text).toContain(`at most ${limits.providerAttempts} model attempts, ending at epoch ms ${limits.expiresAt}`);
    expect(text).toContain('Charges, and unconfirmed calls or deliveries, are recorded unknown.');
    expect(text).toContain('Production safeguards are incomplete.');
    if (tools) {
      expect(text).not.toContain('You have no tools');
      expect(text).toContain("doorway\'s four tests");
    } else expect(text).toMatch(/no tools/u);
    expect(text.includes('capability briefing is unavailable')).toBe(!available);
  }
});
