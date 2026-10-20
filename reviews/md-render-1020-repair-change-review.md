# Change review — prepare signed Telegram formatting and retain parse refusals

Subject base: 39d72c391905038ad7da24c51c6c0e8df5732b0f
Review state: open
Reviewed content: none
Outcome: render each reply before signing and durable admission; preserve its exact signed plain alternative and the definite parse-refusal evidence; preserve heading hashes and link destinations.
Affected rules: 1, 33, 36, 42, 44, 63, 70, 74, 77, 89, 101, 102, 106, 111, 113, 116
Affected floors: secrets — scan original and both prepared variants before signing, physical custody unchanged; spend cap — no model calls added; stop — recheck stop/expiry/ownership before the bounded alternative; no duplicate sends — one target and claim, uncertain sends never repeated, one alternative only after definite parse refusal; durable intake — unchanged and outbound preparations/evidence retained in the journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: exact outbound payload authority and no-duplicate behavior are involved; the repair reuses the journal owner and dispatch claim.
Side effects: new intents retain shown text, signed plain alternative and any parse-refusal response; continuation parts use saved formatting after restart. Legacy intents dispatch their original signed bytes. Infrastructure notices contain no markdown and continue verbatim. The additional additive refusal frame advances journal generation to six. Rendered HTML can exceed its visible-character count; existing source-part limits remain and physical platform refusal remains bounded.
Undo and recovery: revert rendering preparation and dispatch together, retaining journals. Previously admitted sends remain consumed and unknown sends must never be repeated. An older reader may refuse a formatted multipart intent under its former encoding check, so recovery of such a root requires a reader with the repaired preparation support; do not rewrite retained bodies or signatures to force rollback.
Multi-machine posture: exact variants replicate with the existing intent before the existing claim. A parse refusal is journaled and replicated before fallback, with the existing owner, stop and expiry checks repeated. No separate store, target or claim is created.
Layer below: outboundSigner verifies exact target/chat/thread/body; journal append fsync and snapshot retain preparation; shared.replicated retains refusal evidence under the existing claim; Telegram classifier requires matching receipt text and destination. The core adapter without a prepared alternative continues to refuse alternate rendering.
Bug class: durability
Bug evidence: reproducer=tests/preview/journal-markdown-preparation.test.ts; restart=tests/preview/journal-markdown-preparation.test.ts
Hook bypass: none
Convergence: none
Decision: md-render-preparation | bind HTML and one plain alternative in the existing intent before dispatch; record parse refusal separately so successful fallback cannot erase it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/md-render-1020-repair-142633-PROGRESS.md
Decision: md-render-content | protect raw link destinations before label formatting and require whitespace for closing heading hashes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/md-render-1020-repair-142633-PROGRESS.md
Decision: md-render-review-coverage | cover the original formatter and register commits as well as this repair because the checker found both original unit commits unreviewed | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/md-render-1020-repair-142633-PROGRESS.md
Prompt review: no prompt or model verdict parser changes. Output formatting is tested against actual Telegram history replies 34501/34485 and recorded parse refusal; additional recorded summary-writer 715672480, uncertain summary 715672483, Jev undecided 715672482/unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty bubble 715672550 are replayed through both renderers. The journal send tests prove the preparation path fires on captured replies, not just synthetic strings.
Prompt finding: 4106b49fff07 | protocol-literal | existing guidance to preserve missing evidence; unchanged by this repair.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed saved-memory answer; unchanged by this repair.
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label and uncertainty guidance; unchanged by this repair.

Coverage: this record covers the original four-file renderer addition and its register replay as well as the repair. The repaired final behavior supersedes post-signature transformation. Added tests prove both outcomes of the asynchronous refusal-custody barrier before fallback.

Register regeneration: delegated owner-manifest and inventory scripts reported zero changed pins; generated/ replay is bound to product commit 7e3fad6c297676be408ddaa2b543cd28fbeceaa3.

## Closing block

simplestRobustRoute: prepare both exact variants through the existing journal owner, sign them before admission, dispatch one target, retain a definite parse refusal and permit only its bounded alternative. This is that route. The retained alternative prevents formatter-version drift; refusal evidence prevents success from erasing a rejected attempt; protected URLs and whitespace-delimited heading closers prevent the two demonstrated content corruptions. Existing start, stop, ownership and durability checks remain. No live unattended acceptance is claimed from offline replay.
80/20: repair the three demonstrated defects with focused signature, content, fallback and restart tests; the Studio retains live-channel and full-suite gate ownership.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
