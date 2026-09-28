/** Physical limits a launch can end at: its elapsed and output bounds, and the
 * host resource owner's memory/process/CPU/aggregate ceilings and admission. */
export const RESOURCE_LIMITS = Object.freeze(['timeout', 'size', 'memory', 'processes', 'cpu', 'aggregate', 'capacity']);

/** Content-free physical outcome of one subscription CLI model invocation. */
export function subscriptionCallOutcome(result, promptBytes, elapsedMs, maxTokens, maxOutputBytes) {
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
  return { exitCode: code, localLimit, elapsedMs: Math.max(0, Math.round(elapsedMs)), type, subtype, isError,
    outputTokens, promptBytes, ...(result.resources ? { resources: launchResources(result.resources) } : {}) };
}

/** The content-free resource facts of one owned launch: which bounds held hard, its observed peaks,
 * and the repair it needed. Kept on the call-outcome row, so they survive restart and compaction. */
function launchResources(r) {
  const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
  const hold = value => ['hard', 'sampled', 'unavailable'].includes(value) ? value : 'unavailable';
  return { enforcement: Object.fromEntries(['cpuPerProcess', 'handlesPerProcess', 'processGrowth', 'treeHandles', 'memory', 'treeCpu']
    .map(key => [key, hold(r.enforcement?.[key])])),
    peakMemoryBytes: count(r.peakMemoryBytes), peakProcesses: count(r.peakProcesses), treeCpuMilliseconds: count(r.treeCpuMilliseconds),
    census: ['none', 'complete', 'partial', 'failed'].includes(r.census) ? r.census : 'none',
    leakedDescendants: count(r.leakedDescendants), cleanup: r.cleanup === 'verified' ? 'verified' : 'unresolved' };
}

/** Append the physical result before the adapter can classify or discard it. */
export function observedSubscriptionIO(physicalIO, policy, operation, append,
  clock = { elapsed: () => performance.now(), at: () => Date.now() }) {
  const role = operation.endsWith(':reply-review') ? 'reply-review'
    : operation.startsWith('summary:') ? 'summary' : 'model';
  return { ...physicalIO, execute: async command => {
    if (JSON.stringify(command.args) !== JSON.stringify(policy.args)) return physicalIO.execute(command);
    const start = clock.elapsed();
    let result, failed = false;
    try { result = await physicalIO.execute(command); }
    catch {
      failed = true;
      result = { code: null, limited: true, localLimit: null, stdout: '', stdoutBytes: new Uint8Array() };
    }
    append({ kind: 'call-outcome', id: operation, role,
      outcome: subscriptionCallOutcome(result, Buffer.byteLength(command.stdin), clock.elapsed() - start,
        policy.maxTokens, policy.maxOutputBytes), at: clock.at() });
    if (failed) throw Error('preview: subscription physical invocation failed');
    return result;
  } };
}
