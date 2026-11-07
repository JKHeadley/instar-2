/** Rule 121. These drive the real journal and worker with a stub judge, so they prove the wiring and the exact facts ONLY.
 * Whether the judge reads correctly is measured on real model calls: .instar/lanes/attribution-2-0-replay (1.x's three
 * test tiers all passed with a stub while the real judge missed 51 of 72 known false credits). */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts } from './journal-test-worker.js';
import { importChannelItems } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { JEV_MODEL, jevQuestions } from './reply-check.js';
import { ATTRIBUTION_CHUNK_LIMIT, ATTRIBUTION_TEXT_MAX, attributionPacket, attributionSummary, chunkForJudge, attributionTrace, ATTRIBUTION_OBJECTION, decideAttribution, markerFacts, normalizeWords, parseAttributionAnswer, parseMarker, worthJudging,
  type AttributionMode, type SourceRecord } from './attribution.js';
import { LIVE_JUDGMENTS } from './model-call-boundary.js';
// @ts-expect-error the hook's decision stays plain JavaScript
import { noteText } from './tool-admission.mjs';
// @ts-expect-error the recorder stays plain JavaScript
import { observedSubscriptionIO } from './call-diagnostics.mjs';
// @ts-expect-error the checkpoint stays plain JavaScript
import { createAdmissionGate } from './admission-gate.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const record: SourceRecord = { by: 'Sam', strength: 'verified', at: Date.parse('2026-10-08T12:00:00Z'), text: 'at least every hour and a half or so' };
const resolve = (ref: string) => ref === 'telegram 102965/123160' ? record : null;
const sourced = 'Sam: "at least every hour and a half or so" [source: telegram 102965/123160 2026-10-08]';
const claim = (fields: Record<string, unknown>) => JSON.stringify({ claims: [{ span: sourced, person: 'Sam', kind: 'statement', marker: 0, labelled: false,
  stillCredits: false, recap: false, ownWords: 'own', faithful: true, why: 'x', ...fields }] });

describe('the marker and its exact facts', () => {
  it('parses the 1.x form and a journal id, and nothing else', () => {
    expect(parseMarker('[source: telegram 102965/123160 2026-10-08]')).toEqual({ ref: 'telegram 102965/123160', date: '2026-10-08' });
    expect(parseMarker('[source: telegram:7654321:update:9 2026-10-08]')?.ref).toBe('telegram:7654321:update:9');
    for (const bad of ['[source: telegram 2026-10-08', '[source: telegram 1/2]', '[source: telegram 1/2 yesterday]', '[source: ]'])
      expect(parseMarker(bad)).toBeNull();
  });
  it.each([
    ['resolves', sourced, null],
    ['unknown record', 'Sam: "at least" [source: telegram 1/2 2026-10-08]', 'cannot-be-shown'],
    ['wrong date', 'Sam: "at least" [source: telegram 102965/123160 2026-10-09]', 'date-mismatch'],
    ['words not in the record', 'Sam: "at most" [source: telegram 102965/123160 2026-10-08]', 'quote-not-in-record'],
    ['no quote', 'Sam said this [source: telegram 102965/123160 2026-10-08]', 'no-quote'],
    ['a quote lines before the marker', 'Sam: "at least"\nand then [source: telegram 102965/123160 2026-10-08]', 'no-quote'],
    ['malformed', 'Sam: "at least" [source: telegram 102965 2026-10-08]', 'malformed-marker'],
  ])('%s', (_name, text, refusal) => { expect(markerFacts(text, resolve)[0]!.refusal).toBe(refusal); });
  it('a paraphrase is not the words; spacing, case and curly quotes are', () => {
    expect(markerFacts('Sam: "every ninety minutes or so" [source: telegram 102965/123160 2026-10-08]', resolve)[0]!.refusal).toBe('quote-not-in-record');
    expect(markerFacts('Sam: “AT LEAST  every hour” [source: telegram 102965/123160 2026-10-08]', resolve)[0]!.refusal).toBeNull();
    expect(normalizeWords('A’s  B')).toBe("a's b");
  });
  it('the prefilter only decides spend: credit words near a person, any marker, any bare rule', () => {
    expect(worthJudging('Sam said to stop.', ['Sam'])).toBe(true);
    expect(worthJudging('That is a standing rule, so no.', [])).toBe(true);
    expect(worthJudging(sourced, [])).toBe(true);
    expect(worthJudging('The build finished at noon.', ['Sam'])).toBe(false);
    expect(worthJudging('Alex told me to stop.', [])).toBe(true);
  });
});

