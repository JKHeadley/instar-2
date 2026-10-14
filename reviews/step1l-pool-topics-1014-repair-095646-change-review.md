# Change review — destination validation waits preserve topic intake

Subject base: deed93445d6d4b897c446c9b629c789cd68f707b
Review state: open
Reviewed content: none
Outcome: Destination activation, authority or login validation unavailability leaves undispatched session input queued and its source worker intact; maintenance revalidates and delivers once after recovery.
Affected rules: Rules 1, 26, 33, 46, 49, 55, 60, 68, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — no change to custody or transcript-only copying; spend cap — shared allowance and prepared-attempt accounting retained; stop — original host stop and deadline retained; no duplicate sends — undispatched intake alone waits and existing intake identities deduplicate; durable intake — validation failure uses the existing queued maintenance retry.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Narrow source repair of continuing intake, verified through its disposable host and direct consumers.
Side effects: Session selection and pending revalidation return no eligible result if the injected validation dependency throws. Ordinary non-session selection still throws. Manifest checks and durable writes remain outside the catch, as do handoff custody, copy and retirement. No new timer, state, authority or capability restriction.
Undo and recovery: Revert the repair and regenerate register artifacts; retain existing snapshots and intake. No schema migration. Reversion restores the demonstrated risk of terminally settling undispatched input.
Multi-machine posture: Deliberately machine-local under the existing topic owner fence; no new writer, cross-machine credential transfer or ownership change.
Layer below: Inspected pool selection, quota holds and attempt accounting; shipped journal-agent validation binding to runtime.check and harness.current; topic handoff completion reconciliation, exact retirement and encrypted custody; host queued drain and maintenance behavior. Existing source handles and shared allowance survive waiting.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt review: No prompts or parsers changed. Recorded summary, uncertain, Jev undecided/unsure, reply-review and delivered/empty reply shapes now pass through validation failure, queued wait, recovery and existing answer consumer in topic-login-pool tests.
Decision: step1l-repair-095646-validation | Catch only the injected validation call for session selection, returning the existing no-eligible result for initial and pending destinations; propagate manifest, persistence and non-session errors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1l-pool-topics-1014-repair-095646-PROGRESS.md

Generated register: Replayed from source commit 2fb5a10ea57d3b3f3aa38345a148c07cb516ede7. Delegated desk rehash and repin scripts changed no owner or inventory pins. Shape-only evidence, not native certification.

simplestRobustRoute: This is the simplest robust route: reuse pool eligibility and the existing host queue, maintenance, lifetime, stop and allowance. No new recovery mechanism. Validate before retirement; preserve input on unavailability; drain once after recovery. Disposable-host evidence is not native/provider or unattended production acceptance.
80/20: Both reproduced paths turn green, with stop/deadline, unchanged accounting, error distinction and recorded-shape coverage. Full suite and native acceptance belong to the Studio gate.
VERDICT: author submission; no independent convergence claimed
