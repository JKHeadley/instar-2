# Change review — sb-w4-d1b round 3: the status answer is held inside a 3500-unit budget where it is built

Subject base: b2bf46358de759736775dd551a4eaa62fd603cfd
Review state: open
Reviewed content: none
Outcome: Observer #183 (a2): on a copy of a long-history root (proofroom1-a2-20261005-045110, candidate 39d5d4fd) the operator's "What is your status?" answer was 4103 of Telegram's 4096 units in one message (update 715674230); the deferral status lines pushed it over. Per the desk directive the fix is a real budget, not a trim of a few characters: `statusAnswer` (tests/preview/status-command.ts), the one funnel both the chat reply and the operator dashboard read, now holds the whole answer inside STATUS_ANSWER_BUDGET = 3500 units, measured as the send path measures them (the HTML-escaped body in UTF-8 bytes). When the whole is inside the budget it is returned byte for byte unchanged. When it is over, every line is kept in order and only the longest lines are shortened, to one shared cap (the largest that fits), each cut at a space in its second half and marked with an ellipsis, so every label and its leading facts stay. The earlier commit in this round (df65d932) also names at most the 10 longest-waiting pending memory decisions; the count stays exact. On the recorded a2 answer the result is 3499 units with all 31 lines present.
Affected rules: 87 (the operator's status pull answers in one delivered message again), 2 (a shortened line is visibly marked with an ellipsis; nothing is dropped silently), 52 (one bounded message instead of a split or a too-long notice), 36 (both sides of the bound are proven at the limit: exactly the budget is unchanged, one unit over is shortened back inside), 106 (replayed on the recorded over-limit answers: a2 update 715674230 and the live 2026-10-03 answers 6232050 and 6232056), 116 (one bounding function at the existing funnel, no new store or model call), 74 (this record), 101 (plain commits, no bypass flag), 102 (Decision lines below)
Affected floors: secrets — unchanged: the bound only shortens text that was already redacted and already shown; it adds no new text. Spend cap — unchanged: no model call, reservation or retry; the status answer is still a fixed reply. Stop — unchanged: no gate, stop or stop-confirmation path touched. No duplicate sends — unchanged: the status answer is still appended once as a status-answer row and sent by the existing path; no send path changed. Durable intake — unchanged: no row kind, field or cursor behaviour changed.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a pure text-bounding function over the fixed status answer. It writes nothing new and decides nothing: an answer inside the budget is byte-identical to before, and an over-budget one keeps every line in order with its head.
Side effects: on a long-history root, the longest status lines (Tools, Effect doorway, Harness identity, Kept session, Past a cap, the pending-decisions list) end in an ellipsis instead of their full tail; the operator dashboard shows the same bounded text, since it reads the same funnel by design.
Undo and recovery: revert 0e43c34f and df65d932 (and the repin/replay commits after them). No state to repair; the answer is derived on every read.
Multi-machine posture: machine-local preview runner; nothing replicated.
Layer below: reviews/sb-w4-d1b-repair2-change-review.md and every record it carries. Beneath the change: reply-parts.ts encodeReply and TELEGRAM_MESSAGE_LIMIT (the send path's own measure), unchanged.
Bug class: unit
Bug evidence: reproducer=tests/preview/status-command.test.ts
Hook bypass: none. `git config --get core.hooksPath` is unset in this clone; plain commits.
Convergence: none
Decision: d1b-r3-budget-at-funnel | held the bound in statusAnswer, the one function the chat reply and the dashboard both read, rather than in any single line, because the over-limit growth came from several lines that each grow with the journal and a per-line trim would be beaten by the next growing line | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-d1b-PROGRESS.md
Decision: d1b-r3-shared-cap | shortened only the longest lines to one shared cap instead of dropping lines, so every status fact keeps its label and leading figures and short lines are never touched | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-d1b-PROGRESS.md
Decision: d1b-r3-3500 | chose 3500 units per the desk directive, leaving 596 units of headroom under 4096 for the PREVIEW mark and journal growth | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-d1b-PROGRESS.md
Prompt review: not model-facing. The status answer is a fixed reply; it is also carried as `statusFacts` in the status turn's packet, which now carries the same bounded text. No prompt wording, output parsing or accept/escalate/refuse decision changed.
Deferral: generated/register.json:1 | not-a-deferral=generated register output re-emitted by the desk replay with only the source pin changed

## Closing block

simplestRobustRoute: one bounding function at the existing single funnel, measured the way the send path measures. Alternatives were each worse: trimming one line (beaten by the next growing line, and the desk ruled it out), splitting the status into two messages (the one-glance pull becomes two), or dropping lines by priority (a hand-kept priority list that drifts, and a dropped fact is a silent loss).
80/20: proven at the limit on both sides and on three recorded over-limit answers; status-command 21/21, operator-dashboard 9/9, reply-parts 27/27, journal-obligations and retrospective-duty-followup 51/51, tsc clean, lint exit 0, register --check true. Not run here: the full suite (the pipeline reruns it after the push).
VERDICT: author submission; the independent verdict is recorded as a pass
