# Change review — enclose the existing local transcription deadlines

Subject base: bf2cb698cd6b67f7165c96627f7a2cdde3c32805
Review state: open
Reviewed content: none
Outcome: Let the two named real-media tests await the bounded offline transcription and its cleanup before deleting their temporary roots. Preserve every acceptance, refusal and physical cleanup assertion.
Affected rules: 26, 34, 36, 37, 42, 49, 55, 60, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged custody and protected file assertions; spend cap — unchanged Six admission and allocation return; stop — unchanged production stop and an added stopped slow-path neighbor; no duplicate sends — unchanged custody deduplication assertion; durable intake — no runtime or journal change
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Required owner-reference and generated register publication retain critical review despite the narrow test-only cause; production composition, limits, capability and model behavior are unchanged.
Side effects: The three real transcription cases can wait up to 180 seconds instead of 30 seconds before the test watchdog fails. Non-audio Telegram cases retain 30 seconds. No global timeout or assertion changes.
Undo and recovery: Revert this commit to restore the prior test deadlines; no migration or installed-state recovery is needed. Keep the original red run as evidence rather than treating a subsequent pass as exoneration.
Multi-machine posture: Host-local tests of the same offline decoder on each supported host; no cross-machine state or authority changes.
Layer below: scripts/local-transcriber.mjs allows sequential 30000 ms ffmpeg and 90000 ms whisper-cli calls. scripts/resource-owner.mjs also awaits admission and verified cleanup. A 30000 ms outer test deadline can fire during valid recognition and remove its temporary root prematurely. The new 180000 ms test watchdog encloses both stage limits plus 60000 ms for admission, cleanup and fixture assertions; production enforcement is unchanged.
Bug class: integration
Bug evidence: reproducer=tests/preview/telegram-files.test.ts
Hook bypass: none
Convergence: none

1.X FIRST: searched actual JKHeadley/instar main snapshot
9b5790e8105f94c8ad6f13243d063e7c7efd23b6 in src/ and docs/specs/ for process probes,
lsof, kill-session, ffmpeg, whisper and transcription timeout. Read
src/monitoring/ExternalHogProcTable.ts (comm= and unknown malformed readings),
src/core/SessionManager.ts (indeterminate failed probes),
docs/specs/unified-session-lifecycle-robustness.md and
docs/specs/test-runner-concurrency-bound.md, with ONEX-LESSONS.md sections 2 and 6.
Inspected history ab26b7ca3 and 618560b3e/c91b8780e/681f86543/e1a1b7218.
The existing owning repair be9ab8e836bb1123d67ff0f06bdb0b4da88d2cea already reuses
executable-only census and unknown-on-failed-observation behavior. No duplicate census
or session repair is added. src/core/VoiceTranscription.ts, history f154f38aa,
uses one bounded HTTP call with a default 60-second limit; that is not this two-stage
offline decoder. Reuse bounded calls and cleanup, retaining the existing offline path
rather than introducing a provider dependency.

Decision: T179-R4-DEADLINE | Enclose the existing 30 s decode and 90 s recognition limits with a finite 180 s test watchdog, including admission/cleanup allowance; keep non-audio deadlines and every assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-179-repair-PROGRESS.md

Before: the four named files produced 45 passes and one failure in 102.42 seconds:
Telegram audio timed out at 30002 ms. Real media allocation took 27985 ms; inventory
and both physical tmux cleanup tests passed. This reproduces an exact named failure
after the existing census repair. Log: train-179-r4-targeted.log in the desk lanes.

After: the two changed files passed all 35 cases in 47.27 seconds, foreground
nice -n 10 npx vitest run --maxWorkers 1. Typecheck passed. The new fake-clock pair
injects 31 seconds of recognition without generating load: the directory remains owned
at 30 seconds, the unstopped result succeeds, a stopped result refuses, and both remove
decoded plaintext on settlement. Both stage timeout arguments remain exactly 30000/90000.
Existing real owner output/timeout/stop tests and the capacity-before-spawn refusal pass.
Logs: train-179-r4-media-fixed.log and train-179-r4-typecheck-final.log.

Recorded-shape replays remain active and passed: summary-writer 715672480,
summary-uncertain 715672483, Jev undecided 715672482 and unsure 969389570,
reply-review 969389923, delivered reply 715672479, empty reply 715672550
(retrospective-duty-followup-train-1-2026-10-08.json), and attachment bridge
715676899 (gap-image-1017.json). No model prompt or output parser changed.

The 18:18:31 copied-preview answer failure at bf2cb698 remains red: the browser
stalled at sent/chat-shown on forum-answer-copy-20261105-181103. No runner was
launched against the copy. This change does not claim a repaired live answer.
The desk retains full/native/review/live gates and owns fresh full-test admission.
No full suite, CPU load generator, quarantine, hand-edited pin or certificate change.

Architecture passed on dbf5473d6; lint/register correctly refused the changed media
test's stale owner-reference pin. The delegated desk-rehash-owner-manifests.mjs
and desk-repin-chain.sh refreshed only that preview owner pin; no chain inventory
change was required. build-register.mjs --replay at pin commit
009d74ec8b13ccd507fdf99c7bbd40688d61e190 exited 0, producing generation
sha256:673b311150832984c1e01485ab8f7538ea9484336365eeae46b7ad07b3371cce
(298 entries, 121 rules, shape-only authority). The generated seven-file register
publication is mechanical; all final-head cheap checks remain required before push.

## Closing block

simplestRobustRoute: Correct only the enclosing test watchdogs to accommodate the existing bounded decoder and cleanup; verify a slow valid result and stopped neighbor with fake time while keeping real physical and recorded-shape checks. No added runtime machinery or capability reduction.
80/20: The reproduced named failure has a concrete deadline mismatch and a narrow repair; existing census/session repairs remain single-owned and the desk performs the full/native/review/live gates.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
