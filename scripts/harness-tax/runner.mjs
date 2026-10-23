/** Standing measurement tool. Machine-local ledger; no production imports or credentials. */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tasks, parts, trustDimensions } from './catalog.mjs';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const setups = ['bare', 'instar1', 'instar2'];
const fail = message => { throw Error(`harness-tax: ${message}`); };
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function durable(path, value) {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  const directory = openSync(dirname(path), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}
const read = path => JSON.parse(readFileSync(path, 'utf8'));

export function validateConfig(config) {
  if (!['stub', 'live'].includes(config.mode) || !config.model || !config.start) fail('mode, exact model and start required');
  if (!Number.isFinite(Date.parse(config.start))) fail('invalid start');
  if (!Number.isInteger(config.maxCalls) || config.maxCalls < 1 || !finite(config.timeoutMs) || config.timeoutMs < 1) fail('finite limits required');
  const ids = config.taskIds ?? tasks.map(t => t.id);
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !tasks.some(t => t.id === id))) fail('unknown or duplicate task');
  const off = config.off ?? [];
  if (off.length > 1 || off.some(id => !parts.some(p => p.id === id && p.kind === 'compensating'))) fail('one compensating part at a time; floors cannot be disabled');
  if (config.mode === 'live') {
    if (!config.driverModule || !config.graderModule) fail('live driver and independent grader required');
    const forbidden = /adriana|amrch2388|sagemind-adriana|gearfinity3d|luna/i;
    const homes = [], bots = [], logins = [];
    for (const setup of setups) {
      const target = config.targets?.[setup];
      if (!target || target.disposable !== true || target.model !== config.model || !target.login || forbidden.test(target.login)) fail('disposable target with allowed login and identical model required');
      if (!target.root || !target.isolationReceipt || !target.floorReceipt || target.live === true) fail('isolated root and floor receipts required');
      if (forbidden.test(target.root)) fail('excluded target');
      homes.push(resolve(target.root)); logins.push(target.login);
      if (setup !== 'bare') { if (!target.bot || !target.channel) fail('own bot and demo channel required'); bots.push(target.bot); }
    }
    if (new Set(homes).size !== 3 || new Set(bots).size !== 2 || new Set(logins).size !== 3) fail('setups require separate roots, bots and logins');
  }
  return config;
}

export function initialize(root, config) {
  validateConfig(config);
  mkdirSync(root, { mode: 0o700 }); // exclusive: never adopt another experiment or a live root
  mkdirSync(join(root, 'events'), { mode: 0o700 });
  durable(join(root, 'experiment.json'), { version: 1, config, catalogDigest: digest(tasks), partsDigest: digest(parts) });
}

export function validateResult(result, request, wallMs) {
  if (!result || result.requestId !== request.id || result.model !== request.model) fail('uncorrelated result or model drift');
  if (!['complete', 'uncertain', 'failed', 'unsupported'].includes(result.state)) fail('missing outcome');
  if (!Array.isArray(result.evidence) || !result.evidence.length || !Array.isArray(result.breaches)) fail('evidence and breach census required');
  if (!result.observation || !Array.isArray(result.costs)) fail('observation and attributed costs required');
  const seen = new Set();
  for (const cost of result.costs) {
    if (!parts.some(p => p.id === cost.part) || !cost.id || seen.has(cost.id)) fail('unattributed or duplicate cost');
    seen.add(cost.id);
    for (const field of ['tokens', 'calls', 'wallMs']) if (cost[field] !== null && !finite(cost[field])) fail('invalid cost');
    if (!cost.evidence) fail('cost lacks evidence');
  }
  // Each adapter partitions sequential elapsed time; parallel spans must be allocated, not double-counted.
  const sum = field => result.costs.some(c => c[field] === null) ? null : result.costs.reduce((n, c) => n + c[field], 0);
  for (const field of ['tokens', 'calls']) {
    if (result.totals?.[field] !== null && !finite(result.totals?.[field])) fail('missing meter must be explicit null');
    if (sum(field) !== result.totals[field]) fail('cost ledger does not reconcile');
  }
  if (sum('wallMs') !== null && sum('wallMs') > wallMs + 1) fail('cost time exceeds observed wall time');
  const remainder = sum('wallMs') === null ? null : Math.max(0, wallMs - sum('wallMs'));
  return { ...result, costs: [...result.costs, { id: 'runner-overhead', part: 'harness-runtime', tokens: 0, calls: 0, wallMs: remainder, evidence: 'runner monotonic elapsed less attributed sequential spans' }], wallMs };
}

