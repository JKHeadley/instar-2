#!/usr/bin/env node
// Binds each change to its review record (reviews/*.md) and to the evidence the landing needs.
// The record's fields and what each one holds are in scripts/change-review.mjs.
//
// In-tree check (runs inside `npm run test:all`, so every gate runs it):
//   node scripts/check-change-review.mjs [check]
//     Every commit made since this checker was adopted must be covered by a record: a record
//     covers the commits between its 'Subject base:' and the last commit that edited it.
//     Each current record is validated against its actual subject (the files changed in that
//     range): required fields, frozen content, prompt/dispatch findings, deferrals, skips and
//     governed-document versions (Rule 90: a changed governed document adds a new changelog
//     version and keeps every earlier one byte-identical; any landing commit it names exists).
//
// Authoring:
//   draft --base <sha> [--title T]  print a record skeleton for the working tree's change
//   freeze <record>                 Review state: frozen + the reviewed content digest
//   open <record>                   void the frozen round (Review state: open)
//
// Evidence (append-only, hash-chained, machine-local ledger in the git common directory, so
// every worktree of the repository shares it; INSTAR_CHANGE_EVIDENCE overrides the path):
//   suite <vitest-json> <exit> [--full]   record a suite result for the current tree (test:all does this)
//   ci <ci-local-result.json>             record a ci-local verdict (ci-local does this)
//   pass <record> --reviewer R --verdict accepted|repair --artifact PATH
//        [--independence TEXT] [--inspected all|a,b] [--omitted path=reason,...]
//        [--residue id=severity=basis]... [--submitted all|id,id]
//   classify <entry> <class> <note>       classify red evidence (it stays visible)
//   redo <entry> <evidence>               record that an entry never carried useful signal
//   landing                               the landing gate for HEAD (desk: run before landing)
//   history <governed-doc>                the document's versions, generated from git
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RED_CLASSES, RESIDUE_SEVERITIES, addedLineHits, isPromptSourceFile, isTestFile, landingVerdict, parseRecord,
  scanPrompts, subjectDigest, suggestTier, validateRecord } from './change-review.mjs';
import { discoverGoverned, governingDocument } from './check-governed-docs.mjs';

const CHECKER = 'scripts/check-change-review.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\n$/, '');
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const lines = text => (text ? text.split('\n').filter(Boolean) : []);
const isAncestor = (a, b) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { stdio: 'ignore' }); return true; } catch { return false; } };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const outside = path => !path.startsWith('reviews/');

