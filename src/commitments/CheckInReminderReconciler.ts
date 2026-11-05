/**
 * CheckInReminderReconciler — the stateful half of the dated-commitment
 * check-in reminder (ACT-724; docs/specs/dated-commitment-reminder.md).
 *
 * One recurring pass scans the commitment store for open commitments whose
 * `checkInAt` has arrived and posts exactly one reminder each.
 *
 * WHY A SCAN AND NOT A JOB PER COMMITMENT (spec §2.1). The action's sketch said
 * "materialize one one-shot scheduler entry per dated commitment". Taken
 * literally that reproduces two of the three defects it lists: a per-commitment
 * entry needs a job file plus a manifest entry (defect (b), the two-file dance)
 * and retiring it after delivery means editing or deleting that file (defect
 * (c)). A scan has neither: coverage is a property of the scan, so there is no
 * registration step that can be skipped or race, and teardown is just the
 * commitment reaching a terminal status.
 *
 * The decision itself is pure and lives in checkInReminderCore.ts.
 */
import {
  selectDueCommitments,
  formatCheckInDate,
  buildCheckInReminderText,
  CHECK_IN_MAX_ATTEMPTS,
  type NotDueReason,
} from './checkInReminderCore.js';
import type { Commitment, CommitmentTracker } from './CommitmentTracker.js';

export interface CheckInReminderDeps {
  tracker: Pick<CommitmentTracker, 'getAll' | 'mutate'>;
  /**
   * DETERMINISTIC delivery — deliberately not the LLM tone-gated path.
   *
   * A reminder must not be capable of being held by a gate that fails closed:
   * an undelivered reminder is the entire defect this feature exists to fix.
   * The text is a fixed template carrying no agent prose, so there is nothing
   * for a tone gate to judge — the safety the gate provides is not being
   * bypassed, it is not applicable.
   */
  send: (topicId: number, text: string, identity: { commitmentId: string; checkInAt: string; logicalSendId: string }) => Promise<unknown>;
  /** The original send's receipt: true delivered, false definitely not, undefined unknown. */
  resolveDelivery?: (logicalSendId: string) => Promise<boolean | undefined>;
  time: { now(): number; iso(ms: number): string; parse(iso: string): number; formatWhen(ms: number): string };
  log?: (line: string) => void;
}

export interface CheckInReminderConfig {
  enabled: boolean;
  /** When true, decide and log but send nothing and stamp nothing. */
  dryRun: boolean;
  /** Hard ceiling on reminders per pass — a bounded blast radius. */
  maxPerPass?: number;
}

export interface CheckInReminderPassReport {
  ran: boolean;
  dryRun: boolean;
  scanned: number;
  due: number;
  sent: number;
  failed: number;
  wouldSend: number;
  capped: number;
  /** Retries exhausted this pass — genuinely undelivered reminders. */
  gaveUp: number;
  /** Sends whose result is unknown this pass: held under their send id, never repeated. */
  unknown: number;
  skippedByReason: Partial<Record<NotDueReason, number>>;
  errors: Array<{ id: string; error: string }>;
}

const DEFAULT_MAX_PER_PASS = 25;

function emptyReport(over: Partial<CheckInReminderPassReport> = {}): CheckInReminderPassReport {
  return {
    ran: false,
    dryRun: false,
    scanned: 0,
    due: 0,
    sent: 0,
    failed: 0,
    wouldSend: 0,
    capped: 0,
    gaveUp: 0,
    unknown: 0,
    skippedByReason: {},
    errors: [],
    ...over,
  };
}

/** The stable identity of a commitment's one check-in send. */
export const checkInSendId = (id: string): string => `${id}:check-in`;

export class CheckInReminderReconciler {
  constructor(
    private readonly deps: CheckInReminderDeps,
    private readonly config: CheckInReminderConfig,
  ) {}

  /**
   * One pass. Idempotent by construction: the CAS stamp means a pass that
   * crashes midway, or two passes racing, cannot double-send.
   */
  async runPass(): Promise<CheckInReminderPassReport> {
    if (!this.config.enabled) return emptyReport({ dryRun: this.config.dryRun });

    const now = this.deps.time.now();
    const settled = await this.settleUnsettled(this.deps.tracker.getAll());
    const all = this.deps.tracker.getAll();
    const { due, skipped } = selectDueCommitments(all as Array<Commitment & { id: string }>, now, this.deps.time.parse);

    const skippedByReason: Partial<Record<NotDueReason, number>> = {};
    for (const s of skipped) skippedByReason[s.reason] = (skippedByReason[s.reason] ?? 0) + 1;

    const cap = this.config.maxPerPass ?? DEFAULT_MAX_PER_PASS;
    const batch = due.slice(0, cap);
    const capped = Math.max(0, due.length - batch.length);
    if (capped > 0) {
      // Never silent: a bounded pass that dropped work says so, and the
      // remainder is picked up next pass (the stamp makes that safe).
      this.log(`[check-in-reminder] capped at ${cap}; ${capped} due commitment(s) deferred to the next pass`);
    }

    const report = emptyReport({
      ran: true,
      dryRun: this.config.dryRun,
      scanned: all.length,
      due: due.length,
      capped,
      skippedByReason,
    });
    report.sent += settled;

    for (const commitment of batch) {
      if (this.config.dryRun) {
        report.wouldSend++;
        this.log(`[check-in-reminder] would remind ${commitment.id} in topic ${commitment.topicId}`);
        continue;
      }
      const ok = await this.remindOne(commitment, now, report);
      if (ok) report.sent++;
    }

    return report;
  }