export function validateGrade(grade, task, result) {
  if (!grade || !grade.reviewer || grade.resultDigest !== digest(result) || !grade.reason || !grade.evidence?.length) fail('unbound grade');
  for (const field of ['correctness', ...task.trust]) {
    const value = field === 'correctness' ? grade.correctness : grade.trust?.[field];
    if (!['pass', 'fail', 'unknown'].includes(value)) fail('missing correctness or trust judgment');
  }
  if (result.state !== 'complete' && grade.correctness === 'pass') fail('uncertain result cannot pass');
  if (result.breaches.length && grade.trust?.constraintsHonoured === 'pass') fail('breach cannot honour constraints');
  if (!grade.cost || !grade.cost.evidence || ['tokens', 'calls', 'wallMs'].some(k => grade.cost[k] !== null && !finite(grade.cost[k]))) fail('grading costs required, including human/stub zeroes');
  return grade;
}

/** Port of 1.x LiveTestHarness's injected driver / correlated evidence pattern.
 * No retries: an ambiguous turn stays durable and requires reconciliation, never a second send. */
export async function runDay(root, day, driver, grader, now = () => Date.now()) {
  const experiment = read(join(root, 'experiment.json'));
  const config = validateConfig(experiment.config);
  if (digest(tasks) !== experiment.catalogDigest || digest(parts) !== experiment.partsDigest) fail('catalog changed during experiment');
  if (!Number.isInteger(day) || day < 0) fail('invalid day');
  if (config.mode === 'live' && now() < Date.parse(config.start) + day * 86400000) fail('stage is not due; no fake multi-day evidence');
  // wx is an exclusive process lock. A crash leaves it for explicit desk reconciliation.
  const lock = openSync(join(root, 'run.lock'), 'wx', 0o600);
  writeFileSync(lock, `${process.pid}\n`); fsyncSync(lock);
  try {
    const selected = tasks.filter(t => (config.taskIds ?? tasks.map(x => x.id)).includes(t.id));
    const events = readdirSync(join(root, 'events'));
    if (events.some(n => n.endsWith('.intent.json') && !events.includes(n.replace('.intent.json', '.result.json'))))
      fail('unfinished intent: reconcile before dispatch; no automatic replay');
    const prior = readdirSync(join(root, 'events')).filter(n => n.endsWith('.result.json')).map(n => read(join(root, 'events', n)));
    if (prior.some(r => r.result.totals.calls === null)) fail('unknown call liability requires reconciliation');
    let calls = prior.reduce((n, r) => n + r.result.totals.calls + (r.grade.cost.calls ?? config.maxCalls), 0);
    for (const task of selected) for (const setup of setups) for (let index = 0; index < task.stages.length; index++) {
      const name = `${task.id}.${setup}.${index}`;
      const intent = join(root, 'events', `${name}.intent.json`);
      const done = join(root, 'events', `${name}.result.json`);
      if (existsSync(done)) {
        continue;
      }
      const step = task.stages[index];
      if (step.day !== day) continue;
      if (index && !existsSync(join(root, 'events', `${task.id}.${setup}.${index - 1}.result.json`))) fail('earlier stage missing');
      if (existsSync(intent)) fail('unfinished intent: reconcile before dispatch; no automatic replay');
      if (existsSync(join(root, 'STOP'))) fail('operator stop');
      if (calls >= config.maxCalls) fail('call cap reached');
      // Do not leak rubric, future prompts or expected answer into the target.
      const request = { id: name, model: config.model, setup, task: task.id, stage: index,
        ...step, timezone: config.timezone ?? 'America/Los_Angeles', start: config.start,
        fixtures: index === 0 ? task.fixtures : {}, off: setup === 'instar2' ? config.off ?? [] : [],
        target: config.targets?.[setup], deadlineMs: config.timeoutMs, remainingCalls: config.maxCalls - calls,
        mode: config.mode, experimentRoot: root };
      const at = now();
      if (config.mode === 'live' && index) {
        const previous = read(join(root, 'events', `${task.id}.${setup}.${index - 1}.intent.json`));
        const spacing = (step.day - task.stages[index - 1].day) * 86400000;
        if (!finite(previous.at) || !finite(at) || at - previous.at < spacing)
          fail('elapsed stage spacing not met; planned dates are not continuity evidence');
      }
      durable(intent, { request, at });
      const start = performance.now();
      const controller = new AbortController();
      let timer;
      let result;
      try {
        const raw = await Promise.race([
          driver.execute(request, { signal: controller.signal }),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('deadline')); }, config.timeoutMs); }),
        ]);
        result = validateResult(raw, request, performance.now() - start);
      } catch {
        durable(join(root, 'events', `${name}.interrupted.json`), { requestId: name, state: 'uncertain', reason: 'driver, correlation, metering or deadline failure; inspect host evidence; never retry blindly' });
        throw Error('target result uncertain');
      } finally { clearTimeout(timer); }
      if (result.totals.calls !== null && result.totals.calls > request.remainingCalls) result.breaches.push('call-cap');
      // Capture before grading: a failed grader never loses the target's result or resends its input.
      const capture = join(root, 'events', `${name}.capture.json`);
      durable(capture, result);
      const history = Array.from({ length: index }, (_, i) => read(join(root, 'events', `${task.id}.${setup}.${i}.result.json`)));
      const gradePacket = { task, result, requestId: name, history, finalStage: index === task.stages.length - 1,
        remainingCalls: request.remainingCalls - (result.totals.calls ?? request.remainingCalls) };
      durable(join(root, 'events', `${name}.grading-input.json`), gradePacket);
      let gradeTimer;
      const gradeController = new AbortController();
      let grade;
      try {
        grade = validateGrade(await Promise.race([
          grader.grade(gradePacket, { signal: gradeController.signal }),
          new Promise((_, reject) => { gradeTimer = setTimeout(() => { gradeController.abort(); reject(Error('grader deadline')); }, config.timeoutMs); }),
        ]), task, result);
      } finally { clearTimeout(gradeTimer); }
      if (grade.cost.calls !== null && grade.cost.calls > gradePacket.remainingCalls) {
        durable(join(root, 'events', `${name}.grading-breach.json`), { breach: 'call-cap', grade });
        fail('grader exceeded remaining call cap');
      }
      durable(done, { requestId: name, mode: config.mode, task: task.id, setup, stage: index, day, off: request.off, result, grade });
      if (result.totals.calls === null) fail('unknown call liability; captured result retained');
      calls += result.totals.calls + (grade.cost.calls ?? config.maxCalls);
      if (result.breaches.length) fail('constraint breach recorded; experiment stopped');
    }
  } finally {
    closeSync(lock);
    const { unlinkSync } = await import('node:fs'); unlinkSync(join(root, 'run.lock'));
  }
}