// ---- records -------------------------------------------------------------------------------
function records() {
  return lines(tryGit('ls-tree', '-r', '--name-only', 'HEAD', 'reviews/'))
    .filter(p => p.endsWith('.md') && !p.endsWith('.sample.md')).map(path => {
      const text = git('show', `HEAD:${path}`);
      const record = parseRecord(text);
      const last = git('rev-list', '-1', 'HEAD', '--', path);
      const base = record.one('Subject base');
      const valid = !!base && /^[0-9a-f]{40}$/.test(base) && tryGit('cat-file', '-t', base) === 'commit' && isAncestor(base, last);
      const range = valid ? new Set(lines(git('rev-list', `${base}..${last}`))) : new Set();
      const subject = valid ? lines(git('diff', '--name-only', '--no-renames', base, last)).filter(outside) : [];
      return { path, text, record, last, base, valid, range, subject };
    });
}
function digestAt(commit, subject) {
  const blobs = new Map(lines(subject.length ? git('ls-tree', commit, '--', ...subject) : '').map(l => { const [meta, path] = l.split('\t'); return [path, meta.split(' ')[2]]; }));
  return subjectDigest(subject.map(path => ({ path, blob: blobs.get(path) ?? null })));
}
function addedLines(base, last) {
  const out = []; let path = null; let line = 0;
  for (const l of git('diff', '-U0', '--no-renames', '--no-color', base, last, '--', '.', ':(exclude)reviews').split('\n')) {
    if (l.startsWith('+++ ')) { path = l === '+++ /dev/null' ? null : l.slice(6); continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (path && l.startsWith('+')) { out.push({ path, line, text: l.slice(1) }); line++; }
  }
  return out;
}
function promptScan() {
  const files = lines(git('ls-files')).filter(p => (isTestFile(p) || isPromptSourceFile(p)) && /\.(ts|mts|mjs|js)$/.test(p) && existsSync(p))
    .map(path => ({ path, text: readFileSync(path, 'utf8') }));
  return scanPrompts(files);
}
function json(commit, path) { const t = tryGit('show', `${commit}:${path}`); if (t === null) return null; try { return JSON.parse(t); } catch { return undefined; } }

// Rule 90: a governing edit produces a new version and keeps the old ones; landing metadata
// it names must be real commits.
function governedVersionErrors(entry, discovery) {
  const errors = [];
  const docs = new Set(entry.subject.map(p => governingDocument(p, discovery)).filter(Boolean));
  for (const doc of docs) {
    const changelog = doc.replace(/\.md$/, '.changelog.json');
    const before = json(entry.base, changelog); const after = json(entry.last, changelog);
    const existed = tryGit('cat-file', '-e', `${entry.base}:${doc}`) !== null;
    if (!existed && after === null) continue; // a new governed document starts at one version
    if (!entry.subject.includes(changelog)) { errors.push(`Rule 90: governed ${doc} changed without a new version in ${changelog}`); continue; }
    if (!Array.isArray(after)) { errors.push(`Rule 90: ${changelog} is not a changelog array`); continue; }
    const old = Array.isArray(before) ? before : [];
    const tail = after.slice(after.length - old.length);
    if (after.length <= old.length) errors.push(`Rule 90: ${changelog} gained no new version for this change`);
    else if (JSON.stringify(tail) !== JSON.stringify(old)) errors.push(`Rule 90: ${changelog} rewrites an earlier version in place; append a new one instead`);
    for (const version of after.slice(0, after.length - old.length)) {
      const shas = [version?.approvedIn?.mergeCommit, ...(version?.changes ?? []).flatMap(c => c?.commits ?? [])].filter(s => typeof s === 'string');
      for (const sha of shas) if (tryGit('cat-file', '-t', sha) !== 'commit') errors.push(`Rule 90: ${changelog} names landing commit ${sha}, which this repository does not have`);
    }
  }
  return errors;
}

function check({ quiet = false } = {}) {
  const adoption = lines(tryGit('log', '--diff-filter=A', '--format=%H', 'HEAD', '--', CHECKER)).at(-1);
  if (!adoption) { if (!quiet) console.log('change-review: checker not yet adopted in this history; nothing to check'); return { errors: [], current: [] }; }
  const required = new Set([adoption, ...lines(git('rev-list', '--ancestry-path', `${adoption}..HEAD`))]);
  const all = records();
  const errors = []; const notes = [];
  const covered = new Set(all.flatMap(r => [...r.range]));
  const uncovered = [...required].filter(c => !covered.has(c));
  for (const c of uncovered) errors.push(`Rule 74: commit ${c.slice(0, 12)} (${git('log', '-1', '--format=%s', c)}) is not covered by any review record — run: node ${CHECKER} draft --base <the commit this change starts from>`);
  const landedRef = tryGit('rev-parse', '--verify', '-q', 'origin/main');
  const current = all.filter(r => required.has(r.last) && !(landedRef && isAncestor(r.last, landedRef)));
  const invalid = all.filter(r => required.has(r.last) && !r.valid);
  for (const r of invalid) errors.push(`Rule 74: ${r.path}: 'Subject base:' must be a full commit id that is an ancestor of the record`);
  const scan = current.length ? promptScan() : { findings: [], promptSources: [] };
  const discovery = current.length ? discoverGoverned('.') : null;
  for (const r of current.filter(x => x.valid)) {
    if (!r.subject.length) { errors.push(`Rule 74: ${r.path} reviews an empty subject`); continue; }
    const hits = addedLineHits(addedLines(r.base, r.last));
    const ctx = { subject: r.subject, digest: digestAt(r.last, r.subject),
      promptFindings: scan.findings.filter(f => r.subject.includes(f.promptFile) || (f.fixtureFile && r.subject.includes(f.fixtureFile))),
      promptSourcesChanged: r.subject.filter(p => scan.promptSources.includes(p)),
      deferrals: hits.deferrals, skips: hits.skips, exists: p => tryGit('cat-file', '-e', `${r.last}:${p}`) !== null };
    const v = validateRecord(r.record, ctx);
    errors.push(...v.errors.map(e => `${r.path}: ${e}`), ...governedVersionErrors(r, discovery).map(e => `${r.path}: ${e}`));
    notes.push(...v.notes.map(n => `${r.path}: ${n}`));
  }
  if (!quiet) {
    for (const n of notes) console.log(`note: ${n}`);
    console.log(`change-review: ${required.size} commits since adoption, ${all.length} records, ${current.length} current; ${scan.findings.length} prompt findings among the files current changes touch or in the tree (dispositioned where a change touches them)`);
  }
  return { errors, current };
}

// ---- authoring -----------------------------------------------------------------------------
function workingSubject(base) {
  const changed = [...lines(git('diff', '--name-only', '--no-renames', base)), ...lines(git('ls-files', '--others', '--exclude-standard'))];
  // An untracked directory entry (a node_modules symlink, say) is not a changed file.
  return [...new Set(changed)].filter(p => outside(p) && (!existsSync(p) || statSync(p).isFile())).sort();
}
function workingDigest(subject) {
  return subjectDigest(subject.map(path => ({ path, blob: existsSync(path) ? git('hash-object', path) : null })));
}
function setFields(file, updates) {
  let text = readFileSync(file, 'utf8');
  for (const [label, value] of Object.entries(updates)) {
    const re = new RegExp(`^${label}:.*$`, 'm');
    if (!re.test(text)) throw Error(`${file} has no '${label}:' line`);
    text = text.replace(re, `${label}: ${value}`);
  }
  writeFileSync(file, text);
}
function draft(base, title) {
  if (!base) throw Error('draft needs --base <commit this change starts from>');
  const subject = workingSubject(base);
  const scan = promptScan();
  const findings = scan.findings.filter(f => subject.includes(f.promptFile) || (f.fixtureFile && subject.includes(f.fixtureFile)));
  const added = [];
  for (const path of subject.filter(p => existsSync(p))) {
    const tracked = tryGit('cat-file', '-e', `${base}:${path}`) !== null;
    const diff = tracked ? git('diff', '-U0', '--no-color', base, '--', path) : null;
    if (diff === null) readFileSync(path, 'utf8').split('\n').forEach((text, i) => added.push({ path, line: i + 1, text }));
    else { let line = 0; for (const l of diff.split('\n')) { const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l); if (h) line = Number(h[1]); else if (l.startsWith('+') && !l.startsWith('+++')) added.push({ path, line: line++, text: l.slice(1) }); } }
  }
  const hits = addedLineHits(added);
  const out = [`# Change review — ${title ?? 'TITLE'}`, '', `Subject base: ${git('rev-parse', base)}`, 'Review state: open', 'Reviewed content: none',
    'Outcome: ', 'Affected rules: ', 'Affected floors: secrets — ; spend cap — ; stop — ; no duplicate sends — ; durable intake — ',
    'Operator questions: none', `Suggested tier: ${suggestTier(subject)}`, 'Declared tier: ', 'Tier rationale: ', 'Side effects: ',
    'Undo and recovery: ', 'Multi-machine posture: ', 'Layer below: ', 'Bug class: none', 'Bug evidence: none', 'Hook bypass: none',
    'Convergence: none', ...(subject.some(p => scan.promptSources.includes(p)) ? ['Prompt review: '] : []),
    ...findings.map(f => `Prompt finding: ${f.id} | <quoted-evidence|protocol-literal|question-with-hypothesis> | <reason> — ${f.kind} ${f.promptFile}${f.fixtureFile ? ` <- ${f.fixtureFile}` : ''}: "${f.phrase.slice(0, 80)}"`),
    ...hits.deferrals.map(h => `Deferral: ${h} | commitment=<ref> or not-a-deferral=<reason>`),
    ...hits.skips.map(h => `Skip: ${h} | quarantine=<docs/defects/...> or scope=<reason>`),
    '', `Subject (${subject.length} paths): ${subject.join(', ')}`, '', '## Closing block', '',
    'simplestRobustRoute: ', '80/20: ', 'VERDICT: author submission; the independent verdict is recorded as a pass'];
  console.log(out.join('\n'));
}

