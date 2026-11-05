// Carryover row 14: the pure half of the 1.x StuckInputSentinel port. The cases below are the 1.x
// unit tests (legacy-1x/tests/unit/StuckInputSentinel*.test.ts at JKHeadley/instar 4f88880a)
// re-targeted at src/assembly/pending-input.ts; each block names the 1.x describe it carries.
import { describe, expect, it } from 'vitest';
import { PENDING_INPUT_LADDER, afterPresentation, classifyPromptTextPresentation, locatePromptText, pendingInputAction,
  pendingInputAt, pendingInputStep } from '../../src/assembly/pending-input.js';
import type { PendingInputDecision, PendingInputRecord } from '../../src/assembly/pending-input.js';
import { classifyPaneActive } from '../../src/assembly/production-session-driver.js';

const ESC = '\x1b';
// The exact text the live F2 event (2026-07-02) captured as "stuck input".
const GHOST_TEXT = 'tas channel-parity: now test the Slack topic';
const PLAIN_STUCK_PANE = ['────────────────────────────────────────', `❯ ${GHOST_TEXT}`, '────────────────────────────────────────',
  '  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n');
const GHOST_ANSI_PANE = ['────────────────────────────────────────', `❯ ${ESC}[0;2m${GHOST_TEXT}${ESC}[0m`, '────────────────────────────────────────',
  '  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n');
const REAL_ANSI_PANE = ['────────────────────────────────────────', `${ESC}[36m❯${ESC}[0m ${GHOST_TEXT}`, '────────────────────────────────────────',
  '  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n');

describe('classifyPromptTextPresentation — SGR dim decoding (1.x StuckInputSentinel-ghost-text)', () => {
  it("classifies the live F2 frame (ESC[0;2m suggestion) as 'ghost'", () => {
    expect(classifyPromptTextPresentation(GHOST_ANSI_PANE, GHOST_TEXT)).toBe('ghost');
  });
  it("classifies a bare ESC[2m dim run as 'ghost'", () => {
    expect(classifyPromptTextPresentation(`❯ ${ESC}[2m${GHOST_TEXT}${ESC}[0m`, GHOST_TEXT)).toBe('ghost');
  });
  it("classifies a plain frame with no SGR codes as 'real' (nothing renders dim)", () => {
    expect(classifyPromptTextPresentation(PLAIN_STUCK_PANE, GHOST_TEXT)).toBe('real');
  });
  it("classifies normally-styled genuine input as 'real' even with colored chrome", () => {
    expect(classifyPromptTextPresentation(REAL_ANSI_PANE, GHOST_TEXT)).toBe('real');
  });
  it("classifies COLORED but normal-intensity text as 'real' (color is not the ghost tell)", () => {
    expect(classifyPromptTextPresentation(`❯ ${ESC}[36m${GHOST_TEXT}${ESC}[0m`, GHOST_TEXT)).toBe('real');
  });
  it("never misreads a truecolor component '2' (38;2;r;g;b) as the dim attribute", () => {
    expect(classifyPromptTextPresentation(`❯ ${ESC}[38;2;150;150;150m${GHOST_TEXT}${ESC}[0m`, GHOST_TEXT)).toBe('real');
  });
  it('handles the 256-color form (38;5;n) without misreading params', () => {
    expect(classifyPromptTextPresentation(`❯ ${ESC}[38;5;245m${GHOST_TEXT}${ESC}[0m`, GHOST_TEXT)).toBe('real');
  });
  it("treats SGR 22 (normal intensity) as canceling dim — text after it is 'real'", () => {
    expect(classifyPromptTextPresentation(`❯ ${ESC}[2m${ESC}[22m${GHOST_TEXT}`, GHOST_TEXT)).toBe('real');
  });
  it("returns 'inconclusive' on MIXED styling (part dim, part normal)", () => {
    const half = Math.floor(GHOST_TEXT.length / 2);
    expect(classifyPromptTextPresentation(`❯ ${ESC}[2m${GHOST_TEXT.slice(0, half)}${ESC}[22m${GHOST_TEXT.slice(half)}`, GHOST_TEXT)).toBe('inconclusive');
  });
  it("returns 'inconclusive' when the ANSI frame's prompt text does not match (raced captures)", () => {
    expect(classifyPromptTextPresentation(GHOST_ANSI_PANE, 'a totally different message')).toBe('inconclusive');
  });
  it("returns 'inconclusive' when the ANSI frame has no readable prompt", () => {
    expect(classifyPromptTextPresentation('no prompt here at all', GHOST_TEXT)).toBe('inconclusive');
  });
  it('classifies wrapped-line ghost text (empty ❯, dim text on the next line)', () => {
    expect(classifyPromptTextPresentation(['❯ ', `${ESC}[2mwrapped ghost suggestion${ESC}[0m`, '──────'].join('\n'), 'wrapped ghost suggestion')).toBe('ghost');
  });
  it('tracks dim state ACROSS lines when tmux does not re-emit attributes per line', () => {
    expect(classifyPromptTextPresentation([`❯ ${ESC}[2m`, 'wrapped ghost suggestion', '──────'].join('\n'), 'wrapped ghost suggestion')).toBe('ghost');
  });
  it("classifies Codex's `›` composer the same way", () => {
    expect(classifyPromptTextPresentation(`› ${ESC}[2mExplain this codebase${ESC}[0m`, 'Explain this codebase')).toBe('ghost');
    expect(classifyPromptTextPresentation('› [telegram:1052] continue running', '[telegram:1052] continue running')).toBe('real');
  });
});

