# Change review — rc-2 pipeline repair: the status command's fixed report is not rewritten by the reply-check revision

Subject base: e388ac0641d20cccdb9648b1a5419d268cf34d75
Review state: open
Reviewed content: none
Outcome: The rc-2 pre-switch set failed (f) as a new failure versus live: group I's I1d (the 'What is your status?' reply must carry the 'Retrospective review: … completed pass(es) … inspected … efficiency duty ran' line) FAILED on rc-2 (preswitch-rc-2-e388ac06-20261006-050415, update 840341757) and PASSED on live e4cf7104 (preswitch-sb-w4-replycheck-e4cf7104-20261006-015938, update 840341745). Cause: in both runs the operator had just said 'Your replies are too long — keep them to two sentences.', and the contextual reply review objected to the status report with breaks_preference. A violation sends the reply to the one bounded revision round, where a model rewrites it. On live the reviser kept the draft (guidance landing 'unchanged'); on rc-2 it cut the report to two sentences (landing 'revised'), dropping the Retrospective review line that is Rule 51's proof — and the rewritten text was still signed as infrastructure, because the status command's speaker is fixed. The difference between the runs is model choice, not anything the five merged builds changed: src/ differs from live only by a conformance pin, and no merged hunk touches the revision path. The fix is at the source: the status command's report (the same predicate that makes it speak as infrastructure, `isStatusCommand(turn.text) && !turn.reserved`) is not offered to the revision round. The review still runs, its objection is still recorded with the send as a signal, and the credential floor is untouched. Every other reply keeps its revision round unchanged.
Affected rules: 89 (the runner's own fixed report is no longer rewritten by a model while signed as infrastructure: what is signed infrastructure is what infrastructure wrote); 51 (the status reply keeps its Retrospective review line, the proof the efficiency duty ran); 86 (the objection stays a recorded signal, never a rewrite or hold; the two ruled exceptions are unchanged); 34 and 37 (both sides proven by one two-case test, and the status side shown to fail without the fix; no quarantine); 74 (this record); 101 (plain commits, no bypass); 116 (one predicate on an existing condition, no new machinery).
Affected floors: secrets — unchanged; the credential-shape floor and held-secret checks run before and regardless of the revision. spend cap — a status reply no longer spends the revision call and its revision review (at most two fewer model calls on that turn); nothing is added. stop — unchanged. no duplicate sends — unchanged; one send per turn. durable intake — unchanged; no journal row kind or field is added.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what decides whether a model revises an outbound reply, on the preview's live answer path.
Side effects: a status-command reply that draws a review objection is now sent as the fixed report with the objection recorded, instead of being model-revised. Its release record shows the objection with no revision; `responseSkipped` is not set for it, because the revision was not skipped for deadline or cap but never applies.
Undo and recovery: revert a923d453 and re-run the desk chain (repin, replay), dropping f6bbd388 and 72dce649.
Multi-machine posture: machine-local preview runner, unchanged.
Layer below: tests/preview/status-command.ts `isStatusCommand` and the Rule 89 speaker predicate in tests/preview/journal.ts, which this reuses exactly.
Bug class: live-path
Bug evidence: reproducer=tests/preview/reply-check.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/results/preswitch-rc-2-e388ac06-20261006-050415/I-proofroom3-ps/inspect-i1s.json
Hook bypass: none. `git config --get core.hooksPath` is unset; plain `git commit` only; no stash.
Convergence: none
Decision: rc-2-repair-status-not-revised | the status command's fixed report is excluded from the reply-check revision round rather than making the I1d check tolerant or teaching the reviser to keep the Retrospective line: the report is the runner's own account signed as infrastructure (Rule 89), so a model rewrite of it is the defect, and the objection stays a recorded signal (Rule 86) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rc-2-PROGRESS.md
Prompt review: model-facing in the decision sense only: no prompt text or parser changes; what changes is that a status-command reply is no longer sent to the revision model. Replayed the real recorded review shape from the rc-2 proof room 3 journal inspect (update 840341757): verdict violation, ruleIds [breaks_preference], with its recorded reason text, through the worker; the status side keeps the fixed report (revise called 0 times) and the ordinary side is revised once. Stubs carry that recorded verdict; the status side was confirmed to fail with the fix disabled. The three prompt findings below are pre-existing literals in tests/preview/journal.ts that this change does not touch.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing memory-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing memory-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal.ts, tests/preview/reply-check.test.ts

## Closing block

simplestRobustRoute: one existing predicate (the one that already makes the status report speak as infrastructure) gates the existing revision condition and its skipped-reason twin; no new state, constant or call.
80/20: 0 must-fix, 1 note: targeted tests only (reply-check, status-command, guidance, retrospective-duty-followup, claim-scoped-floor: 140 passed, 1 pre-existing skip); the full suite runs on the gate host.
VERDICT: author submission; the independent verdict is recorded as a pass
