/** Offline packet-level recall against a varied 300-turn fictional operator diary. */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, withoutCorrectedHistory } from './journal-test-worker.js';
import { conversation, scenes } from './realistic-recall-fixture.js';

const key = new Uint8Array(32).fill(74);
const now = 1_790_000_000_000;
const bot = '12345678';
const operator = '7654321';
const facts = scenes.flatMap(scene => [scene.fact, ...(scene.old ? [scene.old] : [])]);
const updates = conversation();

function summary(context: string): string {
  const packet = JSON.parse(context) as { summary?: { text: string }; history: { user: string }[];
    memoryRequest?: { message: string }; memoryCandidates?: { id: string; message: string }[] };
  const source = [packet.summary?.text ?? '', ...packet.history.map(item => item.user)].join('\n');
  // A deliberately concise rolling summary. Older detail must come from original turns.
  const retained = facts.filter(fact => source.includes(fact)).slice(-6);
  const request = packet.memoryRequest?.message ?? '';
  const corrected = scenes.find(scene => scene.old && request.includes(scene.fact));
  const forgotten = scenes.find(scene => scene.forget && request.includes(scene.fact));
  const old = corrected?.old ?? forgotten?.fact;
  const candidate = old ? packet.memoryCandidates?.find(item => item.message.includes(old)) : undefined;
  const memory = old && candidate ? [{ mode: corrected ? 'correct' : 'forget', source: candidate.id, quote: old,
    ...(corrected ? { replacement: corrected.fact } : {}),
    ...(packet.summary?.text.includes(old) ? { summaryPassages: [old] } : {}) }] : [];
  return JSON.stringify({ summary: retained.filter(fact => fact !== old).join('\n') || 'The operator discussed errands, family, dates and work.',
    people: [], commitments: [], closed: [], memory,
    ...(old && !candidate ? { memoryDisposition: 'unresolved' } : {}) });
}

function update(id: number, text: string) {
  return { update_id: id, message: { chat: { id: Number(operator), type: 'private' }, from: { id: Number(operator) },
    text, date: Math.floor(now / 1000) - 86400 + id * 30 } };
}

export interface RealisticCase {
  id: string; topic: string; scenarioCategory: 'named question' | 'reworded follow-up' | 'correction chain' | 'pronoun' | 'date';
  question: string; expectedCurrentAnswer: string; sourceTurn: number; correctionTurn?: number;
  packetBytes: number; neededPresent: boolean | null; staleAbsent: boolean | null; actualVisibleAnswer: string;
  observedMiss: 'needed clause absent' | 'stale clause present' | null; historyMode: string;
}
export interface RealisticResult { turns: number; questions: number; positiveCases: number; neededPresent: number;
  exclusionCases: number; staleAbsent: number;
  misses: RealisticCase[]; cases: RealisticCase[]; summaries: number; memoryChanges: number }

