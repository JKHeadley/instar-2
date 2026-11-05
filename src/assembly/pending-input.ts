/**
 * Pending-input evidence: the pure half of the 1.x `SessionManager.verifyInjection` +
 * `StuckInputSentinel` port (carryover row 14; legacy-1x/src/core/StuckInputSentinel.ts at
 * JKHeadley/instar 4f88880a). Every function here reads captured pane text handed to it and
 * decides nothing on its own authority: the session driver owns the capture, the exact delivery
 * identity, the durable record and the bounded keypress.
 *
 * Why it exists: Claude Code 2.1.105+ occasionally eats the Enter after a bracketed paste, so an
 * accepted input sits unsubmitted at the `❯` prompt. 1.x recovered it with a bounded keypress
 * ladder, and after live finding F2 (2026-07-02) it refused to press at a model-suggested
 * composer suggestion ("ghost text"), which is rendered dim (SGR 2) and is byte-identical to real
 * input once styling is stripped. The invariant carried here: NEVER AUTO-SUBMIT TEXT THE OPERATOR
 * (OR THE HOST) DID NOT ACTUALLY SEND. Only text that (a) equals the complete payload the
 * driver itself sent and (b) provably renders at normal intensity is eligible for a recovery key.
 * Ghost, mixed, raced or unreadable presentation all fail toward NOT pressing.
 */

/** The 1.x tuned schedule, kept as data so the driver and its tests share one source.
 *  `schedule`: milliseconds after the send at which recovery rung k may fire (verifyInjection
 *  500/1500/3500/6500). `verifyAt`: the verify-only pass; text still at an idle prompt this long
 *  after the send, with every rung spent, is undelivered. `minObservations`: the StuckInputSentinel
 *  rule that the same text must persist across two consecutive captures before any key.
 *  `maxAttempts`: rungs per stuck text; afterwards the record is exhausted until the text changes. */
export const PENDING_INPUT_LADDER = Object.freeze({
  schedule: Object.freeze([500, 1500, 3500, 6500] as const), verifyAt: 9000, minObservations: 2, maxAttempts: 4,
  /** 1.x performStuckInputKeyEffect: the pause between the two Enters of the last rung. */
  doubleEnterPauseMs: 150,
});

export type PendingInputAction = 'Enter' | 'C-m' | 'Enter-sleep-Enter';
/** 1.x StuckInputSentinel.actionForAttempt / SessionManager.performStuckInputKeyEffect escalation. */
export function pendingInputAction(attempt: number): PendingInputAction {
  if (attempt === 0 || attempt === 1) return 'Enter';
  if (attempt === 2) return 'C-m';
  return 'Enter-sleep-Enter';
}

/** A composer span in a joined tmux frame. Each segment retains its styling coordinates. */
export interface LocatedPromptText {
  readonly lineIdx: number; readonly start: number; readonly text: string;
  readonly segments: readonly Readonly<{ lineIdx: number; start: number; text: string }>[];
}
/** Anchored composer glyph, never a glyph embedded in output. Read the whole input up to the
 * harness separator/footer. `capture-pane -J` joins soft wraps; real input newlines remain.
 * Menu/activity classification is additionally required at the driver checkpoint. */
export function locatePromptText(lines: readonly string[]): LocatedPromptText | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = /^(\s*)[❯›] ?(.*)$/u.exec(lines[i] ?? '');
    if (!match) continue;
    const start = match[1]!.length + 1 + ((lines[i] ?? '')[match[1]!.length + 1] === ' ' ? 1 : 0);
    const segments = [{ lineIdx: i, start, text: match[2]! }];
    // Use the bottom composer border, not a separator-looking line inside the payload.
    const border = lines.map(line => /^\s*[─━]+\s*$/u.test(line)).lastIndexOf(true);
    const last = lines.map(line => line.trim().length > 0).lastIndexOf(true);
    // Codex's unboxed composer ends at a separated model/status footer.
    const footer = border <= i && last > i + 1 && !lines[last - 1]?.trim()
      && /^\s*gpt-[a-z0-9.-]+\s+(?:low|medium|high|xhigh)\s*$/u.test(lines[last] ?? '') ? last - 1 : lines.length;
    const end = border > i ? border : footer;
    for (let j = i + 1; j < end; j++) segments.push({ lineIdx: j, start: 0, text: lines[j]! });
    while (segments.length && !segments.at(-1)!.text.trim()) segments.pop();
    while (segments.length && !segments[0]!.text.trim()) segments.shift();
    if (!segments.length) return null;
    return { lineIdx: segments[0]!.lineIdx, start: segments[0]!.start,
      text: segments.map(segment => segment.text).join('\n'), segments };
  }
  return null;
}