// ---- ledger --------------------------------------------------------------------------------
function ledgerPath() {
  if (process.env.INSTAR_CHANGE_EVIDENCE) return process.env.INSTAR_CHANGE_EVIDENCE;
  const common = git('rev-parse', '--git-common-dir');
  return join(isAbsolute(common) ? common : resolve(common), 'instar-change-evidence.jsonl');
}
function readLedger() {
  const path = ledgerPath();
  if (!existsSync(path)) return [];
  const out = []; let prev = 'genesis';
  for (const line of lines(readFileSync(path, 'utf8'))) {
    const entry = JSON.parse(line);
    const { id, ...body } = entry;
    if (body.prev !== prev || id !== sha256(JSON.stringify(body)).slice(0, 16)) throw Error(`evidence ledger ${path} is not an unbroken chain at entry ${out.length} (Rule 112)`);
    out.push(entry); prev = id;
  }
  return out;
}
function append(body) {
  const entries = readLedger();
  const full = { ...body, seq: entries.length, prev: entries.at(-1)?.id ?? 'genesis', at: new Date().toISOString() };
  const entry = { id: sha256(JSON.stringify(full)).slice(0, 16), ...full };
  appendFileSync(ledgerPath(), JSON.stringify(entry) + '\n');
  console.log(`evidence ${entry.id} appended (${entry.kind}) -> ${ledgerPath()}`);
  return entry;
}
const headTree = () => ({ head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
  dirty: git('status', '--porcelain', '--untracked-files=no').length > 0 });

