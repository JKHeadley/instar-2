# Change review — the journal IO bridge forwards the result write time

Subject base: efea5252c97e23dac3b120761405c97d73e265d7
Review state: open
Reviewed content: none
Outcome: the repair for unit review round 2 (Astra, VERDICT NO). The journal runner's IO bridge now forwards resultWrittenAt beside readResult and clearResult, so the shipped composition can tell that a result was written before a background Stop. An answer finished before that Stop is delivered without waiting on unrelated background work, and a worker exit under that Stop keeps the answer. The regression fixture now reaches the adapter through the shipped bridge, so dropping the property fails it.
Affected rules: 26, 30, 34, 77, 114, 116
Affected floors: secrets — the bridge forwards one existing file-time read of a whole-millisecond number and nothing new enters any record or receipt; spend cap — no model call, reservation or checkpoint changes; stop — stop authority is still checked first in observe; no duplicate sends — one reply per turn end through the unchanged cursor, and the incident test still delivers exactly once; durable intake — accepted input stays durable, and the driver's ordering and exit checks are unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it connects the ordering evidence on the live reply path that ends a conversation turn, though the change itself is one forwarded method.
Side effects: this corrects the earlier repair record's claim that the production IO supplies the write time: scripts/production-session-io.mjs implements it, but the runner's bridge did not pass it on until this change. Session work through the same bridge (production-session-work.ts) now also receives the write time; it reads the same method and applies the same driver rule. The test now reads two delimiters from tests/preview/journal-agent.mjs, so reordering the bridge's first lines fails the test until its slice is updated.
Undo and recovery: revert these commits. No stored shape changes and no migration is needed in either direction.
Multi-machine posture: machine-local, deliberately. The write time is read on the worker's machine and compared with that machine's Stop receipt; nothing is replicated.
Layer below: read every clearResult bridge in src/, scripts/ and the runner: tests/preview/journal-agent.mjs is the only one forwarding these methods to the driver path. src/harness-adapters/codex-conversation-worker.ts picks only readResult and clearResult and does not call the driver's observe with a write time. Both production physical IO constructions in the runner are createProductionSessionIO, which implements resultWrittenAt.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; live=tests/assembly/fixtures-background-turn-live-2026-11-07.json
Hook bypass: none
Convergence: none
Decision: stb-bridge-shipped-source | The regression evaluates the shipped bridge's result methods from the runner's source, following the driver test's existing journalDriverConfiguration precedent. Rejected: moving the methods into a new helper module, because the runner would still need its own wiring pin and the review asked for no new mechanism. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-repair-035746-PROGRESS.md
Prompt review: no model instruction, prompt or output parsing changes; the touched test file already pins shipped guidance, which raises the two findings below.
Prompt finding: 0725f0150c56 | protocol-literal | existing conversation-prompt wording, unchanged by this change — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "use them to answer and act within that role; a tool refusal remains a refusal."
Prompt finding: 27d7720e7977 | protocol-literal | existing conversation-prompt wording, unchanged by this change — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "this memory and work record"
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed by the repair, not authored prose

Verification: before the one-line fix, the fixture on the shipped bridge failed exactly the three named tests with state uncertain. After it, production-conversation-session passed 199/199. With production-session-driver, production-session-work, session-stop-hook, session-deadline-recovery, journal-conversation-session and journal-topic-sessions: 574/574 across 7 files. tsc is clean, and npm run lint and register:check exit 0. Not run: the full suite, macOS-only native contract, the admitted gate with a live model and the live Telegram surface.
Residue: gate-edge-record | medium | carried from the unit record: a default-background Agent call is recorded as complete at launch; unchanged here.

## Closing block

simplestRobustRoute: forward the existing method through the existing bridge and run the existing regression through that bridge. No timer, tracker, capability restriction or review mechanism is added.
80/20: the one reproduced must-fix is closed and pinned by a test that fails without it; the remaining evidence is the Studio full suite and the combined build's live proof.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
