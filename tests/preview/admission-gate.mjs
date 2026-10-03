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
// - Admission. The tool hook asks here before a delegation or a consequential tool runs. A delegation is recorded
//   durably as a child edge of the claim's own edge before the subagent starts, and closed when its result returns;
//   a consequential tool passes the effect owner (`createToolEffectOwner`) with its exact operation and input.
//
// Credentials pass through in the child's own request headers and are neither read nor kept here. The server binds
// 127.0.0.1 only and serves only paths under its random secret, so another local process cannot spend a claim.
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { nestedSessionWorkClose, nestedSessionWorkEdge, sessionWorkEffect } from '../../src/assembly/production-session-work.js';

/** Where each harness's model calls go after admission: fixed, so this server can never be used to reach anything else. */
export const MODEL_UPSTREAMS = Object.freeze({ 'claude-code': Object.freeze({ host: 'api.anthropic.com', port: 443, secure: true }),
  'codex-cli': Object.freeze({ host: 'chatgpt.com', port: 443, secure: true }) });
/** Requests that reach the model endpoint but start no model call: counted as nothing. Every other POST is a call. */
const UNCOUNTED = Object.freeze([/^\/v1\/messages\/count_tokens(?:\?|$)/u]);
const claimPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/u;
const MAX_ADMIT_BYTES = 262144;

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
 * The effect owner a consequential tool call passes, with its exact operation and input, before it is dispatched. Its four
 * tests, in order: (1) authorization: the installed profile registers exactly this operation (a category is never
 * authority); (2) stop and fence: no stop is held and the claim is open; (3) stable identity: the call's identity is the
 * digest of the work item that owns it, the operation and the canonical input, and an identity already prepared refuses,
 * so the same send never goes twice (a retry of the same step included); (4) durable preparation: the request is appended
 * before the call is admitted, and an append that fails refuses. The returned result is what the gate consumes.
 */
export function createToolEffectOwner({ operations, append, prepared, stopped, now }) {
  const registered = new Set(operations);
  return Object.freeze({
    admit({ parent, tool, input }) {
      const operation = toolOperation(tool);
      if (!registered.has(operation)) return { admitted: false, reason: `effect owner: the installed profile registers no ${operation} operation `
        + `(registered: ${[...registered].join(', ') || 'none'}); refused by default` };
      if (stopped()) return { admitted: false, reason: 'effect owner: a stop is held' };
      const payload = digest(canonical(input));
      const identity = digest(`${parent.child}\n${operation}\n${payload}`);
      if (prepared(identity)) return { admitted: false, reason: `effect owner: ${operation} with this exact input was already prepared (${identity}); never sent twice` };
      try { append(sessionWorkEffect({ id: identity, edge: parent.id, operation, digest: payload, state: 'prepared', detail: 'admitted for dispatch', at: now() })); }
      catch { return { admitted: false, reason: 'effect owner: the request could not be recorded before dispatch' }; }
      return { admitted: true, reason: `effect owner: ${operation} admitted as ${identity}`, identity, operation, digest: payload };
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
    if (call.kind === 'delegation') {
      if (call.phase === 'post') {
        const open = state.delegations.get(id);
        if (open?.open) {
          append(nestedSessionWorkClose(open.edge, 'complete', 'the delegated agent returned its result to its parent',
            `tool-result:${id}`, Number.isSafeInteger(call.result_bytes) ? call.result_bytes : null, now()));
          open.open = false;
        }
        return { decision: 'allow', reason: 'delegation returned' };
      }
      if (state.delegations.has(id)) return { decision: 'deny', reason: 'admission: this delegation was already admitted' };
      const edge = nestedSessionWorkEdge(state.edge, { id, tool }, now());
      try { append(edge); } catch { return { decision: 'deny', reason: 'admission: the delegation edge could not be recorded' }; }
      state.delegations.set(id, { edge, open: true });
      return { decision: 'allow', reason: `delegation recorded as ${edge.id}: the subagent's calls and tools pass this same checkpoint` };
    }
    if (call.kind === 'effect') {
      if (call.phase === 'post') {
        const admitted = state.effects.get(id);
        if (admitted) { effects.observed({ parent: state.edge, ...admitted, resultBytes: Number(call.result_bytes) || 0 }); state.effects.delete(id); }
        return { decision: 'allow', reason: 'effect observed' };
      }
      const verdict = effects.admit({ parent: state.edge, tool, input: call.tool_input ?? null });
      if (!verdict.admitted) return { decision: 'deny', reason: verdict.reason };
      state.effects.set(id, { identity: verdict.identity, operation: verdict.operation, digest: verdict.digest });
      return { decision: 'allow', reason: verdict.reason };
    }
    return { decision: 'deny', reason: 'admission: unknown admission kind' };
  };

  const server = http.createServer((req, res) => {
    const match = /^\/([0-9a-f]{32})\/([^/]+)(\/.*)?$/u.exec(req.url ?? '');
    if (!match || match[1] !== secret) { req.resume(); return reply(res, 404, { error: 'not found' }); }
    const state = claims.get(match[2]), rest = match[3] ?? '/';
    if (!state || state.closed || stopped()) { req.resume(); return refuseModel(res, 'instar: this step is closed or stopped; nothing is dispatched'); }
    if (rest === '/admit') {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { body += chunk; if (body.length > MAX_ADMIT_BYTES) req.destroy(); });
      req.on('end', () => {
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