function suite(file, exit, full) {
  let report = null;
  try { report = JSON.parse(readFileSync(file, 'utf8')); } catch { /* an interrupted run leaves no report */ }
  const complete = !!report && report.numTotalTests > 0 && Array.isArray(report.testResults)
    && report.testResults.every(r => ['passed', 'failed', 'skipped', 'pending'].includes(r.status));
  return append({ kind: 'suite', ...headTree(), scope: full ? 'full' : 'partial', exit: Number(exit), complete: complete && full,
    success: !!report?.success, total: report?.numTotalTests ?? null, failed: report?.numFailedTests ?? null,
    skipped: report?.numPendingTests ?? null, resultsSha256: report ? sha256(readFileSync(file)) : null });
}
function changeHeads(recordPath) {
  const entry = records().find(r => r.path === recordPath);
  if (!entry?.valid) throw Error(`${recordPath} is not a valid committed review record at HEAD`);
  return { entry, heads: [...entry.range] };
}
function pass(recordPath, opts) {
  const { entry, heads } = changeHeads(recordPath);
  if (!['accepted', 'repair'].includes(opts.verdict)) throw Error('--verdict must be accepted or repair');
  if (!opts.reviewer || !opts.artifact || !existsSync(opts.artifact)) throw Error('pass needs --reviewer and an existing --artifact');
  const produced = readLedger().filter(e => heads.includes(e.head) && (e.kind === 'suite' || e.kind === 'ci')).map(e => e.id);
  const submitted = opts.submitted === 'all' ? produced : (opts.submitted ?? '').split(',').filter(Boolean);
  const residue = (opts.residue ?? []).map(r => { const [id, severity, ...basis] = r.split('='); return { id, severity, basis: basis.join('=') }; });
  for (const r of residue) if (!r.id || !RESIDUE_SEVERITIES.includes(r.severity) || !r.basis) throw Error(`--residue ${r.id}: needs id=${RESIDUE_SEVERITIES.join('|')}=basis`);
  return append({ kind: 'pass', ...headTree(), record: recordPath, reviewer: opts.reviewer, verdict: opts.verdict,
    artifact: resolve(opts.artifact), artifactSha256: sha256(readFileSync(opts.artifact)), independence: opts.independence ?? null,
    inspected: opts.inspected === 'all' ? entry.subject : (opts.inspected ?? '').split(',').filter(Boolean),
    omitted: (opts.omitted ?? '').split(',').filter(Boolean).map(o => { const [caseId, ...reason] = o.split('='); return { caseId, reason: reason.join('=') }; }),
    residue, submitted, subjectDigest: digestAt(entry.last, entry.subject) });
}
async function landing() {
  const { errors, current } = check({ quiet: true });
  const ledger = readLedger();
  const { head, tree } = headTree();
  const notes = [];
  const { convergenceEligible } = await import(pathToFileURL(join(here, '..', 'dist', 'verification', 'index.js')).href);
  const author = r => git('log', '-1', '--format=%an', r.last).toLowerCase();
  for (const r of current.filter(x => x.valid)) {
    const v = landingVerdict(r.record, ledger, { heads: [...r.range, head], head, tree, record: r.path, author: author(r),
      subject: r.subject, convergenceEligible, artifactHash: p => (p && existsSync(p) ? sha256(readFileSync(p)) : null) });
    errors.push(...v.errors.map(e => `${r.path}: ${e}`)); notes.push(...v.notes.map(n => `${r.path}: ${n}`));
  }
  if (!current.length) errors.push('Rule 74: no current review record binds the change being landed');
  for (const n of notes) console.log(n);
  return errors;
}
function history(doc) {
  const commits = lines(git('log', '--format=%H %cs', '--follow', '--', doc));
  const landedRef = tryGit('rev-parse', '--verify', '-q', 'origin/main');
  let next = null; const rows = [];
  for (const row of commits.reverse()) {
    const [commit, date] = row.split(' ');
    const blob = tryGit('rev-parse', `${commit}:${doc}`);
    rows.push({ version: blob, began: date, commit, supersedes: next, landedOnMain: !!landedRef && isAncestor(commit, landedRef) });
    next = blob;
  }
  console.log(JSON.stringify(rows.reverse(), null, 2));
}

