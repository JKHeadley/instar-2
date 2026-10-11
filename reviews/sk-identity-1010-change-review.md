# Change review — sk-identity-1010

Subject base: a50313532da5c2324817a53c84724683492a11b9
Review state: open
Reviewed content: none
Outcome: explain what the agent is, what Instar is, why it differs and its current abilities in everyday words in the person's language, without naming its harness or model. Preserve the existing inventory, route state and runtime logic.
Affected rules: 1, 3, 4, 26, 30, 34, 36, 37, 47, 49, 58, 70, 74, 78, 80, 84, 85, 101, 102, 105, 111, 112, 113, 115, 116; approved identity amendment 3.
Affected floors: secrets — custody and outbound checks unchanged; spend cap — no new call, unchanged attempt and prompt bounds; stop — unchanged; no duplicate sends — unchanged send path; durable intake — unchanged format and persistence.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: only model-facing text and its wording/replay assertions change; no parser, dispatch or authority logic changes.
Side effects: system-prompt policy digest and native composition digest change. The existing policy-successor activation path and macOS conformance run are required at landing; this commit changes no activation or conformance assertion. Prompt floor and route refresh are tested.
Undo and recovery: revert this wording commit; no stored state migration. Any deployed policy successor must follow the existing activation path on rollback.
Multi-machine posture: identical wording on each owning runner; generated features and per-turn route/account availability remain runner-local inputs. No new state or ownership path.
Layer below: inspected capabilityBriefing inventory filters, journal-agent turnSources, journal routedContext, subscription tools prompt derivation, policy digest assertion and native conformance pin. Trusted instruction is unconditional for self-description; the optional internals clause cannot exempt naming the harness or model.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and the common hooks directory contains only sample hooks.
Convergence: none
Decision: sk-identity-wording | replace technical identity prose and bind both answer routes to four plain-language questions without harness/model names; keep runtime logic unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-identity-1010-PROGRESS.md
Decision: sk-identity-inventory | retain generated feature availability and current tools/account state; report the existing fixed tool-outcome summary gap as explicitly permitted by the brief | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-identity-1010-PROGRESS.md
Decision: sk-identity-evidence | replay retained real shapes with assertions on the new briefing; preserve historical captures and name macOS conformance and old-review debt without rewriting other records | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-identity-1010-PROGRESS.md
Validation follow-up: direct-import checks exposed an older identity assertion in agentready.test.ts; update it to the current introduction and assert the unconditional self-description instruction on answer, tool and native prompts. No tool-contract assertion changed. journal-dated-memory.test.ts also pinned two retired briefing sentences; replace them with the current tools-off and generated upcoming-date lines, leaving the runtime behavior tests unchanged. Refresh the same policy digest in offline-canary and renew-activation, and the retired memory-description assertion in live-failure-regressions; keep the captured/stub replies and all decision assertions unchanged.
Prompt review: ordinary language identity instruction, not an accept/refuse filter. No new keyword gate, parser or delegation prompt. Recorded outputs remain byte-identical; replay proves delivery of the new briefing and compatibility, not new live-model behavior. Existing trusted instruction's internals exception applies only to technical vocabulary, never to the separate unconditional self-description rule.
Prompt finding: 450c79237a95 | protocol-literal | unchanged ambiguity instruction, checked for delivery rather than used as an exact-match judgment trigger.
Prompt finding: 557114b4e497 | quoted-evidence | new identity description asserted in briefing and real-shape replay tests; no verdict depends on matching it.
Prompt finding: e2d2f84aa62a | quoted-evidence | explanation of continuity asserted as output text, not a fixture phrase that drives a judgment.

simplestRobustRoute: edit the existing identity text and trusted instruction, retaining generated inventory and per-turn route refresh. This is the simplest route; no new runtime machinery. Existing authority and route state guard admission, replay checks the received briefing, and unchanged spend/stop/size limits bound the work. No new unattended live success is claimed.
80/20: focused wording repair; macOS conformance and historical review debt remain explicitly reported gate limitations. The report carries targeted test results and precise failures.
VERDICT: author submission; this record asserts no independent verdict