  /**
   * Durable start, then send, then settle. 1.x sent first and let a relay's
   * content dedup absorb a crash before the stamp; 2.0's floor forbids relying on
   * that: an uncertain send is never repeated. So the attempt and the send's start
   * are on record before the send, a definite failure clears the start for a bounded
   * retry, and an unknown one stays held under its logical send id until a receipt
   * settles it. The field never claims a delivery that did not happen (the original
   * reason 1.x refused to stamp first).
   */
  private async settleUnsettled(all: readonly Commitment[]): Promise<number> {
    let delivered = 0;
    for (const c of all) {
      if (!c.checkInReminderSendStartedAt || c.checkInReminderSentAt || c.status !== 'pending') continue;
      const receipt = await this.deps.resolveDelivery?.(checkInSendId(c.id));
      if (receipt === true) {
        await this.deps.tracker.mutate(c.id, prev => ({ ...prev, checkInReminderSendStartedAt: undefined,
          checkInReminderSentAt: this.deps.time.iso(this.deps.time.now()) }));
        delivered++;
      } else if (receipt === false) {
        await this.deps.tracker.mutate(c.id, prev => ({ ...prev, checkInReminderSendStartedAt: undefined }));
      }
    }
    return delivered;
  }

  private async remindOne(
    commitment: Commitment,
    now: number,
    report: CheckInReminderPassReport,
  ): Promise<boolean> {
    const topicId = commitment.topicId;
    if (typeof topicId !== 'number') return false; // excluded by the predicate; belt-and-braces

    const text = buildCheckInReminderText({
      userRequest: commitment.userRequest ?? '',
      when: formatCheckInDate(commitment.checkInAt ?? '', this.deps.time),
    });

    // Count the attempt BEFORE trying. If the process dies mid-send, the
    // attempt is still on record, so a crash-loop cannot buy infinite retries.
    try {
      await this.deps.tracker.mutate(commitment.id, (c) => ({
        ...c,
        checkInReminderAttempts: (c.checkInReminderAttempts ?? 0) + 1,
        checkInReminderSendStartedAt: this.deps.time.iso(now),
      }));
    } catch (err) {
      report.errors.push({ id: commitment.id, error: String(err) });
      return false;
    }

    try {
      const outcome = await this.deps.send(topicId, text, { commitmentId: commitment.id, checkInAt: commitment.checkInAt!,
        logicalSendId: checkInSendId(commitment.id) });
      if (outcome === 'unknown') {
        // It may have reached the person. Held under its send id, never repeated.
        report.unknown++;
        return false;
      }
    } catch (err) {
      report.failed++;
      report.errors.push({ id: commitment.id, error: String(err) });
      const attempts = (commitment.checkInReminderAttempts ?? 0) + 1;
      if (attempts >= CHECK_IN_MAX_ATTEMPTS) {
        // Give up loudly — record the undelivered fact rather than a "sent".
        try {
          await this.deps.tracker.mutate(commitment.id, (c) => ({
            ...c,
            checkInReminderFailedAt: this.deps.time.iso(now),
            checkInReminderSendStartedAt: undefined,
          }));
        } catch {
          // @silent-fallback-ok — the failure is already in the pass report;
          // failing to annotate must not strand the remaining due commitments.
        }
        this.log(
          `[check-in-reminder] GIVING UP on ${commitment.id} after ${attempts} attempts — reminder UNDELIVERED`,
        );
        report.gaveUp++;
      } else {
        // A definite failure sent nothing: clear the start for a bounded retry.
        try {
          await this.deps.tracker.mutate(commitment.id, (c) => ({ ...c, checkInReminderSendStartedAt: undefined }));
        } catch {
          // @silent-fallback-ok — a retained start only holds this reminder for settlement.
        }
      }
      return false;
    }

    // Delivered. Only now does the stamp go on, so it never lies.
    try {
      await this.deps.tracker.mutate(commitment.id, (c) => ({
        ...c,
        checkInReminderSentAt: this.deps.time.iso(now),
        checkInReminderSendStartedAt: undefined,
      }));
    } catch (err) {
      // The user HAS the reminder; only the bookkeeping failed. Report it. The
      // durable start holds it for receipt settlement, so nothing sends twice.
      report.errors.push({ id: commitment.id, error: `sent-but-unstamped: ${err}` });
    }
    return true;
  }

  private log(line: string): void {
    this.deps.log?.(line);
  }
}