const STUCK_PANE_IDLE = ['────────────────────────────────────────', '❯ [telegram:7195] hello there friend', '────────────────────────────────────────',
  '  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n');
const EMPTY_PROMPT_PANE = ['────────────────────────────────────────', '❯ ', '────────────────────────────────────────',
  '  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n');
const WORKING_PANE = ['✻ Brewed for 14m 11s', '────────────────────────────────────────', '❯ [telegram:7195] hello there friend',
  '────────────────────────────────────────', '  ⏵⏵ bypass permissions on · esc to interrupt · ctrl+t to hide tasks'].join('\n');
const text = (pane: string) => locatePromptText(pane.split('\n'))?.text ?? null;

describe('locatePromptText (1.x StuckInputSentinel — extractPromptText)', () => {
  it('returns the text after ❯ on the prompt line', () => { expect(text(STUCK_PANE_IDLE)).toBe('[telegram:7195] hello there friend'); });
  it('returns null when the prompt is empty', () => { expect(text(EMPTY_PROMPT_PANE)).toBeNull(); });
  it('returns null when there is no ❯ in the pane', () => { expect(text('just some text\nno prompt here\n')).toBeNull(); });
  it('returns the wrapped line when prompt line is empty but next is content', () => {
    expect(text(['❯ ', 'wrapped content here', '──────'].join('\n'))).toBe('wrapped content here');
  });
  it('does not return the box-border separator as wrapped content', () => {
    expect(text(['❯ ', '────────────────', '  ⏵⏵ bypass'].join('\n'))).toBeNull();
  });
  it("reads Codex's `›` prompt too", () => { expect(text(['─ Worked for 1m 20s ────', '', '› [telegram:1052] continue', ''].join('\n'))).toBe('[telegram:1052] continue'); });
});

describe('classifyPaneActive stands in for 1.x isPaneActivelyWorking', () => {
  it('flags panes with "esc to interrupt" as working', () => { expect(classifyPaneActive(WORKING_PANE)).toBe(true); });
  it('does NOT flag the idle pane as working', () => { expect(classifyPaneActive(STUCK_PANE_IDLE)).toBe(false); });
  it('does NOT flag a stale "Brewed for…" past-tense marker as working — live reproduction case', () => {
    expect(classifyPaneActive(['✻ Brewed for 14m 11s', '────────', '❯ hello', '  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n'))).toBe(false);
  });
  it('does NOT flag a "✶ Running…" line in isolation as working when no footer hint is present', () => {
    expect(classifyPaneActive(['✶ Running Phase 1a checks', '❯ hello'].join('\n'))).toBe(false);
  });
  it("flags Codex's shared \"esc to interrupt\" footer while a turn is in flight", () => {
    expect(classifyPaneActive(['› [telegram:1052] continue running', '', '  Working (37m 24s • esc to interrupt)'].join('\n'))).toBe(true);
  });
});

