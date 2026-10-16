# Change review — bounded request identities in work observations

Subject base: 160d7af00d4874dab6096ad1d5f347bccf0223df
Review state: open
Reviewed content: none
Outcome: an accepted 500-byte reminder cannot reject the population's work-observation row or hide an unrelated frozen child. Both short and long reminders retain stable observation keys and full durable request contents.
Affected rules: 9 and 64 — durable looking and stall visibility include accepted long requests; 26 and 70 — regression exercises real worker intake, acceptance, journal append and reopen; 39 and 87 — existing failure counts and pull status, no push; 44 and 45 — old advisory request keys are replaced by the next population observation, with a fresh observation window, without changing durable requests or work lookup; 49, 74, 102, 111, 113 and 116 — recorded scope, decision, foundation, posture and simplest repair; 101 — no hook bypass.
Affected floors: secrets — hashes replace quotes in observation keys; spend cap — no added model calls; stop — existing observer stop gate unchanged; no duplicate sends — no send or retry introduced; durable intake — accepted capacity and full request records unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: three-line projection repair with two boundary regression cases, no new capability, authority, parser, model prompt or output acceptance path.
Side effects: request work keys now use the same stable digest as promise observations. Existing raw-key advisory history is replaced on the next observation, resetting that request's silence clock once; unrelated children retain their clocks. No durable obligation identity or lookup changes.
Undo and recovery: revert this repair commit; all request records and sentinel frame shapes remain readable. Reverting restores the long-request observation defect.
Multi-machine posture: deterministic hashes agree on all machines given the same journal requests. Observations remain local-worker evidence in the existing replicated journal and convey no peer recovery authority. Single-machine behavior requires no peer.
Layer below: inspected openLoops' full-quote request identity, the worker's accepted quote limit, openRequests' durable projection, the existing promise request hash, the sentinel identity validator and observeWork's whole-row append. Lookup into obligationWork still uses the original loop identity.
Bug class: integration
Bug evidence: reproducer=tests/preview/live-sentinels.test.ts
Hook bypass: none
Convergence: none
Decision: owed-request-key | Reuse promise request hashes only for observation keys while retaining original obligation lookup and full durable request, avoiding a new store or reduced intake capacity. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owed-result-1015-repair-184532-PROGRESS.md
Prompt review: no model prompt, parser or acceptance changes; added inputs exercise the existing request acceptance path, not a new meaning rule.

Subject: tests/preview/live-sentinels.ts, tests/preview/live-sentinels.test.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json
Review coverage repair: the original unit record lacked a Subject base and required schema fields. Added its actual base and author-review fields to cover the six unit commits; preserved its existing evidence without claiming new native or live acceptance.
Register refresh: ran the delegated desk scripts (zero owner or inventory changes), then rebuilt generated register outputs against the committed repair. Generated source pins now bind the repaired sentinel bytes. No hand-edited pins.
Verification: new boundary cases fail before repair (500-byte request leaves no work row) and pass after repair. All 21 live-sentinels tests pass; journal-due-loop's 6 and dispatch-now's 11 tests pass. Seven unchanged live-sentinels-launch cases refuse before launch on WSL (bot identity refused); Studio gate owns those launcher checks. No independent convergence or live-user acceptance claimed.

## Closing block

simplestRobustRoute: project existing durable requests onto the existing bounded promise hash when recording work observations. Keep all validators, intake capacity, work lookup, stop and authority boundaries. This is the simplest route; no watcher, store, retry, send or recovery machinery is added.
80/20: repair the one accepted-input boundary exposed by review, prove short and long neighbors with another frozen child and journal reopen, and submit to the desk without broadening scope.
VERDICT: author submission; independent desk review pending
