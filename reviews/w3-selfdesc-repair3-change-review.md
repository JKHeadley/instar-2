# Change review — w3-selfdesc repair round 3: a format re-ask or timeout replacement re-reads its tool route, and the review's capability read follows the latest attempt

Subject base: 0bf26ebf0b98d6694393ff5c0bf5c69b464a91b7
Review state: open
Reviewed content: none
Outcome: Repairs the w3-selfdesc round-3 unit review (Astra, VERDICT NO, one must-fix). A format re-ask (and a timeout replacement) reused the first call's packet; after that call's tool turn reserved seven extra calls, the re-ask could not fit tools and runToolTurn answered it text-only, yet its packet still said externalTools "as listed", and declaredObligations inferred tools from the earlier trace. Now journal.ts re-reads the packet's route-dependent entries (obligationDecision, governingConstraints, capabilities) through the same toolRoute port before a re-ask or replacement is reserved, re-preparing the prompt when they changed; and the tool-turn projection records the latest attempt's route on the turn (reserved = tools, refused = text), which declaredObligations reads for capability while the earlier trace stays as the turn's attempt history. The boundary test runs the real worker and runToolTurn at caps 10 (re-ask text-only: packet and review read none) and 16 (re-ask with tools: as listed), with journal reopen; it fails on the prior code at cap 10.
Affected rules: 45, 78 and 84 (the packet and the review's capability evidence match the route each call actually took), 34 and 36 (both sides of the decision tested through the real worker and tool turn), 37 (source fix, no quarantine), 74 and 111 (this record), 101 (no hook bypass), 116 (one helper re-reading three existing keys plus one projected flag; no new service, classifier or review round)
Affected floors: secrets — unchanged; spend cap — unchanged (no new call; the route predicate is the existing toolPacketFits, and dispatch keeps its own check after reservation); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged (no journal record shape change; the flag is derived on projection and replays identically)
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what the answering model and the reply reviewer are told about tool capability on a re-asked or replaced call.
Side effects: a packet re-read for a re-ask may differ by one byte in size between the tools and no-tools guidance (1671 vs 1672 bytes for the three entries); the existing re-ask already adds its format reminder without a size re-check, so this follows the same behavior.
Undo and recovery: git revert the repair commit, then repin and replay the register; no journal format change.
Multi-machine posture: unchanged; tool state stays per runner.
Layer below: toolPacketFits/runToolTurn in tool-turn.mjs, the toolRoute port, projectToolTurn and declaredObligations in journal.ts, exercised by journal-obligations.test.ts.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: selfdesc-repair3-fix-here | the review asks the repair be made once in the tools dependency and consumed here; the shared code lives in tests/preview/journal.ts on this branch, so it is fixed here in one commit (e6b91168) that the w4-toolsreal branch can take unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-selfdesc-PROGRESS.md
Prompt review: no new prompt wording; the re-ask and replacement packets now carry the existing OBLIGATION_DECISION / OBLIGATION_DECISION_TOOLS, governingConstraints and capabilities values chosen for the call's actual route, exactly as a fresh packet does.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: re-read the three route-dependent packet entries through the existing toolRoute port at the reuse points, and read capability from the latest recorded route. Not chosen: a new execution service, a per-call packet rebuild through preparedFor, or a separate reviewer.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
