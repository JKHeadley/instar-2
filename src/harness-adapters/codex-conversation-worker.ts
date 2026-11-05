import { createHash } from 'node:crypto';
import { codexConversationRequests as requests, createCodexTurnReader, CODEX_CONVERSATION_CONFIG } from './codex-conversation.js';
import type { CodexThreadOptions } from './codex-conversation.js';
import type { SessionProtocolConnection, SessionProtocolIO } from './session-protocol.js';
import type { HarnessAdapterPort, HarnessInputDelivery, HarnessNormalizedObservation } from '../assembly/index.js';
import type { ProductionSessionConfig } from '../assembly/index.js';
import { admissionArgs, modelGateLaunch, sessionConnectorArgs } from '../assembly/index.js';
function ensure(value: unknown, detail: string): asserts value { if (!value) throw new Error(detail); }
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) ? value as Record<string, unknown> : {};
const idOf = (value: unknown) => { ensure(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value), 'protocol identity missing'); return value; };

/** One adapter, the same host queue/liability/intake as the terminal worker. Raw captures,
 * process custody and timeout enforcement are the injected physical boundary's job. */
export function createCodexConversationWorker(input: Readonly<{
  configuration(): ProductionSessionConfig; transport: SessionProtocolIO; resumeKey?: string;
  io: Pick<import('../assembly/index.js').SessionWorkIO, 'readResult' | 'clearResult'>;
  resolveDelivery(operation: string): HarnessInputDelivery | undefined;
  beforeLaunch?(claim: string): void; afterLaunch?(): void;
}>): HarnessAdapterPort<2> {
  let connection: SessionProtocolConnection | null = null, config: ProductionSessionConfig | null = null;
  let claim = '', incarnation = '', thread = '', operation = '', grounding = '';
  let accepted = false, acknowledgedAt: number | undefined;
  let reader: ReturnType<typeof createCodexTurnReader> | null = null;
  const send = (request: ReturnType<typeof requests.initialize>) => connection!.request(request.method, request.params);
  const guard = () => { ensure(config && !config.stopped(), 'conversation stopped'); };
  let frameCount = 0, idleDirty = false;
  const feed = () => { for (const frame of connection?.drain() ?? []) { frameCount++; if (reader && reader.snapshot().status !== 'open') idleDirty = true; reader?.consume(frame); }
    if (connection && !connection.alive()) reader?.lost(); };
  const verify = (value: { launch: string; claim: string; incarnation: string }) => {
    ensure(connection && value.launch === connection.identity && value.claim === claim && value.incarnation === incarnation,
      'stale conversation worker');
  };
  const idleFingerprint = (target: { launch: string; claim: string; incarnation: string }) => {
    verify(target); guard(); feed();
    const result = reader?.snapshot();
    return !config!.protectedSessions.includes(target.launch) && !config!.protectedSessions.includes(target.claim)
      && !idleDirty && connection!.alive() && result?.status === 'completed'
      ? hash(JSON.stringify([target.launch, target.claim, target.incarnation, operation, result, frameCount])) : null;
  };
  const api: HarnessAdapterPort<2> = {
    describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: true }),
    async launch(spec) {
      input.beforeLaunch?.(spec.claim); config = input.configuration(); guard();
      const pending = spec.restore && input.resolveDelivery(spec.restore.operation);
      if (spec.restore) ensure(!connection && accepted && operation === spec.restore.operation
        && pending && pending.digest === spec.restore.digest && hash(pending.text) === spec.restore.digest
        && pending.claim !== spec.claim && Number.isSafeInteger(spec.restore.deadline) && spec.restore.deadline > config.now(),
      'restore requires exact accepted input, closed prior worker and remaining lifetime');
      ensure(config.confinement === 'admitted' && config.toolAdmission && config.modelGate && config.model,
        'protocol worker requires tool and model admission and exact model');
      ensure(spec.workingScope === config.cwd, 'worker scope differs from admitted scope');
      claim = spec.claim; incarnation = spec.incarnation;
      const overrides = [...admissionArgs('codex-cli', config.toolAdmission, claim),
        ...modelGateLaunch('codex-cli', config.modelGate(claim)).args,
        ...sessionConnectorArgs('codex-cli', config.connectors?.(claim))];
      // Overrides are installed on the process and therefore apply to both start and resume.
      const options: CodexThreadOptions = { cwd: config.cwd, model: config.model,
        approvalPolicy: 'never', sandbox: 'danger-full-access', config: CODEX_CONVERSATION_CONFIG };
      const args = ['app-server', '--listen', 'stdio://', '-c', 'check_for_update_on_startup=false', ...overrides];
      const via = config.launchVia;
      connection = await input.transport.open({ claim, incarnation,
        executable: via?.[0] ?? config.executable,
        args: via ? [...via.slice(1, -1), '--stdio', via.at(-1)!, config.executable, ...args] : args,
        env: { PATH: '/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin', HOME: config.home, CODEX_HOME: config.configHome },
        cwd: config.cwd, deadline: Math.min(config.now() + config.turnDeadlineMs, spec.restore?.deadline ?? Infinity), maxProcesses: config.maxSessions,
        requestTimeoutMs: config.readyTimeoutMs ?? 30_000 });
      try {
        await send(requests.initialize()); guard(); const ready = requests.initialized(); connection.notify(ready.method, ready.params);
        const saved = config.io.load().resumes[claim] ?? config.io.load().resumes[input.resumeKey ?? claim];
        const hit = saved && config.io.transcriptExists('codex-cli', saved, config.cwd, config.configHome);
        // Missing native cache uses the host's complete grounding on the NEXT input, never a replay.
        const needsGrounding = !hit && (saved || config.continuationRequired?.());
        if (needsGrounding) {
          ensure(config.continuation, 'agent-owned continuation required');
          const context = config.continuation({ operation: spec.operation, claim, incarnation, reason: 'cache-miss' });
          ensure(context.text.trim() && context.source.trim(), 'complete continuation unavailable'); grounding = context.text;
        }
        const response = await send(hit ? requests.resume(saved, options) : requests.start(options)); guard();
        thread = idOf(object(object(response).thread).id);
        if (hit) ensure(thread === saved, 'resumed thread differs from checkpoint');
        const journal = config.io.load(); config.io.save({ ...journal, resumes: { ...journal.resumes, [claim]: thread, [input.resumeKey ?? claim]: thread } });
        reader = null; operation = ''; accepted = false; acknowledgedAt = undefined;
        input.afterLaunch?.();
        const worker = { launch: connection.identity, claim, incarnation };
        if (pending) ensure((await api.deliver({ ...pending, ...worker })).state === 'accepted', 'restored input was not accepted');
        return worker;
      } catch (error) {
        await connection.close();
        connection = null; reader = null;
        throw error;
      }
    },
    async deliver(delivery) {
      verify(delivery); guard(); feed();
      if (reader?.snapshot().status === 'open') return { state: 'busy-not-dispatched', evidence: operation };
      const admitted = input.resolveDelivery(delivery.operation);
      ensure(admitted && admitted.digest === delivery.digest && admitted.text === delivery.text && hash(delivery.text) === delivery.digest,
        'durable delivery bytes missing or changed');
      ensure(operation !== delivery.operation, 'input already submitted; no automatic replay');
      input.io.clearResult(delivery.resultPath);
      ensure(input.io.readResult(delivery.resultPath, delivery.maxBytes) === null, 'stale conversation result remains');
      operation = delivery.operation; reader = null; idleDirty = false; accepted = false; acknowledgedAt = undefined;
      // Host persists dispatch intent before calling this method. An RPC failure is uncertain.
      const submission = grounding ? `${grounding}\n\n${delivery.text}` : delivery.text;
      const journal = config!.io.load();
      ensure(!journal.protocolDeliveries?.some(row => row.operation === delivery.operation && row.identity === delivery.launch),
        'protocol input already prepared; no automatic replay');
      config!.io.save({ ...journal, protocolDeliveries: [...journal.protocolDeliveries ?? [], {
        operation: delivery.operation, identity: delivery.launch, claim, incarnation, digest: delivery.digest,
        submissionDigest: hash(submission), thread,
      }] });
      const response = await send(requests.deliver(thread, submission));
      const turn = object(object(response).turn);
      reader = createCodexTurnReader(thread, idOf(turn.id), delivery.maxBytes);
      feed(); guard(); grounding = ''; accepted = true;
      // The transport correlates the turn/start response to this exact submitted input.
      acknowledgedAt = config!.now();
      return { state: 'accepted', evidence: `${connection!.identity}:${thread}:${turn.id}` };
    },
    async notDispatched(delivery) {
      ensure(!connection, 'non-dispatch requires retired worker');
      const current = input.configuration();
      const saved = current.io.load().protocolDeliveries?.find(row => row.operation === delivery.operation && row.identity === delivery.launch);
      if (!saved || !input.transport.capture) return false; // Legacy/absent binding supplies no proof.
      ensure(saved.claim === delivery.claim && saved.incarnation === delivery.incarnation
        && saved.digest === delivery.digest && hash(delivery.text) === delivery.digest, 'non-dispatch input differs');
      const frames = input.transport.capture({ ...delivery, requireClosed: true }).map(object);
      // A complete, existing initialization capture plus no request for this
      // prepared submission proves no model dispatch. Any ambiguous request holds.
      return frames.some(row => row.direction === 'request' && object(row.frame).method === 'initialize')
        && !frames.some(row => row.direction === 'request' && object(row.frame).method === 'turn/start'
          && object(object(row.frame).params).threadId === saved.thread);
    },
    async observe(query) {
      // Carryover 08: a former host's completed result can be collected without
      // reconnecting its pipes, reopening admission or replaying a model request.
      if (!connection && query.delivery) {
        config = input.configuration(); guard();
        ensure(Number.isSafeInteger(query.cursor) && query.cursor >= 0 && query.cursor <= 2
          && Number.isSafeInteger(query.limit) && query.limit >= 1 && query.limit <= 64, 'bounded observation required');
        const delivery = query.delivery;
        const saved = config.io.load().protocolDeliveries?.find(row => row.operation === delivery.operation && row.identity === query.launch);
        ensure(saved && saved.claim === query.claim && saved.incarnation === query.incarnation
          && delivery.launch === query.launch && delivery.claim === query.claim && delivery.incarnation === query.incarnation
          && saved.digest === delivery.digest && hash(delivery.text) === delivery.digest && input.transport.capture,
        'protocol recovery input identity unavailable');
        const captures = input.transport.capture(query).map(object);
        const starts = captures.filter(row => row.direction === 'request').map(row => object(row.frame))
          .filter(frame => frame.method === 'turn/start' && object(frame.params).threadId === saved.thread
            && Array.isArray(object(frame.params).input) && (object(frame.params).input as unknown[]).length === 1
            && object((object(frame.params).input as unknown[])[0]).type === 'text'
            && typeof object((object(frame.params).input as unknown[])[0]).text === 'string'
            && hash(object((object(frame.params).input as unknown[])[0]).text as string) === saved.submissionDigest);
        ensure(starts.length === 1 && Number.isSafeInteger(starts[0]!.id), 'protocol recovery request ambiguous or missing');
        const responses = captures.filter(row => row.direction === 'response').map(row => object(row.frame));
        const replies = responses.filter(frame => frame.id === starts[0]!.id && frame.method === undefined);
        ensure(replies.length === 1 && replies[0]!.error === undefined, 'protocol recovery response ambiguous or missing');
        const recoveredReader = createCodexTurnReader(saved.thread, idOf(object(object(replies[0]!.result).turn).id), delivery.maxBytes);
        for (const frame of responses) recoveredReader.consume(frame);
        const result = recoveredReader.snapshot();
        ensure(result.status === 'completed', 'protocol recovery has no completed turn; no automatic replay');
        const text = result.reply ? input.io.readResult(delivery.resultPath, delivery.maxBytes) ?? result.reply : null;
        ensure(text === null || Buffer.byteLength(text) <= delivery.maxBytes, 'conversation result exceeds byte bound');
        const events: HarnessNormalizedObservation[] = [
          ...(text?.trim() ? [{ kind: 'reply' as const, delivery: delivery.operation, text, digest: hash(text) }] : []),
          { kind: 'turn-end', delivery: delivery.operation, state: text?.trim() ? 'completed' : 'no-reply' },
        ];
        const batch = events.slice(query.cursor, query.cursor + query.limit);
        return { observations: batch, cursor: query.cursor + batch.length, complete: true };
      }
      verify(query); guard(); feed();
      ensure(Number.isSafeInteger(query.cursor) && query.cursor >= 0 && query.cursor <= 2
        && Number.isSafeInteger(query.limit) && query.limit >= 1 && query.limit <= 64, 'bounded observation required');
      if (query.delivery) {
        verify(query.delivery);
        const admitted = input.resolveDelivery(query.delivery.operation);
        ensure(query.delivery.operation === operation && admitted && admitted.digest === query.delivery.digest
          && admitted.text === query.delivery.text && hash(query.delivery.text) === query.delivery.digest,
        'turn belongs to another input');
      }
      const acknowledgement = query.delivery && acknowledgedAt !== undefined ? { acknowledgedAt } : {};
      const events: HarnessNormalizedObservation[] = [];
      const result = reader?.snapshot();
      if (!connection!.alive()) events.push({ kind: 'exit', evidence: connection!.identity });
      else if (query.delivery && result && result.status !== 'open') {
        ensure(query.delivery.operation === operation, 'turn belongs to another input');
        if (result.status === 'unverifiable') events.push({ kind: 'paused', evidence: result.reason ?? 'unverifiable turn' });
        else {
          const text = result.reply ? input.io.readResult(query.delivery.resultPath, query.delivery.maxBytes) ?? result.reply : null;
          ensure(!text || Buffer.byteLength(text) <= query.delivery.maxBytes, 'conversation result exceeds byte bound');
          if (text?.trim()) events.push({ kind: 'reply', delivery: operation, text, digest: hash(text) });
          events.push({ kind: 'turn-end', delivery: operation,
            state: result.status === 'completed' && text?.trim() ? 'completed' : 'no-reply' });
        }
      }
      if (events[0]?.kind === 'exit' || events[0]?.kind === 'paused') return { observations: events, cursor: query.cursor, complete: true, ...acknowledgement };
      const batch = events.slice(query.cursor, query.cursor + query.limit);
      return { observations: batch, cursor: query.cursor + batch.length, complete: true, ...acknowledgement };
    },
    async observeIdle(target) { return idleFingerprint(target); },
    async control(target) {
      if (target.idleEvidence !== undefined && idleFingerprint(target) !== target.idleEvidence)
        return { state: 'refused', evidence: 'idle evidence changed; worker kept' };
      if (target.action === 'compact') return { state: 'refused', evidence: 'use grounded replacement' };
      if (connection) {
        verify(target); feed();
        if (reader?.snapshot().status === 'open' && connection.alive()) {
          try { await send(requests.interrupt(thread, reader.snapshot().turnId)); } catch { /* exact process close below */ }
        }
      }
      await input.transport.close(target.claim, target.incarnation, target.launch || undefined);
      connection = null; reader = null;
      return { state: 'closed', evidence: target.reason };
    },
  };
  return api;
}