/** No network, provider, Telegram send, or live journal access. */
export async function runRealisticRecall(): Promise<RealisticResult> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-realistic-recall-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot, chat: operator, operator,
    grant: 'grant:offline-realistic-recall', configurationDigest: 'sha256:offline-realistic-recall',
    expires: now + 1_000_000, maxCalls: 1200, maxReplies: 400, maxTurns: 400, maxBytes: 24000, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis);
  const ports = { now: () => now, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => input.id.startsWith('summary:')
      ? summary(input.context) : JSON.stringify({ reply: 'Noted.', memory: [], dated: [] }),
    send: async () => 1, checkOutbound: () => {} };
  let worker = createJournalWorker(journal, ports);
  try {
    for (let index = 0; index < updates.length; index++) {
      const id = index + 1, text = updates[index]!;
      if (text.startsWith('Actually,') || text.startsWith('Forget ')) {
        worker.intake([update(id, text)]);
        await worker.drain();
      } else {
        const item = update(id, text), turnId = `telegram:${bot}:update:${id}`;
        journal.append({ kind: 'intake', id: turnId, update: id, text, raw: JSON.stringify(item),
          accepted: true, cursor: id + 1, at: now });
        journal.append({ kind: 'reserve', id: turnId, at: now });
        journal.append({ kind: 'answer', id: turnId, text: 'Noted.', state: 'complete', at: now });
        journal.append({ kind: 'intent', id: turnId, text: 'PREVIEW — Noted.', chat: operator,
          update: id, grant: genesis.grant, at: now });
        journal.append({ kind: 'sent', id: turnId, message: id, at: now });
      }
      if (id % 30 === 0 || text.startsWith('Actually,') || text.startsWith('Forget '))
        await worker.summarizeIfNeeded(true);
    }
    await worker.summarizeIfNeeded(true);
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    const cases: RealisticCase[] = [];
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index]!;
      for (let variant = 0; variant < 2; variant++) {
        const question = scene.questions[variant]!;
        const probe = worker.probe(question);
        if ('reason' in probe) throw Error(`${scene.id}/${variant}: ${probe.reason}`);
        const context = probe.context;
        const packet = JSON.parse(context) as { historyMode: string; summary?: { text: string }; recalled?: { user: string }[];
          history?: { user: string }[]; memory?: unknown[] };
        const neededPresent = scene.forget ? null : context.includes(scene.fact);
        // A corrected-away clause may appear only as labelled history (memorySearch `was`, Rule 7).
        const current = withoutCorrectedHistory(context);
        const staleAbsent = scene.old ? !current.includes(scene.old) : scene.forget ? !context.includes(scene.fact) : null;
        const observedMiss = staleAbsent === false ? 'stale clause present'
          : neededPresent === false ? 'needed clause absent' : null;
        cases.push({ id: `${scene.id}/${variant + 1}`, topic: scene.topic,
          scenarioCategory: scene.old || scene.forget ? 'correction chain' : variant === 1 && /\b(she|her|him|his|that|those)\b/iu.test(question)
            ? 'pronoun' : scene.topic === 'date' ? 'date' : variant === 1 ? 'reworded follow-up' : 'named question',
          question, expectedCurrentAnswer: scene.answer, sourceTurn: index * 10 + 1,
          ...(scene.old || scene.forget ? { correctionTurn: index * 10 + 8 } : {}),
          packetBytes: Buffer.byteLength(context), neededPresent, staleAbsent,
          actualVisibleAnswer: neededPresent ? scene.fact : 'UNKNOWN', observedMiss,
          historyMode: packet.historyMode });
        if (variant === 0) {
          // The follow-up is elliptical. Preserve the first question as a real
          // preceding accepted turn, with no answer that could leak the oracle.
          for (const [offset, text] of [question, 'One second, the kettle is whistling.'].entries()) {
            const id = updates.length + index * 2 + offset + 1, item = update(id, text);
            const turnId = `telegram:${bot}:update:${id}`;
            journal.append({ kind: 'intake', id: turnId, update: id, text, raw: JSON.stringify(item),
              accepted: true, cursor: id + 1, at: now });
            journal.append({ kind: 'reserve', id: turnId, at: now });
            journal.append({ kind: 'answer', id: turnId, text: 'Let me check.', state: 'complete', at: now });
            journal.append({ kind: 'intent', id: turnId, text: 'PREVIEW — Let me check.', chat: operator,
              update: id, grant: genesis.grant, at: now });
            journal.append({ kind: 'sent', id: turnId, message: id, at: now });
          }
        }
      }
    }
    const misses = cases.filter(item => item.observedMiss !== null);
    const result = { turns: updates.length, questions: cases.length,
      positiveCases: cases.filter(item => item.neededPresent !== null).length,
      neededPresent: cases.filter(item => item.neededPresent === true).length,
      exclusionCases: cases.filter(item => item.staleAbsent !== null).length,
      staleAbsent: cases.filter(item => item.staleAbsent === true).length,
      misses, cases, summaries: journal.view.summaries.length, memoryChanges: journal.view.memory.length };
    journal.close(); return result;
  } finally { try { journal.close(); } catch { /* already closed */ } rmSync(root, { recursive: true, force: true }); }
}
