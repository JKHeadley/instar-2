// The host's one admission checkpoint for a harness it delegates to (Part fifteen §5 in docs/19-scheduled-work; Rules 1,
// 60, 75, 114): a loopback server this runner owns, which every child of a delegated session step or a Codex tool turn
// reaches before anything it does leaves the host.
//
// - Model dispatch. The child's harness is pointed at this server as its model endpoint (Claude Code through
//   ANTHROPIC_BASE_URL, Codex through a provider whose base URL is this server), so EVERY model call the child makes,
//   its harness-internal calls and its subagents' calls included, passes here before it is forwarded to the fixed
//   upstream. Each call takes one unit of the claim's reserved allowance first; a call that finds none left is refused
//   here and never dispatched. A closed claim, or a held stop, refuses every call, so a child that outlives its step
//   cannot spend.
// - Admission. The tool hook asks here before EVERY tool call of a gated step runs, so a closed claim or a held stop
//   refuses ordinary work too, not only model calls. A delegation is recorded durably as a child edge of the claim's own
//   edge before the subagent starts, and closed only on evidence of its result: a synchronous delegation's returned
//   result, or, for an asynchronous spawn (whose immediate return is only the child's handle), the harness's own wait
//   reporting that exact child completed with its result. A bare wake-up is not that evidence. A consequential tool passes the
//   effect owner (`createToolEffectOwner`) with its exact operation and input; it decides by the effect doorway's four tests.
//
// Credentials pass through in the child's own request headers and are neither read nor kept here. The server binds
// 127.0.0.1 only and serves only paths under its random secret, so another local process cannot spend a claim.
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { nestedSessionWorkClose, nestedSessionWorkEdge, sessionWorkEffect } from '../../src/assembly/production-session-work.js';
import { doorwayRecord } from './tool-admission.mjs';

/** Where each harness's model calls go after admission: fixed, so this server can never be used to reach anything else. */
export const MODEL_UPSTREAMS = Object.freeze({ 'claude-code': Object.freeze({ host: 'api.anthropic.com', port: 443, secure: true }),
  'codex-cli': Object.freeze({ host: 'chatgpt.com', port: 443, secure: true }) });
/** Requests that reach the model endpoint but start no model call: counted as nothing. Every other POST is a call. */
const UNCOUNTED = Object.freeze([/^\/v1\/messages\/count_tokens(?:\?|$)/u]);
const claimPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/u;
const MAX_ADMIT_BYTES = 262144;
/** Delegation tools whose return is the new child's handle, never its result (Codex 0.156.1, recorded 2026-10-03). */
const ASYNC_SPAWN_TOOLS = Object.freeze(['spawn_agent', 'collaborationspawn_agent']);
/** A tool excerpt as the hook sends it (JSON text, possibly of a JSON string): its value, unwrapped; null if unreadable. */
const unwrap = text => { let value = text; for (let depth = 0; depth < 3 && typeof value === 'string'; depth++) {
  try { value = JSON.parse(value); } catch { return depth === 0 ? null : value; } } return value; };

/** A stable rendering of a tool input: object keys sorted at every depth, so one operation has one digest. */
export const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value ?? null);
const digest = text => `sha256:${createHash('sha256').update(text).digest('hex')}`;
/** The exact operation a consequential tool call names: `mcp:<server>:<tool>` for an MCP tool, `tool:<name>` otherwise. */
export function toolOperation(tool) {
  const mcp = /^mcp__([^_].*?)__(.+)$/u.exec(String(tool));
  return mcp ? `mcp:${mcp[1]}:${mcp[2]}` : `tool:${String(tool)}`;
}

