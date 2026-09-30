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
// every worktree of the repository shares it; INSTAR_CHANGE_EVIDENCE overrides the path).
// Appends are serialized by an O_EXCL writer lock; each run's result bytes are kept, content-
// addressed and never overwritten, beside the ledger:
//   run                                   `npm run test:all`: runs the whole gate (npm run test:gate),
//                                         bound to the subject captured when it starts
//   ci-start                              record a ci-local start before any step runs; prints its run id
//   ci <ci-local-result.json> [--run ID]  complete that start with ci-local's verdict (ci-local does
//                                         both); with no --run, the start is recorded first here
//   pass <record> (--records DIR | --reviewer R --artifact PATH)
//        [--independence TEXT] [--inspected all|a,b] [--omitted path=reason,...]
//        [--residue id=severity=basis]... [--submitted all|id,id]
//        the decision is read from the artifact's own VERDICT line (YES|NO), never passed in
//   classify <entry> <class> <note>       classify red evidence (it stays visible)
//   redo <entry> <evidence>               record that an entry never carried useful signal
//   landing [--records DIR]               the landing gate for HEAD; with the desk's record
//                                         directory it consumes candidate/review/gate.json
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, truncateSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RED_CLASSES, RESIDUE_SEVERITIES, addedLineHits, artifactDecision, isPromptSourceFile, isTestFile, landingVerdict, parseRecord,
  scanPrompts, subjectDigest, suggestTier, validateRecord } from './change-review.mjs';
import { indexedSections, isGeneratedOutput, isGoverned } from './check-governed-docs.mjs';

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
    // Generated output is rebuilt from sources that are scanned where they are authored.
    if (path && l.startsWith('+')) { if (!isGeneratedOutput(path)) out.push({ path, line, text: l.slice(1) }); line++; }
  }
  return out;
}
function promptScan() {
  const files = lines(git('ls-files')).filter(p => (isTestFile(p) || isPromptSourceFile(p)) && /\.(ts|mts|mjs|js)$/.test(p) && existsSync(p))
    .map(path => ({ path, text: readFileSync(path, 'utf8') }));
  return scanPrompts(files);
}
function json(commit, path) { const t = tryGit('show', `${commit}:${path}`); if (t === null) return null; try { return JSON.parse(t); } catch { return undefined; } }

