# Change review — train-124 bounded provider-throttle recovery

Subject base: 588332d9d0839cd504bee2819e297cd6222a2ef9
Review state: open
Reviewed content: none
Outcome: Integrate exactly reviewed sentinel-ratelimit-1022 head 2e076f3f056eca0694e5a4a389cfc1d5b7603418 onto the train-113 live base, preserving its bounded continuation, truthful wait notice, parser repair and Studio conformance evidence.
Affected rules: 1, 26, 30, 32, 34, 36, 37, 42, 46, 49, 52, 55, 59, 60, 61, 63, 68, 69, 70, 74, 87, 89, 90, 101, 102, 111, 112, 113, 115, 116
Affected floors: secrets — fixed notice through existing outbound checks; spend cap — original session and reply budgets; stop — original driver and send checks; no duplicate sends — durable continuation and notice intent with no uncertain resend; durable intake — original accepted input and compatible progress reader retained.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Integrate already-reviewed observable recovery without new authority, prompts, stores, retry policy or source repairs.
Side effects: Captured quiet provider-capacity failures use the existing one delayed continuation. One early bounded infrastructure notice explains the wait. Quota alone changes next-call login selection. Native retries, busy work, quoted/stale errors, later output and authenticated completion retain their exclusions. Register replay updates publication evidence without granting authority.
Undo and recovery: Disable new detection and wait emissions while retaining the compatible progress journal reader. The older two-minute-minimum reader cannot replay early progress intents, so a raw rollback of that reader is unsafe against new journals. Preserve durable intake, never repeat uncertain continuations or sends, and restore conformance declarations only with the composition they certify.
Multi-machine posture: Physical recovery deliberately remains machine-local to the exact admitted worker. Existing conversation ownership and durable journal fence effects across machines. No new peer takeover, credential transfer or cross-machine writer; the carried certificate attests only its declared Studio Darwin tuple.
Layer below: Full purpose and rule book; exact member diff, original and repair Studio reports; captured provider fixture and historical model-output fixtures; existing driver Stop/result and deadline checks, progress intent/receipt and reply budget; standard desk repin/build/rehash/replay chain.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, sample files only. Ordinary merge and commits.
Convergence: none
Prompt review: No new model-facing change in this composition. Member recorded summary-writer, uncertain, Jev undecided/unsure, reply-review, delivered reply and empty candidate shapes replay through its driver and wait-notice tests. Empty candidate evidence is not a claim of a delivered empty bubble. No serving model login or live journal was accessed on the Laptop.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged pre-existing instruction asserted by its existing topic-awareness test; this integration changes only the member's throttle and progress behavior.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged pre-existing instruction asserted by its existing memory-list test, with no new fixture-derived instruction.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged pre-existing source-label instruction asserted by its existing hallucinated-memory test.
Decision: train-124-merge | Ordinary merge of exact reviewed head 2e076f3f056eca0694e5a4a389cfc1d5b7603418 fast-forwarded cleanly. Member evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sentinel-ratelimit-1022-PROGRESS.md and sentinel-ratelimit-1022-repair-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-124-PROGRESS.md
Decision: train-124-A | Preserve all member and accepted live-base behavior without source edits; regenerate generated artifacts through the existing tool rather than hand-merging. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-124-PROGRESS.md
Decision: train-124-B | Create a separate branch directly at exact live base 588332d9d0839cd504bee2819e297cd6222a2ef9; no branch move, main merge or changes to other trains. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-124-PROGRESS.md
Decision: train-124-D | Run isolated offline tests on the Laptop and report host-dependent failures separately; no Studio writes, serving logins or live acceptance claim. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-124-PROGRESS.md
Decision: train-124-desk | Reuse the downloaded standard chain. Inventory and owner rehash changed zero pins; replay the register from the exact reviewed member head, retaining the context guard and native certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-124-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing declarations regenerated by the standard replay tool; no postponed implementation.
Verification: Targeted member tests, direct importers, specified journal tests, register end-to-end, provider subscription, default-context floor and pinned READY selection; build, typecheck, lint, architecture, register and change-review checks. Local progress records exact results and host limitations. Desk decision C was not needed: no conflict and no omitted head.

simplestRobustRoute: This is the simplest robust route: one ordinary merge of the reviewed member and the existing generation chain, adding no machinery. Exact admitted worker, accepted intake and quiet terminal error are start guards; authenticated result/Stop or honest uncertainty are end guards. One continuation, original deadline, stop and spend/reply budgets remain limits. Historical captured-shape replays exercise the shipped code with isolated I/O; this build claims neither new live-user acceptance nor independent convergence.
80/20: Only specified tests and direct source importers, foreground bounded chunks with one worker. No full suite, load generator or second baseline checkout.
VERDICT: author submission for desk gate; independent acceptance remains with the desk