describe('pendingInputAction (1.x actionForAttempt)', () => {
  it('matches SessionManager.fireStuckInputRecovery escalation', () => {
    expect([0, 1, 2, 3, 99].map(pendingInputAction)).toEqual(['Enter', 'Enter', 'C-m', 'Enter-sleep-Enter', 'Enter-sleep-Enter']);
  });
  it('keeps the 1.x schedule, two-capture minimum and four-rung budget as data', () => {
    expect(PENDING_INPUT_LADDER).toMatchObject({ schedule: [500, 1500, 3500, 6500], verifyAt: 9000, minObservations: 2, maxAttempts: 4 });
  });
  it('locates the pending text only when it equals the full accepted payload', () => {
    expect(pendingInputAt(STUCK_PANE_IDLE, '[telegram:7195] hello there friend')?.text).toBe('[telegram:7195] hello there friend');
    expect(pendingInputAt(STUCK_PANE_IDLE, '[telegram:7195] a completely different message')).toBeNull();
    expect(pendingInputAt(EMPTY_PROMPT_PANE, '[telegram:7195] hello there friend')).toBeNull();
    // Codex placeholder immunity: the dim "Explain this codebase" hint never equals the injected marker.
    expect(pendingInputAt(['› Explain this codebase', ''].join('\n'), '[telegram:1052] continue running into version')).toBeNull();
  });
});

/** Drive the pure ladder the way the driver does: a capture per tick, the styled frame on demand. */
function sentinel(payload: string) {
  let record: PendingInputRecord = { operation: 'delivery', intake: 'intake', digest: 'sha256:test', payload, promptText: null, sentAt: 0, observations: 0, attempts: 0, pressing: false, presentation: null, undelivered: false };
  const fired: number[] = []; let styledCaptures = 0; let cleared = 0;
  const tick = (pane: string, now: number, styled: string | null | (() => string | null) = pane): PendingInputDecision => {
    let decision = pendingInputStep(record, pane, classifyPaneActive(pane), now, true);
    if (decision.kind === 'classify') {
      styledCaptures++;
      let frame: string | null = null;
      try { frame = typeof styled === 'function' ? styled() : styled; } catch { frame = null; }
      decision = afterPresentation(decision.record, frame === null ? 'inconclusive' : classifyPromptTextPresentation(frame, decision.located.text));
    }
    if (decision.kind === 'clear') { cleared++; return decision; }
    record = decision.record;
    if (decision.kind === 'press') { fired.push(decision.attempt); record = { ...record, pressing: false }; }
    return decision;
  };
  return { tick, fired, get record() { return record; }, get styledCaptures() { return styledCaptures; }, get cleared() { return cleared; } };
}
const MARKER = '[telegram:7195] hello there friend';
const LATE = 10_000; // every rung is due