// Rules 90/91: a governing edit produces a new version and keeps every earlier one. The governed
// set is read at BOTH ends of the change, so a document cannot shed its governance or its
// history to escape the check, and a changelog edited on its own is checked too. Approval
// (approvedIn) belongs to the version-chain owner (src/facts/version-chain.ts decodeVersion),
// which needs a part-two provider this repository does not have; nothing here stands in for it.
function governedAt(commit, path) { const text = tryGit('show', `${commit}:${path}`); return text !== null && isGoverned(text); }
function governingAt(commit, path) {
  if (governedAt(commit, path)) return path;
  const index = `${dirname(path)}.md`; const text = tryGit('show', `${commit}:${index}`);
  return text !== null && isGoverned(text) && indexedSections(index, text).includes(path) ? index : null;
}
function governedVersionErrors(entry) {
  const errors = [];
  const touched = new Map(); // governing document -> whether its body (or a section) changed
  for (const path of entry.subject) {
    if (path.endsWith('.changelog.json')) { const doc = path.replace(/\.changelog\.json$/, '.md'); if (!touched.has(doc)) touched.set(doc, false); continue; }
    if (!path.endsWith('.md') || isGeneratedOutput(path)) continue; // generated output is not a governed document (Rule 91)
    for (const doc of new Set([governingAt(entry.base, path), governingAt(entry.last, path)].filter(Boolean))) touched.set(doc, true);
  }
  for (const [doc, bodyChanged] of touched) {
    const wasGoverned = governedAt(entry.base, doc); const isGovernedNow = governedAt(entry.last, doc);
    const changelog = doc.replace(/\.md$/, '.changelog.json');
    const before = json(entry.base, changelog); const after = json(entry.last, changelog);
    if (wasGoverned && !isGovernedNow) { errors.push(`Rule 91: ${doc} was governed at the change's base and no longer declares governance; a change record cannot remove governance`); continue; }
    if (Array.isArray(before) && !Array.isArray(after)) { errors.push(`Rule 90: ${changelog} existed at the change's base and is now ${after === null ? 'removed' : 'not a changelog array'}; history is never removed`); continue; }
    if (!wasGoverned && !isGovernedNow) continue;
    const changelogChanged = entry.subject.includes(changelog);
    if (!wasGoverned && after === null) continue; // a newly governed document starts at one version
    if (bodyChanged && wasGoverned && !changelogChanged) { errors.push(`Rule 90: governed ${doc} changed without a new version in ${changelog}`); continue; }
    if (!changelogChanged) continue;
    if (!Array.isArray(after)) { errors.push(`Rule 90: ${changelog} is not a changelog array`); continue; }
    const old = Array.isArray(before) ? before : [];
    const tail = after.slice(after.length - old.length);
    if (after.length < old.length || JSON.stringify(tail) !== JSON.stringify(old)) errors.push(`Rule 90: ${changelog} rewrites or drops an earlier version; append a new one instead`);
    else if (bodyChanged && wasGoverned && after.length === old.length) errors.push(`Rule 90: ${changelog} gained no new version for this change`);
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
  for (const r of current.filter(x => x.valid)) {
    if (!r.subject.length) { errors.push(`Rule 74: ${r.path} reviews an empty subject`); continue; }
    const hits = addedLineHits(addedLines(r.base, r.last));
    // Rule 109: a frozen record is compared with the candidate's content, whichever record
    // covers the later commits; only an explicit reopen of THIS record voids its round.
    const ctx = { subject: r.subject, digest: digestAt('HEAD', r.subject),
      promptFindings: scan.findings.filter(f => r.subject.includes(f.promptFile) || (f.fixtureFile && r.subject.includes(f.fixtureFile))),
      promptSourcesChanged: r.subject.filter(p => scan.promptSources.includes(p)),
      deferrals: hits.deferrals, skips: hits.skips, exists: p => tryGit('cat-file', '-e', `${r.last}:${p}`) !== null,
      read: p => tryGit('show', `${r.last}:${p}`),
      resolvesEvidence: p => tryGit('cat-file', '-e', `${r.last}:${p}`) !== null || (isAbsolute(p) && existsSync(p) && statSync(p).isFile()),
      readEvidence: p => (isAbsolute(p) ? (existsSync(p) && statSync(p).isFile() ? readFileSync(p, 'utf8') : null) : tryGit('show', `${r.last}:${p}`)) };
    const v = validateRecord(r.record, ctx);
    errors.push(...v.errors.map(e => `${r.path}: ${e}`), ...governedVersionErrors(r).map(e => `${r.path}: ${e}`));
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
    'Convergence: none', '<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->',
    ...(subject.some(p => scan.promptSources.includes(p)) ? ['Prompt review: '] : []),
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
const runStore = () => `${ledgerPath().replace(/\.jsonl$/, '')}-runs`;
// A torn final line (a writer that died mid-append) is not part of the chain; the writer lock
// moves it aside before the next append, so it is kept, never silently dropped.
function readLedger() {
  const path = ledgerPath();
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const complete = text.endsWith('\n') ? text : text.slice(0, text.lastIndexOf('\n') + 1);
  const out = []; let prev = 'genesis';
  for (const line of lines(complete)) {
    const entry = JSON.parse(line);
    const { id, ...body } = entry;
    if (body.prev !== prev || id !== sha256(JSON.stringify(body)).slice(0, 16)) throw Error(`evidence ledger ${path} is not an unbroken chain at entry ${out.length} (Rule 112)`);
    out.push(entry); prev = id;
  }
  return out;
}
// One writer at a time across every worktree: an O_EXCL lock file naming its holder. A lock whose
// holder process is gone is reclaimed; a live holder is waited for, then refused.
const sleeper = new Int32Array(new SharedArrayBuffer(4));
function withLedgerLock(run, waitMs = 60_000) {
  const path = ledgerPath(); mkdirSync(dirname(path), { recursive: true });
  const lock = `${path}.lock`; const end = Date.now() + waitMs; let fd;
  for (;;) {
    try { fd = openSync(lock, 'wx', 0o600); writeSync(fd, String(process.pid)); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let holder = NaN; try { holder = Number(readFileSync(lock, 'utf8')); } catch { /* released meanwhile */ }
      let alive = true; if (Number.isInteger(holder) && holder > 0) { try { process.kill(holder, 0); } catch (e) { alive = e.code === 'EPERM'; } }
      if (!alive) { try { unlinkSync(lock); } catch { /* another writer reclaimed it */ } continue; }
      if (Date.now() >= end) throw Error(`evidence ledger lock ${lock} is held by process ${holder}`);
      Atomics.wait(sleeper, 0, 0, 20);
    }
  }
  try {
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      if (text && !text.endsWith('\n')) {
        const keep = text.lastIndexOf('\n') + 1;
        writeFileSync(`${path}.torn-${sha256(text.slice(keep)).slice(0, 12)}`, text.slice(keep));
        truncateSync(path, Buffer.byteLength(text.slice(0, keep)));
      }
    }
    return run();
  } finally { closeSync(fd); unlinkSync(lock); }
}
function append(body) {
  return withLedgerLock(() => {
    const entries = readLedger();
    const full = { ...body, seq: entries.length, prev: entries.at(-1)?.id ?? 'genesis', at: new Date().toISOString() };
    const entry = { id: sha256(JSON.stringify(full)).slice(0, 16), ...full };
    const fd = openSync(ledgerPath(), 'a', 0o600);
    try { writeSync(fd, JSON.stringify(entry) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
    console.log(`evidence ${entry.id} appended (${entry.kind}) -> ${ledgerPath()}`);
    return entry;
  });
}
// Result bytes are kept under their own sha256 and never overwritten, so a later run replacing
// the working-tree result file erases nothing.
function preserve(bytes) {
  const hash = sha256(bytes); const dir = runStore(); mkdirSync(dir, { recursive: true });
  const path = join(dir, `${hash}.json`);
  if (!existsSync(path)) { const tmp = `${path}.${process.pid}.pending`; writeFileSync(tmp, bytes, { flag: 'wx', mode: 0o600 }); renameSync(tmp, path); }
  return { hash, path };
}
// The tested subject: HEAD, its tree, and whether tracked files or untracked sources differ.
const headTree = () => ({ head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
  dirty: git('status', '--porcelain', '--untracked-files=no').length > 0
    || lines(git('ls-files', '--others', '--exclude-standard', '--', 'src', 'tests', 'scripts', 'bin', 'docs', 'package.json')).length > 0 });

// The whole gate, bound to the subject captured when it starts. The command is fixed, so a
// caller cannot label a partial or stale report as the full gate.
const GATE = ['run', 'test:gate'];
const RESULTS = '.test-results.json';
function gateRun() {
  const runId = randomUUID(); const start = headTree();
  // No evidence-producing work runs before its start is durable: a start that cannot be
  // recorded refuses the run, so a result can never be produced and then silently lost.
  append({ kind: 'run-start', runId, ...start, scope: 'full', command: `npm ${GATE.join(' ')}` });
  try { unlinkSync(RESULTS); } catch { /* no stale report */ }
  const child = spawnSync('npm', GATE, { stdio: 'inherit' });
  const exit = child.status ?? 128;
  try {
    let bytes = null; let report = null;
    try { bytes = readFileSync(RESULTS); report = JSON.parse(bytes.toString('utf8')); } catch { /* the run left no report */ }
    const complete = !!report && report.numTotalTests > 0 && Array.isArray(report.testResults)
      && report.testResults.every(r => ['passed', 'failed', 'skipped', 'pending'].includes(r.status));
    const end = headTree();
    const stored = bytes ? preserve(bytes) : null;
    append({ kind: 'suite', runId, ...start, scope: 'full', exit, signal: child.signal ?? null, complete,
      subjectMoved: end.head !== start.head || end.tree !== start.tree || end.dirty !== start.dirty,
      success: !!report?.success, total: report?.numTotalTests ?? null, failed: report?.numFailedTests ?? null,
      skipped: report?.numPendingTests ?? null, resultsSha256: stored?.hash ?? null, results: stored?.path ?? null });
  } catch (e) { console.error(`change-review: gate result NOT recorded; the run stays an unfinished start (red) in the ledger: ${e.message}`); }
  return exit;
}
// ci-local records its start before running any step (ci-start) and completes it here. A direct
// `ci` call with no --run records its own start first. Either way a completion that cannot be
// recorded leaves an unfinished start, which landing counts as red until it is classified.
const ciStart = () => append({ kind: 'run-start', runId: randomUUID(), ...headTree(), scope: 'ci', command: 'node scripts/ci-local.mjs' });
function ci(file, runId) {
  const start = runId ? readLedger().find(e => e.kind === 'run-start' && e.runId === runId && e.scope === 'ci') : ciStart();
  if (!start) throw Error(`no recorded ci-local start ${runId}`);
  try {
    const bytes = readFileSync(file); const result = JSON.parse(bytes.toString('utf8'));
    const head = /^[0-9a-f]{40}$/.test(result.head ?? '') ? result.head : start.head;
    const stored = preserve(bytes);
    return append({ kind: 'ci', runId: start.runId, head, tree: git('rev-parse', `${head}^{tree}`), dirty: headTree().dirty, exit: result.verdict === 'passed' ? 0 : 1,
      complete: true, success: result.verdict === 'passed', verdictReason: result.verdictReason, resultSha256: stored.hash, results: stored.path });
  } catch (e) { throw Error(`${e.message}; start ${start.id} stays an unfinished run (red) in the ledger`); }
}

function changeHeads(recordPath) {
  const entry = records().find(r => r.path === recordPath);
  if (!entry?.valid) throw Error(`${recordPath} is not a valid committed review record at HEAD`);
  // The heads landing judges this record over: its own range plus the candidate HEAD, so a
  // record whose last edit precedes HEAD still gives `--submitted all` the runs made at HEAD.
  return { entry, heads: [...new Set([...entry.range, headTree().head])] };
}
// The desk's exact-candidate records (lanes/<...>/candidate.json, review.json, gate.json).
function deskRecords(dir) {
  const read = name => { try { return JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')); } catch { throw Error(`desk record ${name}.json is missing or malformed in ${dir}`); } };
  const candidate = read('candidate'); const review = read('review');
  const { head, tree } = headTree();
  if (candidate.candidate !== head || candidate.tree !== tree) throw Error(`desk candidate ${candidate.candidate} / ${candidate.tree} is not HEAD ${head} / ${tree}`);
  if (review.candidate !== head || review.tree !== tree || review.base !== candidate.base) throw Error('desk review record is not bound to this candidate');
  if (!review.reviewer || !review.artifact) throw Error('desk review record names no reviewer or artifact');
  let gate = null; try { gate = JSON.parse(readFileSync(join(dir, 'gate.json'), 'utf8')); } catch { /* the gate runs after review */ }
  return { candidate, review, gate };
}
function pass(recordPath, opts) {
  const { entry, heads } = changeHeads(recordPath);
  if (opts.verdict) throw Error('--verdict is not accepted: the decision is read from the review artifact itself');
  let reviewer = opts.reviewer; let artifact = opts.artifact; let deskVerdict = null;
  if (opts.records) { const { review } = deskRecords(opts.records); reviewer = review.reviewer; artifact = review.artifact; deskVerdict = review.verdict; }
  if (!reviewer || !artifact || !existsSync(artifact)) throw Error('pass needs --records DIR, or --reviewer and an existing --artifact');
  const text = readFileSync(artifact, 'utf8');
  const decision = artifactDecision(text);
  if (!decision) throw Error(`${artifact} states no 'VERDICT: YES|NO' decision`);
  if (deskVerdict !== null && (deskVerdict === 'YES') !== (decision === 'YES')) throw Error(`the desk review record says ${deskVerdict} but ${artifact} decides ${decision}`);
  const { head, tree } = headTree();
  if (!text.includes(head) && !text.includes(tree)) throw Error(`${artifact} names neither HEAD ${head} nor its tree ${tree}; it is not a review of this candidate`);
  const produced = readLedger().filter(e => heads.includes(e.head) && ['suite', 'ci', 'run-start'].includes(e.kind)).map(e => e.id);
  const submitted = opts.submitted === 'all' ? produced : (opts.submitted ?? '').split(',').filter(Boolean);
  const residue = (opts.residue ?? []).map(r => { const [id, severity, ...basis] = r.split('='); return { id, severity, basis: basis.join('=') }; });
  for (const r of residue) if (!r.id || !RESIDUE_SEVERITIES.includes(r.severity) || !r.basis) throw Error(`--residue ${r.id}: needs id=${RESIDUE_SEVERITIES.join('|')}=basis`);
  return append({ kind: 'pass', head, tree, dirty: headTree().dirty, record: recordPath, reviewer, verdict: decision === 'YES' ? 'accepted' : 'repair',
    artifact: resolve(artifact), artifactSha256: sha256(readFileSync(artifact)), independence: opts.independence ?? null,
    inspected: opts.inspected === 'all' ? entry.subject : (opts.inspected ?? '').split(',').filter(Boolean),
    omitted: (opts.omitted ?? '').split(',').filter(Boolean).map(o => { const [caseId, ...reason] = o.split('='); return { caseId, reason: reason.join('=') }; }),
    residue, submitted, subjectDigest: digestAt(entry.last, entry.subject) });
}
async function landing(recordsDir) {
  const { errors, current } = check({ quiet: true });
  let desk;
  if (recordsDir) {
    try {
      const { review, gate } = deskRecords(recordsDir);
      if (review.verdict !== 'YES') errors.push('Rule 74: the desk review record is not an exact-tree YES');
      if (!gate?.gateManifest) errors.push('Rule 37: the desk gate record names no gate manifest');
      const results = gate?.gateManifest ? join(dirname(gate.gateManifest), 'test-results.json') : null;
      desk = { reviewer: review.reviewer, artifact: resolve(review.artifact),
        gateResultsSha256: results && existsSync(results) ? sha256(readFileSync(results)) : 'missing' };
      // The desk flow submits the whole ledger population: the pass is derived from the desk's
      // own review record, once, and never from a label.
      const ledgerNow = readLedger();
      for (const r of current.filter(x => x.valid)) {
        if (!ledgerNow.some(e => e.kind === 'pass' && e.record === r.path && e.artifact === desk.artifact && e.artifactSha256 === sha256(readFileSync(desk.artifact))))
          pass(r.path, { records: recordsDir, submitted: 'all' });
      }
    } catch (e) { errors.push(`Rule 74: ${e.message}`); }
  }
  const ledger = readLedger();
  const { head, tree } = headTree();
  const notes = [];
  const claimed = current.some(r => r.valid && r.record.one('Convergence') === 'claimed');
  const built = join(here, '..', 'dist', 'verification', 'index.js');
  const convergenceEligible = claimed && existsSync(built) ? (await import(pathToFileURL(built).href)).convergenceEligible : null;
  const author = r => git('log', '-1', '--format=%an', r.last).toLowerCase();
  const readArtifact = p => (p && existsSync(p) ? readFileSync(p) : null);
  for (const r of current.filter(x => x.valid)) {
    const v = landingVerdict(r.record, ledger, { heads: [...r.range, head], head, tree, record: r.path, author: author(r), desk,
      subject: r.subject, convergenceEligible, artifactHash: p => { const b = readArtifact(p); return b ? sha256(b) : null; },
      artifactDecision: p => { const b = readArtifact(p); return b ? artifactDecision(b.toString('utf8')) : null; } });
    errors.push(...v.errors.map(e => `${r.path}: ${e}`)); notes.push(...v.notes.map(n => `${r.path}: ${n}`));
  }
  if (!current.length) errors.push('Rule 74: no current review record binds the change being landed');
  for (const n of notes) console.log(n);
  return errors;
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
    case 'run': if (rest.length) throw Error('run takes no arguments: it always runs the whole gate'); return gateRun();
    case 'ci-start': console.log(`ci-run ${ciStart().runId}`); return 0;
    case 'ci': ci(rest[0], flag('run')); return 0;
    case 'pass': pass(rest[0], { reviewer: flag('reviewer'), verdict: flag('verdict'), artifact: flag('artifact'), records: flag('records'),
      independence: flag('independence'), inspected: flag('inspected'), omitted: flag('omitted'), residue: flags('residue'), submitted: flag('submitted') }); return 0;
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
      const errors = await landing(flag('records'));
      if (errors.length) { console.error(`change-review landing REFUSED (${errors.length}):\n${errors.map(e => `  - ${e}`).join('\n')}`); return 1; }
      console.log('change-review landing ACCEPTED'); return 0;
    }
    default: console.error(`unknown command ${command}`); return 2;
  }
}
process.exitCode = await main(process.argv.slice(2)).catch(e => { console.error(`change-review: ${e.message}`); return 2; });
