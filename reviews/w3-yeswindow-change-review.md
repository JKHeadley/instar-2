# Change review — w3-yeswindow: an operator request stays answerable 18 hours by default, never past the trial's end, with its lapse in UTC and local time

Subject base: ba63cbbc4be4a897ecd1cd43882e2907ca558172
Review state: open
Reviewed content: none
Outcome: Plan row #373 (observer #143). On the operator's preview the requests lapsed one hour after issue: raise 2a9e7a52e98077e6 (opened 01:33 PDT, lapsed 02:33) and renewal 2582df96e288e6cd (opened 04:02, lapsing 05:02), both unseen at night. proposeOperatorRequest set expiresAt to min(trial end, now + OPERATOR_REQUEST_MS) with a one-hour constant. The default is now 18 hours, configurable on the root with run --operator-request-hours N (1 to 48, passed as explicitYes.requestWindowMs), and the clamp to the trial's current end is kept: for a renewal the current activation end, for a raise the trial end (the same value, view.expires). The reply, the pull request body and the request file keep the UTC lapse sentence and add one sentence with the same instant in the operator's time zone (the worker's timeZone, the runner's --time-zone), and, when the trial's end cut the window, that it is that end. Replay checks only the UTC sentence (a prefix of every new text) and admits lifetimes up to 48 hours (OPERATOR_REQUEST_MAX_MS), so the live journal's one-hour UTC-only requests replay unchanged (checked on a read-only copy).
Affected rules: 42 (a lapsed approval is still refused and its pull request closed), 79, 82 and 98 (exact request, operator approval, single admission unchanged), 3 (the stated lapse is the real expiresAt; the clamp note only when the trial end set it), 106 (recorded turns 969390038 and 969390039 and the live journal replayed), 5 (README entry), 116, 74, 113
Affected floors: secrets — the storage key went from the vault into the environment for the read-only copy only, never printed, and the copy was deleted; spend cap — unchanged: a raise is still bounded and applies only on approval of its exact numbers; only the time a yes may come changes; stop — a stop moves the base, so every open request stays refused; no duplicate sends — unchanged: one completion intent per request, each review id judged once; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes how long an approval can complete a request that raises the spend allowance or extends the trial end, and the replay bound of recorded request rows.
Side effects: requests stay open in status, in the packet and as open pull requests for up to 18 hours instead of one; the request line grows by one sentence (local time and, near the end, the clamp note).
Undo and recovery: revert the commit. A journal that recorded a request with a lifetime over one hour refuses to open under the older build (its wellFormedRequest bounded lifetimes at one hour), so launch roots with this build only once it is the installed one. The reverse direction (one-hour rows under this build) replays unchanged.
Multi-machine posture: machine-local preview runner, unchanged.
Layer below: produceExplicitYes / admitExplicitYes (unchanged; it already refuses a lapsed request by its own expiresAt), the review source (unchanged; it refuses to open a lapsed request), approvalBase and the supersede rule (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: yeswindow-default-18h | the default window is 18 hours, root-configurable with --operator-request-hours (1 to 48), so a phone tap the next morning still lands | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-yeswindow-PROGRESS.md
Decision: yeswindow-replay-max | replay admits any lifetime up to 48 hours rather than the configured window, so lowering the window never makes a recorded request unreadable | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-yeswindow-PROGRESS.md
Decision: yeswindow-governing-deadline | the deadline is the trial's current end for both actions, since a renewal's current activation end and a raise's trial end are the same value | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-yeswindow-PROGRESS.md
Decision: yeswindow-lapse-sentence | the local time and the clamp note ride a separate trailing sentence and replay checks only the UTC sentence, so one-hour UTC-only rows replay unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-yeswindow-PROGRESS.md
Decision: yeswindow-zone-source | the operator's zone is the worker's timeZone (the runner's --time-zone); none, or UTC, keeps UTC alone | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-yeswindow-PROGRESS.md
Decision: yeswindow-24h-clock | local time uses a 24-hour clock, so ICU's narrow no-break space before AM/PM never reaches the chat | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-yeswindow-PROGRESS.md
Prompt review: no model-facing text changed. The runner-written request line is appended after the model's reply; the packet's operatorRequest fields are unchanged and only stay open for the longer window.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Skip: tests/preview/yes-window.test.ts:222 | scope=runs only with a read-only COPY of the live journal and the vault storage key bound (INSTAR_YESWINDOW_ROOT, INSTAR_SECRET_PREVIEW_STORAGE_KEY); run and passed for this change, reported in the PROGRESS file

Subject (7 paths): reviews/w3-yeswindow-change-review.md, tests/preview/README.md, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/operator-yes.test.ts, tests/preview/operator-yes.ts, tests/preview/yes-window.test.ts

## Closing block

simplestRobustRoute: the required outcome is that a request stays answerable long enough for a phone tap, never past the trial's end, and says when it lapses in the operator's own time. The simplest robust route is one constant (18 hours), one optional window parameter passed from one launcher option, and one trailing sentence on the existing request texts. The one added bound, OPERATOR_REQUEST_MAX_MS, prevents a named failure: bounding replay by the configured window would make a journal refuse to open after the window was lowered.
80/20: 0 must-fix; notes: the packet shows no lapse time to the model (unchanged); the older build cannot read a journal holding a request longer than one hour.
VERDICT: author submission; the independent verdict is recorded as a pass
