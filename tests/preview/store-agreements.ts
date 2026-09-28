/**
 * Rule 33 — cross-store coherence is an invariant. The live runner keeps several
 * durable records that answer the same question. Each agreement below names the
 * question, its AUTHORITATIVE input and the store or projection that must agree,
 * and runs an existing comparison where one exists. Checks run at every launch
 * and then on a cadence inside the runner's own loop (bounded maintenance); each
 * completed check is appended durably with its verdict. This detects; it never
 * repairs, and it never rebuilds the independently authored run log from the
 * conversation journal merely because a view reads both.
 *
 * Seam for build 9 (required-protection executor): `STORE_AGREEMENTS` is the
 * typed declaration list and `runDueAgreements` the single execution entry; an
 * executor that owns due plans may call it instead of the runner loop, keeping
 * the same log so the last actual result, freshness and failures stay visible.
 */
import { closeSync, constants, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import { auditJournal } from './journal-audit.mjs';
import type { JournalView } from './journal.js';
import { loopHealth } from './obligations.js';
import type { OwnerObservation } from './conversation-owner.js';
import type { RunLog } from './self-state.js';

export interface AgreementInput {
  readonly view: JournalView; readonly runs: RunLog; readonly ownership: OwnerObservation;
  readonly root: string; readonly now: number;
}
/** `agree: null` means the comparison could not be made from here (never counted as agreement). */
export type AgreementVerdict = Readonly<{ agree: boolean | null; detail: string }>;
export interface StoreAgreement {
  readonly id: string;
  readonly question: string;
  /** The independently authored source of truth. */
  readonly authoritative: string;
  /** The store or projection that must agree with it. */
  readonly projection: string;
  /** Maximum age of the last completed check before it is due again. */
  readonly cadenceMs: number;
  check(input: AgreementInput): AgreementVerdict;
}
export interface AgreementRecord { v: 1; id: string; at: number; agree: boolean | null; detail: string }

const HOUR = 3_600_000;

export const STORE_AGREEMENTS: readonly StoreAgreement[] = Object.freeze([
  { id: 'memory-provenance', question: 'What does the agent remember, and which operator message is it from?',
    authoritative: 'journal operator turns and corrections', projection: 'active memory and the last recorded model packet',
    cadenceMs: 6 * HOUR,
    // The existing on-demand audit (journal-audit.mjs) traces every active item and packet item to its source.
    check: ({ view }) => {
      const report = auditJournal(view) as { findings: { code: string }[] };
      return report.findings.length === 0 ? { agree: true, detail: 'every active memory and packet item traces to the journal' }
        : { agree: false, detail: `${report.findings.length} untraced item(s): ${[...new Set(report.findings.map(f => f.code))].slice(0, 4).join(', ')}` };
    } },
  { id: 'unfinished-at-exit', question: 'How much accepted operator work did the last run leave unfinished?',
    authoritative: 'the conversation journal (turns and their settlement)', projection: 'the run log exit row written at that exit',
    cadenceMs: 6 * HOUR,
    check: ({ view, runs, now }) => {
      const exited = [...runs.launches].reverse().find(run => run.exit !== undefined && run.unfinished !== undefined && !run.nonowner);
      if (!exited) return { agree: null, detail: 'no exit row records unfinished work yet' };
      // Only a launch appends turns: compare only while no later launch has accepted new work.
      // The run log's append order is its sequence; a timestamp is not.
      const later = runs.launches.slice(runs.launches.lastIndexOf(exited) + 1).filter(run => !run.nonowner);
      const comparable = later.length === 0 || (later.length === 1 && later[0]!.exit === undefined
        && !view.order.some(turn => turn.at > later[0]!.at));
      if (!comparable) return { agree: null, detail: 'a later launch has changed the journal since that exit' };
      const journal = loopHealth(view, now).unfinished;
      return journal === exited.unfinished ? { agree: true, detail: `${journal} unfinished in both` }
        : { agree: false, detail: `run log exit says ${exited.unfinished} unfinished, journal says ${journal}` };
    } },
  { id: 'serving-runner', question: 'Which runner is serving this conversation right now?',
    authoritative: 'the conversation owner claim (host-scope lease and holder record)', projection: 'open launches in this root\'s run log',
    cadenceMs: HOUR,
    check: ({ runs, ownership, root }) => {
      const open = runs.launches.filter(run => run.exit === undefined);
      if (ownership.state === 'foreign') return { agree: null, detail: 'held from another machine; liveness is not observable here' };
      const mine = ownership.state === 'serving' && ownership.holder?.root === root;
      if (mine) {
        const current = open.at(-1);
        if (open.length === 1 && (current?.pid === undefined || current.pid === ownership.holder!.pid))
          return { agree: true, detail: 'the one open launch is the owner' };
        return { agree: false, detail: `${open.length} open launch(es) while one runner owns the conversation; earlier ends were never recorded` };
      }
      return open.length === 0 ? { agree: true, detail: `no open launch; owner ${ownership.state}` }
        : { agree: false, detail: `${open.length} launch(es) without a recorded exit while the owner is ${ownership.state}` };
    } },
  { id: 'snapshot-replay', question: 'What is the conversation state after compaction?',
    authoritative: 'the append-only journal frames', projection: 'the compaction snapshot',
    cadenceMs: 6 * HOUR,
    // Opening the journal verifies the snapshot digest and turn index and replays the retained frames;
    // compaction compares the projection before replacing it. Reaching this check means the open verified.
    check: ({ view }) => ({ agree: true, detail: `journal opened and replayed (${view.order.length} turns)` }) },
] satisfies StoreAgreement[]);

export function readAgreementLog(path: string): Map<string, AgreementRecord> {
  const last = new Map<string, AgreementRecord>();
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { return last; }
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      const row = JSON.parse(line) as AgreementRecord;
      if (row.v === 1 && typeof row.id === 'string' && Number.isSafeInteger(row.at) && typeof row.detail === 'string') last.set(row.id, row);
    } catch { /* a torn line is skipped; the next completed check supersedes it */ }
  }
  return last;
}