/** Archive ingestion is evidence, not a second parser of the agent's answer protocol. */
export function recordedObservation(row) {
  const state = row.state ?? row.result?.verdict ?? row.verdict ?? row.outcome?.state ?? row.outcome ?? row.modelOutcome;
  return { id: row.id ?? row.update ?? row.through, kind: row.kind ?? 'recorded-output', digest: digest(row),
    state: typeof state === 'string' ? state : 'unknown',
    output: row.output ?? row.raw ?? row.modelOutput ?? row.text ?? null,
    usage: row.usage ?? row.result?.usage ?? row.uncertainUsage ?? null };
}

export function table(rows, verdicts = []) {
  const cell = value => String(value ?? 'unknown').replaceAll('|', '\\|').replaceAll('\n', ' ');
  const lines = ['| Task / stage | Setup | Variant | Evidence | Correct | Trust | Wall ms | Tokens | Calls | Breaches | Cost attribution | Part judgment |',
    '|---|---|---|---|---|---|---:|---:|---:|---|---|---|'];
  for (const r of rows) lines.push('| ' + [ `${r.task}/${r.stage}`, r.setup, r.off?.length ? `off:${r.off.join(',')}` : 'baseline', r.mode, r.grade.correctness,
    trustDimensions.map(k => `${k}=${r.grade.trust[k] ?? 'n/a'}`).join('; '), r.result.wallMs.toFixed(3),
    r.result.totals.tokens, r.result.totals.calls, r.result.breaches.join(', ') || 'none observed',
    [...r.result.costs, { ...r.grade.cost, part: 'grading' }].map(c => `${c.part} (${parts.find(p => p.id === c.part).kind}): ${c.tokens ?? '?'} tokens, ${c.calls ?? '?'} calls, ${c.wallMs === null ? '?' : Math.round(c.wallMs)} ms`).join('; '),
    [...new Set(r.result.costs.map(c => c.part))].map(id => {
      const v = verdicts.find(v => v.part === id);
      return v ? `${id}: ${v.verdict}; ${v.reason}; evidence=${v.evidence.join(',')}` : `${id}: change (collect paired live evidence; current evidence=${r.mode})`;
    }).join('; '),
  ].map(cell).join(' | ') + ' |');
  return lines.join('\n') + '\n';
}

