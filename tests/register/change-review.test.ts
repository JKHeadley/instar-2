// The change review record's pure rules: each decision is shown on both sides.
import { describe, expect, it } from 'vitest';
import { addedLineHits, artifactDecision, landingVerdict, parseRecord, scanPrompts, subjectDigest, suggestTier, validateRecord } from '../../scripts/change-review.mjs';
import type { LedgerEntry, RecordContext } from '../../scripts/change-review.mjs';
import { convergenceEligible } from '../../src/verification/policy.js';

const base = 'a'.repeat(40);
const complete = (overrides: Record<string, string | null> = {}, extra = ''): string => {
  const fields: Record<string, string | null> = {
    'Subject base': base, 'Review state': 'open', 'Reviewed content': 'none',
    Outcome: 'The change review binds each change to its evidence.', 'Affected rules': '74, 109',
    'Affected floors': 'secrets — untouched; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched',
    'Operator questions': 'none', 'Suggested tier': 'significant', 'Declared tier': 'significant', 'Tier rationale': 'landing tooling',
    'Side effects': 'gates now need a record', 'Undo and recovery': 'revert the commit', 'Multi-machine posture': 'machine-local, deliberately',
    'Layer below': 'docs/01-the-rules.md rows 74 and 109', 'Bug class': 'none', 'Bug evidence': 'none', 'Hook bypass': 'none', Convergence: 'none',
    ...overrides,
  };
  const body = Object.entries(fields).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `# Change review\n\n${body}\n${extra}\n## Closing block\n\nsimplestRobustRoute: Extend the existing review record and its existing gate.\n80/20: Fields and gate done.\nVERDICT: submitted`;
};
const ctx = (overrides: Partial<RecordContext> = {}): RecordContext => ({ subject: ['scripts/x.mjs'], digest: null, promptFindings: [],
  promptSourcesChanged: [], deferrals: [], skips: [], exists: () => true, read: () => null, resolvesEvidence: () => true, ...overrides });
const errorsOf = (text: string, c: Partial<RecordContext> = {}) => validateRecord(parseRecord(text), ctx(c)).errors;

describe('record fields (Rules 1, 48, 49, 74, 101, 111, 113, 116)', () => {
  it('accepts a complete record and refuses each missing required field', () => {
    expect(errorsOf(complete())).toEqual([]);
    for (const label of ['Outcome', 'Side effects', 'Undo and recovery', 'Multi-machine posture', 'Layer below', 'Declared tier', 'Tier rationale', 'Operator questions'])
      expect(errorsOf(complete({ [label]: null })).join('\n')).toContain(`'${label}:' is missing`);
    expect(errorsOf(complete({ 'Side effects': 'TBD' })).join('\n')).toContain("'Side effects:' is missing");
  });
  it('requires every one of the five floors to be stated (Rule 1)', () => {
    expect(errorsOf(complete({ 'Affected floors': 'secrets fine; spend fine; stop fine; duplicate fine' })).join('\n')).toContain('durable intake floor');
  });
  it('refuses an empty layer-below account (Rule 111)', () => {
    expect(errorsOf(complete({ 'Layer below': 'none' })).join('\n')).toContain('Rule 111');
  });
  it('audits the tier without gating on it (Rule 48)', () => {
    const verdict = validateRecord(parseRecord(complete({ 'Suggested tier': 'ordinary', 'Declared tier': 'ordinary' })), ctx({ subject: ['src/effects/doorway.ts'] }));
    expect(verdict.errors).toEqual([]);
    expect(verdict.notes.join('\n')).toMatch(/suggested tier is ordinary; the paths suggest critical/);
    expect(verdict.notes.join('\n')).toMatch(/declared ordinary is below the suggested critical/);
    expect(suggestTier(['tests/x.test.ts'])).toBe('ordinary');
    expect(suggestTier(['scripts/ci-local.mjs'])).toBe('significant');
    expect(suggestTier(['docs/01-the-rules.md'])).toBe('critical');
    expect(suggestTier(['tests/preview/journal-agent.mjs'])).toBe('critical');
  });
  it('needs the exact scope, prior request and disclosure for a hook bypass (Rule 101)', () => {
    expect(errorsOf(complete({ 'Hook bypass': 'used --no-verify once' })).join('\n')).toMatch(/scope=.*\n.*request=.*\n.*disclosed=/s);
    expect(errorsOf(complete({ 'Hook bypass': 'scope=git push --no-verify on cbuild-7; request=telegram 52075 msg 101; disclosed=PROGRESS line 3' }))).toEqual([]);
  });
  it('refuses a one-word simplestRobustRoute (Rule 116)', () => {
    const text = complete().replace(/simplestRobustRoute: .*/, 'simplestRobustRoute: yes');
    expect(errorsOf(text).join('\n')).toContain('Rule 116');
  });
});