/** Full payload equality: shared prologues, substrings and truncated captures carry no authority. */
export function pendingInputAt(pane: string, payload: string): LocatedPromptText | null {
  if (!payload.trim()) return null;
  const located = locatePromptText(pane.split('\n'));
  return located?.text === payload ? located : null;
}

/** Visible frame decoded by the same ANSI reader as the presentation verdict. */
export function pendingInputVisibleFrame(ansi: string): string {
  return parseAnsiDimLines(ansi).map(line => line.text).join('\n');
}

/**
 * How the pending text is RENDERED in the live pane (1.x F2 ghost-text exclusion), from a styled
 * capture (`tmux capture-pane -e`):
 *   - 'real'         — normal intensity: genuinely typed or host-sent input.
 *   - 'ghost'        — entirely dim (SGR 2): the harness's model-generated composer suggestion.
 *   - 'inconclusive' — cannot prove either way (capture failed, frames raced, mixed styling).
 */
export type PromptTextPresentation = 'real' | 'ghost' | 'inconclusive';

interface AnsiDimLine { text: string; dim: boolean[] }

/**
 * Decode a `capture-pane -e` frame into visible lines plus a per-character dim-attribute mask.
 * Tracks SGR state across the whole frame (tmux may or may not re-emit attributes at line
 * starts) and skips the extended-color forms (`38;5;n`, `38;2;r;g;b` and colon sub-parameters)
 * so a truecolor component of `2` is never misread as the dim attribute.
 */
