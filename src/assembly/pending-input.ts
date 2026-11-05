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
 * (OR THE HOST) DID NOT ACTUALLY SEND. Only text that (a) contains the marker of the exact text the
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

/** 1.x SessionManager.extractInjectionMarker: the distinguishing first 40 visible characters of
 *  the sent text, or null when too short (< 8) to identify it reliably at a prompt. */
export function pendingInputMarker(sentText: string): string | null {
  const marker = sentText.replace(/^\s+/u, '').slice(0, 40).trim();
  return marker.length >= 8 ? marker : null;
}

/** Lines that are Claude Code status/separator chrome rather than wrapped input
 *  (1.x StuckInputSentinel.isStatusLine). */
function isStatusLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^─+$/u.test(t)) return true;
  if (t.startsWith('⏵⏵ ')) return true;
  return false;
}

export interface LocatedPromptText { readonly lineIdx: number; readonly start: number; readonly text: string }
/**
 * 1.x StuckInputSentinel.locatePromptText, widened to both supported composers: Claude Code's `❯`
 * and Codex's `›`. Finds the last prompt line, returns the trimmed text after its last prompt glyph,
 * or the immediately following non-status line when the prompt line itself is empty (wrapped
 * input). The column `start` lets the styled-frame classifier map exactly these characters onto
 * a per-character dim mask, so the verdict is about the same text the plain frame showed.
 */
export function locatePromptText(lines: readonly string[]): LocatedPromptText | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    const idx = Math.max(line.lastIndexOf('❯'), line.lastIndexOf('›'));
    if (idx < 0) continue;
    const after = line.slice(idx + 1);
    const text = after.trim();
    if (text.length > 0) return { lineIdx: i, start: idx + 1 + (after.length - after.trimStart().length), text };
    const next = lines[i + 1];
    if (next && next.trim().length > 0 && !isStatusLine(next))
      return { lineIdx: i + 1, start: next.length - next.trimStart().length, text: next.trim() };
    return null;
  }
  return null;
}

/**
 * The text at the prompt when it still carries the marker of the exact text the driver sent
 * (1.x SessionManager.isMarkerStuckAtPrompt: the full marker, or its first 30 characters for a
 * wrapped row). Null when the prompt is empty, shows other text, or there is no prompt. Gemini's
 * boxed composer and pi's rule-sandwiched composer are not located: 2.0 runs only Claude Code and
 * Codex sessions (`SessionFramework`).
 */
export function pendingInputAt(pane: string, marker: string): LocatedPromptText | null {
  if (marker.length < 8) return null;
  const located = locatePromptText(pane.split('\n'));
  if (!located) return null;
  return located.text.includes(marker) || located.text.includes(marker.slice(0, 30)) ? located : null;
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
    const dimMask = parsed[located.lineIdx]?.dim ?? [];
    let sawDim = false, sawNormal = false;
    for (let k = 0; k < located.text.length; k++) {
      const ch = located.text[k];
      if (ch === ' ' || ch === '\t') continue; // whitespace carries no styling signal
      if (dimMask[located.start + k]) sawDim = true;
      else sawNormal = true;
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
  /** Marker of the exact text the driver sent (pendingInputMarker). */
  readonly marker: string;
  /** The prompt text the last observation located; a change resets corroboration and the styled
   *  verdict (1.x: new content is a fresh stuck event) but never the per-send rung budget. */
  readonly promptText: string | null;
  /** When the driver pressed Enter for it. */
  readonly sentAt: number;
  /** Consecutive observations that saw the marker at an idle prompt (reset when it is not). */
  readonly observations: number;
  /** Recovery rungs consumed: sent, or recorded as intended before a cut (effect unknown). */
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
  const located = pendingInputAt(pane, record.marker);
  if (!located) return { kind: 'clear' };
  const settled = record.pressing ? { ...record, pressing: false } : record;
  const same = settled.promptText === located.text;
  const current = same ? settled : { ...settled, promptText: located.text, observations: 0, presentation: null };
  if (paneActive) return { kind: 'observe', record: { ...current, observations: 0 }, detail: 'input queued behind active work' };
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
