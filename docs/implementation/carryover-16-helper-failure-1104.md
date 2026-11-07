# Carryover row 16: HelperWatchdog / SubagentTracker, ported from 1.x

Row 16 of `lanes/carryover-1028.md` (user outcome: a helper's failure returns to its parent instead of
losing the requested result) is OPEN. This note records what the 2026-11-05 unit carried from
`JKHeadley/instar` commit `f3f94826ae7c0ae6203c2651698c02b95b89ccfa` (raw copies in `legacy-1x/`),
what it reused that 2.0 already had, what it adapted, what it left out and why, so the remaining gap
is named rather than implied. No live proof is claimed; row 16 stays OPEN until a live task.

## Where the 1.x feature lives in 2.0

| 1.x | 2.0 | Carried how |
|---|---|---|
| `SubagentTracker.onStart` (JSONL record per helper before/at start) | `nestedSessionWorkEdge` appended by the checkpoint before the subagent is admitted (`tests/preview/admission-gate.mjs` delegation `pre`), plus the hook's `child-start` row (`tests/preview/tool-admission-hook.mjs`) | Reused as it was: already durable, in the journal, under the parent's single writer. Test: `tests/preview/session-admission.test.ts` "admits the full tool set" (edge is in the record before the hook answers). |
| `SubagentTracker.onStop` with the result (`lastMessage`, transcript path) | nested close `complete` on the returned tool result or the harness wait's per-child completion; the hook's `child-stop` row | Reused. 2.0 keeps result bytes, never result text (least revelation). Tests: session-admission "a delegation whose return is interrupted", "an asynchronous spawn acknowledgement is not completion". |
| `HelperWatchdog` `helper-failed` (regex on the stop message, alert injected into the parent session) | `nestedSessionWorkFailure` + `classifyHelperFailure` in `src/assembly/production-session-work.ts`; the hook reports a `PostToolUseFailure` for a delegation to the checkpoint, which closes the edge `failed` | Carried: the five tuned `FAILURE_PATTERNS` and `classifyStopMessage` verbatim, as a signal only (Rules 4, 10, 86). The close state comes from the harness's own failure completion naming the exact call, never from the match; only the reason enters the journal. The 1.x injection into the parent's stdin is not carried (see omissions). |
| `HelperWatchdog` `stall` (5-minute timer, alert injected into the parent) | the presence sentinel's registered-child observation (`tests/preview/live-sentinels.ts` `workSilenceObservations`) and the step deadline | Not carried as a timer (see omissions): 2.0 already observes every registered child on the status surface, hedged, with no kill or retry authority. |
| `server.ts` `MAX_SUBAGENT_WAIT_MS` (60-minute stale-subagent cap on the zombie-kill exemption) | `WORK_STALE_GRACE_MS` in `tests/preview/live-sentinels.ts`: a child open one silence window past its own recorded `budget.deadline` is stale | Adapted: the bound is the edge's recorded deadline (an exact fact, Rules 13 and 26), not a constant from start. A stale helper is `action-needed` and no longer holds its parent in a wait; nothing is killed. |
| `server.ts` zombie-cleanup / `SwapWorkGate` / `SessionReaper` gate K ("absent ⇒ keep") | the parent's wait on a registered helper (`live-sentinels.ts`), `openDelegations` refusing lost-worker revival and turn end (`src/assembly/production-conversation-session.ts`) | Reused. Tests: `live-sentinels.test.ts` "observes every registered child", `production-conversation-session.test.ts` open-child cases. |
| parent result after a lost helper | the port closes the open helper `uncertain` before its own close names it; `collect` after a restart returns that diagnosis, no replay | Reused and now traced end to end (`tests/assembly/helper-loss-trace.test.ts`). |
| (no 1.x analogue) duplicate result | `tests/preview/journal.ts` `projectSessionWork` refuses a second close for the same edge and a re-opened edge id on a new row; `production-conversation-session.ts` batch recovery requires exactly one settled close per helper | New guard the task asked for: a late or duplicate result cannot re-settle a helper or re-charge its excess. Replay of rows already on disk is unchanged. |

## Lines carried versus newly written

Raw copies: `legacy-1x/` (commit `4166c74d0`), 1,130 source and test lines. The port does not copy
those files into the compiled tree: the 1.x classes are a side store and an event emitter around a
tmux session, and 2.0's journal, checkpoint and hook already hold their durable facts. Carried lines
are final lines whose logic is the 1.x source unchanged.

| File | Carried from 1.x | Adapted or new |
|---|---|---|
| `src/assembly/production-session-work.ts` | 12 (`FAILURE_PATTERNS` as `HELPER_FAILURE_PATTERNS`, `classifyStopMessage` as `classifyHelperFailure`) | 15 (`nestedSessionWorkFailure`, comments) |
| `tests/preview/live-sentinels.ts` | 1 (the stale-cap rule, as a recorded fact) | 12 |
| `tests/preview/admission-gate.mjs` | 0 | 10 |
| `tests/preview/tool-admission-hook.mjs` | 0 | 9 |
| `tests/preview/journal.ts` | 0 | 12 |
| `src/assembly/production-conversation-session.ts` | 0 | 10 |
| `tests/assembly/production-session-work.test.ts` | 16 (the classifier vectors of `HelperWatchdog.test.ts` and `HelperWatchdog.wireup.test.ts`) | 30 |
| `tests/assembly/helper-loss-trace.test.ts` | 0 | 227 |
| `tests/preview/session-admission.test.ts` | 0 | 39 |
| `tests/preview/live-sentinels.test.ts` | 0 | 44 |