/**
 * The effect owner a consequential (or policy-named) tool call passes, with its exact operation and input, before it is
 * dispatched. In order: (1) authorization: `decide(tool, input)` is the effect doorway's decision for the call
 * (tool-admission.mjs admitToolCallEffect: the purpose's four consequential-effect tests under the installation's current
 * effect policy, its grants and the accepted closed operation set, so an ordinary or granted operation passes and an
 * ungranted consequential one, or any under a policy that cannot be read, refuses); (2) stop and fence: no stop is held
 * and the claim is open; (3) stable identity: a consequential call's identity is the digest of the work item that owns it,
 * the operation and the canonical input, and an identity already prepared refuses, so the same send never goes twice (a
 * retry of the same step included); an ordinary one (no test holds) is identified by its call as well, since repeating
 * it is harmless; (4) durable preparation: the request is appended before the call is admitted, and an append that fails
 * refuses. The returned result (with the doorway's record) is what the gate consumes.
 */
export function createToolEffectOwner({ decide, append, prepared, stopped, now }) {
  return Object.freeze({
    admit({ parent, tool, input, call }) {
      const operation = toolOperation(tool);
      let verdict;
      try { verdict = decide(tool, input); } catch (error) { return { admitted: false, reason: `effect owner: the effect doorway could not decide (${String(error?.message ?? error)}); refused` }; }
      const doorway = doorwayRecord(verdict);
      if (!verdict.admitted) return { admitted: false, reason: verdict.reason, doorway };
      if (stopped()) return { admitted: false, reason: 'effect owner: a stop is held', doorway };
      const payload = digest(canonical(input));
      const identity = digest(`${parent.child}\n${operation}\n${payload}${verdict.consequential ? '' : `\n${String(call)}`}`);
      if (prepared(identity)) return { admitted: false, reason: `effect owner: ${operation} with this exact input was already prepared (${identity}); never sent twice`, doorway };
      try { append(sessionWorkEffect({ id: identity, edge: parent.id, operation, digest: payload, state: 'prepared', detail: 'admitted for dispatch', at: now() })); }
      catch { return { admitted: false, reason: 'effect owner: the request could not be recorded before dispatch', doorway }; }
      return { admitted: true, reason: `${verdict.reason}; effect owner: ${operation} prepared as ${identity}`, identity, operation, digest: payload, doorway };
    },
    observed({ parent, identity, operation, digest: payload, resultBytes }) {
      append(sessionWorkEffect({ id: identity, edge: parent.id, operation, digest: payload, state: 'observed',
        detail: `the tool returned ${resultBytes} bytes`, at: now() }));
    },
  });
}

/**
 * Starts the checkpoint. `append` writes one durable record (a child edge, its close, an effect record) and throws when it
 * cannot; `effects` is the effect owner; `stopped` is the runner's stop authority. `upstreams` and `request` exist so a test
 * can stand in for the provider; production uses the fixed upstreams over TLS.
 */