describe('the verdict', () => {
  const facts = markerFacts(sourced, resolve);
  const decide = (fields: Record<string, unknown>, surface: 'send' | 'write' = 'write') => decideAttribution(sourced, surface, facts, parseAttributionAnswer(claim(fields)));
  it('passes own, faithful words', () => { expect(decide({}).verdict).toBe('pass'); });
  it('keeps who wrote it apart from what it claims', () => {
    expect(decide({ ownWords: 'relayed' }).findings[0]!.reason).toBe('relayed');
    expect(decide({ faithful: false }).findings[0]!.reason).toBe('overstated');
  });
  it('a label removes the credit or it is refused', () => {
    expect(decide({ marker: null, labelled: true, stillCredits: false }).verdict).toBe('pass');
    expect(decide({ marker: null, labelled: true, stillCredits: true }).findings[0]!.reason).toBe('promoted-unsourced');
  });
  it('a recap is exempt on send only, and a bare rule refusal never is', () => {
    expect(decide({ marker: null, recap: true }, 'send').verdict).toBe('pass');
    expect(decide({ marker: null, recap: true }, 'write').findings[0]!.reason).toBe('unsourced');
    expect(decide({ marker: null, recap: true, kind: 'rule-refusal' }, 'send').findings[0]!.reason).toBe('unsourced-rule');
  });
  it('drops a span the model invented', () => {
    expect(decideAttribution(sourced, 'write', facts, parseAttributionAnswer(claim({ span: 'words that are not there', marker: null }))).verdict).toBe('pass');
  });
  it('an imported log proves a name: unclear authorship is counted, not passed and not refused', () => {
    const imported = markerFacts(sourced, () => ({ ...record, strength: 'identity-only' }));
    expect(decideAttribution(sourced, 'write', imported, parseAttributionAnswer(claim({ ownWords: 'unclear' })))).toMatchObject({ verdict: 'unchecked', cause: 'author unclear' });
  });
  it('states what code proved, and keeps the conversation off every surface but send', () => {
    const packet = attributionPacket({ text: sourced, surface: 'write', facts, conversation: [{ from: 'Sam', text: 'hi' }] });
    expect(packet).toContain('"strength":"verified"'); expect(packet).not.toContain('conversation');
    expect(attributionPacket({ text: sourced, surface: 'send', facts, conversation: [{ from: 'Sam', text: 'hi' }] })).toContain('conversation');
  });
  it('an unreadable answer throws, so the caller records unchecked', () => {
    expect(() => parseAttributionAnswer('no json here')).toThrow(); expect(() => parseAttributionAnswer('{"claims":[{}]}')).toThrow();
  });
  it('a sourced claim missing who wrote it or whether it is faithful is no verdict, never a pass (1.x support)', () => {
    expect(() => parseAttributionAnswer(JSON.stringify({ claims: [{ span: sourced, marker: 0 }] }))).toThrow(SyntaxError);
    expect(() => parseAttributionAnswer(claim({ ownWords: 'maybe' }))).toThrow(SyntaxError);
    expect(() => parseAttributionAnswer(claim({ faithful: 'yes' }))).toThrow(SyntaxError);
    // An unsourced or labelled claim answers neither question, so neither is required of it.
    expect(parseAttributionAnswer(claim({ marker: null, ownWords: null, faithful: null }))).toHaveLength(1);
    expect(parseAttributionAnswer(claim({ labelled: true, ownWords: null, faithful: null }))).toHaveLength(1);
  });
  it('chunks long text as 1.x did: every character is in some chunk, each within the bound', () => {
    const text = `${'The build is complete. '.repeat(800)}\n\n${'Para.\n'.repeat(4000)}${FALSE_CREDIT}`, chunks = chunkForJudge(text);
    expect(chunks.length).toBeGreaterThan(1); expect(chunks.every(chunk => chunk.length <= ATTRIBUTION_TEXT_MAX)).toBe(true);
    expect(chunks.join('').replace(/\s/gu, '')).toBe(text.replace(/\s/gu, '')); expect(chunks.at(-1)).toContain(FALSE_CREDIT);
    expect(chunkForJudge(sourced)).toEqual([sourced]);
  });
  it('is a registered judgment with a signal authority', () => { expect(LIVE_JUDGMENTS['attribution-check'].authority).toBe('signal'); });
});

