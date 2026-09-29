# Change review — cint-L3b pipeline repair 2: compact capability texts, trimmed packet guidance, register regenerated

Subject base: 13a2254a90ab1fbb16bdc91cd8402f4a614a6689
Review state: open
Reviewed content: none
Outcome: The desk chose option (c) for the packet-budget conflict. Each declared feature's README capability line is now one short line, which the register build carries as its briefing text. The full description stays in the same README as an indented Details line, which the capability parser ignores. The briefing says its lines are summaries and points to the module documentation and the status reply. The working-disciplines source names the gravity wells by id, since each well's full text rides the retrospective duty that grades it. The stand-ground sentence and the open-item and standing-grant headers are shorter; the number of open items is unchanged. The concurrentWork note is shorter and its fields are unchanged. The conversion anchor is refreshed for the glossary and shape hashes, together with its approved pin (sha256:10ee14b6…a200), and generated/ is regenerated with --replay. Measured on the real launcher: an ordinary live-shaped first turn with no history prepares 20449 bytes. The admission ceiling is 21537 bytes (32768 minus the 3039-byte system prompt and the 8192-byte reply-review headroom), so 1088 bytes remain for history. That is below the desk's 4 KB target; the remainder lies in sources outside this option's scope, which are reported to the desk.
Affected rules: 16, 19, 70, 74, 78, 84, 116
Affected floors: secrets — unchanged, redaction still applies to every trimmed source; spend cap — unchanged, no call type or bound changes; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: (1) the packet budget: after option (c), the live-shaped first turn leaves 1088 bytes for history, not 4 KB, and a live desk-status report (up to 4096 bytes) would consume more. The rest sits in the self-state source (about 2.9 KB), the reply-protocol guidance fields obligationDecision, datedDecision and capability (about 2.7 KB), and the pinned purpose excerpts and mind rules. Reaching 4 KB needs a choice about those, or about the bound or the review headroom.
Suggested tier: critical
Declared tier: critical
Tier rationale: the change regenerates the register and refreshes the conversion anchor pin
Side effects: every live packet carries shorter briefing, discipline and concurrent-work text; generated/ reflects the combined tree's declarations
Undo and recovery: revert these commits and regenerate; nothing durable changes format
Multi-machine posture: machine-local, as before
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md (read in full); scripts/register-shipped.mjs capabilityLines (one line per feature, indented lines ignored); tests/preview/journal.ts prompt admission; tests/preview/journal-envelope.ts (the measured prepared bytes)
Bug class: integration
Bug evidence: reproducer=tests/preview/capability-briefing.test.ts
Hook bypass: none
Convergence: none
Prompt review: the capability note, working-disciplines text and concurrentWork note are shortened; no protocol, system prompt or provider policy changed
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/conversion.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

## Closing block

simplestRobustRoute: The texts are shortened where they are defined (README lines, the discipline and concurrent-work builders) with no new mechanism. The parser's existing one-line rule keeps full descriptions in the documentation. Every feature is still briefed by name and availability.
80/20: tsc, the architecture check, lint, register:check and every touched test file pass on this machine; the full suite runs at the gate.
VERDICT: author submission; the independent verdict is recorded as a pass