export async function createAdmissionGate({ append, effects, stopped, now, upstreams = MODEL_UPSTREAMS, request = null }) {
  const secret = randomBytes(16).toString('hex');
  const claims = new Map();
  const reply = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const refuseModel = (res, message) => reply(res, 400, { type: 'error', error: { type: 'invalid_request_error', message } });

  const admit = (state, call) => {
    const tool = String(call.tool_name ?? ''), id = String(call.tool_use_id ?? '');
    if (!/^[A-Za-z0-9._:-]{1,200}$/u.test(id)) return { decision: 'deny', reason: 'admission: exact tool call identity required' };
    if (call.kind === 'tool') return { decision: 'allow', reason: 'admission: the step is open and no stop is held' };
    if (call.kind === 'wait') {
      // The harness's own wait on its children. A wait that returns is a wake-up (any mailbox activity, a progress
      // message included), never by itself a child's completion. An edge closes only on per-child terminal evidence:
      // the wait's `status` map naming that child's handle with a `completed` result. Anything else (the bare
      // "Wait completed." Codex 0.156.1 returns, a timeout, a running or errored child) leaves the edge open for the
      // parent to settle as uncertain.
      const result = unwrap(call.result_excerpt);
      const status = result && typeof result === 'object' && result.status && typeof result.status === 'object' ? result.status : null;
      if (!status) return { decision: 'allow', reason: 'wait: no per-child completion evidence' };
      let finished = 0;
      for (const row of state.delegations.values()) {
        if (!row.open || !row.async) continue;
        const reported = row.handles.map(handle => status[handle]).find(value => value !== undefined);
        const text = reported && typeof reported === 'object' && typeof reported.completed === 'string' ? reported.completed : null;
        if (text === null) continue;
        append(nestedSessionWorkClose(row.edge, 'complete', 'the harness reported this delegated agent completed with its result',
          `tool-result:${id}`, Buffer.byteLength(text, 'utf8'), now()));
        row.open = false; finished += 1;
      }
      return { decision: 'allow', reason: `wait: ${finished} delegated agent(s) reported completed` };
    }
    if (call.kind === 'delegation') {
      if (call.phase === 'post') {
        const open = state.delegations.get(id);
        if (open?.open) {
          // An asynchronous spawn returns the child's handle, not its result: the edge stays open, holding the handle,
          // until the harness's wait reports the child finished (or the parent closes it as uncertain).
          if (ASYNC_SPAWN_TOOLS.includes(tool) || call.background === true) {
            const handle = unwrap(call.result_excerpt), input = unwrap(call.input_excerpt);
            open.async = true;
            open.handles = [handle?.task_name, handle?.agent_id, handle?.id, input?.task_name]
              .filter(value => typeof value === 'string' && value.length > 0);
            return { decision: 'allow', reason: `delegation started (${open.handles.join(', ') || 'no handle'}); its edge stays open until its result` };
          }
          append(nestedSessionWorkClose(open.edge, 'complete', 'the delegated agent returned its result to its parent',
            `tool-result:${id}`, Number.isSafeInteger(call.result_bytes) ? call.result_bytes : null, now()));
          open.open = false;
        }
        return { decision: 'allow', reason: 'delegation returned' };
      }
      if (state.delegations.has(id)) return { decision: 'deny', reason: 'admission: this delegation was already admitted' };
      const edge = nestedSessionWorkEdge(state.edge, { id, tool }, now());
      try { append(edge); } catch { return { decision: 'deny', reason: 'admission: the delegation edge could not be recorded' }; }
      state.delegations.set(id, { edge, open: true, async: false, handles: [] });
      return { decision: 'allow', reason: `delegation recorded as ${edge.id}: the subagent's calls and tools pass this same checkpoint` };
    }
    if (call.kind === 'effect') {
      if (call.phase === 'post') {
        const admitted = state.effects.get(id);
        if (admitted) { effects.observed({ parent: state.edge, ...admitted, resultBytes: Number(call.result_bytes) || 0 }); state.effects.delete(id); }
        return { decision: 'allow', reason: 'effect observed' };
      }
      if (state.effects.has(id)) return { decision: 'deny', reason: 'admission: this effect was already admitted' };
      const verdict = effects.admit({ parent: state.edge, tool, input: call.tool_input ?? null, call: id });
      const record = verdict.doorway ? { doorway: verdict.doorway } : {};
      if (!verdict.admitted) return { decision: 'deny', reason: verdict.reason, ...record };
      state.effects.set(id, { identity: verdict.identity, operation: verdict.operation, digest: verdict.digest });
      return { decision: 'allow', reason: verdict.reason, ...record };
    }
    return { decision: 'deny', reason: 'admission: unknown admission kind' };
  };

  const server = http.createServer((req, res) => {
    const match = /^\/([0-9a-f]{32})\/([^/]+)(\/.*)?$/u.exec(req.url ?? '');
    if (!match || match[1] !== secret) { req.resume(); return reply(res, 404, { error: 'not found' }); }
    const state = claims.get(match[2]), rest = match[3] ?? '/';
    if (!state || state.closed || stopped()) {
      req.resume();
      return rest === '/admit' ? reply(res, 200, { decision: 'deny', reason: 'admission: this step is closed or a stop is held; nothing runs' })
        : refuseModel(res, 'instar: this step is closed or stopped; nothing is dispatched');
    }
    if (rest === '/admit') {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { body += chunk; if (body.length > MAX_ADMIT_BYTES) req.destroy(); });
      req.on('end', () => {
        // Authority is read again now the whole request is here: a claim closed or a stop raised while the body was
        // arriving refuses, so nothing is admitted on a reading taken before the withdrawal.
        if (state.closed || claims.get(match[2]) !== state || stopped())
          return reply(res, 200, { decision: 'deny', reason: 'admission: this step is closed or a stop is held; nothing runs' });
        let verdict;
        try { verdict = admit(state, JSON.parse(body)); } catch { verdict = { decision: 'deny', reason: 'admission: request unreadable or unrecordable' }; }
        reply(res, 200, verdict);
      });
      return undefined;
    }
    // Model dispatch: the allowance is taken before the call is forwarded, and a call past it is never forwarded.
    if (req.method === 'POST' && !UNCOUNTED.some(pattern => pattern.test(rest))) {
      if (state.calls >= state.allowance) {
        state.refused = true; req.resume();
        return refuseModel(res, `instar: this step's reserved model-call allowance (${state.allowance}) is used; the call was not dispatched`);
      }
      state.calls += 1;
    }
    const upstream = upstreams[state.framework];
    const headers = { ...req.headers, host: upstream.host };
    delete headers.connection;
    const send = request ?? (upstream.secure ? https.request : http.request);
    const forwarded = send({ host: upstream.host, port: upstream.port, path: rest, method: req.method, headers }, answer => {
      res.writeHead(answer.statusCode ?? 502, answer.headers); answer.pipe(res);
    });
    forwarded.on('error', () => { if (!res.headersSent) reply(res, 502, { error: 'upstream unavailable' }); else res.destroy(); });
    req.pipe(forwarded);
    return undefined;
  });
  // A streaming upgrade would carry calls this server cannot count, so none is accepted: the harness uses HTTP.
  server.on('upgrade', (_req, socket) => socket.destroy());
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  return Object.freeze({
    /** The model endpoint and admission root for one claim. */
    base(claim) { if (!claimPattern.test(claim)) throw Error('admission gate: exact claim required'); return `http://127.0.0.1:${port}/${secret}/${claim}`; },
    /** Opens a claim with its reserved allowance and the edge its delegations hang from; a new open starts from nothing. */
    open(claim, { framework, allowance, edge }) {
      if (!claimPattern.test(claim) || !upstreams[framework] || !Number.isSafeInteger(allowance) || allowance < 1 || !edge?.id)
        throw Error('admission gate: claim, framework, allowance and edge required');
      claims.set(claim, { framework, allowance, edge, calls: 0, refused: false, closed: false, delegations: new Map(), effects: new Map() });
    },
    /** Closes a claim: no further call or admission passes. Returns its final state. */
    close(claim) { const state = claims.get(claim); if (state) state.closed = true; return this.state(claim); },
    /** Calls admitted, whether one was refused at the ceiling, and the child edges still open; null for an unknown claim. */
    state(claim) {
      const state = claims.get(claim);
      return state ? { calls: state.calls, refused: state.refused, closed: state.closed,
        openDelegations: [...state.delegations.values()].filter(row => row.open).map(row => row.edge) } : null;
    },
    /** Marks a still-open child edge settled by its parent (the parent closes it, never this server). */
    settle(claim, edgeId) { const row = [...(claims.get(claim)?.delegations.values() ?? [])].find(entry => entry.edge.id === edgeId); if (row) row.open = false; },
    closeAll() { for (const state of claims.values()) state.closed = true; },
    /** Stops the server; open keep-alive connections are ended, so a stop never waits on an idle harness. */
    stop() { for (const state of claims.values()) state.closed = true; server.closeAllConnections();
      return new Promise(resolve => server.close(() => resolve())); },
  });
}
