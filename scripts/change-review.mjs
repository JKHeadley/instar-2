// The change review record: the existing independent-review artifact (reviews/*.md), extended
// so it binds to the change it reviews and carries the evidence the rule book asks of it.
// Pure logic only; scripts/check-change-review.mjs does the git and ledger I/O.
//
// Rules held here, each through the one existing review record rather than a new service:
//   1 (affected floors), 48 (suggested vs declared tier, informational), 49 (outcome, affected
//   rules, operator questions), 65 (convergence: passes, independent reviewer, residue basis),
//   70 (bug class and its evidence bar), 74 (side effects, undo), 101 (hook bypass disclosure),
//   107 (produced vs submitted evidence), 109 (frozen/open state and reviewed content),
//   111 (layer below), 112 (append-only evidence, redo only when no signal existed),
//   113 (multi-machine posture), 116 (simplestRobustRoute), 12/27 (prompt and dispatch scan
//   dispositions), 37 (exact-tree completed suite; quarantine names its defect), 6/71 (deferral
//   carries a same-change commitment).
// The scans only raise findings. What a finding means is decided by the independent reviewer
// through the disposition lines in the record (Rules 4 and 86: a brittle filter only signals).
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// TypeScript parses prompt literals; it loads only when a scan runs.
let tsModule = null;
const typescript = () => (tsModule ??= createRequire(import.meta.url)('typescript'));

export const TIERS = ['ordinary', 'significant', 'critical'];
export const FLOORS = [
  { name: 'secrets', re: /secret/i },
  { name: 'spend cap', re: /spend/i },
  { name: 'stop', re: /\bstop/i },
  { name: 'no duplicate sends', re: /duplicate/i },
  { name: 'durable intake', re: /intake/i },
];
export const BUG_CLASSES = {
  none: [],
  unit: ['reproducer'],
  integration: ['reproducer'],
  durability: ['reproducer', 'restart'],
  'live-path': ['reproducer', 'live'],
  'user-facing': ['reproducer', 'live'],
};
export const PROMPT_DISPOSITIONS = { 'quoted-evidence': true, 'protocol-literal': true, 'question-with-hypothesis': true,
  'copied-trigger': false, 'asserted-answer': false };
export const RESIDUE_SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const RED_CLASSES = ['product-regression-fixed', 'environment', 'flake-quarantined', 'incomplete-not-evidence', 'superseded-by-redo'];

const SINGLE = ['Subject base', 'Review state', 'Reviewed content', 'Outcome', 'Affected rules', 'Affected floors',
  'Operator questions', 'Suggested tier', 'Declared tier', 'Tier rationale', 'Side effects', 'Undo and recovery',
  'Multi-machine posture', 'Layer below', 'Bug class', 'Bug evidence', 'Hook bypass', 'Convergence', 'Prompt review'];
const REPEATED = ['Residue', 'Deferral', 'Prompt finding', 'Skip'];
const CLOSING = ['simplestRobustRoute:', '80/20:', 'VERDICT:'];
const PLACEHOLDER = /^(|tbd|todo|n\/a|na|-|\.\.\.|<.*>)$/i;

export function parseRecord(text) {
  const fields = new Map(); const lines = text.replace(/\r\n/g, '\n').split('\n');
  const labels = [...SINGLE, ...REPEATED];
  for (const line of lines) {
    const m = /^([A-Za-z][A-Za-z0-9 /-]*?):\s?(.*)$/.exec(line);
    if (!m || !labels.includes(m[1])) continue;
    const list = fields.get(m[1]) ?? []; list.push(m[2].trim()); fields.set(m[1], list);
  }
  const tail = text.trimEnd().split('\n').slice(-CLOSING.length);
  const closing = Object.fromEntries(CLOSING.map((label, i) => [label.slice(0, -1),
    tail[i]?.startsWith(label) ? tail[i].slice(label.length).trim() : null]));
  return { fields, closing, one: label => fields.get(label)?.[0] ?? null, all: label => fields.get(label) ?? [] };
}

const pipe = value => value.split('|').map(part => part.trim());
const keyed = value => Object.fromEntries(value.split(';').map(part => part.trim()).filter(Boolean)
  .map(part => { const i = part.indexOf('='); return i < 0 ? [part, ''] : [part.slice(0, i).trim(), part.slice(i + 1).trim()]; }));