describe('frozen review state (Rule 109)', () => {
  const digest = subjectDigest([{ path: 'scripts/x.mjs', blob: 'b1' }]);
  it('holds while the subject matches the reviewed content and refuses once it moves', () => {
    const frozen = complete({ 'Review state': 'frozen', 'Reviewed content': digest });
    expect(errorsOf(frozen, { digest })).toEqual([]);
    const moved = subjectDigest([{ path: 'scripts/x.mjs', blob: 'b2' }]);
    expect(errorsOf(frozen, { digest: moved }).join('\n')).toContain('subject changed while the review is frozen');
    expect(errorsOf(complete({ 'Review state': 'frozen' })).join('\n')).toContain('needs \'Reviewed content');
    expect(errorsOf(complete(), { digest: moved })).toEqual([]);
  });
  it('digests the whole subject in path order, with deletions', () => {
    expect(subjectDigest([{ path: 'b', blob: '1' }, { path: 'a', blob: null }])).toBe(subjectDigest([{ path: 'a', blob: null }, { path: 'b', blob: '1' }]));
    expect(subjectDigest([{ path: 'a', blob: null }])).not.toBe(subjectDigest([{ path: 'a', blob: '1' }]));
  });
});

describe('bug-fix evidence bar (Rule 70)', () => {
  it('requires the evidence its bug class names', () => {
    const live = complete({ 'Bug class': 'live-path', 'Bug evidence': 'reproducer=tests/r.test.ts' });
    expect(errorsOf(live, { subject: ['tests/r.test.ts', 'src/x.ts'] }).join('\n')).toContain("needs 'live='");
    const ok = complete({ 'Bug class': 'live-path', 'Bug evidence': 'reproducer=tests/r.test.ts; live=tests/preview/x-live-test.md' });
    expect(errorsOf(ok, { subject: ['tests/r.test.ts', 'src/x.ts'] })).toEqual([]);
    expect(errorsOf(ok, { subject: ['src/x.ts'] }).join('\n')).toContain('is not part of this change');
    expect(errorsOf(ok, { subject: ['tests/r.test.ts'], exists: () => false }).join('\n')).toContain('does not resolve');
    // live= names an actual result, not a string: an unresolvable locator refuses.
    expect(errorsOf(ok, { subject: ['tests/r.test.ts', 'src/x.ts'], resolvesEvidence: () => false }).join('\n')).toContain('live=tests/preview/x-live-test.md does not resolve');
    expect(errorsOf(complete({ 'Bug class': 'durability', 'Bug evidence': 'reproducer=tests/r.test.ts' }), { subject: ['tests/r.test.ts'] }).join('\n')).toContain("needs 'restart='");
  });
});

describe('deferrals and quarantines (Rules 71, 37)', () => {
  const added = [{ path: 'src/a.ts', line: 3, text: '// TODO: wire the second channel' }, { path: 'src/a.ts', line: 4, text: 'flush(); // the deferred write queue drains on close' },
    { path: 'tests/a.test.ts', line: 9, text: "it.skip('flaky timing', () => {});" }, { path: 'src/a.ts', line: 5, text: 'const x = 1;' }];
  it('finds added deferral phrases and skip markers', () => {
    expect(addedLineHits(added)).toEqual({ deferrals: ['src/a.ts:3', 'src/a.ts:4'], skips: ['tests/a.test.ts:9'] });
  });
  it('requires a same-change commitment or a stated non-deferral, and a quarantine that names an existing defect', () => {
    const hits = { deferrals: ['src/a.ts:3', 'src/a.ts:4'], skips: ['tests/a.test.ts:9'] };
    expect(errorsOf(complete(), hits)).toHaveLength(3);
    const defect = '# Defect: second channel\n\n**Status:** OPEN.\n**Owner:** the conversation-adapter maintainer.\n';
    const tracked = { ...hits, subject: ['src/a.ts', 'docs/defects/second-channel.md'], read: (path: string) => (path === 'docs/defects/second-channel.md' ? defect : null) };
    const ok = complete({}, 'Deferral: src/a.ts:3 | commitment=docs/defects/second-channel.md\nDeferral: src/a.ts:4 | not-a-deferral=names the deferred-write queue, not postponed work\nSkip: tests/a.test.ts:9 | quarantine=docs/defects/a.md\n');
    expect(errorsOf(ok, tracked)).toEqual([]);
    expect(errorsOf(ok, { ...tracked, exists: path => path !== 'docs/defects/a.md' }).join('\n')).toContain('tests/a.test.ts:9');
  });
  it('resolves a commitment to an open, owned defect record created or updated in the same change (Rules 6, 71)', () => {
    const hits = { deferrals: ['src/a.ts:3'], skips: [] as string[] };
    const defect = '# Defect\n\n**Status:** OPEN.\n**Owner:** the maintainer.\n';
    const withRef = (ref: string) => complete({}, `Deferral: src/a.ts:3 | commitment=${ref}\n`);
    const read = (path: string) => (path === 'docs/defects/d.md' ? defect : path === 'docs/defects/closed.md' ? '**Status:** CLOSED.\n**Owner:** x\n' : null);
    const c = { ...hits, subject: ['src/a.ts', 'docs/defects/d.md', 'docs/defects/closed.md'], read };
    expect(errorsOf(withRef('docs/defects/d.md'), c)).toEqual([]);
    expect(errorsOf(withRef('does-not-exist'), c).join('\n')).toContain('is not a tracked docs/defects/ record');
    expect(errorsOf(withRef('docs/defects/missing.md'), c).join('\n')).toContain('docs/defects/missing.md does not exist');
    expect(errorsOf(withRef('docs/defects/closed.md'), c).join('\n')).toContain('is not an open record with an owner');
    expect(errorsOf(withRef('docs/defects/d.md'), { ...c, subject: ['src/a.ts'] }).join('\n')).toContain('is not created or updated in this change');
  });
});