function appendAgreement(path: string, record: AgreementRecord): void {
  const fresh = !existsSync(path);
  const fd = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try { const line = Buffer.from(`${JSON.stringify(record)}\n`); let written = 0; while (written < line.length) written += writeSync(fd, line, written); fsyncSync(fd); }
  finally { closeSync(fd); }
  if (fresh) { const dir = openSync(dirname(path), 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } }
}

/** Runs every due agreement once (bounded by the declaration list), recording each completed verdict.
 * A check that throws is recorded as a failed check, never as agreement. */
export function runDueAgreements(path: string, input: AgreementInput, force = false): AgreementRecord[] {
  const last = readAgreementLog(path), done: AgreementRecord[] = [];
  for (const agreement of STORE_AGREEMENTS) {
    const previous = last.get(agreement.id);
    if (!force && previous && input.now - previous.at < agreement.cadenceMs) continue;
    let verdict: AgreementVerdict;
    try { verdict = agreement.check(input); }
    catch (error) { verdict = { agree: false, detail: `check failed: ${error instanceof Error ? error.message.slice(0, 120) : 'error'}` }; }
    const record: AgreementRecord = { v: 1, id: agreement.id, at: input.now, agree: verdict.agree, detail: verdict.detail };
    appendAgreement(path, record); done.push(record);
  }
  return done;
}

/** Status view: every declared agreement with its last completed check and whether it is due. */
export function agreementStatus(path: string, now: number) {
  const last = readAgreementLog(path);
  return STORE_AGREEMENTS.map(agreement => {
    const record = last.get(agreement.id);
    return { id: agreement.id, question: agreement.question, authoritative: agreement.authoritative, projection: agreement.projection,
      lastCheckedAt: record?.at ?? null, agree: record?.agree ?? null, detail: record?.detail ?? 'never checked',
      due: !record || now - record.at >= agreement.cadenceMs };
  });
}

export function agreementLine(path: string, now: number): string {
  const rows = agreementStatus(path, now);
  const disagree = rows.filter(row => row.agree === false), unchecked = rows.filter(row => row.lastCheckedAt === null);
  if (disagree.length) return `Store checks: ${disagree.length} disagreement(s) — ${disagree.map(row => `${row.id}: ${row.detail}`).join('; ')}`;
  return `Store checks: ${rows.filter(row => row.agree === true).length} of ${rows.length} agree${unchecked.length ? `, ${unchecked.length} never checked` : ''}.`;
}