const FALSE_CREDIT = 'Sam told me never to spawn on the laptop.', HONEST = 'I would avoid the laptop; that is my own view.', KEPT = 'The build is done.';
interface Scenario { mode?: AttributionMode; answer?: string; judge?: 'refuse' | 'pass' | 'throw' | 'junk' | 'partial'; revised?: string; crash?: string; maxCalls?: number; note?: string; imported?: { account: string; id: string; from: string; text: string; conversation: string } }
async function drive(s: Scenario) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'attribution-'))); roots.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(23), sends: string[] = [], packets: string[] = [];
  let judged = 0, crashes = 0;
  const reply = s.answer ?? FALSE_CREDIT;
  const ports = (): PreviewPorts => ({ now: () => 1790000000000, stopped: () => false, prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', 9999999999999), model: async () => reply,
    checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return sends.length; },
    ...(s.mode ? { attribution: { mode: s.mode, judge: async ({ id, packet }) => {
      judged++; packets.push(packet);
      // The real launcher's own recorder writes this row before the answer is read. Refusing it turned every judge answer into
      // UNKNOWN on the real route, and hand-built rows hid that (found live, 2026-11-06): so this goes through the real recorder.
      await observedSubscriptionIO({ execute: async () => ({ code: 0, limited: false, stdout: '', stdoutBytes: new Uint8Array() }) },
        { maxTokens: 2048, maxOutputBytes: 16384 }, id, (row: never) => journal.append(row), { elapsed: () => 1, at: () => 1790000000000 }).execute({ stdin: 'x' });
      if (s.judge === 'throw') throw Error('timeout');
      if (s.judge === 'junk') return { value: 'not json' };
      if (s.judge === 'partial') return { value: JSON.stringify({ claims: [{ span: (JSON.parse(packet) as { packet: { text: string } }).packet.text.split(' [source')[0], marker: 0 }] }) };
      const text = (JSON.parse(packet) as { packet: { text: string } }).packet.text;
      const refuse = (s.judge ?? 'refuse') === 'refuse' && text.includes('Sam told me');
      return { value: JSON.stringify({ claims: refuse ? [{ span: 'Sam told me never to spawn on the laptop', person: 'Sam', kind: 'rule', marker: null, labelled: false, stillCredits: false, recap: false, ownWords: null, faithful: null, why: 'no record' }] : [] }) };
    } } } : {}),
    replyCheck: { elapsedMs: () => 0, jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(jevQuestions).map(rule => [rule, { type: 'noul', noul: 0.02 }])) }, latencyMs: 1 }),
      escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 1 }),
      revise: async input => ({ state: 'complete', text: s.revised ?? input.text, dispositions: (input.objections ?? []).map(objection => ({ objection, decision: 'accept' as const, reason: 'fixed' })) }) } });
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: s.maxCalls ?? 40, maxReplies: 20, maxTurns: 20, maxBytes: 262144, cursor: 0 };
  const open = (fresh: boolean) => openPreviewJournal(path, key, fresh ? genesis : undefined, stage => {
    if (s.crash && stage === s.crash && ++crashes === 1) throw Error(`TEST crash ${stage}`); });
  let journal = open(true), worker = createJournalWorker(journal, ports());
  try {
    if (s.imported) importChannelItems(journal, [{ source: 'conversation', at: 1789000000000, ...s.imported }], s.imported.account, 1790000000000);
    worker.intake([{ update_id: 1, message: { message_id: 1, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Where should builds run?' } }]);
    if (s.crash) { await expect(worker.drain()).rejects.toThrow('TEST crash'); journal.close(); journal = open(false); worker = createJournalWorker(journal, ports()); }
    await worker.drain();
    const note = s.note === undefined ? undefined : await worker.attributionOfNote('toolu_1', s.note);
    return { sends, judged, packets, note, rows: journal.view.attribution ?? [], turn: journal.view.order[0]!, calls: journal.view.calls };
  } finally { journal.close(); }
}

describe('the send check on the real worker (stub judge: wiring only)', () => {
  it('absent, nothing runs and the reply is unchanged', async () => {
    const result = await drive({}); expect(result.sends).toEqual([FALSE_CREDIT]); expect(result.rows).toEqual([]);
  });
  it('record mode writes the refusal and changes nothing the reader sees', async () => {
    const result = await drive({ mode: 'record' });
    expect(result.sends).toEqual([FALSE_CREDIT]); expect(result.judged).toBe(1);
    expect(result.rows).toMatchObject([{ surface: 'send', mode: 'record', verdict: 'refuse', findings: [{ reason: 'unsourced' }] }]);
  });
  it('enforce sends the agent\'s honest revision, and checks the revision too', async () => {
    const result = await drive({ mode: 'enforce', revised: HONEST });
    expect(result.sends).toEqual([HONEST]); expect(result.turn.release?.objections).toContain(ATTRIBUTION_OBJECTION);
    expect(result.rows.map(row => row.verdict)).toEqual(['refuse', ...(worthJudging(HONEST, []) ? ['pass'] : [])]);
  });
  it('enforce excises a refused claim the agent kept, and the rest of the answer still leaves', async () => {
    const result = await drive({ mode: 'enforce', answer: `${FALSE_CREDIT} ${KEPT} The tests all passed on the Studio this morning.` });
    expect(result.sends).toHaveLength(1); expect(result.sends[0]).not.toContain('Sam told me'); expect(result.sends[0]).toContain(KEPT);
  });
  it('enforce with nothing left sends the holding notice, never the credit', async () => {
    const result = await drive({ mode: 'enforce' });
    expect(result.sends).toHaveLength(1); expect(result.sends[0]).not.toContain('Sam told me');
  });
  it.each(['throw', 'junk'] as const)('a judge that %ss passes unchecked and is counted', async judge => {
    const result = await drive({ mode: 'enforce', judge });
    expect(result.sends).toEqual([FALSE_CREDIT]); expect(result.rows).toMatchObject([{ verdict: 'unchecked' }]);
  });
  it('counts one model call against the allowance', async () => {
    const plain = await drive({ mode: 'record', answer: KEPT }), credited = await drive({ mode: 'record' });
    expect(credited.calls).toBe(plain.calls + 1);
  });
  it('a crash after the reservation leaves it unchecked and never replays the call', async () => {
    const result = await drive({ mode: 'record', crash: 'after:attribution-reserve' });
    expect(result.judged).toBe(0); expect(result.rows).toMatchObject([{ verdict: 'unchecked', cause: 'interrupted' }]);
  });
  it('a plain reply makes no call', async () => {
    const result = await drive({ mode: 'enforce', answer: KEPT }); expect(result.judged).toBe(0); expect(result.rows).toEqual([]);
  });
  it('hands the judge the authenticated conversation', async () => {
    const result = await drive({ mode: 'record' });
    expect(JSON.parse(result.packets[0]!).packet.conversation).toEqual([{ from: 'the operator', text: 'Where should builds run?' }]);
  });
});

describe('the write check (stub judge: wiring only)', () => {
  const answer = KEPT;
  it('enforce refuses a false credit in a note with the way through, and records it', async () => {
    const result = await drive({ mode: 'enforce', answer, note: FALSE_CREDIT });
    expect(result.note).toContain('source unknown');
    expect(result.rows).toMatchObject([{ id: 'note:toolu_1', surface: 'write', verdict: 'refuse' }]);
  });
  it('record mode clears the note and keeps the verdict', async () => {
    const result = await drive({ mode: 'record', answer, note: FALSE_CREDIT });
    expect(result.note).toBeNull(); expect(result.rows).toMatchObject([{ verdict: 'refuse', mode: 'record' }]);
  });
  it('a note the judge cannot read clears and is counted', async () => {
    const result = await drive({ mode: 'enforce', answer, judge: 'throw', note: FALSE_CREDIT });
    expect(result.note).toBeNull(); expect(result.rows).toMatchObject([{ verdict: 'unchecked' }]);
  });
  it('a false credit after a long run of plain text is still judged and refused (review 2026-11-07 tail case)', async () => {
    const result = await drive({ mode: 'enforce', answer, note: `${'The build is complete. '.repeat(800)}${FALSE_CREDIT}` });
    expect(result.note).toContain('source unknown');
    expect(result.rows.filter(row => row.id.startsWith('note:')).map(row => row.verdict)).toContain('refuse');
  });
  it('text past the check bound is recorded unchecked with no call, never silently dropped, and the note is still written', async () => {
    const filler = `${'The build is complete.\n'.repeat(700)}\n\n`.repeat(ATTRIBUTION_CHUNK_LIMIT + 1);
    const result = await drive({ mode: 'enforce', answer, note: `${filler}${FALSE_CREDIT}` });
    expect(result.note).toBeNull(); expect(result.judged).toBe(0);
    expect(result.rows).toMatchObject([{ id: `note:toolu_1#${String(ATTRIBUTION_CHUNK_LIMIT)}`, verdict: 'unchecked', cause: `text past ${String(ATTRIBUTION_CHUNK_LIMIT)} checks` }]);
  });
  it('a partial answer on a sourced claim records unchecked, never pass', async () => {
    const note = `Sam: "Where should builds run?" [source: telegram 7654321/1 ${new Date(1790000000000).toISOString().slice(0, 10)}]`;
    const result = await drive({ mode: 'enforce', answer, judge: 'partial', note });
    expect(result.note).toBeNull(); expect(result.rows).toMatchObject([{ verdict: 'unchecked', cause: 'unreadable answer' }]);
  });
  it('a recap is never exempt in a note: no conversation reaches the judge', async () => {
    const result = await drive({ mode: 'record', answer, note: FALSE_CREDIT });
    expect(JSON.parse(result.packets[0]!).packet.conversation).toBeUndefined();
  });
  it('reads notes only: prose files, the added lines of a patch, never code', () => {
    expect(noteText('Write', { file_path: 'notes/a.md', content: 'x' })).toBe('x');
    expect(noteText('Edit', { file_path: 'a.txt', new_string: 'y' })).toBe('y');
    expect(noteText('Write', { file_path: 'a.ts', content: 'x' })).toBeNull();
    expect(noteText('apply_patch', { input: '*** Begin Patch\n*** Update File: a.md\n@@\n-old\n+new\n*** End Patch' })).toBe('new');
    expect(noteText('apply_patch', { input: '*** Begin Patch\n*** Update File: a.ts\n@@\n+new\n*** End Patch' })).toBeNull();
    // A prose file in the same patch does not bring the code file's added lines with it.
    expect(noteText('apply_patch', { input: `*** Begin Patch\n*** Add File: a.md\n+The build is complete.\n*** Update File: a.ts\n@@\n+// ${FALSE_CREDIT}\n*** End Patch` }))
      .toBe('The build is complete.');
    expect(noteText('apply_patch', { input: '*** Begin Patch\n*** Update File: a.ts\n*** Move to: b.md\n@@\n+moved\n*** Delete File: c.md\n*** End Patch' })).toBe('moved');
  });
});

describe('imported records resolve, and prove less than a live turn', () => {
  const date = new Date(1789000000000).toISOString().slice(0, 10);
  const slack = { account: 'echo:slack', id: 'slack:COWN:123.001', from: 'slack:U123ABC', text: 'Dana says the code is GREEN-3.', conversation: 'Slack channel COWN' };
  const telegram = { account: 'echo:telegram', id: 'telegram:52075:84421', from: 'telegram:7654321', text: 'run it on the mini', conversation: 'Telegram topic 52075' };
  it('a Slack marker resolves to the imported row as identity-only', async () => {
    const result = await drive({ mode: 'record', answer: KEPT, judge: 'pass', imported: slack, note: `Dana: "the code is GREEN-3" [source: slack COWN/123.001 ${date}]` });
    expect(result.rows).toMatchObject([{ verdict: 'pass' }]);
    expect(JSON.parse(result.packets[0]!).packet.markers[0].record).toMatchObject({ sender: 'slack:U123ABC', strength: 'identity-only' });
  });
  it('a Telegram row imported from 1.x resolves by its 1.x marker, and its operator reads as the operator', async () => {
    const result = await drive({ mode: 'record', answer: KEPT, judge: 'pass', imported: telegram, note: `Sam: "run it on the mini" [source: telegram 52075/84421 ${date}]` });
    expect(JSON.parse(result.packets[0]!).packet.markers[0].record).toMatchObject({ sender: 'the operator', strength: 'identity-only' });
  });
  it('words not in the imported row are refused by code, with no model call', async () => {
    const result = await drive({ mode: 'enforce', answer: KEPT, imported: slack, note: `Dana: "never ship on Friday" [source: slack COWN/123.001 ${date}]` });
    expect(result.judged).toBe(0); expect(result.rows).toMatchObject([{ verdict: 'refuse', findings: [{ reason: 'quote-not-in-record' }] }]);
  });
  it('a live turn resolves by its journal id and as verified', async () => {
    const result = await drive({ mode: 'record', answer: KEPT, judge: 'pass', note: `Sam: "Where should builds run?" [source: telegram 7654321/1 ${new Date(1790000000000).toISOString().slice(0, 10)}]` });
    expect(JSON.parse(result.packets[0]!).packet.markers[0]).toMatchObject({ record: { strength: 'verified' } });
  });
});

describe('the trail', () => {
  it('counts what passed unchecked and why, so the timeout rate is a number', () => {
    expect(attributionSummary([{ verdict: 'pass', latencyMs: 100, surface: 'send' }, { verdict: 'unchecked', cause: 'judge failed', latencyMs: 45000, surface: 'send' }, { verdict: 'refuse', latencyMs: 0, surface: 'write' }]))
      .toMatchObject({ checks: 3, bySurface: { send: 2, write: 1 }, uncheckedBy: { 'judge failed': 1 } });
  });
  const row = (at: number, span: string, verdict: string, ref?: string) => ({ at, id: `t${at}`, surface: 'write', mode: 'record', verdict, spans: [{ span, ...(ref ? { ref } : {}) }], findings: [] });
  it('reads every wording of a claim back, oldest first, by words or by ref', () => {
    const rows = [row(3000, 'Sam\'s standing rule: no laptop', 'refuse'), row(1000, 'Sam corrected me about the laptop', 'pass', 'telegram 1/2'), row(2000, 'an unrelated line', 'pass')];
    expect(attributionTrace(rows, 'laptop').map(item => item.at)).toEqual([new Date(1000).toISOString(), new Date(3000).toISOString()]);
    expect(attributionTrace(rows, 'telegram 1/2')).toHaveLength(1);
  });
});

describe('the real hook asks the real checkpoint (a note is written or refused before the file changes)', () => {
  const run = async (note: (call: string, text: string) => Promise<string | null>, path: string, content: string) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'attribution-hook-'))); roots.push(root);
    const ws = join(root, 'ws'), state = join(root, 'state'), tmp = join(root, 'tmp');
    for (const dir of [ws, state, tmp]) mkdirSync(dir);
    const asked: string[] = [];
    const gate = await createAdmissionGate({ append: () => {}, stopped: () => false, now: () => 5, note: async (call: string, text: string) => { asked.push(text); return note(call, text); },
      effects: { admit: () => ({ admitted: false, reason: 'unused' }), observed: () => {} } });
    try {
      gate.open('claim-a', { framework: 'claude-code', allowance: 2, edge: { id: 'session-work-edge:op:1', child: 'session-work-x' } });
      writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp, maxCalls: 50, maxWriteBytes: 1048576, operations: [], gate: gate.base('claim-a') }));
      const child = spawn(process.execPath, [join(__dirname, 'tool-admission-hook.mjs'), 'pre', state], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      child.stdout.on('data', chunk => { stdout += String(chunk); });
      child.stdin.end(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(ws, path), content }, tool_use_id: 'toolu_note' }));
      const status = await new Promise<number | null>(resolve => child.on('close', resolve));
      return { asked, status, denied: /"permissionDecision":"deny"/u.test(stdout) || status === 2, stdout, wrote: existsSync(join(ws, path)) };
    } finally { await gate.stop(); }
  };
  it('refuses a false credit in a note and hands back the way through', async () => {
    const result = await run(async () => 'Rule 121: refused. say source unknown', 'notes.md', FALSE_CREDIT);
    expect(result.asked).toEqual([FALSE_CREDIT]); expect(result.denied).toBe(true); expect(result.stdout).toContain('Rule 121');
  });
  it('clears a note the check clears', async () => {
    const result = await run(async () => null, 'notes.md', KEPT); expect(result.asked).toEqual([KEPT]); expect(result.denied).toBe(false);
  });
  it('a failing check lets the note through', async () => {
    const result = await run(async () => { throw Error('down'); }, 'notes.md', FALSE_CREDIT); expect(result.denied).toBe(false);
  });
  it('never asks about code', async () => {
    const result = await run(async () => 'refused', 'a.ts', FALSE_CREDIT); expect(result.asked).toEqual([]); expect(result.denied).toBe(false);
  });
});
