# Change review — supervise declaration replacement packets

Subject base: cadc62e3eacd187a4c4b2ea190f9855ea60031b6
Review state: open
Reviewed content: none
Outcome: A requested action's declaration or format re-ask validates the replacement packet through the existing due-selection and preparation checkpoint before reserving or invoking the retry. Refusal or unavailability holds the turn before another call or send; passing checks bind the actual retry digest.
Affected rules: 1, 4, 10, 12, 26, 28, 34, 36, 37, 38, 41, 42, 49, 55, 57, 58, 60, 69, 70, 74, 75, 86, 90, 95, 101, 102, 107, 111, 112, 113, 116.
Affected floors: secrets — existing redaction and outbound custody unchanged; spend cap — existing retry reservation and supervisor allowance retained; stop — checked again after asynchronous supervision and before the retry; no duplicate sends — no send before the replacement is settled, repeated due scans remain idempotent; durable intake — original journal and digest-bound judgments retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Restores required supervision on an existing model-facing requested-action recovery path.
Side effects: Replacement packets consume the existing supervisor allowance for their own due/preparation judgments. An unavailable or refused replacement checkpoint now holds visibly instead of invoking an unsupervised retry or falling through to the original answer. Operator replies, discarded runner date declarations, exact validators, off-supervisor behavior and bounded recovery remain unchanged. Other retry mechanisms are outside this narrow repair.
Undo and recovery: Revert this repair and regenerate the register. No new record kind or migration; journal replay preserves each recorded hold and judgment. Reverting reintroduces unsupervised declaration retries.
Multi-machine posture: The journal's current owner executes this checkpoint on every supported machine; ownership, replication and forwarding are unchanged. No new machine-local state.
Layer below: Inspected validateBefore and runStep, digest-bound stepCoverage, format-retry projection and reservations, durable hold projection, drain's held-turn exclusion, exact promise/fulfillment validators and requested-action date authority. Coverage matching is unchanged; no earlier judgment is relabelled as a replacement judgment.
Bug class: live-path
Bug evidence: reproducer=tests/preview/business-step-supervision.test.ts; live=tests/preview/fixtures/flap-a-declarations-2026-10-04.json
Hook bypass: none
Convergence: none
Decision: flapa-retry-checkpoint | Share the existing requested-action checkpoint between initial and replacement packets; hold before retry reservation/call/send on refusal or unavailability | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-a-p2-repair-021049-PROGRESS.md
Decision: flapa-retry-evidence | Use focused regressions and exact captured model bytes; report inaccessible Studio evidence instead of fabricating full-gate results | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-a-p2-repair-021049-PROGRESS.md
Prompt review: No prompt text or parser changes. The same prepared retry packet now reaches the existing supervisor with its exact digest. Recorded invalid fulfillment 715674119 exercises the new checkpoint in a synthetic due-action context; recorded dated 6232376 remains a single call. Recorded summary, answer, Jev and review shapes are replayed separately without treating uncertainty as success. This is recorded-byte replay, not a new live provider exchange; missing empty-bubble and saved full-gate evidence are reported to the desk.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory reply and its literal test are unchanged.
Prompt finding: bd01de21286a | protocol-literal | Existing sourceLabel guidance and its delivery test are unchanged.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing operator-history guidance and its delivery test are unchanged.

Verification: Five new regression cases fail against base journal.ts. Repaired tree passes all 58 tests in business-step-supervision, flap-a-declarations, journal-requested-action and format-retry. Positive and repeated-invalid replacements bind two new checks before retry reservation; violation and outage at both boundaries prevent a second call/send and survive journal reopen. Typecheck passes. Desk rehash and inventory repin found zero changed pins; generated register replay follows the source commit. Studio saved gate results exceed the read-only API's size limit; no synthetic full-suite result replaces them.

## Closing block

simplestRobustRoute: This is the simplest robust route: extract the existing due-packet checkpoint into a local helper and reuse it before the declaration/format replacement. The credible failure is a retry executing with judgments bound to its old packet. Start is a requested-action retry candidate; end is a supervised bounded retry and existing send path, or a durable hold. Existing cap, stop, exact validators and one-retry bounds remain. Captured-output replay exercises the shipped worker; no new unattended live-provider proof is claimed.
80/20: Reproduce the exact regression, test its passing/refused/unavailable neighbors and recorded model bytes, then regenerate and run cheap checks. Full-suite gate and independent landing judgment remain the desk pipeline's work.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