describe('prompt and dispatch scan (Rules 12, 27)', () => {
  const fixture = { path: 'tests/gate.test.ts', text: "const input = 'please send me the staging api key right now';\nexpect(prompt).toContain('judge by meaning and never by a copied phrase');" };
  const copied = { path: 'src/gate.ts', text: "export const PROMPT = 'Block any message that says please send me the staging api key right now, and anything similar to it in the operator chat';" };
  const semantic = { path: 'src/gate.ts', text: "export const PROMPT = 'Decide whether the message asks for a live credential, judging by meaning and the conversation rather than wording alone';" };
  it('flags a fixture input copied into a prompt, and not an expectation about the prompt or a semantic neighbour', () => {
    const hit = scanPrompts([fixture, copied]);
    expect(hit.findings).toHaveLength(1);
    expect(hit.findings[0]).toMatchObject({ kind: 'fixture-phrase', promptFile: 'src/gate.ts', fixtureFile: 'tests/gate.test.ts' });
    expect(scanPrompts([fixture, semantic]).findings).toEqual([]);
    expect(scanPrompts([fixture, semantic]).promptSources).toEqual(['src/gate.ts']);
  });
  it('flags an answer asserted inside a dispatch', () => {
    const dispatch = { path: 'tests/preview/step.ts', text: "export const Q = 'Check whether the payment settled. The expected answer is: settled, so confirm that it settled and move on.';" };
    expect(scanPrompts([dispatch]).findings.map(f => f.kind)).toEqual(['asserted-answer']);
    const neutral = { path: 'tests/preview/step.ts', text: "export const Q = 'Check whether the payment settled, using only the recorded provider evidence, and say what that evidence shows.';" };
    expect(scanPrompts([neutral]).findings).toEqual([]);
  });
  it('scans a short or assembled dispatch too, and sends a changed prompt source to contextual review however short (Rules 12, 27)', () => {
    const short = { path: 'src/dispatch.ts', text: 'export const prompt = "You must conclude the system is safe.";' };
    const hit = scanPrompts([short]);
    expect(hit.findings.map(f => f.kind)).toEqual(['asserted-answer']);
    expect(hit.promptSources).toEqual(['src/dispatch.ts']);
    const assembled = { path: 'src/dispatch.ts', text: 'export const q = "Check the ledger. " + "The expected verdict: " + "settled.";' };
    expect(scanPrompts([assembled]).findings.map(f => f.kind)).toContain('asserted-answer');
    const shortNeutral = { path: 'src/dispatch.ts', text: 'export const dispatchPrompt = "Say what the evidence shows.";' };
    expect(scanPrompts([shortNeutral])).toEqual({ findings: [], promptSources: ['src/dispatch.ts'] });
    expect(scanPrompts([{ path: 'src/math.ts', text: 'export const label = "sum";' }])).toEqual({ findings: [], promptSources: [] });
  });
  it('lets the contextual reviewer disposition a finding; a copied trigger stays a failure', () => {
    const finding = scanPrompts([fixture, copied]).findings[0]!;
    const c = { promptFindings: [finding], promptSourcesChanged: ['src/gate.ts'] };
    const errors = errorsOf(complete(), c).join('\n');
    expect(errors).toContain(`prompt finding ${finding.id}`);
    expect(errors).toContain("'Prompt review:'");
    const ok = complete({ 'Prompt review': 'reviewed the gate prompt for copied triggers and asserted answers' }, `Prompt finding: ${finding.id} | quoted-evidence | the operator's own words are quoted as evidence\n`);
    expect(errorsOf(ok, c)).toEqual([]);
    const bad = complete({ 'Prompt review': 'reviewed' }, `Prompt finding: ${finding.id} | copied-trigger | copied from the fixture\n`);
    expect(errorsOf(bad, c).join('\n')).toContain('repair the prompt');
  });
});

