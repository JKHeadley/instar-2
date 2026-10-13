# Change review — Telegram receipt suffix normalization

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Settle a successful send whose returned plain text only lost its trailing ASCII spaces/newlines, while retaining content-free mismatch diagnostics and the existing UNKNOWN no-retry behavior.
Affected rules: 1, 4, 26, 34, 36, 37, 39, 42, 49, 70, 74, 89, 95, 101, 102, 108, 111, 113, 116.
Affected floors: secrets — only masked whitespace excerpts, lengths and closed field names enter diagnostics; spend cap — unchanged; stop — unchanged; no duplicate sends — no retry or recovery changes; durable intake — existing intent and receipt journal unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: A bounded comparison repair in the existing provider receipt classifier; no new state, model prompt, authority, transport or retry mechanism.
Side effects: Successful receipts with the full terminal U+0020/U+000A suffix removed can now settle. Exact echoes remain accepted. Leading/interior changes, partial suffix removal, Unicode whitespace, CR/tab cleanup, entity decoding and empty returned text do not gain equivalence. Non-success reason strings now distinguish chat/thread/message_id/text and include masked text shape, within the existing 200-character journal bound. Existing reason aggregates may have more keys. Message IDs retain the positive safe-integer requirement; sendMessage assigns the new ID, so this boundary has no pre-known ID against which a different valid ID could be checked.
Undo and recovery: Revert the classifier change to restore strict equality and the generic mismatch reason. This does not repeat sends or change existing recorded outcomes; an UNKNOWN intent remains fenced during both upgrade and rollback.
Multi-machine posture: The classifier is pure and ships identically on each machine; outcome diagnostics use the existing replicated journal, with no new machine-local store. Existing owner fencing, dispatch claims and signatures remain untouched.
Layer below: Read the Bot API sendMessage/Message contract, Telegram TDLib fix_formatted_text and remove_invalid_entities, the actual journal-agent send seam, outbound settlement's 200-character bound, the forensic report for update 46039986, repository captures and the journal's durable-intent/restart behavior.
Bug class: integration
Bug evidence: reproducer=tests/preview/receipt-trailing-space.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model-facing prompt, model-output parser or judgment gate changed; this is a Telegram transport receipt comparison.

Decision: receipt-space-directional | Compare the returned plain text to either the exact intended text or that text with its complete terminal ASCII space/LF suffix removed. Keep signed intent bytes and all existing UNKNOWN records unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-trailing-space-1013-PROGRESS.md
Decision: receipt-space-redaction | Put closed mismatch field names and bounded UTF-16 lengths/offset/whitespace-only escaped excerpts in the existing reason field; mask all non-whitespace code units before escaping to avoid retaining unknown secrets. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-trailing-space-1013-PROGRESS.md
Decision: receipt-space-evidence | Preserve the forensic report's exact outgoing body and explicitly label the trimmed response as synthetic; no actual mismatching receipt survived, so neither the fixture nor the test establishes which field differed in the incident. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-trailing-space-1013-PROGRESS.md

## Provider evidence and limits

[Bot API sendMessage](https://core.telegram.org/bots/api#sendmessage) returns the sent Message and describes text after entity parsing. It does not specify whitespace trimming. The existing send seam escapes plain text into HTML and already compares the returned plain text, not HTML markup.

[Telegram's TDLib implementation](https://github.com/tdlib/td/blob/master/td/telegram/MessageEntity.cpp), inspected 2026-10-13, provides the narrower implementation evidence: remove_invalid_entities identifies the final non-space/non-LF code unit; fix_formatted_text uses it for rtrim. This repair admits only that terminal removal, not the additional transformations the implementation can perform. It is implementation-backed behavior, not a newly claimed public Bot API guarantee.

Repository fixture inspection found recorded outgoing replies and sent IDs, but no captured successful Bot API response object proving this normalization. The incident report likewise says the actual receipt was not retained. The new fixture contains the verbatim 1,031-character outgoing body from update 46039986, frames 240/259, ending in an empty March heading plus LF; the trimmed response and other receipt neighbours are explicitly synthetic. No live Telegram call was authorized or made. This establishes the comparison behavior under the hypothesized normalization, not the original mismatch's field or a live-provider proof.

The tests cover the captured body, exact and normalized success, altered content, routing mismatches, invalid message IDs, unsupported whitespace/entity/Unicode changes, bounded secret-free diagnostics surviving settlement and journal replay, refusal, lost receipt and a durable crash image between send and receipt. The replayed journal keeps UNKNOWN unresolved without a duplicate send.

Subject (3 paths): tests/preview/telegram-send-outcome.mjs, tests/preview/receipt-trailing-space.test.ts, tests/preview/fixtures/receipt-trailing-space-2026-10-13.json

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the existing classifier's text boundary and use its existing reason field. No retry, reconciliation service, new state or extra send is added. Start guards remain signed intent and owner admission; end guards remain exact routing, valid message identity and constrained text comparison; limit guards remain the existing transport and journal bounds. No unattended live-provider completion is claimed without the missing actual receipt evidence.
80/20: The narrowed comparator and real journal replay test the positive case and refusal/UNKNOWN neighbours; provider-incident attribution remains explicitly unproved. Independent convergence belongs to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
