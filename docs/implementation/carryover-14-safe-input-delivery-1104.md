# Carryover row 14 — safe input delivery (1.x StuckInputSentinel and MessageDelivery)

Row 14 of `lanes/carryover-1028.md`. User outcome: accepted input starts work, while suggested
ghost input is not submitted. 1.x source at JKHeadley/instar `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`:
`src/core/StuckInputSentinel.ts`, `src/messaging/MessageDelivery.ts` and their tests, copied
verbatim under `legacy-1x/` as the raw baseline (commit "Copy 1.x StuckInputSentinel and
MessageDelivery baseline for carryover row 14").

## Row 14 final cell (carryover-1028.md, 2026-11-03 refresh)

State **built**, strict proof **OPEN**: "`src/assembly/production-session-driver.ts:693` boot-sweeps prepared deliveries and preserves uncertain sends; L uses its continuing adapter (`tests/preview/journal-agent.mjs:2775`). Exact 1.x ghost/styled-input discrimination is still specified in D18:24, not demonstrated by a normal answered message." The gap named there is exactly what this change ports: the boot sweep covers a send that never started; nothing covered an Enter that was eaten after the send, and no styled-input discrimination existed.

## The 2.0 call path before this change

`src/assembly/production-session-driver.ts`: `deliver()` checks the prompt is ready, records the
delivery `prepared` → `sending`, `sendText()` pastes the text and presses Enter, and the delivery is
recorded `accepted` with evidence `tmux-input:<operation>`. Nothing verified that the Enter was
taken. If it was eaten, the text sat at the prompt, `observe()` saw a non-idle, non-active pane and
answered "session live; turn still open" until the per-turn deadline killed the session. No key was
ever re-pressed (so a ghost suggestion was trivially never submitted, and a real accepted input was
never recovered).

## Behavior inventory

| 1.x behavior (source) | 2.0 disposition | Where |
|---|---|---|
| Marker of the injected text, first 40 visible characters, minimum 8 (`SessionManager.extractInjectionMarker`) | Replaced: a shared prologue does not identify a production envelope; the complete payload and original intake digest are required | `pendingInputAt`, `DeliveryRecord` |
| Marker still at a `❯`/`›` prompt line, or its first 30 characters on the wrapped row (`isMarkerStuckAtPrompt`) | Replaced by full payload equality on joined tmux captures; Gemini `│ *` and pi rule-sandwich composers omitted: 2.0 `SessionFramework` is only `claude-code` and `codex-cli` | `pendingInputAt`, `locatePromptText` |
| Generic prompt-text reader: text after the last `❯`, wrapped next line, separator/footer excluded (`StuckInputSentinel.locatePromptText`, `isStatusLine`) | Anchored composer glyph and complete multiline payload, with segment styling coordinates; widened to `›` | `locatePromptText` |
| Never fire while the pane shows a working footer (`CLAUDE_WORKING_INDICATORS`) | Replaced by the existing `classifyPaneActive` (footer hints, "working…", spinner glyphs). Evidence: the 1.x activity cases pass against it in `tests/assembly/pending-input.test.ts`; 2.0 already uses one activity tell for every driver decision (Rule 116) | driver `observe()` |
| Same text must persist across two consecutive ticks before any key (`minTicksBeforeFire = 2`) | Carried as two consecutive observations | `PENDING_INPUT_LADDER.minObservations` |
| In-process schedule 500/1500/3500/6500 ms after injection, verify-only pass at 9000 ms (`verifyInjection.markerCheckSchedule`) | Carried as instants after the recorded send; the host's `observe()` cadence drives the ticks | `PENDING_INPUT_LADDER.schedule`, `verifyAt` |
| Four rungs: Enter, Enter, C-m, Enter + 150 ms + Enter (`actionForAttempt`, `performStuckInputKeyEffect`) | Carried | `pendingInputAction`, driver `observe()` |
| Exhausted after four rungs until the text changes | Carried per send: the budget is per sent input and never renews on a text change (a text change resets corroboration and the styled verdict only) | `pendingInputStep` |
| F2 ghost-text exclusion: same-pane `capture-pane -e`, SGR dim decoding with 38;5 / 38;2 / colon sub-parameters, `real`/`ghost`/`inconclusive`; ghost sticky, inconclusive transient; re-assessed before every rung; Codex marker path not gated | ANSI decoder retained; both harnesses require fresh complete-payload styling, activity and menu checks at every key, including after sleep | `classifyPromptTextPresentation`, `afterPresentation`, driver `captureStyled` |
| Rung consumed on `effect-unknown` (key may have reached the pane) | Strengthened: typed dispatch intent is durable before each key; an unknown outcome preserves the original identity and inhibits further keys until reconciled | `PendingInputRecord.pressing` |
| Refusal budget (`consecutiveRefusals`, the 75,001-row loop) | Omitted: 2.0 has no durable-delivery fence returning `refused` here; stop, identity and tmux failures throw out of `observe()` and leave the saved record, so no silent retry loop exists. Evidence: `checkStop`, `verifyLive`, `run` in the driver | — |
| One `undeliverable` row and `onUndeliverable` consumer: attention item plus a deterministic Telegram notice (`server.ts` 11695) | Re-expressed: `pause-observed` / `input-undelivered` to the existing owner, which records the uncertain turn and retires the worker (`conversation-harness-adapter.ts` → `production-conversation-session.ts`). The owner's existing uncertain-outcome path owns any operator notice (Rules 53, 87, 88); no notice is sent from the driver | driver `observe()` |
| Tier-C escalation (server restart + replay via `SessionRecoveryChannel`, `RecoveryActuationAuthority`, dark by default) | Omitted: 2.0 worker loss and replacement are owned by the conversation session's existing `replace()` path with its own admission checks (`production-conversation-session.ts`); a holder-requested restart is a Part Eight typed effect that is granted but not landed (`docs/18-sentinel-holders/08`). The 1.x escalation tests are in `legacy-1x/tests/unit/StuckInputSentinel-escalation.test.ts` for the desk | — |
| `stuck-input-events.jsonl` and `DegradationReporter` | Omitted: the durable session journal row (`SessionRecord.pendingInput`) and the observation `detail` are the record; 2.0 has no side JSONL stores (Rule 32, 45) | `SessionRecord.pendingInput` |
| Setinterval sentinel scanning every session; GC of records for dead sessions | Re-expressed: the owner's existing `observe()` cycle per open turn; the record lives on the session row and is cleared when the text leaves the prompt or the turn closes | driver `observe()`, `closeTurn` |
| `MessageDelivery.deliverToSession`: alive check, allowed foreground process, human-input detection, context budget pointer delivery, per-session FIFO mutex | Omitted as already done by 2.0: `verifyLive` (exact tmux identity, stronger than alive), the harness is launched by the driver into its own pane so the foreground process is fixed, 1.x `hasActiveHumanInput` always returned `false` for agent sessions (`server.ts` 17948), the conversation session bounds the envelope at 1,048,576 bytes and the driver sends chunked literals, and `io.exclusive` serializes every boundary. Its tests are in `legacy-1x/tests/unit/message-delivery.test.ts` | `deliver()`, `sendText()` |

## Decisions (Rule 102)

- CARRYOVER-14-1104-1 — Eight owns the narrow typed `submit-authentic-pending-input` action.
  Ten re-resolves the original accepted delivery and complete payload at the existing checkpoint;
  the same delivery journal records admission, fresh-frame digest and uncertain key outcomes.
  No separate holder, store, timer or operator authorization is needed.
- CARRYOVER-14-1104-2 — Both composers require full payload equality and a fresh normal-intensity
  frame without active work or a menu. The last rung rechecks after its sleep. A shared prologue,
  arbitrary prompt glyph or normal intensity alone cannot authorize a key.
- CARRYOVER-14-1104-3 — Keep the four-rung budget per sent input; changed payloads never inherit the original intake authority and never renew the budget.
- CARRYOVER-14-1104-4 — Report a spent ladder as `pause-observed` / `input-undelivered` to the
  existing owner instead of 1.x tier-C restart/replay and direct Telegram notice; omit the JSONL
  event log and DegradationReporter.
- CARRYOVER-14-1104-5 — Reuse `classifyPaneActive` as the activity tell instead of a second
  indicator list.
- CARRYOVER-14-1104-6 — Keep the raw 1.x baseline under `legacy-1x/`, outside the compiled and
  tested trees, so the baseline commit builds and the live tree is unchanged by it.

## Evidence

`tests/assembly/production-session-pending-input.test.ts` retains successful input recovery next
to Astra's shared-envelope, focused-menu and fresh-active-frame negative cases. It also covers
both harnesses, final-rung races, changed durable authority and unknown outcomes across restart.
`tests/assembly/pending-input.test.ts` retains the 1.x SGR/F2 recorded-shape cases and bounded ladder.
`tests/assembly/pending-input-admission.test.ts` checks closed payload bindings, durable-before-key
ordering, ordinal deduplication, refused evidence and unknown dispatch/settlement outcomes.
No live task has run; row 14 stays OPEN until the whole feature passes one.

## Known limits

- The ladder runs on the owner's `observe()` cadence; a slower cadence delays, never multiplies, the rungs.
- Only text sent by this driver is recovered; operator-typed text in an operator's own pane is outside the driver's identity and is not pressed.
- The undelivered report reaches the operator only through the owner's existing uncertain-outcome path; no dedicated notice exists.
- Gemini and pi composers, tier-C restart escalation and the refusal budget are not carried (see the table).
