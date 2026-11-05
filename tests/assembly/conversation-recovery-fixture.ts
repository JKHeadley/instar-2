import { createHash } from 'node:crypto';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import type { ConversationSessionConfig, ConversationState } from '../../src/assembly/production-conversation-session.js';
import type { ConversationDelivery, ConversationWorker } from '../../src/assembly/conversation-harness-adapter.js';
import type { HarnessAdapterPort, HarnessTranscriptEntry, HarnessTranscriptObservation } from '../../src/assembly/contracts.js';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const MINUTE = 60_000;

/** A transcript whose last assistant turn called `tool` at `at` and never received its result. */
export const stalled = (at: number, tool = 'Read'): HarnessTranscriptEntry[] => [
  { type: 'user', timestampMs: at - 1000, message: { content: 'please read it' } },
  { type: 'assistant', timestampMs: at, message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tool-1', name: tool, input: { file_path: '/x' } }] } },
];
/** Three identical tool failures: the same normalized error, each answered, none progressing. */
export const looping = (at: number): HarnessTranscriptEntry[] => [1, 2, 3].flatMap(n => [
  { type: 'assistant', timestampMs: at + n * 1000, message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `tool-${n}`, name: 'Bash', input: { command: 'npm test' } }] } },
  { type: 'user', timestampMs: at + n * 1000 + 500, message: { content: [{ type: 'tool_result', tool_use_id: `tool-${n}`, is_error: true, content: 'Error: ENOENT no such file' }] } },
]);

type Options = Partial<ConversationSessionConfig> & { transcript?: boolean; pollMs?: number };
/** An open child edge of the live claim: the 1.x "active child processes" evidence in 2.0 terms. */
export const childEdge = (): SessionWorkEdge => ({ type: 'SessionWorkEdge', schemaVersion: 1, id: 'child-1:edge', parent: 'claim:process', child: 'child-1',
  scope: '/scope', owner: 'machine-1', authority: 'existing-role', budget: { steps: 1, deadline: 10_000_000_000, maxResultBytes: 65536, calls: 1, tokens: null },
  exitTest: 'child work', placement: 'local', transport: 'fake', resultDestination: '/scope/results', openedAt: 1000 });
export function liveWorker(options: Options = {}) {
  const { transcript: withTranscript = true, pollMs = 100, ...rest } = options;
  const f = assemblyRuntimeFixture();
  let clock = 1000, stopped = false, state: ConversationState | null = null;
  let active: ConversationDelivery | null = null, finish: () => boolean = () => false, pending = 0, delegations: readonly SessionWorkEdge[] = [];
  let entries: HarnessTranscriptEntry[] = [], size = 100, grow = false, paused: string | null = null, compaction: 'resumed' | 'replace-required' | 'refused' = 'resumed';
  const dead = new Set<string>();
  const launches: ConversationWorker[] = [], restores: unknown[] = [], delivered: ConversationDelivery[] = [], notices: { kind: string; detail: string }[] = [];
  const audits: Record<string, unknown>[] = [], edges: (SessionWorkEdge | SessionWorkEdgeClose)[] = [], controls: string[] = [];
  let transcriptReads = 0;
  const answer = '{"answer":"hello"}';
  const adapter: HarnessAdapterPort<2> = {
    describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false }),
    // A grounded replacement starts without the wall its predecessor hit.
    launch: async input => { const worker = { launch: `process-${launches.length}`, incarnation: input.incarnation, claim: input.claim }; launches.push(worker); if (input.restore) { restores.push(input.restore); paused = null; } return worker; },
    deliver: async input => { delivered.push(input); active = input; return { state: 'accepted', evidence: 'accepted' }; },
    observe: async input => {
      if (dead.has(input.launch)) return { observations: [{ kind: 'exit', evidence: 'retired' }], cursor: input.cursor, complete: true };
      if (!input.delivery) return { observations: [], cursor: input.cursor, complete: true };
      if (paused) return { observations: [{ kind: 'paused', evidence: 'idle at the wall', reason: paused }], cursor: input.cursor, complete: true };
      if (!finish()) return { observations: [], cursor: input.cursor, complete: true };
      const observations = [{ kind: 'reply' as const, delivery: active!.operation, text: answer, digest: hash(answer) },
        { kind: 'turn-end' as const, delivery: active!.operation, state: 'completed' as const }];
      return { observations: observations.slice(input.cursor), cursor: 2, complete: true };
    },
    control: async input => {
      controls.push(input.action);
      if (input.action === 'compact') {
        if (compaction === 'resumed') { paused = null; return { state: 'resumed', evidence: 'compaction receipt' }; }
        if (compaction === 'replace-required') { return { state: 'replace-required', evidence: 'idle compaction failed' }; }
        return { state: 'refused', evidence: 'compaction refused' };
      }
      dead.add(input.launch); return { state: 'closed', evidence: 'stop' };
    },
    ...(withTranscript ? { observeTranscript: async (): Promise<HarnessTranscriptObservation> => {
      transcriptReads++; if (grow) size += 10;
      return { sessionUuid: 'transcript-1', path: '/t.jsonl', size, mtime: size, entries };
    } } : {}),
  };
  const config: ConversationSessionConfig = {
    conversation: 'operator-1', allowanceDeadline: 10_000_000_000, authorized: () => true, currentAuthority: () => 'existing-role',
    store: { load: () => structuredClone(state), save: next => { state = structuredClone(next); } },
    createAdapter: () => adapter, contextRecoveryAllowed: () => true,
    io: { clearResult: () => {}, readResult: () => null, modelCalls: () => delivered.length, wait: async ms => { clock += ms; },
      prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, refusalReason: null, openDelegations: delegations, uncertainEffects: 0, toolPreparations: pending }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: f.c, now: () => clock, stopped: () => stopped, append: row => { if (row.type !== 'SessionWorkCall') edges.push(row); },
    parent: 'run-1', owner: 'machine-1', placement: 'local', transport: 'fake', workingScope: '/scope', resultDirectory: '/scope/results',
    artifact: 'artifact', incarnation: 'incarnation', deadlineMs: 14_400_000, pollMs, maxCalls: 100, maxSteps: 64, maxResultBytes: 65536,
    notice: (kind, detail) => notices.push({ kind, detail }), audit: event => audits.push(event),
    revival: { settlingMs: 100 },
    ...rest,
  };
  const port = value(createConversationSessionPort(config));
  const request = (operation: string) => ({ operation, question: 'What do you remember?', context: '{"memory":"tea"}', authority: 'existing-role' });
  return { port, config, request, launches, restores, delivered, notices, audits, edges, controls,
    state: () => structuredClone(state!), restart: () => value(createConversationSessionPort(config)), now: () => clock,
    advance: (ms: number) => { clock += ms; }, reads: () => transcriptReads,
    transcript: (next: HarnessTranscriptEntry[]) => { entries = next; }, growing: (next: boolean) => { grow = next; },
    finishWhen: (next: () => boolean) => { finish = next; }, prepared: (count: number) => { pending = count; },
    delegations: (next: readonly SessionWorkEdge[]) => { delegations = next; }, wall: (reason: string | null) => { paused = reason; },
    compaction: (next: typeof compaction) => { compaction = next; }, stop: () => { stopped = true; },
    loseWorker: () => { if (launches[0]) dead.add(launches[0].launch); },
    attempts: () => state?.workerRecoveryState?.attempts ?? {}, events: (name: string) => audits.filter(row => row.event === name),
  };
}