describe('pendingInputStep — tick lifecycle (1.x StuckInputSentinel tick lifecycle)', () => {
  it('does NOT fire on the first observation of stuck text', () => {
    const s = sentinel(MARKER); s.tick(STUCK_PANE_IDLE, LATE);
    expect(s.fired).toEqual([]); expect(s.record.observations).toBe(1); expect(s.record.attempts).toBe(0);
  });
  it('fires the first recovery action on the SECOND consecutive observation (minObservations=2)', () => {
    const s = sentinel(MARKER); s.tick(STUCK_PANE_IDLE, LATE); s.tick(STUCK_PANE_IDLE, LATE);
    expect(s.fired).toEqual([0]); expect(s.record.attempts).toBe(1);
  });
  it('escalates across ticks: Enter (0) → Enter (1) → C-m (2) → Enter-sleep-Enter (3)', () => {
    const s = sentinel(MARKER); const actions: string[] = [];
    for (let i = 0; i < 5; i++) { const d = s.tick(STUCK_PANE_IDLE, LATE); if (d.kind === 'press') actions.push(d.action); }
    expect(s.fired).toEqual([0, 1, 2, 3]); expect(actions).toEqual(['Enter', 'Enter', 'C-m', 'Enter-sleep-Enter']);
  });
  it('stops firing after maxAttempts even if the pane remains stuck, and reports the text undelivered', () => {
    const s = sentinel(MARKER); let last: PendingInputDecision | null = null;
    for (let i = 0; i < 10; i++) last = s.tick(STUCK_PANE_IDLE, LATE);
    expect(s.fired).toEqual([0, 1, 2, 3]); expect(last?.kind).toBe('undelivered'); expect(s.record.undelivered).toBe(true);
  });
  it('holds each rung until its 1.x verifyInjection instant (500/1500/3500/6500 ms after the send)', () => {
    const s = sentinel(MARKER);
    s.tick(STUCK_PANE_IDLE, 100); expect(s.tick(STUCK_PANE_IDLE, 499).kind).toBe('observe');
    s.tick(STUCK_PANE_IDLE, 500); expect(s.fired).toEqual([0]);
    s.tick(STUCK_PANE_IDLE, 1499); expect(s.fired).toEqual([0]);
    s.tick(STUCK_PANE_IDLE, 1500); s.tick(STUCK_PANE_IDLE, 3499); s.tick(STUCK_PANE_IDLE, 3500); s.tick(STUCK_PANE_IDLE, 6499); s.tick(STUCK_PANE_IDLE, 6500);
    expect(s.fired).toEqual([0, 1, 2, 3]);
    expect(s.tick(STUCK_PANE_IDLE, 8999).kind).toBe('observe');
    expect(s.tick(STUCK_PANE_IDLE, 9000).kind).toBe('undelivered');
  });
  it('refuses to fire while the pane shows the harness is actively working', () => {
    const s = sentinel(MARKER); for (let i = 0; i < 5; i++) s.tick(WORKING_PANE, LATE);
    expect(s.fired).toEqual([]); expect(s.record.observations).toBe(0);
  });
  it('never admits appended content under the original payload identity', () => {
    const s = sentinel(MARKER); s.tick(STUCK_PANE_IDLE, LATE); s.tick(STUCK_PANE_IDLE, LATE);
    const changed = STUCK_PANE_IDLE.replace(MARKER, `${MARKER} and more words`);
    expect(s.tick(changed, LATE).kind).toBe('clear');
    expect(s.fired).toEqual([0]);
  });
  it('clears the record when the prompt clears between ticks (the input submitted)', () => {
    const s = sentinel(MARKER); s.tick(STUCK_PANE_IDLE, LATE); s.tick(STUCK_PANE_IDLE, LATE);
    expect(s.tick(EMPTY_PROMPT_PANE, LATE).kind).toBe('clear'); expect(s.cleared).toBe(1);
  });
  it('treats a rung recorded as pressing across a cut as consumed (effect unknown), never re-sent', () => {
    const s = sentinel(MARKER); s.tick(STUCK_PANE_IDLE, LATE);
    const d = s.tick(STUCK_PANE_IDLE, LATE); expect(d.kind).toBe('press');
    const cut = { ...s.record, pressing: true }; // the key may or may not have reached the pane
    const next = pendingInputStep(cut, STUCK_PANE_IDLE, false, LATE, true);
    expect(next).toMatchObject({ kind: 'observe', detail: 'pending input submission uncertain; observation only' });
  });
});