// Rule 48: a suggestion from the changed paths. It informs; the declaration is the author's.
export function suggestTier(paths) {
  const critical = /^(docs\/00-the-purpose\.md|docs\/00-the-policy-register\.md|docs\/01-the-rules\.md|docs\/02-the-register\.md|docs\/03-the-glossary\.md|generated\/|register-source\/|src\/(effects|intake|transport)\/|tests\/preview\/(journal-agent\.mjs|journal\.ts)$)|\.declarations\.json$/;
  const significant = /^(src\/|scripts\/|bin\/|deploy\/|\.github\/|package(-lock)?\.json$|tsconfig|vitest\.config|tests\/preview\/(?!.*\.test\.)[^/]+\.(ts|mjs|mts)$)/;
  if (paths.some(p => critical.test(p))) return 'critical';
  if (paths.some(p => significant.test(p))) return 'significant';
  return 'ordinary';
}

// Rules 12 and 27. A prompt source is live non-test code; a fixture phrase is a test input
// literal (never an expectation about the prompt, which runs the other way). A fixture phrase
// found inside a longer prompt literal may be a copied blocking trigger; an asserted answer in
// a dispatch may pre-empt the question. Both are findings for the contextual reviewer.
export const isTestFile = path => /\.test\.(ts|mts|mjs|js)$/.test(path) || /(^|\/)fixtures\//.test(path);
export const isPromptSourceFile = path => /^(src|tests\/preview)\/.+\.(ts|mts|mjs|js)$/.test(path) && !/\.d\.m?ts$/.test(path) && !isTestFile(path);
const ASSERTED = /\b(the (correct|expected|right|true) (answer|verdict|result|conclusion) is|expected (answer|verdict|result|conclusion)\s*[:=]|you (should|must|will) (conclude|find|answer)|the answer is)\b/i;
const EXPECTATION = /(^|\.)(expect|toContain|toMatch|toBe|toEqual|toStrictEqual|toThrow|toMatchObject|toHaveProperty|includes)$/;
const ERRORISH = /(Error|fail|requireFact|refuse|reject|assert)/i;
const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
const wordCount = s => s.split(' ').filter(Boolean).length;
function literals(path, text, test) {
  const ts = typescript();
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const excluded = node => {
    for (let p = node.parent; p && !ts.isSourceFile(p); p = p.parent) {
      if (ts.isBlock(p)) return false;
      if (!test && ts.isThrowStatement(p)) return true;
      if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
        const callee = p.expression.getText(source).replace(/\(.*$/s, '');
        if (test ? EXPECTATION.test(callee) : ERRORISH.test(callee)) return true;
      }
    }
    return false;
  };
  const out = [];
  const walk = node => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !excluded(node)) out.push(node.text);
    else if (ts.isTemplateExpression(node) && !excluded(node)) out.push(node.head.text, ...node.templateSpans.map(s => s.literal.text));
    ts.forEachChild(node, walk);
  };
  walk(source);
  return out.map(norm);
}
export function findingId(parts) { return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 12); }
export function scanPrompts(files) {
  const phrases = new Map(); const prompts = [];
  for (const { path, text } of files) {
    if (isTestFile(path)) {
      for (const phrase of literals(path, text, true)) if (wordCount(phrase) >= 5 && phrase.length >= 25 && !phrases.has(phrase)) phrases.set(phrase, path);
    } else if (isPromptSourceFile(path)) {
      for (const literal of literals(path, text, false)) if (wordCount(literal) >= 12) prompts.push({ path, literal });
    }
  }
  const findings = new Map();
  for (const { path, literal } of prompts) {
    for (const [phrase, fixture] of phrases) if (literal !== phrase && literal.includes(phrase)) {
      const id = findingId(['fixture-phrase', path, phrase]);
      if (!findings.has(id)) findings.set(id, { id, kind: 'fixture-phrase', promptFile: path, fixtureFile: fixture, phrase });
    }
    const asserted = ASSERTED.exec(literal);
    if (asserted) {
      const id = findingId(['asserted-answer', path, literal]);
      if (!findings.has(id)) findings.set(id, { id, kind: 'asserted-answer', promptFile: path, fixtureFile: null, phrase: literal.slice(0, 160) });
    }
  }
  return { findings: [...findings.values()].sort((a, b) => a.id.localeCompare(b.id)), promptSources: [...new Set(prompts.map(p => p.path))].sort() };
}

