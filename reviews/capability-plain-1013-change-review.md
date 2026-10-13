# Change review — Everyday capability descriptions

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: The existing capability marker produces concrete requests, readable expiry dates, and plain permission and connection limits from the installed inventory.
Affected rules: 4, 10, 18, 36, 49, 70, 74, 78, 80, 84, 101, 103, 104, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends, durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: User-facing capability wording changes; recorded failure and installed-state neighbor replay required.
Side effects: Generated feature descriptions and tool paragraph change for new turns. Historical persisted notes and revisions retain their original wording and hashes. No authority, selection, review, intake or send logic changes.
Undo and recovery: Revert wording and regenerate the register. No durable-state migration.
Multi-machine posture: Stateless formatting from supplied inventory and limits, explicit UTC expiry; no host clock or timezone dependency.
Layer below: Generated feature availability, actual effect check and sign-off keys, marker hash validation and persisted revision path inspected. No connection count establishes login or authority.
Bug class: integration
Bug evidence: reproducer=tests/preview/capability-plain.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory has sample files only
Convergence: none
Prompt review: Generated note remains the single capability record used by answer and contextual reviewer. Existing explicit whole-answer marker and exact-paragraph hash stay in force.

Decision: CP-1 | Edit existing module descriptions and note; no parallel capability inventory. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-plain-1013-PROGRESS.md
Decision: CP-2 | Missing, unknown and configured connections never imply a login or a grant. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-plain-1013-PROGRESS.md
Decision: CP-3 | Render supplied expiry in explicit UTC. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-plain-1013-PROGRESS.md
Decision: CP-4 | Preserve recorded bytes; replay actual marker against new note using identical installed abilities and limits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-plain-1013-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: change descriptions at their existing source and keep marker rendering, generated availability, provenance and review. Start: supplied inventory and tool state. End: exact note wording reviewed before sending. No new state, gate, classifier or authority. Offline recorded replay is not a claim of new live model judgment or live deployment.
80/20: One presentation cause; narrow implementation with targeted importer tests and existing READY gates.
VERDICT: author submission; independent review remains the desk's
