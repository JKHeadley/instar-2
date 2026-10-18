# Change review — w3-selfdesc repair round 4: a format re-ask or timeout replacement records its re-read packet, so the contextual review and the revision read the attempt that ran

Subject base: 95a2bd9058d4767af4a25529e7856ded0c9f0142
Review state: open
Reviewed content: none
Outcome: Repairs the w3-selfdesc round-4 unit review (Astra, VERDICT NO, one must-fix). Round 3 re-read a re-ask's or replacement's capability entries for the route its call took, but the refreshed prepared prompt was sent to the model and recorded nowhere, so turn.prompt stayed the first attempt's packet; the contextual reviewer (replyReviewContext via projectedReplyPrompt) and the revision read the old route's capabilities, governing constraints and obligation instructions beside a corrected declaration. Now the format-retry (answer role) and answer-replace rows carry the refreshed prompt when one was prepared (answer-replace only when it differs), the reducer makes it the turn's prompt (identical on replay after reopen), the earlier attempt's prompt stays on its reserve row as evidence (retainedEvidence keeps a row prompt that no longer equals the turn's), and the launcher's model-call input reference names the row that holds the input (reserve, lookup, format-retry or answer-replace) instead of always naming the reserve row. The boundary test drives the shipped prepareJournalEnvelope, runToolTurn and replyReviewContext at caps 12 (text-only) and 18 (tools) for both a format re-ask and a recorded timeout replacement, asserts the review packet's capabilities, governingConstraints and obligationDecision and the turn's prompt before and after reopen; it fails on the prior head. The reviewer's retained regression probe passes on both caps.
Affected rules: 45, 58, 78 and 84 (the packet review and revision read, and its recorded provenance, match the call that actually ran), 34 and 36 (both routes and both retry kinds tested through the real worker, envelope, tool turn and reviewer input), 37 (source fix, no quarantine), 74 and 111 (this record), 101 (no hook bypass), 116 (one optional field on two existing rows and one projected kind; no new service, classifier or review round)
Affected floors: secrets — unchanged (the recorded prompt is the same prepared envelope already sent and recorded by the model-call boundary); spend cap — unchanged (no new call or reservation); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged (an optional row field; older journals without it replay as before)
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes which packet the reply reviewer and the reviser are given after a re-asked or replaced answer call.
Side effects: a journal with a re-ask now stores the re-ask's prompt on its row, in addition to the first attempt's prompt on the reserve row (bounded by the packet limit, once per turn).
Undo and recovery: git revert the repair commit, then repin and replay the register; journals written with the new optional field are refused by the old reducer only if it rejects unknown fields (it does not: the field is ignored).
Multi-machine posture: unchanged; journal rows replicate as before.
Layer below: the format-retry and answer-replace reducer branches, retainedEvidence and projectedReplyPrompt in journal.ts, and callSubscription's inputRef in journal-agent.mjs, exercised by journal-obligations.test.ts.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: selfdesc-repair4-record-on-row | the refreshed prompt is recorded on the existing retry/replacement row rather than a new record kind, so replay and the reviewer read one source | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-selfdesc-PROGRESS.md
Prompt review: no new prompt wording; the reviewer and reviser now receive the packet the final answer call was actually given.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-agent.mjs, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: record the refreshed prompt on the existing retry/replacement row and let the reducer project it as the turn's prompt. Not chosen: a per-attempt prompt list, a new record kind, or rebuilding the review packet separately.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
