# Recall — minimal robust memory (part twenty-one, draft intent)

`src/recall/` lets a later turn find a relevant earlier exchange across sessions, topics and
restarts, know who said it and when, and use it, while keeping **remembering** separate from
**permission to reveal**. It takes its intent from the unapproved drafts `docs/21-the-recall-doorway.md`,
`docs/22-the-commons.md` and `docs/23-judgment-of-use.md`. It does not implement their machinery:
no evidence packets, retriever family, sentinels or commons.

## Simplest robust route (Rule 116)

The job is to recall prior exchanges with speaker, time and place, show them only to an audience
allowed to see them, and keep every floor. The route reuses existing mechanisms:

| Need | Mechanism | Why not more |
|---|---|---|
| Durable, ordered, signed, restart-safe memory | One fact kind `recall-exchange` through part two's existing store (`authorAndAppend`) | The store already owns durability receipts, signing, replication and recovery. A second store would duplicate all of that. |
| Find by meaning | In-core BM25 with a light stemmer and a coverage-first rank (the shape 1.x SemanticMemory ran on FTS5), plus one optional `RecallRerankPort` | Deterministic, offline and free, with no dependency (core may import only `node:crypto`). Matching by meaning when the words differ goes through one replaceable port. |
| Reveal permission | `mayReveal(exchange, audience)`, one pure function | A single decision point that fails closed. |
| Driver API | `groundTurn(request, reader)` | Recall, then reveal, then a bounded render. Nothing else. |

Local embeddings were considered and deferred. They need a model dependency in core and a
versioned vector index. The rerank port is where they, or a model, plug in if measured recall
shows lexical plus rerank falls short.

## API

```ts
import { recallExchangeSchema, captureExchange, recall, groundTurn, mayReveal } from '.../recall/index.js';

// 1. Install the schema in the part-two registry.
schemas: [...schemas, recallExchangeSchema(scope)]

// 2. Capture every inbound and outbound message once it is known (idempotent).
captureExchange({ conversation: 'telegram:<chat>:<topic>', session, messageId, speakerId, speakerName,
  speakerRole: 'user' | 'agent' | 'system', text, visibility: 'participants' | 'public' | 'private',
  audience: ['<principal id>', ...] }, clockInput, writer)   // → Result<CaptureReceipt>

// 3. Ground each turn before drafting.
await groundTurn({ text: incomingText, exclude: [{ conversation, messageId: incomingId }],
  audience: { conversation, participants: ['<principal id>', ...] } }, reader)
// → Result<{ text, revealed, withheld, manifest }>
```

A driver that already holds a bounded candidate set in memory (the preview journal's projection)
selects through `composeRecall({ query, lexical, candidates, maxResults, stopped, reranker?, spend? })`.
It fuses, by declared rank interleaving, an optional spend-gated semantic rerank of `rerankPool`, the
driver's lexical order, and the derived-index order (query terms against each candidate's generated
`cues`, write-side index material that ranks but is never evidence). It reports `coverage` and a
`degraded` disposition while an indexable candidate lacks cues, so a miss there is a word-match miss,
never evidence of absence. A charging reranker is called only with reserved spend and no stop.

`reader = { context, store, stopped, reranker?, spend? }`. Put `grounding.text` into the model
context as quoted history. It is wrapped in `<recalled-history>`, labelled as data rather than
instructions, and its own closing tag cannot be forged from inside. `withheld` lists `factId`
and a reason for audit only; its content is never rendered.

## Reveal rule

- `public`: any audience.
- `participants`: only when **every** audience participant appears in the exchange's recorded
  `audience`. An empty audience fails closed.
- `private`: never rendered, including to its own speaker. This is agent-only memory.
- An unknown stored visibility reads as `private`.

The capturing caller decides the audience, usually the conversation's authenticated
participants. Recall itself never decides reveal.

## Floors

- **Secrets:** credentials in the text and the display name are redacted before append, so the
  exchange is kept without the secret. A credential-shaped identity key (conversation, session,
  message id, speaker id, audience member) is refused, never rewritten into a colliding identity.
  Part two's envelope also refuses secret-shaped bytes. Everything handed to a model or returned
  (query, candidates, rendered lines, revealed entries) is redacted again, covering older or foreign rows.
- **Spend cap (model and output):** results, rerank candidates, per-entry characters and total
  characters are bounded, with hard ceilings. A reranker is called only after
  `spend.reserve(chargePerCall)` succeeds. With no spend port, nothing is spent.
- **Not a resource ceiling:** `maxScan` bounds how many recent exchanges are *scored*, not how many
  are read. Each query reads and decodes the whole fact store, keeps every eligible exchange and
  sorts them (O(R log R), memory growing with history); the production adapter decrypts and parses
  the whole facts file, and part-two append is O(n). Before live activation, assembly must supply an
  enforced finite storage envelope or part two a bounded read path. Rule 60 is not claimed here.
- **Stop:** `groundTurn` is refused with reason `floor` while stopped, checked before recall and
  again before grounding is returned, so a stop asserted while recall is in flight still refuses.
  `recall` never calls the reranker while stopped. An already-authorized in-flight call is not
  cancelled. Capture is unaffected: intake stays durable during a stop.
- **No duplicate sends:** recall never sends anything. Capture is idempotent on
  (conversation, messageId). The same id with different content (text, speaker id or role,
  visibility, or audience as a set) is refused as `integrity`; session, observation time and
  display name may differ on a redelivery.
- **Exclusions** use the capture identity `{ conversation, messageId }`, since provider ids repeat
  across conversations.
- **Crowd-out:** grounding recalls 50 wide before the reveal check. Fifty or more higher-ranked
  withheld hits can still crowd out every revealable one (recall coverage is lost; nothing
  restricted is revealed).
- **Manifest scope:** `withheld` lists the hits the render loop examined (it stops after
  `maxResults` reveals), not every recalled hit. `truncated` is set when an entry is dropped for
  `maxChars` or its text is cut to `maxCharsPerExchange`.
- **Durable intake:** `captureExchange` returns success only with the store's durability
  receipt. A store refusal passes through unchanged.

## Not yet wired (desk / assembly work)

- **Production reranker binding:** `judge()` in the judgment doorway needs a live Run,
  EffectRequest and fence per turn. The assembly should adapt it to `RecallRerankPort` and
  bind `spend` to part six's reservation.
- **Conversation driver:** calling `captureExchange` on each admitted inbound message and each
  sent outbound message, and `groundTurn` before drafting, happens in the assembly's
  context-delivery path. The preview journal already selects its memory recall and search through
  `composeRecall` (lint NF-11 in `scripts/check-architecture.mjs` holds that), with cues written by
  its supervised summary work and no semantic reranker bound (ordinary conversation's zero helper
  budget, part twenty-one §7).
- **Register:** the new module changes the source roster, so `generated/register.json` must be
  regenerated at a commit that includes it.

Tests: `tests/recall/` covers capture, retrieval quality on a small fixture set, reveal and
grounding, and a session-A to session-B recall across a real encrypted-disk restart.