// ---- main ----------------------------------------------------------------------------------
async function main(argv) {
  const [command = 'check', ...rest] = argv;
  const flag = name => { const i = rest.indexOf(`--${name}`); return i < 0 ? undefined : rest[i + 1]; };
  const flags = name => rest.flatMap((v, i) => (v === `--${name}` ? [rest[i + 1]] : []));
  switch (command) {
    case 'check': {
      const { errors } = check();
      if (errors.length) { console.error(`change-review check FAILED (${errors.length}):\n${errors.map(e => `  - ${e}`).join('\n')}`); return 1; }
      console.log('change-review check OK'); return 0;
    }
    case 'draft': draft(flag('base'), flag('title')); return 0;
    case 'freeze': { const record = parseRecord(readFileSync(rest[0], 'utf8')); const base = record.one('Subject base');
      setFields(rest[0], { 'Review state': 'frozen', 'Reviewed content': workingDigest(workingSubject(base)) }); console.log(`${rest[0]} frozen`); return 0; }
    case 'open': setFields(rest[0], { 'Review state': 'open', 'Reviewed content': 'none' }); console.log(`${rest[0]} open; the frozen round is void`); return 0;
    case 'suite': suite(rest[0], rest[1] ?? '1', rest.includes('--full')); return 0;
    case 'ci': { const result = JSON.parse(readFileSync(rest[0], 'utf8'));
      append({ kind: 'ci', ...headTree(), exit: result.verdict === 'passed' ? 0 : 1, complete: true, success: result.verdict === 'passed',
        verdictReason: result.verdictReason, resultSha256: sha256(readFileSync(rest[0])) }); return 0; }
    case 'pass': pass(rest[0], { reviewer: flag('reviewer'), verdict: flag('verdict'), artifact: flag('artifact'), independence: flag('independence'),
      inspected: flag('inspected'), omitted: flag('omitted'), residue: flags('residue'), submitted: flag('submitted') }); return 0;
    case 'classify': {
      if (!RED_CLASSES.includes(rest[1]) || !rest[2]) throw Error(`classify <entry> <${RED_CLASSES.join('|')}> <note>`);
      if (!readLedger().some(e => e.id === rest[0])) throw Error(`no evidence entry ${rest[0]}`);
      append({ kind: 'classification', ...headTree(), target: rest[0], class: rest[1], note: rest.slice(2).join(' ') }); return 0;
    }
    case 'redo': {
      if (!readLedger().some(e => e.id === rest[0]) || !rest[1]) throw Error('redo <entry> <evidence that it never carried useful signal>');
      append({ kind: 'redo', ...headTree(), target: rest[0], evidence: rest.slice(1).join(' ') }); return 0;
    }
    case 'landing': {
      const errors = await landing();
      if (errors.length) { console.error(`change-review landing REFUSED (${errors.length}):\n${errors.map(e => `  - ${e}`).join('\n')}`); return 1; }
      console.log('change-review landing ACCEPTED'); return 0;
    }
    case 'history': history(rest[0]); return 0;
    default: console.error(`unknown command ${command}`); return 2;
  }
}
// The suite recorder must never turn a test run's own outcome into a different one.
if (process.argv[2] === 'suite' || process.argv[2] === 'ci') { try { await main(process.argv.slice(2)); } catch (e) { console.error(`change-review: suite evidence NOT recorded: ${e.message}`); } }
else process.exitCode = await main(process.argv.slice(2)).catch(e => { console.error(`change-review: ${e.message}`); return 2; });
