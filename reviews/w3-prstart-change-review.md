# Change review — w3-prstart: a launch refused before it launched records its reason

Subject base: 661ab944b613338a6b604feffd02d7ba0518321f
Review state: open
Reviewed content: none
Outcome: The proof room's single cint-L7 launch (02:08:20-38, proofroom-switch.sh) was refused before it launched and left only "preview refused to start or continue; details suppressed" on stderr and no run-log row, so neither the desk nor `status` could name the refusal. Offline diagnosis on two copies of the proof-room root (a loader hook revealing the swallowed error, a loopback Telegram answering as the proof-room bot, an isolated conversation-owner directory) showed every L7 step up to getMe passes, including an exact replay of the switch (L5 paused by SIGHUP after 38 s, L7 started 10 s later): L7 claims, polls in 1-2 s and serves. The one step not exercisable without the real token is the real getMe, so the exact 02:08 refusal is unrecoverable from the records. Fix: a `run` refused after taking the root's writer lease and before launching appends a launch/exit pair while it still holds the lease, with the fixed reason "refused before launch" and the redacted, one-line, 240-character-bounded refusal in `refused`; `status` reports startupRefusals {count, last}. A refusal before the lease (composition origin, a concurrent boot) still writes nothing into the root. Evidence: tests/preview/journal-agent.test.ts "Rules 2, 42" fails on the old code (no runs.jsonl) and passes on the new; the Rule 35 case now also asserts no runs.jsonl is written; 9 related files (86 tests) pass.
Affected rules: 2 (a refused launch is no longer silently lost), 35 (a mismatched composition still writes nothing into a production root), 42 (the refusal stays visible as a refusal in the run log and status), 74, 100 (the recorded detail passes through the existing redaction and is bounded), 116 (one pair of rows through the existing appendRun and one status field; no new store or format)
Affected floors: secrets — the detail is redacted with the existing recall redactor, first line only, bounded to 240 characters; stderr unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (nothing is sent); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: preview launcher only; the change adds a record on a path that already exits non-zero before any poll, send or model call, and changes no decision
Side effects: runs.jsonl gains one launch/exit pair per refused launch, including the expected tokenless genesis refusal; host-watch's last-run reason for such an exit becomes "refused before launch" instead of the previous launch's stale reason
Undo and recovery: revert the fix commit and this record; existing rows stay readable (readRuns ignores an unknown field on older code)
Multi-machine posture: machine-local, deliberately; the root's own run log, written only by the writer-lease holder
Layer below: tests/preview/journal-agent.mjs run try/finally and the writer lease order (lease at openProductionStorage, released in the inner finally after the record), tests/preview/self-state.ts appendRun/readRuns
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed

Subject (3 paths): tests/preview/journal-agent.mjs, tests/preview/journal-agent.test.ts, tests/preview/self-state.ts

## Closing block

simplestRobustRoute: the required outcome is that a refused launch names its refusal durably. The simplest route is to write it through the existing run log with the existing appendRun and redactor, only while the existing writer lease is held, and surface it in the existing status report; this change is that route. Printing the error to stderr was not chosen because host logs are not a governed store and the suppression is deliberate.
80/20: 0 must-fix, 1 note (the 02:08 refusal itself stays unnamed; the next occurrence will name itself)
VERDICT: author submission; the independent verdict is recorded as a pass
