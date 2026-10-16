# Change review — bind own-word times to delivered replies

Subject base: a82cdeac28e30f18a6f3dfee9335ae71ca31b890
Review state: open
Reviewed content: none
Outcome: each sibling statement and promise puts "when I said it", reply delivery time, the separately labeled operator intake time and the quoted words on one ownWords line, so the model can distinguish its own delivery from the operator's input and the future deadline inside a quote.
Affected rules: 7, 13, 28, 29, 34, 36, 42, 49, 58, 60, 70, 74, 83, 84, 96, 101, 102, 111, 112, 113, 116, 117
Affected floors: secrets — existing operator audience, redaction and forgetting precede rendering; spend cap — no new production call or allowance; stop — dispatch guard unchanged; no duplicate sends — existing intents and receipts unchanged; durable intake — no journal schema or storage change.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a model-context label and guidance change only; it adds no decision boundary, effect, authority or model call.
Side effects: the advisory siblingWords item replaces separate at/excerpt fields with one ownWords line. Numeric receipts and journal records remain unchanged; input received is turn.at, not an inferred sender clock. Existing packet and dispatch consumers serialize this view without interpreting those fields; tests assert both subjects and quote bounds. Rendering increases the captured reserve envelope by 811 bytes, within the same measured byte caps. Byte-pressure, omission, source-label and timezone behavior retain their existing tests. Quoted words, operator source labels, memory candidates and deadlines are unchanged.
Undo and recovery: revert the renderer and its expectations; no durable data migration is needed. The retained journal still owns the original numeric delivery timestamps.
Multi-machine posture: the existing owner journal and configured operator timezone remain the sources on every runner; no new state, writer, transport, replication behavior or disconnected-peer visibility claim.
Layer below: inspected wholeReplyReceipt (including final-part acceptance), currentSiblingWords, currentActionFacts, packet fitting and actual host dispatch refresh. The retained recall packet pairs the full agent reply with a conversation:operator sourceLabel at the input minute, while the generic sibling at field holds the delivery minute. The source exchange and receipt are different events; neither timestamp calculation is wrong.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-ownword-time.test.ts
Hook bypass: none; core.hooksPath is unset and the actual shared hooks directory contains samples only.
Convergence: none
Decision: ownword-time-label | bind delivery and intake times to their subjects next to the quote; preserve receipt computation, quoted text and operator source labels | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ownword-time-1016-PROGRESS.md
Decision: ownword-time-inline | put delivery time directly beside the JSON-quoted excerpt, since a separate labeled field still confused the real model | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ownword-time-1016-PROGRESS.md
Decision: ownword-time-pair | label operator intake separately on the same line because inline delivery time alone still lost to sourceLabel; paired times passed both actual-host model replays | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ownword-time-1016-PROGRESS.md
Decision: ownword-time-fixture-budget | add 2 KiB only to the small recall fixture so it still exercises prior exposure and candidate omission with the longer labels; production caps unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ownword-time-1016-PROGRESS.md
Prompt review: replay the exact proof-room projection rows through update 715676633, preserving the failing answer and competing operator labels. The regression failed before the renderer change and passed afterward. Existing dispatch tests replay recorded summary/uncertain, Jev unsure/undecided, reply-review, delivered and empty-reply shapes with the explicit label asserted. Bounded tool-disabled claude-sonnet-5 checks use the existing answer-flat harness. Old host input reproduces the 12:40 approval-time error. The final paired layout answers both original and explicit-both questions with delivery times 12:41/12:42, operator intake 12:40/12:41 and deadline 17:00 kept distinct. Earlier failed layouts and all verbatim outputs remain in desk evidence. The exact host text is replayed with only the tool-disabled stdout result adaptation; it does not resume the original persistent worker. This is not a persistent-session or Telegram acceptance claim.
Prompt finding: 4106b49fff07 | protocol-literal | existing grounding instruction in journal.ts, unchanged by this repair.
Prompt finding: 849db3a6296a | protocol-literal | existing empty saved-memory response in journal.ts, unchanged by this repair.
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label guidance in journal.ts, unchanged by this repair.
Deferral: tests/preview/fixtures/ownword-time-1016.json.gz:122 | not-a-deferral=compressed recorded evidence, not an implementation promise or deferred work.

## Closing block

simplestRobustRoute: this is the simplest robust route: give the existing per-quote receipt time an explicit subject in the existing renderer. The credible failure is the observed substitution of an operator input minute for the agent's delivery minute. No new service, store, parser, gate or policy. Verified audience and whole-reply receipt remain start guards; explicit subject-bound times in the packet and refreshed dispatch are the end state; existing redaction, state and byte bounds remain the limits. No autonomous shipped-path completion claim.
80/20: verify the recorded failure, source-label preservation, unknown and partial-receipt neighbors, configured timezone, closed promises, privacy and byte bounds; run touched consumers and mandatory machine checks. The independent desk owns convergence and the live persistent-session proof.
VERDICT: author submission; independent desk review pending