/** Verdicts are independent judgments. Exact guards prevent unsupported cost-only cuts. */
export function partVerdict(partId, baseline, ablated, judgment) {
  const part = parts.find(p => p.id === partId);
  if (!part || !['keeps-its-cost', 'cut', 'change'].includes(judgment?.verdict) || !judgment.reason || !judgment.evidence?.length) fail('verdict and separately falsifiable evidence/reason required');
  if (judgment.verdict !== 'cut') return { part: partId, kind: part.kind, ...judgment };
  if (part.kind !== 'compensating') fail('infrastructure cannot be a cost-only cut');
  const expectedKeys = tasks.flatMap(t => t.stages.map((_, i) => `${t.id}.${i}`));
  const key = r => `${r.task}.${r.stage}`;
  for (const rows of [baseline, ablated]) {
    if (rows.length !== expectedKeys.length || new Set(rows.map(key)).size !== expectedKeys.length) fail('cut needs the whole staged task set');
    if (rows.some(r => r.mode !== 'live' || r.setup !== 'instar2' || r.result.state !== 'complete' || r.result.breaches.length || r.result.costs.some(c => c.tokens === null || c.calls === null || c.wallMs === null))) fail('cut needs complete live metering and no breaches');
  }
  for (const k of expectedKeys) {
    const a = baseline.find(r => key(r) === k), b = ablated.find(r => key(r) === k);
    if (!a || !b || a.result.model !== b.result.model || a.off.length || b.off.length !== 1 || b.off[0] !== partId) fail('unmatched A/B pair');
    const task = tasks.find(t => t.id === a.task);
    // Final grading sees the complete trajectory. Interim stages are not premature verdicts on promises.
    if (a.stage !== task.stages.length - 1) continue;
    for (const dimension of ['correctness', ...task.trust]) {
      const score = r => dimension === 'correctness' ? r.grade.correctness : r.grade.trust[dimension];
      if (![score(a), score(b)].every(s => ['pass', 'fail'].includes(s)) || score(a) === 'pass' && score(b) !== 'pass') fail('cut would lower correctness/trust or rely on unknowns');
    }
  }
  return { part: partId, kind: part.kind, ...judgment };
}

async function main() {
  const [command, rootArg, arg] = process.argv.slice(2), root = rootArg && resolve(rootArg);
  if (!root) fail('usage: runner.mjs init|run|report|compare ROOT CONFIG.json|DAY|OFF_ROOT [JUDGMENTS.json]');
  if (command === 'init') return initialize(root, read(arg));
  if (command === 'run') {
    const { config } = read(join(root, 'experiment.json'));
    validateConfig(config);
    const stub = await import('./stub.mjs');
    const driver = config.mode === 'stub' ? stub.driver : await import(pathToFileURL(resolve(config.driverModule)).href);
    const grader = config.mode === 'stub' ? stub.grader : await import(pathToFileURL(resolve(config.graderModule)).href);
    return runDay(root, Number(arg), driver, grader);
  }
  if (command === 'report') {
    const rows = readdirSync(join(root, 'events')).filter(n => n.endsWith('.result.json')).sort().map(n => read(join(root, 'events', n)));
    process.stdout.write(table(rows)); return;
  }
  if (command === 'compare') {
    const loadRows = directory => readdirSync(join(directory, 'events')).filter(n => n.endsWith('.result.json')).sort().map(n => read(join(directory, 'events', n)));
    const baseline = loadRows(root), ablated = loadRows(resolve(arg)).filter(r => r.setup === 'instar2');
    const judgments = read(process.argv[5]);
    if (!Array.isArray(judgments)) fail('judgments must be an array');
    const verified = judgments.map(j => partVerdict(j.part, baseline.filter(r => r.setup === 'instar2'), ablated, j));
    process.stdout.write(table([...baseline, ...ablated], verified)); return;
  }
  fail('unknown command');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => {
  // Target/grader errors may contain private text. Local captures remain available to the desk.
  process.stderr.write('harness-tax: run refused or interrupted; inspect local intent/capture and configuration. No automatic retry.\n'); process.exitCode = 1;
});