// Rules 6/71 and 37: added lines that defer work or skip a test must be dispositioned.
const DEFERRAL = /\b(TODO|FIXME|XXX|TBD)\b|\bdefer(?:red|ring)?\b|\bfollow[- ]up\b|\b(?:do|handle|fix|address|revisit) (?:this |it )?later\b/i;
const SKIP = /\b(?:it|test|describe)\.(?:skip|todo)\b|\bxit\(|\.skipIf\(/;
export function addedLineHits(added) {
  return {
    deferrals: added.filter(a => DEFERRAL.test(a.text)).map(a => `${a.path}:${a.line}`),
    skips: added.filter(a => isTestFile(a.path) && SKIP.test(a.text)).map(a => `${a.path}:${a.line}`),
  };
}

export function subjectDigest(entries) {
  const lines = [...entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(e => `${e.path}\0${e.blob ?? 'deleted'}\n`);
  return `sha256:${createHash('sha256').update(lines.join('')).digest('hex')}`;
}

// ctx: { subject: string[], digest, promptFindings: finding[], promptSourcesChanged: string[],
//        deferrals: string[], skips: string[], exists(path): boolean }
export function validateRecord(record, ctx) {
  const errors = []; const notes = [];
  const need = (label, rule) => {
    const value = record.one(label);
    if (value === null || PLACEHOLDER.test(value)) { errors.push(`Rule ${rule}: '${label}:' is missing or empty`); return null; }
    return value;
  };
  const base = need('Subject base', 74);
  if (base && !/^[0-9a-f]{40}$/.test(base)) errors.push("Rule 74: 'Subject base:' must be a full commit id");
  const state = need('Review state', 109);
  if (state && !['open', 'frozen'].includes(state)) errors.push("Rule 109: 'Review state:' must be open or frozen");
  const reviewed = record.one('Reviewed content');
  if (state === 'frozen') {
    if (!reviewed || !/^sha256:[0-9a-f]{64}$/.test(reviewed)) errors.push("Rule 109: a frozen record needs 'Reviewed content: sha256:…'");
    else if (ctx.digest && reviewed !== ctx.digest) errors.push(`Rule 109: the subject changed while the review is frozen (reviewed ${reviewed.slice(0, 19)}…, now ${ctx.digest.slice(0, 19)}…); set 'Review state: open' to void the review round, or restore the reviewed content`);
  }
  need('Outcome', 49);
  const rules = need('Affected rules', 49);
  if (rules && !/\d/.test(rules)) errors.push("Rule 49: 'Affected rules:' must name the rule numbers affected");
  need('Operator questions', 49);
  const floors = need('Affected floors', 1);
  if (floors) for (const floor of FLOORS) if (!floor.re.test(floors)) errors.push(`Rule 1: 'Affected floors:' must state the ${floor.name} floor`);
  const suggested = need('Suggested tier', 48); const declared = need('Declared tier', 48); need('Tier rationale', 48);
  for (const [label, value] of [['Suggested tier', suggested], ['Declared tier', declared]])
    if (value && !TIERS.includes(value)) errors.push(`Rule 48: '${label}:' must be one of ${TIERS.join('/')}`);
  const computed = suggestTier(ctx.subject);
  if (suggested && suggested !== computed) notes.push(`tier audit: the record's suggested tier is ${suggested}; the paths suggest ${computed}`);
  if (declared && TIERS.indexOf(declared) < TIERS.indexOf(computed)) notes.push(`tier audit: declared ${declared} is below the suggested ${computed} (the author's choice; see Tier rationale)`);
  need('Side effects', 74); need('Undo and recovery', 74); need('Multi-machine posture', 113);
  const layer = need('Layer below', 111);
  if (layer && /^none\b/i.test(layer)) errors.push("Rule 111: 'Layer below:' must name the foundation items checked");
  const bugClass = need('Bug class', 70);
  if (bugClass && !Object.hasOwn(BUG_CLASSES, bugClass)) errors.push(`Rule 70: 'Bug class:' must be one of ${Object.keys(BUG_CLASSES).join('/')}`);
  else if (bugClass && bugClass !== 'none') {
    const evidence = keyed(record.one('Bug evidence') ?? '');
    for (const key of BUG_CLASSES[bugClass]) {
      if (!evidence[key]) errors.push(`Rule 70: a ${bugClass} fix needs '${key}=' in 'Bug evidence:'`);
      else if (key !== 'live' && !ctx.exists(evidence[key])) errors.push(`Rule 70: bug evidence ${key}=${evidence[key]} does not exist`);
      else if (key === 'reproducer' && !ctx.subject.includes(evidence[key])) errors.push(`Rule 70: the reproducer ${evidence[key]} is not part of this change`);
    }
  }
  const bypass = need('Hook bypass', 101);
  if (bypass && !/^none\b/i.test(bypass)) {
    const b = keyed(bypass);
    for (const key of ['scope', 'request', 'disclosed']) if (!b[key]) errors.push(`Rule 101: a hook bypass needs '${key}=' (exact scope, prior operator request, contemporaneous disclosure)`);
  }
  const convergence = need('Convergence', 65);
  if (convergence && !['none', 'claimed'].includes(convergence)) errors.push("Rule 65: 'Convergence:' must be none or claimed");
  for (const row of record.all('Residue')) {
    const [id, severity, basis] = pipe(row);
    if (!id || !RESIDUE_SEVERITIES.includes(severity) || !basis) errors.push(`Rule 65: residue '${row}' needs id | ${RESIDUE_SEVERITIES.join('/')} | severity basis`);
  }
  if (ctx.promptSourcesChanged.length && !record.one('Prompt review'))
    errors.push(`Rules 12/27: prompt sources changed (${ctx.promptSourcesChanged.join(', ')}); 'Prompt review:' must record the fixture-trigger and neutral-dispatch review`);
  const dispositions = new Map(record.all('Prompt finding').map(row => { const [id, disposition, reason] = pipe(row); return [id, { disposition, reason }]; }));
  for (const finding of ctx.promptFindings) {
    const d = dispositions.get(finding.id);
    const where = `${finding.promptFile}${finding.fixtureFile ? ` <- ${finding.fixtureFile}` : ''}: "${finding.phrase.slice(0, 80)}"`;
    if (!d || !Object.hasOwn(PROMPT_DISPOSITIONS, d.disposition) || !d.reason) errors.push(`Rules 12/27: prompt finding ${finding.id} (${finding.kind}) needs 'Prompt finding: ${finding.id} | disposition | reason' — ${where}`);
    else if (!PROMPT_DISPOSITIONS[d.disposition]) errors.push(`Rules 12/27: prompt finding ${finding.id} is dispositioned ${d.disposition}; repair the prompt — ${where}`);
  }
  const lineDispositions = (label, hits, rule, ok) => {
    const rows = new Map(record.all(label).map(row => { const [at, ...rest] = pipe(row); return [at, keyed(rest.join(';'))]; }));
    for (const hit of hits) {
      const d = rows.get(hit);
      if (!d || !ok(d)) errors.push(`Rule ${rule}: ${hit} needs '${label}: ${hit} | …' (${label === 'Deferral' ? 'commitment=<tracked ref> or not-a-deferral=<reason>' : 'quarantine=<defect doc> or scope=<reason>'})`);
    }
  };
  lineDispositions('Deferral', ctx.deferrals, '71', d => !!d.commitment || !!d['not-a-deferral']);
  lineDispositions('Skip', ctx.skips, '37', d => (d.quarantine ? ctx.exists(d.quarantine) : !!d.scope));
  for (const [label, rule] of [['simplestRobustRoute', 116], ['80/20', 116], ['VERDICT', 116]]) {
    const value = record.closing[label];
    if (!value || PLACEHOLDER.test(value)) errors.push(`Rule ${rule}: the closing block needs '${label}:' as one of its last three lines`);
  }
  if (record.closing.simplestRobustRoute && wordCount(record.closing.simplestRobustRoute) < 5)
    errors.push('Rule 116: simplestRobustRoute must state the route, not a word');
  return { errors, notes };
}

// Landing. entries: the change's ledger population (every kind, red included). ctx:
// { heads: commit ids in the change's own history, head, tree, record path, author, subject,
//   artifactHash(path) -> sha256|null, convergenceEligible(fn) }
export function landingVerdict(record, entries, ctx) {
  const errors = []; const notes = [];
  const inChange = entries.filter(e => ctx.heads.includes(e.head));
  const redone = new Set(entries.filter(e => e.kind === 'redo').map(e => e.target));
  const classified = new Set(entries.filter(e => e.kind === 'classification' && RED_CLASSES.includes(e.class)).map(e => e.target));
  const suites = inChange.filter(e => e.kind === 'suite' || e.kind === 'ci');
  const red = suites.filter(e => !(e.complete && e.success && e.exit === 0 && !e.dirty));
  for (const e of suites) notes.push(`evidence ${e.id} ${e.kind} ${e.head.slice(0, 8)} ${red.includes(e) ? 'RED' : 'green'}${e.complete === false ? ' (incomplete)' : ''}${classified.has(e.id) ? ' classified' : ''}${redone.has(e.id) ? ' redone' : ''}`);
  const exact = suites.filter(e => e.tree === ctx.tree && !red.includes(e) && e.kind === 'suite');
  if (!exact.length) errors.push(`Rule 37: no completed, clean, passing full-suite result for the exact tree ${ctx.tree}`);
  for (const e of red) if (!classified.has(e.id) && !redone.has(e.id)) errors.push(`Rule 107: red evidence ${e.id} (${e.kind} at ${e.head.slice(0, 8)}) carries no classification`);
  const passes = inChange.filter(e => e.kind === 'pass' && e.record === ctx.record);
  const accepted = passes.filter(p => p.verdict === 'accepted' && p.tree === ctx.tree);
  if (!accepted.length) errors.push(`Rule 74: no accepted independent review pass for the exact tree ${ctx.tree}`);
  for (const p of passes) {
    if (p.reviewer === ctx.author) errors.push(`Rule 65: pass ${p.id} names the author as its reviewer`);
    const hash = ctx.artifactHash(p.artifact);
    if (!hash || hash !== p.artifactSha256) errors.push(`Rule 74: pass ${p.id} review artifact ${p.artifact} is missing or changed since it was recorded`);
    if (/\.sample\.md$/.test(p.artifact)) errors.push(`Rule 74: pass ${p.id} links the sample record, not a real review`);
    const before = entries.filter(e => e.seq < p.seq && ctx.heads.includes(e.head) && (e.kind === 'suite' || e.kind === 'ci'));
    const submitted = new Set(p.submitted ?? []);
    for (const e of before) if (!submitted.has(e.id) && red.includes(e) && !redone.has(e.id)) errors.push(`Rule 107: red evidence ${e.id} was produced before pass ${p.id} but not submitted to it`);
  }
  if (record.one('Convergence') === 'claimed') {
    const final = accepted.at(-1);
    const residue = record.all('Residue').map(row => pipe(row)[0]);
    if (!final) errors.push('Rule 65: a convergence claim needs a machine-written accepted pass');
    else {
      const review = { closure: 'converged', reviewer: final.reviewer, independenceEvidence: final.independence ? [final.independence] : [],
        layerBelow: record.all('Layer below'), eligibleCases: ctx.subject, inspected: final.inspected ?? [], omitted: final.omitted ?? [] };
      const population = ctx.subject.map(id => ({ id, category: 'default', fact: id }));
      if (!ctx.convergenceEligible(review, ctx.author, population)) errors.push('Rule 65: the final pass does not account for every changed path (inspected or omitted with reason) with independence evidence and a layer-below account');
      for (const id of residue) if (!(final.residue ?? []).some(r => r.id === id)) errors.push(`Rule 65: residue ${id} was not accepted by the final pass`);
      for (const r of final.residue ?? []) if (!residue.includes(r.id)) errors.push(`Rule 65: residue ${r.id} accepted by the reviewer is missing from the record`);
    }
  }
  return { errors, notes };
}