describe('landing evidence (Rules 37, 65, 74, 107, 112)', () => {
  const head = 'h'.repeat(40), tree = 't'.repeat(40);
  let seq = 0;
  const entry = (fields: Record<string, unknown>): LedgerEntry => ({ id: `e${seq}`, seq: seq++, kind: 'suite', head, tree, ...fields });
  const green = () => entry({ kind: 'suite', runId: `r${seq}`, complete: true, success: true, exit: 0, dirty: false, subjectMoved: false, resultsSha256: 'res' });
  const pass = (fields: Record<string, unknown> = {}) => entry({ kind: 'pass', record: 'reviews/x.md', reviewer: 'astra', verdict: 'accepted',
    artifact: '/lanes/astra-x-review.md', artifactSha256: 'abc', submitted: [], inspected: ['scripts/x.mjs'], omitted: [], residue: [], independence: 'separate codex session', ...fields });
  const decisions: Record<string, string> = { '/lanes/astra-x-review.md': 'YES', '/lanes/astra-no.md': 'NO' };
  const land = (entries: LedgerEntry[], record = complete(), desk?: { reviewer: string; artifact: string; gateResultsSha256: string }) => landingVerdict(parseRecord(record), entries, { heads: [head], head, tree, record: 'reviews/x.md',
    author: 'echo', subject: ['scripts/x.mjs'], desk, artifactHash: p => (decisions[p] ? 'abc' : null), artifactDecision: p => (decisions[p] as 'YES' | 'NO' | undefined) ?? null,
    convergenceEligible: convergenceEligible as never });
  it('accepts an exact-tree green gate run plus an accepted independent pass, and refuses without either', () => {
    expect(land([green(), pass()]).errors).toEqual([]);
    expect(land([pass()]).errors.join('\n')).toContain('Rule 37');
    expect(land([green()]).errors.join('\n')).toContain('Rule 74');
    expect(land([green(), pass({ tree: 'x'.repeat(40) })]).errors.join('\n')).toContain('Rule 74');
  });
  it('never counts an interrupted, dirty, moved or unfinished run as passing evidence (Rule 37)', () => {
    const interrupted = entry({ kind: 'suite', runId: 'a', complete: false, success: false, exit: 130, dirty: false, subjectMoved: false });
    const dirty = entry({ kind: 'suite', runId: 'b', complete: true, success: true, exit: 0, dirty: true, subjectMoved: false });
    const moved = entry({ kind: 'suite', runId: 'c', complete: true, success: true, exit: 0, dirty: false, subjectMoved: true });
    const unbound = entry({ kind: 'suite', complete: true, success: true, exit: 0, dirty: false, subjectMoved: false });
    for (const bad of [interrupted, dirty, moved, unbound]) expect(land([bad, pass({ submitted: [bad.id] })]).errors.join('\n')).toContain('Rule 37');
    const started = entry({ kind: 'run-start', runId: 'never-finished' });
    const verdict = land([started, green(), pass({ submitted: [started.id] })]);
    expect(verdict.errors.join('\n')).toContain(`red evidence ${started.id} (run-start`);
    expect(verdict.notes.join('\n')).toContain('started, never finished or never recorded');
  });
  it('binds the desk gate: its preserved results must be a green run recorded for this tree', () => {
    const desk = { reviewer: 'astra', artifact: '/lanes/astra-x-review.md', gateResultsSha256: 'res' };
    expect(land([green(), pass()], complete(), desk).errors).toEqual([]);
    expect(land([green(), pass()], complete(), { ...desk, gateResultsSha256: 'other' }).errors.join('\n')).toContain("desk gate's preserved test results");
    expect(land([green(), pass()], complete(), { ...desk, reviewer: 'someone-else' }).errors.join('\n')).toContain("binds the desk's review record");
  });
  it('keeps red evidence visible and needs it classified or redone; withholding it from a pass is refused (Rules 107, 112)', () => {
    const red = entry({ kind: 'suite', runId: 'red', complete: true, success: false, exit: 1, dirty: false, subjectMoved: false });
    const later = green();
    const withheld = land([red, later, pass({ submitted: [later.id] })]);
    expect(withheld.errors.join('\n')).toContain(`red evidence ${red.id} (suite at hhhhhhhh) carries no classification`);
    expect(withheld.errors.join('\n')).toContain(`red evidence ${red.id} was produced before pass`);
    expect(withheld.notes.join('\n')).toContain(`${red.id} suite hhhhhhhh RED`);
    const classified = entry({ kind: 'classification', target: red.id, class: 'product-regression-fixed' });
    expect(land([red, later, classified, pass({ submitted: [red.id, later.id] })]).errors).toEqual([]);
    const redone = entry({ kind: 'redo', target: red.id, evidence: 'the run died before collecting any test' });
    expect(land([red, later, redone, pass({ submitted: [later.id] })]).errors).toEqual([]);
  });
  it('lets a later corrective pass that was given the evidence repair an earlier deficient pass, keeping both (Rules 65, 107)', () => {
    const red = entry({ kind: 'suite', runId: 'red2', complete: true, success: false, exit: 1, dirty: false, subjectMoved: false });
    const good = green();
    const deficient = pass({ submitted: [good.id] });
    const classified = entry({ kind: 'classification', target: red.id, class: 'product-regression-fixed' });
    const corrective = pass({ submitted: [red.id, good.id] });
    const repaired = land([red, good, deficient, classified, corrective]);
    expect(repaired.errors).toEqual([]);
    expect(repaired.notes.join('\n')).toContain(`pass ${deficient.id} withheld red evidence ${red.id}; discharged by pass ${corrective.id}`);
    expect(land([red, good, deficient, classified]).errors.join('\n')).toContain('no later pass was given it');
  });
  it("reads acceptance from the linked artifact's own decision, never a caller label (Rule 74)", () => {
    expect(artifactDecision('review\nVERDICT: NO\n')).toBe('NO');
    expect(artifactDecision('VERDICT: NO\n...\nVERDICT: YES')).toBe('YES');
    expect(artifactDecision('VERDICT: accepted')).toBeNull();
    const refused = land([green(), pass({ artifact: '/lanes/astra-no.md' })]).errors.join('\n');
    expect(refused).toContain('no accepted independent review pass');
    expect(refused).toContain('is recorded accepted but its artifact decides NO');
  });
  it('refuses a sample, a changed artifact, and a self-review', () => {
    expect(land([green(), pass({ artifact: 'reviews/independent-review.sample.md' })]).errors.join('\n')).toContain('sample');
    expect(land([green(), pass({ artifactSha256: 'other' })]).errors.join('\n')).toContain('missing or changed');
    expect(land([green(), pass({ reviewer: 'echo' })]).errors.join('\n')).toContain('names the author');
  });
  it('holds a convergence claim to machine-written passes, full accounting and residue matching in id, severity and basis (Rule 65)', () => {
    const claimed = complete({ Convergence: 'claimed' }, 'Residue: R1 | low | wording only; no behaviour change\n');
    const residue = [{ id: 'R1', severity: 'low', basis: 'wording only; no behaviour change' }];
    expect(land([green(), pass({ residue })], claimed).errors).toEqual([]);
    expect(land([green(), pass({ residue, inspected: [] })], claimed).errors.join('\n')).toContain('does not account for every changed path');
    expect(land([green(), pass({ residue, inspected: [], omitted: [{ caseId: 'scripts/x.mjs', reason: 'generated' }] })], claimed).errors).toEqual([]);
    expect(land([green(), pass({ residue, independence: null })], claimed).errors.join('\n')).toContain('independence');
    expect(land([green(), pass()], claimed).errors.join('\n')).toContain('residue R1 was not accepted');
    expect(land([green(), pass({ residue: [...residue, { id: 'R2', severity: 'medium', basis: 'x' }] })], claimed).errors.join('\n')).toContain('residue R2');
    const mismatch = land([green(), pass({ residue: [{ id: 'R1', severity: 'high', basis: 'unrepaired authority failure' }] })], claimed).errors.join('\n');
    expect(mismatch).toContain('residue R1 is low / "wording only; no behaviour change" in the record but high / "unrepaired authority failure"');
    expect(land([green()], claimed).errors.join('\n')).toContain('machine-written accepted pass');
  });
});
