import { redact } from '../../src/recall/redact.js';

/** Physical limits a launch can end at: its elapsed and output bounds, and the
 * host resource owner's memory/process/CPU/aggregate ceilings and admission. */
export const RESOURCE_LIMITS = Object.freeze(['timeout', 'size', 'memory', 'processes', 'cpu', 'aggregate', 'capacity']);

/** Physical outcome; calls retain a scrubbed UTF-8 excerpt (at most 4096 bytes). */
export function subscriptionCallOutcome(result, promptBytes, elapsedMs, maxTokens, maxOutputBytes, scrub = text => redact(text).text) {
  let frame = null;
  if (!result.limited) try { frame = JSON.parse(result.stdout); } catch { /* No parseable frame. */ }
  const object = frame && typeof frame === 'object' && !Array.isArray(frame) ? frame : null;
  const type = object?.type === 'result' ? 'result' : object ? 'other' : null;
  const knownSubtypes = new Set(['success', 'error_max_turns', 'error_during_execution', 'error_max_budget_usd']);
  const subtype = type === 'result' ? knownSubtypes.has(object.subtype) ? object.subtype : 'other' : null;
  const isError = type === 'result' && typeof object.is_error === 'boolean' ? object.is_error : null;
  const tokens = object?.usage?.output_tokens;
  const outputTokens = Number.isSafeInteger(tokens) && tokens >= 0 ? tokens : null;
  const code = Number.isSafeInteger(result.code) && result.code >= 0 ? result.code : null;
  const localLimit = RESOURCE_LIMITS.includes(result.localLimit) ? result.localLimit
    : !result.limited && type === 'result' && outputTokens !== null && outputTokens > maxTokens ? 'output-cap'
    : !result.limited && type === 'result' && typeof object.result === 'string'
      && Buffer.byteLength(object.result) > maxOutputBytes ? 'size' : null;
  // Capture at the physical boundary, before a downstream parser can reject an otherwise
  // successful terminal frame. Completed calls already retain their model output; this small
  // excerpt also covers malformed answers and crashes between physical and logical recording.
  const diagnostic = {
    signal: typeof result.signal === 'string' && /^SIG[A-Z0-9]{1,16}$/u.test(result.signal) ? result.signal : null,
    cancellationReason: ['stopped', 'stdin-error', 'gate-error', 'spawn-error', 'physical-error'].includes(result.cancellationReason)
      ? result.cancellationReason : null,
    limited: Boolean(result.limited),
    rawOutputExcerpt: boundedExcerpt(result.rawOutput ?? result.stdout ?? '', scrub, result.rawError ? 3072 : 4096),
    ...(result.rawError ? { rawErrorExcerpt: boundedExcerpt(result.rawError, scrub, 1024) } : {}),
  };
  return { exitCode: code, localLimit, elapsedMs: Math.max(0, Math.round(elapsedMs)), type, subtype, isError,
    outputTokens, promptBytes, diagnostic, ...(result.resources ? { resources: launchResources(result.resources) } : {}) };
}

function boundedExcerpt(raw, scrub, limit) {
  // Scrub BEFORE clipping: a credential straddling the excerpt boundary must not leave a prefix.
  let clean;
  try { clean = scrub(typeof raw === 'string' ? raw : ''); }
  catch { clean = '[provider excerpt unavailable: secret scrub failed]'; }
  let excerpt = Buffer.from(clean).subarray(0, limit).toString('utf8');
  while (Buffer.byteLength(excerpt) > limit) excerpt = excerpt.slice(0, -1);
  // Clipping can split a redaction marker into text the journal rejects as a credential.
  // Omit only that diagnostic excerpt; never let evidence capture discard a completed call.
  return redact(excerpt).count > 0 ? '[provider excerpt omitted: redaction boundary]' : excerpt;
}

/** The content-free resource facts of one owned launch: which bounds held hard (and on which subject),
 * its admission, observed peaks, and the repair it needed. Kept on the call-outcome row, so they
 * survive restart and compaction. */
function launchResources(r) {
  const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
  const hold = value => ['hard', 'sampled', 'unavailable', 'unsupported'].includes(value) ? value : 'unavailable';
  const uid = r.uidProcesses, admission = r.admission;
  return { enforcement: Object.fromEntries(['cpuPerProcess', 'handlesPerProcess', 'processGrowth', 'treeHandles', 'memory', 'treeCpu']
    .map(key => [key, hold(r.enforcement?.[key])])),
    ...(uid && typeof uid === 'object' ? { uidProcesses: uid.state === 'hard' && /^uid:\d+$/u.test(uid.subject)
      && Number.isSafeInteger(uid.limit) && uid.limit > 0
      ? { state: 'hard', subject: uid.subject, limit: uid.limit } : { state: 'unavailable', subject: null, limit: null } } : {}),
    ...(admission && ['answer', 'review', 'maintenance'].includes(admission.work) && Number.isSafeInteger(admission.concurrent)
      && admission.concurrent >= 1 ? { admission: { work: admission.work, concurrent: admission.concurrent, waitedMs: count(admission.waitedMs) } } : {}),
    peakMemoryBytes: count(r.peakMemoryBytes), peakProcesses: count(r.peakProcesses), treeCpuMilliseconds: count(r.treeCpuMilliseconds),
    census: ['none', 'complete', 'partial', 'failed'].includes(r.census) ? r.census : 'none',
    leakedDescendants: count(r.leakedDescendants), cleanup: ['verified', 'unconfined'].includes(r.cleanup) ? r.cleanup : 'unresolved',
    ...(['working-area-joined', 'unconfined'].includes(r.membership) ? { membership: r.membership } : {}),
    ...(r.allocation && /^allocation:sha256:[a-f0-9]{64}$/u.test(r.allocation.set) && ['returned', 'reserved'].includes(r.allocation.state)
      ? { allocation: { set: r.allocation.set, state: r.allocation.state } } : {}) };
}

/** Append the physical result before the adapter can classify or discard it. */
export function observedSubscriptionIO(physicalIO, policy, operation, append,
  clock = { elapsed: () => performance.now(), at: () => Date.now() }, scrub = text => redact(text).text) {
  const role = operation.endsWith(':reply-review') || operation.endsWith(':reply-revision')
    || operation.endsWith(':revision-review') || operation.endsWith(':held-notice-review') ? 'reply-review'
    : operation.startsWith('summary:') ? 'summary' : 'model';
  return { ...physicalIO, execute: async command => {
    // Preflights carry no input; model commands carry the prepared packet. Tool
    // settings, MCP and session arguments extend the policy's base arguments.
    if (typeof command.stdin !== 'string' || command.stdin.length === 0) return physicalIO.execute(command);
    const start = clock.elapsed();
    let result, failed = false;
    try { result = await physicalIO.execute(command); }
    catch {
      failed = true;
      result = { code: null, limited: true, localLimit: null, cancellationReason: 'physical-error', stdout: '', stdoutBytes: new Uint8Array() };
    }
    append({ kind: 'call-outcome', id: operation, role,
      outcome: subscriptionCallOutcome(result, Buffer.byteLength(command.stdin), clock.elapsed() - start,
        policy.maxTokens, policy.maxOutputBytes, scrub), at: clock.at() });
    if (failed) throw Error('preview: subscription physical invocation failed');
    return result;
  } };
}
