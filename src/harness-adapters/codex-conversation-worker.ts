import { createHash } from 'node:crypto';
import { codexConversationRequests as requests, createCodexTurnReader, CODEX_CONVERSATION_CONFIG } from './codex-conversation.js';
import type { CodexThreadOptions } from './codex-conversation.js';
import type { SessionProtocolConnection, SessionProtocolIO } from './session-protocol.js';
import type { HarnessAdapterPort, HarnessInputDelivery, HarnessNormalizedObservation } from '../assembly/contracts.js';
import type { ProductionSessionConfig } from '../assembly/production-session-driver.js';
import { admissionArgs, modelGateLaunch, sessionConnectorArgs } from '../assembly/production-session-driver.js';
import { ensure } from '../assembly/boundary.js';
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) ? value as Record<string, unknown> : {};
const idOf = (value: unknown) => { ensure(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value), 'protocol identity missing'); return value; };

/** One adapter, the same host queue/liability/intake as the terminal worker. Raw captures,
 * process custody and timeout enforcement are the injected physical boundary's job. */
export function createCodexConversationWorker(input: Readonly<{
  configuration(): ProductionSessionConfig; transport: SessionProtocolIO; resumeKey?: string;
  io: Pick<import('../assembly/production-session-work.js').SessionWorkIO, 'readResult' | 'clearResult'>;
  resolveDelivery(operation: string): HarnessInputDelivery | undefined;
  beforeLaunch?(claim: string): void; afterLaunch?(): void;
}>): HarnessAdapterPort<2> {
  let connection: SessionProtocolConnection | null = null, config: ProductionSessionConfig | null = null;
  let claim = '', incarnation = '', thread = '', operation = '', grounding = '';
  let reader: ReturnType<typeof createCodexTurnReader> | null = null;
  const send = (request: ReturnType<typeof requests.initialize>) => connection!.request(request.method, request.params);
  const guard = () => { ensure(config && !config.stopped(), 'conversation stopped'); };
  const feed = () => { for (const frame of connection?.drain() ?? []) reader?.consume(frame);
    if (connection && !connection.alive()) reader?.lost(); };
  const verify = (value: { launch: string; claim: string; incarnation: string }) => {
    ensure(connection && value.launch === connection.identity && value.claim === claim && value.incarnation === incarnation,
      'stale conversation worker');
  };
  return {
    describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: true }),
    async launch(spec) {
      input.beforeLaunch?.(spec.claim); config = input.configuration(); guard();
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
        cwd: config.cwd, deadline: config.now() + config.turnDeadlineMs, maxProcesses: config.maxSessions,
        requestTimeoutMs: config.readyTimeoutMs });
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
        reader = null; operation = '';
        input.afterLaunch?.();
        return { launch: connection.identity, claim, incarnation };
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
      operation = delivery.operation; reader = null;
      // Host persists dispatch intent before calling this method. An RPC failure is uncertain.
      const response = await send(requests.deliver(thread, grounding ? `${grounding}\n\n${delivery.text}` : delivery.text));
      const turn = object(object(response).turn);
      reader = createCodexTurnReader(thread, idOf(turn.id), delivery.maxBytes);
      feed(); guard(); grounding = '';
      return { state: 'accepted', evidence: `${connection!.identity}:${thread}:${turn.id}` };
    },
    async observe(query) {
      verify(query); guard(); feed();
      ensure(Number.isSafeInteger(query.cursor) && query.cursor >= 0 && query.cursor <= 2
        && Number.isSafeInteger(query.limit) && query.limit >= 1 && query.limit <= 64, 'bounded observation required');
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
      if (events[0]?.kind === 'exit' || events[0]?.kind === 'paused') return { observations: events, cursor: query.cursor, complete: true };
      const batch = events.slice(query.cursor, query.cursor + query.limit);
      return { observations: batch, cursor: query.cursor + batch.length, complete: true };
    },
    async control(target) {
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
}