function parseAnsiDimLines(ansi: string): AnsiDimLine[] {
  const lines: AnsiDimLine[] = [{ text: '', dim: [] }];
  let dimActive = false;
  let i = 0;
  while (i < ansi.length) {
    const ch = ansi[i];
    if (ch === '\x1b') {
      const csi = /^\x1b\[([0-9;:]*)([@-~])/u.exec(ansi.slice(i, i + 64));
      if (csi) {
        if (csi[2] === 'm') {
          const params = csi[1] === '' ? ['0'] : csi[1]!.split(';');
          let j = 0;
          while (j < params.length) {
            const token = params[j]!;
            const head = token.split(':')[0];
            if (head === '38' || head === '48' || head === '58') {
              if (!token.includes(':')) {
                const mode = params[j + 1];
                if (mode === '5') j += 2;
                else if (mode === '2') j += 4;
              }
              j += 1;
              continue;
            }
            if (head === '' || head === '0') dimActive = false;
            else if (head === '2') dimActive = true;
            else if (head === '22') dimActive = false;
            j += 1;
          }
        }
        i += csi[0].length;
        continue;
      }
      i += 2; // non-CSI escape: skip ESC and the next byte conservatively
      continue;
    }
    if (ch === '\n') { lines.push({ text: '', dim: [] }); i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    const line = lines[lines.length - 1]!;
    line.text += ch;
    line.dim.push(dimActive);
    i += 1;
  }
  return lines;
}

/**
 * Classify how the pending text is rendered, from a styled capture of the SAME pane.
 * `expectedText` is the text the plain capture located; when the styled frame's own prompt
 * extraction does not reproduce it exactly (the captures raced, or the frame has no readable
 * prompt) the verdict is 'inconclusive', never a guess. Only the dim attribute (SGR 2) is the
 * ghost tell; colour is deliberately not (a grey-but-normal theme must not disable recovery).
 */
export function classifyPromptTextPresentation(ansiPane: string, expectedText: string): PromptTextPresentation {
  try {
    const parsed = parseAnsiDimLines(ansiPane);
    const located = locatePromptText(parsed.map(l => l.text));
    if (!located || located.text !== expectedText) return 'inconclusive';
    let sawDim = false, sawNormal = false;
    for (const segment of located.segments) {
      const dimMask = parsed[segment.lineIdx]?.dim ?? [];
      for (let k = 0; k < segment.text.length; k++) {
        const ch = segment.text[k];
        if (ch === ' ' || ch === '\t') continue;
        if (dimMask[segment.start + k]) sawDim = true;
        else sawNormal = true;
      }
    }
    if (sawDim && !sawNormal) return 'ghost';
    if (sawNormal && !sawDim) return 'real';
    return 'inconclusive';
  } catch {
    return 'inconclusive';
  }
}

/** The driver's durable per-session record of one sent input it has not yet seen consumed. */
export interface PendingInputRecord {
  /** Original durable delivery and full terminal payload, never reconstructed from the pane. */
  readonly operation: string;
  readonly intake: string;
  readonly digest: string;
  readonly payload: string;
  /** Complete prompt text corroborated by the last observation. No shared-prefix matching. */
  readonly promptText: string | null;
  /** When the driver pressed Enter for it. */
  readonly sentAt: number;
  /** Consecutive observations that saw the complete payload at an idle prompt (reset when it is not). */
  readonly observations: number;
  /** Bounded recovery rungs consumed; unknown dispatch inhibits the whole remaining ladder. */
  readonly attempts: number;
  /** Durable intent for the rung in flight; true across a cut means that rung's effect is unknown. */
  readonly pressing: boolean;
  /** The last same-pane styled verdict; 'ghost' is sticky for this text and is never pressed. */
  readonly presentation: PromptTextPresentation | null;
  /** The ladder is spent and the text is still at an idle prompt: the input is undelivered. */
  readonly undelivered: boolean;
}

export type PendingInputDecision =
  | Readonly<{ kind: 'clear' }>
  | Readonly<{ kind: 'observe'; record: PendingInputRecord; detail: string }>
  | Readonly<{ kind: 'classify'; located: LocatedPromptText; record: PendingInputRecord }>
  | Readonly<{ kind: 'press'; attempt: number; action: PendingInputAction; record: PendingInputRecord }>
  | Readonly<{ kind: 'undelivered'; record: PendingInputRecord }>;

/**
 * One tick of the 1.x ladder over a plain capture, as a pure decision for the driver to carry out.
 *  - 'clear': the text left the prompt (submitted, or replaced); stop tracking.
 *  - 'observe': keep the record, press nothing this tick (active pane, first sighting, rung not
 *    yet due, ghost or inconclusive presentation, or the verify-only wait).
 *  - 'classify': two captures agree the text is pending and a rung is due; the driver must take
 *    the styled capture and call `afterPresentation` before anything is pressed.
 *  - 'press': the rung to send, with the record already advanced (durable before the key).
 *  - 'undelivered': every rung spent and the text still pending past the verify-only pass.
 */
export function pendingInputStep(record: PendingInputRecord, pane: string, paneActive: boolean, now: number,
  gatePresentation: boolean): PendingInputDecision {
  if (record.pressing) return { kind: 'observe', record, detail: 'pending input submission uncertain; observation only' };
  if (paneActive) return { kind: 'observe', record: { ...record, observations: 0 }, detail: 'input queued behind active work' };
  const located = pendingInputAt(pane, record.payload);
  if (!located) return { kind: 'clear' };
  const settled = record;
  const same = settled.promptText === located.text;
  const current = same ? settled : { ...settled, promptText: located.text, observations: 0, presentation: null };
  const seen = { ...current, observations: current.observations + 1 };
  if (seen.undelivered) return { kind: 'undelivered', record: seen };
  if (seen.observations < PENDING_INPUT_LADDER.minObservations)
    return { kind: 'observe', record: seen, detail: 'input still at the prompt; awaiting a second capture' };
  if (seen.presentation === 'ghost') return { kind: 'observe', record: seen, detail: 'suggested input at the prompt; not submitted' };
  if (seen.attempts >= PENDING_INPUT_LADDER.maxAttempts) {
    if (now - seen.sentAt >= PENDING_INPUT_LADDER.verifyAt) return { kind: 'undelivered', record: { ...seen, undelivered: true } };
    return { kind: 'observe', record: seen, detail: 'recovery ladder spent; verifying' };
  }
  const due = PENDING_INPUT_LADDER.schedule[seen.attempts] ?? PENDING_INPUT_LADDER.verifyAt;
  if (now - seen.sentAt < due) return { kind: 'observe', record: seen, detail: `input still at the prompt; recovery rung ${seen.attempts} not yet due` };
  // Re-judged before every rung (1.x assessPromptTextPresentation ran on each fire-eligible tick).
  if (gatePresentation) return { kind: 'classify', located, record: seen };
  return press(seen);
}

/** Apply the styled-frame verdict to a 'classify' decision. Only 'real' advances to a press. */
export function afterPresentation(record: PendingInputRecord, presentation: PromptTextPresentation): PendingInputDecision {
  const judged = { ...record, presentation };
  if (presentation === 'real') return press(judged);
  return { kind: 'observe', record: judged, detail: presentation === 'ghost'
    ? 'suggested input at the prompt; not submitted' : 'prompt presentation inconclusive; no key sent' };
}

function press(record: PendingInputRecord): PendingInputDecision {
  const attempt = record.attempts;
  return { kind: 'press', attempt, action: pendingInputAction(attempt),
    record: { ...record, attempts: attempt + 1, pressing: true } };
}
