# Change review — integrate plain credential display names

Subject base: 01279df4399297466caa0f72400cdfe1b1269a48
Review state: open
Reviewed content: none
Outcome: Integrate the reviewed w4-credname unit a25270fc31dcc94d33be6b76f9b28ff7dff4736a onto the exact live sb-w4-agentready head. Credential reminders, status and model facts use plain labels, including provider-neutral subscription fallback, while custody identities and delivery keys remain intact.
Affected rules: 1, 4, 13, 30, 34, 36, 37, 44, 45, 49, 70, 74, 80, 84, 86, 90, 100, 101, 102, 111, 113, 116
Affected floors: secrets — existing raw and projected label checks retained; spend cap — no model call added and context guard unchanged; stop — unchanged; no duplicate sends — original notice keys and uncertain intents retained; durable intake — no journal rewrite or key rename
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The integrated unit changes credential metadata supplied to reply review, without changing verdict parsing or refusal logic.
Side effects: The merge fast-forwards with no conflicts. Register generation and commit bindings refresh through the existing desk tools. No integration edit changes product behavior or registry membership.
Undo and recovery: Return to the prior live build before deployment, or revert the display projection while retaining all custody records, accepted intake and sent/uncertain notice keys. Old readers ignore the optional field; no migration is required.
Multi-machine posture: The projection is identical on each updated machine; existing custody, journal ownership and replication remain unchanged. This build and report are local to Mama PC.
Layer below: Read both constitutional documents from origin/main, exact base and unit history, unit and repair reviews/reports, and cint-L37 desk-chain evidence. Inspected fallback, raw and projected secret checks, reminder deduplication and status consumers. No docs conflict or resolution occurred.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains samples only. Ordinary merge and plain commits; no stash.
Convergence: none
Decision: sb-w4-credname-merge | Fast-forward the exact reviewed unit from the exact required live head, carrying both unit records unchanged; unit evidence is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credname-PROGRESS.md and its repair report | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-credname-PROGRESS.md
Decision: sb-w4-credname-desk | Run the supplied repin, build, owner rehash and register replay chain; all owner pins already match, so only generated bindings change | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-credname-PROGRESS.md
Decision: sb-w4-credname-verification | Run targeted tests and captured real-shape replays on WSL, preserving the context-floor guard and reporting platform and Studio-evidence limitations without weakening checks | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-credname-PROGRESS.md
Prompt review: Integration adds no model wording beyond the reviewed unit. Captured credential cases 715673352, 715673353 and 6232017 exercise the projected facts and reminders through the real worker; recorded summary uncertainty, Jev undecided verdicts, reply-review outputs and delivered/empty shapes are additional regression evidence. No fresh model or live-channel completion is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the exact reviewed unit and regenerate the existing register bindings. No new mechanism. Start guards are exact live and unit heads; end guards are targeted consumer checks and register replay; secret, spend, stop, durable intake and send limits remain enforced. No autonomous live-completion claim.
80/20: Submit the combined tree with targeted evidence; the pipeline owns the full suite, independent review and macOS gate.
VERDICT: author submission; no independent verdict asserted
