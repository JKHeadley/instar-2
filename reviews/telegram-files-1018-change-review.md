# Change review — files sent in Telegram reach the agent

Subject base: 0227b381
Review state: open
Reviewed content: none
Outcome: Files sent in Telegram reach the agent through one source-bound file path in the admitted session's harness-readable work area.
Affected rules: 1, 4, 26, 30, 32, 34, 36, 37, 45, 49, 60, 63, 70, 74, 84, 86, 95, 100, 101, 102, 111, 112, 113, 116
Affected floors: secrets — keep encrypted source custody and the existing raw-byte credential-custody and held-secret checkpoint before publishing any path; spend cap — no new model or provider call; stop — existing custody admission and post-preparation session guard remain; no duplicate sends — source-bound durable session delivery is unchanged; durable intake — originals and recorded download refusals remain intact
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Removes decoded PDF protection as expressly directed in LIVE-PATH-PLAN section 7 while retaining the named raw-byte checkpoint and custody floor.
Side effects: Every supported Telegram file-bearing field uses the same download, custody, protection, temporary-file and delivery path. Video, video notes, animations and stickers now enter it. Voice/audio no longer launch transcription or substitute transcript text for the file. The reader retains compatibility with earlier encrypted transcript records. Removes pdf-decode.mjs, pdf-protection.mjs, pdfjs-dist, pdf-lib and their unused runtime dependencies. No encoded-content secret scanning is claimed: compressed/encoded contents go to the harness's native abilities, as explicitly directed; malformed formats are no longer withheld by a custom parser. The harness must honestly report formats it cannot consume. Standalone local-media utilities remain outside this route. The shared path uses the existing bounded session volume and inherited runner/harness ACL, never a wider permission or new store.
Undo and recovery: Revert this change through the normal reviewed release path. No journal migration or deletion is needed; encrypted originals and prior transcript history survive. A failed delivery closes temporary paths, preserves custody and supplies the existing honest unreadable notice. Topic-scoped crash sweeps and batch isolation remain unchanged.
Multi-machine posture: Machine-local deliberately: plaintext files live only on the admitted conversation owner's bounded harness volume. Encrypted custody stays in its existing store; replicated journal custody references retain existing missing/corrupt detection. No transport, ownership or replication-policy changes.
Layer below: Inspected telegramInboundMedia, createTelegramMediaCustody/open, journalMediaSource, admittedUpdate, production-conversation-session file preparation/durable delivery, harnessSessionLayout, grantVolume and inherited ACL, and tool-admission-hook. The tests invoke the actual journal-agent prepareInputFiles expression, use real encrypted custody and compare the bytes at the consumer path. Existing Read-hook, cleanup, batch isolation, source mismatch and recorded-shape tests remain. WSL cannot certify Darwin ACL enforcement or live model comprehension.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/telegram-files.test.ts; live=tests/preview/fixtures/gap-pdf-1017.json
Hook bypass: none
Convergence: none
Decision: telegram-files-one-path | Reuse the existing session file bridge for every supported Telegram file kind; remove per-type decoding and transcription from intake/delivery while retaining historical transcript readability. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/telegram-files-1018-PROGRESS.md
Decision: telegram-files-raw-floor | Follow the explicit section 7 direction: preserve encrypted custody and raw-byte secret protection, remove the PDF decoded-content scanner, and let the harness report unsupported contents honestly. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/telegram-files-1018-PROGRESS.md
Prompt review: Reuses the existing file-tool instruction and user-data-not-authority warning; the noun is now file for every kind. Removes the voice-only transcript notice. Tests replay the actual recorded PDF refusal (update 6234449/message 8687) and image refusal (update 715676899/message 875), plus recorded summary, uncertain/undecided Jev, reply-review, delivered and empty-context shapes through the protected path. Historical refusals are not relabeled as fresh successful model answers; native format support remains the harness's responsibility.
Verification: Initial shipped-callback regression: one photo passed, seven cases failed (PDF refusal, voice/audio missing paths, video/video-note/animation/sticker missing intake). After the change all eight passed. Typecheck and build pass. Directly importing tests and final gates are recorded with their exact outcomes in the report; the two untouched local-transcriber host tests require unavailable host resources. No full suite or live provider call is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route: download once under existing admission, retain encrypted custody, apply the existing raw-byte checkpoint, write to the admitted harness volume and supply its path. It removes format parsers and a transcription process rather than adding mechanisms. Start guards are verified source, ownership, stop and resource admission; end guard is the existing correlated session delivery and cleanup; bounds remain the 8 MiB download cap, encrypted-store ceiling and session-volume limit. No autonomous live completion claim.
80/20: Targeted changed/direct-importer tests, recorded replay, typecheck, architecture, register and pinned ready checks; the desk owns Darwin conformance and full-suite verification.
VERDICT: author submission; no independent convergence or live acceptance claim
