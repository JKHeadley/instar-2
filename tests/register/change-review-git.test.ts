// The change review check and landing gate, driven through the real CLI against throwaway git
// repositories: each refusal is shown next to the neighbour it must accept.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    read: (path: string) => readFileSync(join(dir, path), 'utf8') };
}
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
  it('needs a new version, keeps the old ones byte-identical, and names only real landing commits', () => {
    const r = repo();
    r.write('docs/g.md', doc); r.write('docs/g.changelog.json', JSON.stringify([version(1, 'first')], null, 2));
    const base = r.commit('base'); adopt(r);
    r.write('docs/g.md', doc.replace('The body.', 'The body, sharpened.')); r.write('reviews/change.md', record(base)); r.commit('edit governed doc');
    expect(r.check('check').out).toContain('changed without a new version in docs/g.changelog.json');
    const step = (n: number) => r.write('reviews/change.md', record(base, `<!-- step ${n} -->`));
    step(1); r.write('docs/g.changelog.json', JSON.stringify([version(2, 'sharpen'), version(1, 'first')], null, 2)); r.commit('add version');
    const ok = r.check('check'); expect(ok.out).toContain('change-review check OK');
    step(2); r.write('docs/g.changelog.json', JSON.stringify([version(2, 'sharpen'), version(1, 'first, rewritten')], null, 2)); r.commit('rewrite');
    expect(r.check('check').out).toContain('rewrites an earlier version in place');
    step(3); r.write('docs/g.changelog.json', JSON.stringify([version(2, 'sharpen', { approvedIn: { pr: 1, mergeCommit: 'd'.repeat(40) } }), version(1, 'first')], null, 2)); r.commit('fake landing');
    expect(r.check('check').out).toContain(`names landing commit ${'d'.repeat(40)}`);
    step(4); r.write('docs/g.changelog.json', JSON.stringify([version(2, 'sharpen', { approvedIn: { pr: 1, mergeCommit: base } }), version(1, 'first')], null, 2)); r.commit('real landing');
    expect(r.check('check').status).toBe(0);
    const history = JSON.parse(r.check('history', 'docs/g.md').out.trim()) as { version: string; supersedes: string | null }[];
    expect(history).toHaveLength(2); expect(history[0]!.supersedes).toBe(history[1]!.version);
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
  it('lands only with an exact-tree full suite and an accepted independent pass; red stays visible until classified', () => {
    expect(existsSync(resolve('dist/verification/index.js'))).toBe(true);
    const r = repo();
    r.write('README.md', 'fixture\n'); const base = r.commit('base'); adopt(r);
    r.write('src/a.ts', 'export const a = 1;\n'); r.write('reviews/change.md', record(base)); r.commit('change');
    const report = (success: boolean) => { r.write('.results.json', JSON.stringify({ numTotalTests: 1, success, testResults: [{ status: success ? 'passed' : 'failed' }] })); };
    report(false);
    expect(r.check('suite', '.results.json', '1', '--full').status).toBe(0);
    report(true); expect(r.check('suite', '.results.json', '0', '--full').status).toBe(0);
    const artifact = join(r.dir, '..', `${r.dir.split('/').at(-1)}-astra-review.md`); writeFileSync(artifact, 'VERDICT: accepted\n'); dirs.push(artifact);
    expect(r.check('landing').out).toContain('no accepted independent review pass');
    expect(r.check('pass', 'reviews/change.md', '--reviewer', 'astra', '--verdict', 'accepted', '--artifact', artifact, '--submitted', 'all').status).toBe(0);
    const red = r.check('landing'); expect(red.status).toBe(1); expect(red.out).toMatch(/red evidence (\w+) \(suite at \w+\) carries no classification/);
    const redId = /red evidence (\w+) \(suite/.exec(red.out)![1]!;
    expect(r.check('classify', redId, 'product-regression-fixed', 'the failing assertion was fixed in the next tree').status).toBe(0);
    const landed = r.check('landing'); expect(landed.out).toContain('change-review landing ACCEPTED'); expect(landed.status).toBe(0);
    writeFileSync(artifact, 'VERDICT: accepted, edited later\n');
    expect(r.check('landing').out).toContain('missing or changed since it was recorded');

    const ledger = join(r.dir, '.git', 'instar-change-evidence.jsonl');
    const rows = readFileSync(ledger, 'utf8').trim().split('\n');
    expect(rows.length).toBe(4);
    writeFileSync(ledger, [rows[0], rows[2], rows[3]].join('\n') + '\n');
    expect(r.check('landing').out).toContain('not an unbroken chain');
  }, 120_000);
  it('records an interrupted run as incomplete evidence, never as a pass, and never fails the run it records', () => {
    const r = repo();
    r.write('README.md', 'fixture\n'); r.commit('base');
    const recorded = r.check('suite', 'missing.json', '130', '--full');
    expect(recorded.status).toBe(0);
    const row = JSON.parse(readFileSync(join(r.dir, '.git', 'instar-change-evidence.jsonl'), 'utf8').trim()) as { complete: boolean; exit: number };
    expect(row).toMatchObject({ complete: false, exit: 130 });
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
});
