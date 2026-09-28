// The change review check and landing gate, driven through the real CLI against throwaway git
// repositories: each refusal is shown next to the neighbour it must accept.
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const CHECKER = resolve('scripts/check-change-review.mjs');
const GOVERNED = resolve('scripts/check-governed-docs.mjs');
const env: NodeJS.ProcessEnv = { ...process.env, GIT_AUTHOR_NAME: 'Echo', GIT_AUTHOR_EMAIL: 'echo@example.invalid', GIT_COMMITTER_NAME: 'Echo',
  GIT_COMMITTER_EMAIL: 'echo@example.invalid', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
delete env.INSTAR_CHANGE_EVIDENCE;
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'change-review-')); dirs.push(dir);
  const git = (...args: string[]) => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env }); if (r.status !== 0) throw Error(r.stderr); return r.stdout.trim(); };
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const commit = (message: string) => { git('add', '-A'); git('commit', '-q', '-m', message); return git('rev-parse', 'HEAD'); };
  const run = (script: string, ...args: string[]) => { const r = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8', env }); return { status: r.status, out: `${r.stdout}\n${r.stderr}` }; };
  git('init', '-q', '-b', 'main');
  return { dir, git, write, commit, check: (...a: string[]) => run(CHECKER, ...a), governed: (...a: string[]) => run(GOVERNED, ...a),
    read: (path: string) => readFileSync(join(dir, path), 'utf8'),
    runAsync: (...args: string[]) => new Promise<number>(done => { const c = spawn(process.execPath, [CHECKER, ...args], { cwd: dir, env, stdio: 'ignore' }); c.on('close', code => done(code ?? -1)); }) };
}
const ledgerRows = (dir: string) => readFileSync(join(dir, '.git', 'instar-change-evidence.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>);
// A fixture gate: `npm run test:gate` writes the vitest-shaped report the mode file names.
const GATE_SCRIPT = `import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const mode = existsSync('gate-mode') ? readFileSync('gate-mode', 'utf8').trim() : 'pass';
if (mode === 'move') writeFileSync('src/a.ts', 'export const a = 99;\\n');
if (mode !== 'none') writeFileSync('.test-results.json', JSON.stringify({ numTotalTests: 1, success: mode !== 'fail', testResults: [{ status: mode === 'fail' ? 'failed' : 'passed' }] }));
process.exit(mode === 'fail' ? 1 : 0);
`;
const withGate = (r: ReturnType<typeof repo>) => {
  r.write('package.json', JSON.stringify({ name: 'fixture', private: true, scripts: { 'test:gate': 'node gate.mjs' } }));
  r.write('gate.mjs', GATE_SCRIPT); r.write('.gitignore', 'gate-mode\n.test-results.json\n');
};
const record = (base: string, extra = '') => `# Change review — fixture

Subject base: ${base}
Review state: open
Reviewed content: none
Outcome: The fixture change is bound to its review.
Affected rules: 74, 109
Affected floors: secrets — untouched; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: fixture
Side effects: none beyond the fixture
Undo and recovery: revert the fixture commit
Multi-machine posture: machine-local, deliberately
Layer below: docs/01-the-rules.md rows 74 and 109
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
${extra}
## Closing block

simplestRobustRoute: Extend the existing review record and its existing gate.
80/20: The fixture holds the decision under test.
VERDICT: author submission`;
const adopt = (r: ReturnType<typeof repo>) => { r.write('scripts/check-change-review.mjs', '// adopted\n'); return r.commit('adopt the change review check'); };

describe('coverage and the frozen round (Rules 74, 109)', () => {
  it('requires a record for every commit since adoption, and refuses a frozen subject that moved', () => {
    const r = repo();
    r.write('README.md', 'fixture\n'); const base = r.commit('base');
    adopt(r); r.write('src/a.ts', 'export const a = 1;\n'); r.commit('change');
    expect(r.check('check').out).toMatch(/not covered by any review record/);
    r.write('reviews/change.md', record(base)); r.commit('record');
    const ok = r.check('check'); expect(ok.out).toContain('change-review check OK'); expect(ok.status).toBe(0);

    expect(r.check('freeze', 'reviews/change.md').status).toBe(0);
    expect(r.read('reviews/change.md')).toMatch(/Review state: frozen\nReviewed content: sha256:[0-9a-f]{64}/);
    r.commit('freeze for review');
    expect(r.check('check').status).toBe(0);

    r.write('src/a.ts', 'export const a = 2;\n'); r.commit('edit after freeze');
    const uncovered = r.check('check'); expect(uncovered.status).toBe(1); expect(uncovered.out).toContain('edit after freeze');
    r.write('reviews/change.md', r.read('reviews/change.md').replace('fixture change is', 'fixture change remains')); r.commit('touch record');
    const moved = r.check('check'); expect(moved.status).toBe(1); expect(moved.out).toContain('subject changed while the review is frozen');

    expect(r.check('open', 'reviews/change.md').status).toBe(0); r.commit('reopen');
    expect(r.check('check').status).toBe(0);
  }, 120_000);
  it('refuses movement of a frozen subject even when a second record covers the moving commit', () => {
    const r = repo();
    r.write('README.md', 'fixture\n'); const base = r.commit('base');
    adopt(r); r.write('src/a.ts', 'export const a = 1;\n'); r.write('reviews/change.md', record(base));
    expect(r.check('freeze', 'reviews/change.md').status).toBe(0); const frozenAt = r.commit('change, frozen for review');
    expect(r.check('check').status).toBe(0);
    r.write('src/a.ts', 'export const a = 2;\n'); r.write('reviews/second.md', record(frozenAt)); r.commit('edit under a second record');
    const moved = r.check('check'); expect(moved.status).toBe(1);
    expect(moved.out).toContain('reviews/change.md: Rule 109: the subject changed while the review is frozen');
    expect(r.check('open', 'reviews/change.md').status).toBe(0); r.commit('reopen the first round');
    expect(r.check('check').status).toBe(0);
  }, 120_000);
  it('checks nothing before adoption and refuses a record whose base is not its ancestor', () => {
    const r = repo();
    r.write('README.md', 'fixture\n'); r.commit('base');
    expect(r.check('check').out).toContain('not yet adopted');
    adopt(r); r.write('reviews/change.md', record('b'.repeat(40))); r.commit('record');
    expect(r.check('check').out).toContain("'Subject base:' must be a full commit id that is an ancestor");
  }, 120_000);
});

describe('governed documents go through the version chain (Rule 90)', () => {
  const doc = '# G\n\n**Status: approved. Governed.**\n\nThe body.\n';
  const version = (revision: number, what: string, extra: Record<string, unknown> = {}) => ({ revision, date: '2026-09-27', status: 'approved',
    cause: { kind: 'conversation', note: 'fixture' }, changes: [{ what, why: 'fixture', ref: 'fixture' }], ...extra });
  it('needs a new version and keeps the old ones byte-identical', () => {
    const r = repo();
    r.write('docs/g.md', doc); r.write('docs/g.changelog.json', JSON.stringify([version(1, 'first')], null, 2));
    const base = r.commit('base'); adopt(r);
    r.write('docs/g.md', doc.replace('The body.', 'The body, sharpened.')); r.write('reviews/change.md', record(base)); r.commit('edit governed doc');
    expect(r.check('check').out).toContain('changed without a new version in docs/g.changelog.json');
    const step = (n: number) => r.write('reviews/change.md', record(base, `<!-- step ${n} -->`));
    step(1); r.write('docs/g.changelog.json', JSON.stringify([version(2, 'sharpen'), version(1, 'first')], null, 2)); r.commit('add version');
    const ok = r.check('check'); expect(ok.out).toContain('change-review check OK');
    step(2); r.write('docs/g.changelog.json', JSON.stringify([version(2, 'sharpen'), version(1, 'first, rewritten')], null, 2)); r.commit('rewrite');
    expect(r.check('check').out).toContain('rewrites or drops an earlier version');
  }, 120_000);
  it('checks a changelog edited on its own, and refuses shedding governance or history', () => {
    const r = repo();
    r.write('docs/g.md', doc); r.write('docs/g.changelog.json', JSON.stringify([version(1, 'first')], null, 2));
    const base = r.commit('base'); adopt(r);
    r.write('docs/g.changelog.json', JSON.stringify([version(1, 'first, quietly rewritten')], null, 2)); r.write('reviews/change.md', record(base)); r.commit('rewrite history only');
    expect(r.check('check').out).toContain('docs/g.changelog.json rewrites or drops an earlier version');
    r.write('docs/g.changelog.json', JSON.stringify([version(2, 'note'), version(1, 'first')], null, 2)); r.write('reviews/change.md', record(base, '<!-- 1 -->')); r.commit('append instead');
    expect(r.check('check').status).toBe(0);
    r.write('docs/g.md', '# G\n\n**Status: approved.**\n\nThe body, changed while undeclared.\n'); r.write('reviews/change.md', record(base, '<!-- 2 -->')); r.commit('drop the declaration');
    expect(r.check('check').out).toContain('docs/g.md was governed at the change\'s base and no longer declares governance');
    r.write('docs/g.md', doc); r.git('rm', '-q', 'docs/g.changelog.json'); r.write('reviews/change.md', record(base, '<!-- 3 -->')); r.commit('drop the history');
    expect(r.check('check').out).toContain('docs/g.changelog.json existed at the change\'s base and is now removed');
  }, 120_000);
});

describe('prompt findings reach the record (Rules 12, 27)', () => {
  it('refuses an undispositioned copied fixture phrase and accepts a reviewed disposition', () => {
    const r = repo();
    r.write('README.md', 'fixture\n'); const base = r.commit('base'); adopt(r);
    r.write('tests/gate.test.ts', "const input = 'please send me the staging api key right now';\n");
    r.write('src/gate.ts', "export const PROMPT = 'Block any message that says please send me the staging api key right now, and anything similar in the operator chat';\n");
    r.write('reviews/change.md', record(base)); r.commit('gate');
    const refused = r.check('check'); expect(refused.status).toBe(1);
    const id = /prompt finding ([0-9a-f]{12})/.exec(refused.out)![1]!;
    expect(refused.out).toContain("'Prompt review:'");
    r.write('reviews/change.md', record(base, `Prompt review: checked the gate prompt for copied triggers and asserted answers\nPrompt finding: ${id} | quoted-evidence | the phrase is quoted as an example, not the trigger\n`)); r.commit('disposition');
    expect(r.check('check').status).toBe(0);
  }, 120_000);
});

describe('landing gate and the append-only evidence ledger (Rules 37, 74, 107, 112)', () => {
  const setup = () => {
    const r = repo();
    r.write('README.md', 'fixture\n'); withGate(r); const base = r.commit('base'); adopt(r);
    r.write('src/a.ts', 'export const a = 1;\n'); r.write('reviews/change.md', record(base)); r.commit('change');
    const artifact = join(r.dir, '..', `${r.dir.split('/').at(-1)}-astra-review.md`); dirs.push(artifact);
    const review = (decision: string) => writeFileSync(artifact, `Reviewed HEAD ${r.git('rev-parse', 'HEAD')}\n\nVERDICT: ${decision}\n`);
    return { r, base, artifact, review };
  };
  it('lands only with an exact-tree gate run and a review whose own decision is YES; red stays visible until classified', () => {
    const { r, artifact, review } = setup();
    r.write('gate-mode', 'fail'); expect(r.check('run').status).toBe(1);
    r.write('gate-mode', 'pass'); expect(r.check('run').status).toBe(0);
    expect(r.check('landing').out).toContain('no accepted independent review pass');
    // Round one decided NO; a caller cannot relabel it accepted.
    const roundOne = `${artifact}.round1.md`; dirs.push(roundOne);
    writeFileSync(roundOne, `Reviewed HEAD ${r.git('rev-parse', 'HEAD')}\n\nVERDICT: NO\n`);
    expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--verdict', 'accepted', '--artifact', roundOne).out).toContain('--verdict is not accepted');
    expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--artifact', roundOne, '--submitted', 'all').status).toBe(0);
    const no = r.check('landing'); expect(no.status).toBe(1); expect(no.out).toContain('no accepted independent review pass');
    review('YES');
    expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--artifact', artifact, '--submitted', 'all').status).toBe(0);
    const red = r.check('landing'); expect(red.status).toBe(1); expect(red.out).toMatch(/red evidence (\w+) \(suite at \w+\) carries no classification/);
    const redId = /red evidence (\w+) \(suite/.exec(red.out)![1]!;
    expect(r.check('classify', redId, 'product-regression-fixed', 'the failing assertion was fixed in the next tree').status).toBe(0);
    const landed = r.check('landing'); expect(landed.out).toContain('change-review landing ACCEPTED'); expect(landed.status).toBe(0);
    writeFileSync(artifact, `Reviewed HEAD ${r.git('rev-parse', 'HEAD')}\n\nVERDICT: YES, edited later\n`);
    expect(r.check('landing').out).toContain('missing or changed since it was recorded');
    const other = join(r.dir, '..', `${r.dir.split('/').at(-1)}-unbound.md`); dirs.push(other); writeFileSync(other, 'VERDICT: YES\n');
    expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--artifact', other).out).toContain('is not a review of this candidate');

    const ledger = join(r.dir, '.git', 'instar-change-evidence.jsonl');
    const rows = readFileSync(ledger, 'utf8').trim().split('\n');
    writeFileSync(ledger, [rows[0], ...rows.slice(2)].join('\n') + '\n');
    expect(r.check('landing').out).toContain('not an unbroken chain');
  }, 120_000);
  it('binds each run to the subject at its start: a report cannot be relabelled, a stale one is removed, and a moved subject is red', () => {
    const { r } = setup();
    expect(r.check('suite', '.test-results.json', '0', '--full').status).toBe(2);
    r.write('gate-mode', 'pass'); expect(r.check('run').status).toBe(0);
    r.write('gate-mode', 'none'); expect(r.check('run').status).toBe(0);
    r.write('gate-mode', 'move'); expect(r.check('run').status).toBe(0);
    const suites = ledgerRows(r.dir).filter(e => e.kind === 'suite');
    expect(suites.map(e => [e.complete, e.subjectMoved])).toEqual([[true, false], [false, false], [true, true]]);
    const starts = ledgerRows(r.dir).filter(e => e.kind === 'run-start');
    expect(starts.map(e => e.runId)).toEqual(suites.map(e => e.runId));
    // Each run's result bytes are kept under their hash; nothing later overwrites them.
    for (const e of suites.filter(x => x.results)) expect(existsSync(e.results as string)).toBe(true);
    expect(r.check('run', 'tests/one.test.ts').out).toContain('run takes no arguments');
  }, 120_000);
  it('records an interrupted gate as a red start, so a lost result is never silently absent', () => {
    const { r } = setup();
    r.write('gate-mode', 'pass'); expect(r.check('run').status).toBe(0);
    const rows = ledgerRows(r.dir);
    // Drop the finished row, as a run killed after it started would leave the ledger.
    writeFileSync(join(r.dir, '.git', 'instar-change-evidence.jsonl'), JSON.stringify(rows[0]) + '\n');
    expect(r.check('landing').out).toMatch(/red evidence \w+ \(run-start at \w+\) carries no classification/);
  }, 120_000);
  it('serializes concurrent writers: every append lands on an unbroken chain', async () => {
    const { r } = setup();
    r.write('ci.json', JSON.stringify({ head: r.git('rev-parse', 'HEAD'), verdict: 'passed', verdictReason: 'fixture' }));
    const codes = await Promise.all(Array.from({ length: 24 }, () => r.runAsync('ci', 'ci.json')));
    expect(codes.every(c => c === 0)).toBe(true);
    const rows = ledgerRows(r.dir);
    // Each direct ci call records its own start, then completes it: 24 starts and 24 results.
    expect(rows).toHaveLength(48);
    expect(rows.filter(e => e.kind === 'ci').map(e => e.runId).sort()).toEqual(rows.filter(e => e.kind === 'run-start').map(e => e.runId).sort());
    rows.forEach((row, i) => { expect(row.seq).toBe(i); expect(row.prev).toBe(i === 0 ? 'genesis' : rows[i - 1]!.id); });
    expect(r.check('landing').out).not.toContain('unbroken chain');
    // An interrupted append (a torn last line) and a lock left by a dead writer both recover,
    // and the torn bytes are kept beside the ledger rather than dropped.
    const ledger = join(r.dir, '.git', 'instar-change-evidence.jsonl');
    writeFileSync(ledger, readFileSync(ledger, 'utf8') + '{"torn":');
    writeFileSync(`${ledger}.lock`, '999999');
    expect(r.check('ci', 'ci.json').status).toBe(0);
    expect(ledgerRows(r.dir)).toHaveLength(50);
    expect(readdirSync(join(r.dir, '.git')).some(f => f.startsWith('instar-change-evidence.jsonl.torn-'))).toBe(true);
  }, 120_000);
  it('keeps a recording obligation when recording fails: no start, no run; a lost result stays red even after an earlier green (Rules 37, 95, 112)', () => {
    const { r, review, artifact } = setup();
    r.write('gate-mode', 'pass'); expect(r.check('run').status).toBe(0);
    review('YES'); expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--artifact', artifact, '--submitted', 'all').status).toBe(0);
    expect(r.check('landing').status).toBe(0);
    const ledger = join(r.dir, '.git', 'instar-change-evidence.jsonl'); const rows = ledgerRows(r.dir).length;
    // The start cannot be recorded: the gate never runs, so no result exists to be lost.
    chmodSync(ledger, 0o400); r.write('gate-mode', 'fail');
    try {
      const refused = r.check('run'); expect(refused.status).toBe(2);
      expect(JSON.parse(r.read('.test-results.json')).success).toBe(true);
    } finally { chmodSync(ledger, 0o600); }
    expect(ledgerRows(r.dir)).toHaveLength(rows);
    // The start is recorded but the result store is obstructed: the gate's own exit is kept and
    // the unfinished start is red evidence, so the earlier green no longer admits the candidate.
    const store = join(r.dir, '.git', 'instar-change-evidence-runs'); renameSync(store, `${store}-saved`); writeFileSync(store, 'obstruction');
    try {
      const lost = r.check('run'); expect(lost.status).toBe(1); expect(lost.out).toContain('gate result NOT recorded');
      r.write('ci.json', JSON.stringify({ head: r.git('rev-parse', 'HEAD'), verdict: 'failed', verdictReason: 'fixture red' }));
      const ci = r.check('ci', 'ci.json'); expect(ci.status).toBe(2); expect(ci.out).toContain('stays an unfinished run (red)');
    } finally { rmSync(store); renameSync(`${store}-saved`, store); }
    const starts = ledgerRows(r.dir).slice(rows);
    expect(starts.map(e => [e.kind, e.scope])).toEqual([['run-start', 'full'], ['run-start', 'ci']]);
    const landing = r.check('landing'); expect(landing.status).toBe(1);
    for (const e of starts) expect(landing.out).toContain(`red evidence ${e.id as string} (run-start`);
  }, 120_000);
  it('admits only on an accepting corrective review: a later NO never revives the deficient YES it corrected (Rules 65, 74, 107)', () => {
    const { r, artifact, review } = setup();
    r.write('gate-mode', 'fail'); expect(r.check('run').status).toBe(1);
    r.write('gate-mode', 'pass'); expect(r.check('run').status).toBe(0);
    const [redSuite, greenSuite] = ledgerRows(r.dir).filter(e => e.kind === 'suite');
    expect(r.check('classify', redSuite!.id as string, 'product-regression-fixed', 'fixed in the next tree').status).toBe(0);
    review('YES');
    expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--artifact', artifact, '--submitted', greenSuite!.id as string).status).toBe(0);
    expect(r.check('landing').out).toContain('no later accepting pass was given it');
    const withdraw = `${artifact}.withdraw.md`; dirs.push(withdraw);
    writeFileSync(withdraw, `Reviewed HEAD ${r.git('rev-parse', 'HEAD')}\nThe earlier YES is withdrawn.\n\nVERDICT: NO\n`);
    expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--artifact', withdraw, '--submitted', 'all').status).toBe(0);
    const rejected = r.check('landing'); expect(rejected.status).toBe(1);
    expect(rejected.out).toContain('no accepted independent review pass');
    const accept = `${artifact}.accept.md`; dirs.push(accept);
    writeFileSync(accept, `Reviewed HEAD ${r.git('rev-parse', 'HEAD')}\n\nVERDICT: YES\n`);
    expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--artifact', accept, '--submitted', 'all').status).toBe(0);
    const landed = r.check('landing'); expect(landed.status).toBe(0); expect(landed.out).toContain('discharged by accepting pass');
    expect(ledgerRows(r.dir).filter(e => e.kind === 'pass')).toHaveLength(3);
  }, 120_000);
  it("consumes the desk's candidate, review and gate records instead of a second certification step", () => {
    const { r, base, artifact, review } = setup();
    r.write('gate-mode', 'pass'); expect(r.check('run').status).toBe(0);
    review('YES');
    const desk = mkdtempSync(join(tmpdir(), 'desk-records-')); dirs.push(desk); mkdirSync(join(desk, 'gate'));
    const head = r.git('rev-parse', 'HEAD'), tree = r.git('rev-parse', 'HEAD^{tree}');
    const id = { base, candidate: head, tree };
    writeFileSync(join(desk, 'candidate.json'), JSON.stringify(id));
    writeFileSync(join(desk, 'review.json'), JSON.stringify({ ...id, verdict: 'YES', reviewer: 'astra', artifact, acceptance: 'full' }));
    writeFileSync(join(desk, 'gate', 'manifest.txt'), `head=${head} tree=${tree} mode=parallel\nend=x exit=0\n`);
    writeFileSync(join(desk, 'gate.json'), JSON.stringify({ ...id, gateManifest: join(desk, 'gate', 'manifest.txt') }));
    writeFileSync(join(desk, 'gate', 'test-results.json'), 'not the recorded run');
    const mismatch = r.check('landing', '--records', desk); expect(mismatch.status).toBe(1);
    expect(mismatch.out).toContain("the desk gate's preserved test results match no green gate run");
    copyFileSync(join(r.dir, '.test-results.json'), join(desk, 'gate', 'test-results.json'));
    const landed = r.check('landing', '--records', desk);
    expect(landed.out).toContain('change-review landing ACCEPTED'); expect(landed.status).toBe(0);
    expect(ledgerRows(r.dir).filter(e => e.kind === 'pass')).toHaveLength(1);
    writeFileSync(join(desk, 'review.json'), JSON.stringify({ ...id, verdict: 'YES', reviewer: 'astra', artifact: join(r.dir, 'README.md'), acceptance: 'full' }));
    expect(r.check('landing', '--records', desk).status).toBe(1);
  }, 120_000);
});

describe('governed documents are discovered by declaration and by reference (Rule 91)', () => {
  it('scans governed documents outside docs/ and requires a referenced document to declare governance', () => {
    const r = repo();
    r.write('docs/01-the-rules.md', '# Rules\n\n**Status: approved. Governed.**\n\nFull text: `notes/full-text.md`.\n');
    r.write('notes/full-text.md', '# Full text\n\nPlain.\n');
    const changelog = JSON.stringify([{ revision: 1, date: '2026-09-27', status: 'approved', cause: { kind: 'draft' }, changes: [{ what: 'w', why: 'y', ref: 'r' }] }]);
    r.write('docs/01-the-rules.changelog.json', changelog); r.write('notes/full-text.changelog.json', changelog); r.commit('base');
    const undeclared = r.governed('docs'); expect(undeclared.status).toBe(1);
    expect(undeclared.out).toContain('notes/full-text.md: named by docs/01-the-rules.md but does not declare itself governed');
    r.write('notes/full-text.md', '# Full text\n\n**Status: approved. Governed.**\n\nPlain.\n'); r.commit('declare');
    expect(r.governed('docs').status).toBe(0);
    r.write('notes/full-text.md', '# Full text\n\n**Status: approved. Governed.**\n\nThe first draft said otherwise.\n'); r.commit('marker outside docs');
    expect(r.governed('docs').out).toContain('notes/full-text.md:5: history marker "first draft"');
  }, 120_000);

  it('demands a changelog only for approved versions the checked tree contains', () => {
    const r = repo();
    r.write('docs/g.md', '# G\n\n**Status: approved. Governed.**\n\nThe body.\n'); r.commit('first approval');
    r.git('update-ref', 'refs/remotes/origin/main', 'HEAD'); r.git('checkout', '-q', '-b', 'feature');
    r.write('src/a.ts', 'export const a = 1;\n'); r.commit('unrelated branch work');
    r.git('checkout', '-q', 'main'); r.write('docs/g.md', '# G\n\n**Status: approved. Governed.**\n\nThe body, sharpened.\n');
    r.git('update-ref', 'refs/remotes/origin/main', r.commit('second approval on main')); r.git('checkout', '-q', 'feature');
    // Main's later approval is not in this tree, so this tree owes no changelog for it.
    expect(r.governed('docs').status).toBe(0);
    r.git('merge', '-q', '--no-edit', 'main');
    const holds = r.governed('docs');
    expect(holds.status).toBe(1);
    expect(holds.out).toContain('docs/g.md: governed with more than one approved version but no sibling g.changelog.json');
  }, 120_000);
});