describe('pendingInputStep — F2 ghost-text exclusion (the invariant)', () => {
  it('NEVER fires a keypress at ghost text, across arbitrarily many ticks', () => {
    const s = sentinel(MARKER); const ghost = STUCK_PANE_IDLE.replace(MARKER, `${ESC}[0;2m${MARKER}${ESC}[0m`);
    for (let i = 0; i < 10; i++) s.tick(STUCK_PANE_IDLE, LATE, ghost);
    expect(s.fired).toEqual([]); expect(s.styledCaptures).toBeGreaterThan(0);
    // Ghost is sticky — no further styled captures for this text.
    expect(s.record.presentation).toBe('ghost'); expect(s.styledCaptures).toBe(1); expect(s.record.attempts).toBe(0);
  });
  it('still recovers GENUINE stuck input (normal-intensity text) — the original mission', () => {
    const s = sentinel(MARKER); const real = STUCK_PANE_IDLE.replace('❯', `${ESC}[36m❯${ESC}[0m`);
    s.tick(STUCK_PANE_IDLE, LATE, real); s.tick(STUCK_PANE_IDLE, LATE, real);
    expect(s.fired).toEqual([0]); expect(s.record.presentation).toBe('real');
  });
  it('fails toward NOT pressing when the styled capture returns null — and is NOT sticky', () => {
    const s = sentinel(MARKER); for (let i = 0; i < 5; i++) s.tick(STUCK_PANE_IDLE, LATE, null);
    expect(s.fired).toEqual([]); expect(s.record.presentation).toBe('inconclusive');
    expect(s.styledCaptures).toBeGreaterThanOrEqual(4); // re-assessed on every fire-eligible tick
  });
  it('fails toward NOT pressing when the styled capture THROWS', () => {
    const s = sentinel(MARKER); for (let i = 0; i < 5; i++) s.tick(STUCK_PANE_IDLE, LATE, () => { throw new Error('tmux exploded'); });
    expect(s.fired).toEqual([]);
  });
  it('self-heals: a transiently unreadable frame recovers once the capture works', () => {
    const s = sentinel(MARKER); let frame: string | null = null;
    s.tick(STUCK_PANE_IDLE, LATE, () => frame); s.tick(STUCK_PANE_IDLE, LATE, () => frame);
    expect(s.fired).toEqual([]);
    frame = STUCK_PANE_IDLE; s.tick(STUCK_PANE_IDLE, LATE, () => frame);
    expect(s.fired).toEqual([0]);
  });
  it('does not let changed text inherit a ghost input identity', () => {
    const s = sentinel(MARKER); const ghost = STUCK_PANE_IDLE.replace(MARKER, `${ESC}[0;2m${MARKER}${ESC}[0m`);
    s.tick(STUCK_PANE_IDLE, LATE, ghost); s.tick(STUCK_PANE_IDLE, LATE, ghost);
    expect(s.fired).toEqual([]); expect(s.record.presentation).toBe('ghost');
    const typed = STUCK_PANE_IDLE.replace(MARKER, `${MARKER} for real`);
    s.tick(typed, LATE, typed); s.tick(typed, LATE, typed);
    expect(s.fired).toEqual([]);
  });
  it('requires full payload and styling on the Codex composer too', () => {
    const CODEX_DRAFT = '[telegram:1052] continue running into version issues';
    const pane = [`› ${CODEX_DRAFT}`, '', '  gpt-5.5 medium'].join('\n');
    const s = sentinel(CODEX_DRAFT);
    s.tick(pane, LATE); s.tick(pane, LATE);
    expect(s.fired).toEqual([0]); expect(s.styledCaptures).toBe(1);
  });
  it('re-judges the presentation before EVERY rung, so a suggestion appearing mid-ladder is not pressed', () => {
    const s = sentinel(MARKER); const ghost = STUCK_PANE_IDLE.replace(MARKER, `${ESC}[0;2m${MARKER}${ESC}[0m`);
    s.tick(STUCK_PANE_IDLE, LATE); s.tick(STUCK_PANE_IDLE, LATE); expect(s.fired).toEqual([0]);
    s.tick(STUCK_PANE_IDLE, LATE, ghost); s.tick(STUCK_PANE_IDLE, LATE, ghost);
    expect(s.fired).toEqual([0]); expect(s.record.presentation).toBe('ghost');
  });
});

it('does not truncate extra input at a separator or footer-looking payload line', () => {
  const expected = 'The exact accepted input';
  for (const extra of ['────────', 'gpt-delete', '? for shortcuts', '⏵⏵ bypass permissions on']) {
    const pane = ['────────', `❯ ${expected}`, extra, 'extra input', '────────', '⏵⏵ bypass permissions on'].join('\n');
    expect(pendingInputAt(pane, expected)).toBeNull();
  }
});
it('does not treat a glyph embedded in output as a composer', () => {
  expect(pendingInputAt('output contains ❯ The accepted input', 'The accepted input')).toBeNull();
});
it('checks normal intensity over every line of a multiline input', () => {
  const expected = 'First line\nSecond line';
  expect(classifyPromptTextPresentation(`❯ First line\n${ESC}[2mSecond line${ESC}[0m\n────`, expected)).toBe('inconclusive');
});
