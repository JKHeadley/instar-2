# Change review — train-29 parser policy wiring repair

Subject base: 727ad47e3ff1e15d9057d6e3ffcc5558ae704b4c
Review state: open
Reviewed content: none
Outcome: Keep the launcher parser-policy test accurate after the conversation-session answer route was composed into train-29.
Affected rules: 36, 37, 49, 70, 74, 95, 101, 102, 105, 111, 113, 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime checkpoints; this change only corrects a test's exact call-site inventory.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only correction with no model prompt, parsing implementation, authority or runtime behavior change.
Side effects: The test now permits precisely the two existing readAnswer calls. It still rejects extra call sites, direct parseModelJson calls and changed wrapper policies. It retains the summary object-answer declaration check.
Undo and recovery: Revert this repair commit; no persisted state or runtime migration is involved. Reverting restores the stale one-site assertion.
Multi-machine posture: Repository test evidence is local to the checker host; conversation ownership, durable intake and send fences are unchanged on every machine. Native macOS certification belongs to the Studio desk.
Layer below: Inspected journal-agent.mjs subscription parsing and its exact Telegram-update conversation-session branch. Only that answer branch uses the second tolerant reader; non-conversation calls retain their existing route. The existing journal-conversation-session tests execute the shipped closure and cover routing, stop, secret refusal and durable retry behavior.
Bug class: integration
Bug evidence: reproducer=tests/preview/model-json.test.ts; consumer=tests/preview/journal-conversation-session.test.ts; The supplied Studio fail-fast log records model-json.test.ts:114 receiving two readAnswer sites against one expected. After correction, model-json.test.ts (51 tests) and journal-conversation-session.test.ts (29 tests) pass together on WSL.
Hook bypass: none
Convergence: none
Decision: train-29-repair-parser-inventory | Correct the exact two-call test inventory instead of changing valid runtime parsing; the conversation-session call is already restricted to operator answers. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-repair-072947-PROGRESS.md
Decision: train-29-repair-native-certificate | Leave the three supplied failures from the unproven native macOS certificate to Studio renewal under the standing charter exception; do not change tests or declarations to manufacture certification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-repair-072947-PROGRESS.md

Decision: train-29-repair-pins | Run the delegated desk rehash and repin tools, then regenerate the register from the committed pin, so the changed test is consumed at its actual bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-repair-072947-PROGRESS.md

Subject: tests/preview/model-json.test.ts; register-source/owner-references/preview.json; generated/capabilities.json; generated/capabilities.md; generated/coverage.md; generated/glossary.md; generated/register.json; generated/rules.md; generated/source.json

Register evidence: Delegated rehash refreshed exactly one owner pin. Repin chain changed no inventory pin. Register replay from 60297d4b12029fcb43743b669ff533e98c2fc318 produced generation sha256:fdf2bdc3119cc9b39c77d462d3e9d2e48c49a2bc5a2a89756d84b7bd8dee2801.

simplestRobustRoute: This is the simplest robust route: repair the stale exact test expectation and retain both working runtime routes. No new machinery or safeguards. Start, end and limit guards are unchanged; no autonomous live-completion claim is made.
80/20: Run the changed test, the existing conversation-session consumer tests, typecheck and required cheap and pinned-text gates. Studio owns native certification and full-suite acceptance.
VERDICT: author submission; no independent convergence or live acceptance claimed
