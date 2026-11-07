# Change review — a background Stop closes only a result written before it

Subject base: a35c3941dc3ccd9d88c8e1a2dd0437ecebc75a1e
Review state: open
Reviewed content: none
Outcome: the repair for unit review round 1 (Astra, VERDICT NO). A Stop that reports running background work now closes the turn only for a result whose file was written before that Stop. The host no longer judges this by the poll that first saw the Stop. A partial result written after such a Stop, even inside the same poll, waits for the later turn's own Stop. A worker that exits under such a Stop leaves the answer uncertain instead of complete. The native Darwin conformance certificate is renewed from a 10/10 contract run on the resulting composition.
Affected rules: 26, 30, 55, 105, 114, 115, 116
Affected floors: secrets — the host reads only the result file's write time, inside the same custody as the result read, and nothing new enters the receipt; spend cap — no model call, reservation or checkpoint changes; stop — stop authority is still checked first in observe and ends the wait; no duplicate sends — one reply per turn end through the unchanged cursor, and the incident test still delivers exactly once; durable intake — the accepted input stays durable, and an exit under a held Stop settles uncertain with its input retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what ends a conversation turn on the live reply path and renews a native conformance certificate.
Side effects: an answer written in the same millisecond as its own background Stop counts as later and waits for the next Stop or the existing deadline. Strict ordering errs toward not claiming completion. In practice the Stop hook is a separate process that starts well after the write. An IO without the optional write-time read treats every result under a background Stop as later; the only production IO, scripts/production-session-io.mjs, supplies it. The backgroundStop journal field is gone, and the driver ignores the field on old journals.
Undo and recovery: revert these commits. The receipt shape is unchanged and no migration is needed in either direction. Reverting restores the old certificate digest together with the old composition.
Multi-machine posture: machine-local, deliberately. The hook's clock and the result file's write time are on the same machine as the worker; nothing is replicated.
Layer below: read the Stop hook (scripts/session-hooks/stop.mjs), which stamps at with Date.now(), and the production result read, which already opens the file under custody checks. A real-file check showed Math.floor(lstat mtimeMs) equal to Date.now() at the same millisecond, which is why the comparison is strict.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; live=tests/assembly/fixtures-background-turn-live-2026-11-07.json; other=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-review-probes.txt
Hook bypass: none
Convergence: none
Decision: stb-write-time | The result is tied to the Stop by the file's own write time compared with the Stop receipt's time. Rejected: the hook capturing a result digest, because the hook does not know the per-delivery result path, and giving it that path would need a new pointer file. Also rejected: keeping the host's first-observation marker, which caused the probe-1 false completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-PROGRESS.md
Decision: stb-exit-same-rule | The exited-worker branch uses the same closesTurn eligibility. A recorded turnCloseEvidence, meaning a genuinely closed earlier answer, is still retained. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-PROGRESS.md
Decision: stb-native-renewal | The native contract ran on this composition: 9/10 before, failing only on the stale certificate; 10/10 after re-declaring the digest the contract itself computed, which equals the architecture check's value. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-PROGRESS.md
Prompt review: no model instruction, prompt or output parsing changes; the touched test file already pins shipped guidance, which raises the two findings below.
Prompt finding: 0725f0150c56 | protocol-literal | existing conversation-prompt wording, unchanged by this change — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "use them to answer and act within that role; a tool refusal remains a refusal."
Prompt finding: 27d7720e7977 | protocol-literal | existing conversation-prompt wording, unchanged by this change — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "this memory and work record"
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed by the desk, not prose authored by this repair

Verification: tsc clean. tests/assembly/production-session-driver.test.ts and production-conversation-session.test.ts: 381/381 passed. session-stop-hook, session-deadline-recovery and production-session-work: 50/50 passed. Both review probes now pass as tests. In mutation, removing the write-time comparison fails probe 1, the incident test and the later-Stop test, and removing the exit-branch check fails probe 2. The native contract passed 10/10, and npm run lint and register:check exit 0. Not run: the full suite, the admitted gate with a live model, and the live Telegram surface.
Residue: gate-edge-record | medium | carried from the unit record: a default-background Agent call is recorded as complete at launch; unchanged here.

## Closing block

simplestRobustRoute: tie each result to the Stop that existed when the result was written, using the file's own write time against the receipt's existing time. The same check applies on the exited-worker branch. This removes the host-side backgroundStop marker rather than adding state. The certificate is renewed by running the existing native contract, never by copying a digest.
80/20: both demonstrated false-completion paths are closed and pinned by tests that fail without the repair; the remaining evidence is the Studio full suite and the combined build's live proof.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