## The traced path (`tests/assembly/helper-loss-trace.test.ts`)

Real pieces: the executable hook, the loopback checkpoint, the Eight-owned session-work port, the
encrypted journal (`journal.sessionWorkRecords` is exactly what `tests/preview/journal-agent.mjs`
hands the port as `recoveryEdges`), the presence sentinel. The child harness is substituted; the hook
inputs are the documented envelopes the pinned harness sends.

1. Physical stop: the hook's `child-start` and `child-stop` rows for the helper, synced to disk; the
   helper's harness never posts a result.
2. Parent observation: while the step is open the sentinel reports the parent `waiting` on a
   registered helper and the helper `unknown`; no stall, kill or retry.
3. Durable parent result: at the step deadline the port closes the helper `uncertain` ("the parent
   step closed before the delegated agent returned"), then its own close `uncertain` naming the helper,
   with no `cleanupConfirmed`, `calls: 0`, `reserved: 24`.
4. Across restart: the journal is closed and reopened from disk; a fresh port with nothing in memory
   collects the same `uncertain` result with the same detail plus "no automatic replay"; nothing is
   registered any more and the sentinel keeps no stale wait.
5. Duplicate-result refusal: a second helper close, a late `complete` for it, and a second parent close
   are each refused by the journal; the checkpoint ignores a second failure or a late success for the
   same call and refuses any report after the parent closed the claim.
6. Failed helper: the harness's failure completion closes the helper `failed` (signal `rate-limit`,
   no error text), the parent's own result completes with `cleanupConfirmed` and its digest, and a
   restart collects it complete.
7. Stale helper after host loss: within its recorded deadline the parent waits; one silence window past
   it the helper (and a parent sharing the deadline) is `action-needed`; collection stays uncertain.

Recorded shapes replayed: the three live Bash failure completions of 2026-10-16
(`tests/preview/fixtures/progress-stale-2026-10-16/failed-completions.json`) through the real hook (none
touches an edge); the recorded work output of 2026-10-15 (`work-recovery-2026-10-15.json`) as the
parent's result; the 1.x classifier vectors verbatim.

## Omitted 1.x behavior, with the 2.0 code and can-fail test that make it unnecessary

- Alert injection into the parent session's stdin (`sessionManager.injectMessage`): session input is a
  principal (Rule 29) and 2.0 has one admitted input path per worker. The parent receives the helper's
  error as the tool result natively; the host records the failure as the durable close. Code:
  `tests/preview/admission-gate.mjs` delegation `post`; test: session-admission "a harness-reported
  helper failure closes its edge failed".
- The 5-minute stall timer as a failure signal: `docs/18-sentinel-holders/10-...` row for
  `HelperWatchdog` ("a timer alone does not prove failure"). Code: `live-sentinels.ts`
  `workSilenceObservations` (a helper with fresh unchanged activity is reported `may be stalled`,
  hedged, no authority); test: live-sentinels "observes every registered child ... helpers and unknown
  observations are not stalled". The step deadline (`SESSION_WORK_LIMITS.deadlineMs`) is the only
  ceiling.
- `SubagentTracker`'s JSONL side store, per-session cap, orphan stop records, session summaries and the
  O(1) `hasActiveSubagents` index: the journal's `activeSessionWork` (saved in snapshots, rebuilt from
  retained rows for older ones) is the one store, under the single writer (Rules 32, 33). Code:
  `tests/preview/journal.ts` `projectSessionWork`, `restoreSnapshot`; tests: live-sentinels replay
  assertions, `production-session-work.test.ts` "the journal reserves an edge's whole call liability".
- The 60-minute constant: replaced by the recorded deadline plus one silence window (above).

## Decisions (Rule 102)

C16-1104-1 a harness failure completion naming a delegation call closes its edge `failed`; the parent
completes over it. C16-1104-2 the classifier is a signal only; the error text never enters the journal.
C16-1104-3 no stdin injection and no timer-as-failure; the sentinel and the deadline carry the stall.
C16-1104-4 stale = recorded deadline + one silence window, per edge. C16-1104-5 duplicate close and
re-opened id refused on new rows only; replay unchanged (Rules 7, 44). C16-1104-6 no side store.
C16-1104-7 a conversation edge the journal refused at the cap gets no journal close (it never entered).
C16-1104-8 batch recovery after restart accepts exactly one settled (complete or failed) close per
helper. C16-1104-9 a closed edge id may be re-opened: the port never reuses ids and `collect` refuses
two edges for one operation; tracking every historical id is not added.

## Exact remaining behavior (keeps row 16 OPEN)

- A live task on the Studio in which a real Claude Code helper fails or is lost under a scheduled
  obligation, with the parent's result then collected: not run here (desk-owned).
- Binding a lost helper's `child-stop` row to its edge without its result: the harness names the agent
  id only on the returned result, so a lost helper's close says "did not return"; its stop stays in the
  hook's `admission.jsonl`. A heuristic start-order link was rejected (Rule 26).
