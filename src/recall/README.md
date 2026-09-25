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
await groundTurn({ text: incomingText, excludeMessageIds: [incomingId],
  audience: { conversation, participants: ['<principal id>', ...] } }, reader)
// → Result<{ text, revealed, withheld, manifest }>
```

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

- **Secrets:** credentials are redacted before append, so the exchange is kept without the
  secret. Part two's envelope also refuses secret-shaped bytes. Text is redacted again at
  render time to cover older or foreign rows.
- **Spend cap:** the scan, results, rerank candidates, per-entry characters and total
  characters are all bounded, with hard ceilings. A reranker is called only after
  `spend.reserve(chargePerCall)` succeeds. With no spend port, nothing is spent.
- **Stop:** `groundTurn` is refused with reason `floor` while stopped, and `recall` never calls
  the reranker then. Capture is unaffected: intake stays durable during a stop.
- **No duplicate sends:** recall never sends anything. Capture is idempotent on
  (conversation, messageId). The same id arriving with different content is refused as `integrity`.
- **Durable intake:** `captureExchange` returns success only with the store's durability
  receipt. A store refusal passes through unchanged.

## Not yet wired (desk / assembly work)

- **Production reranker binding:** `judge()` in the judgment doorway needs a live Run,
  EffectRequest and fence per turn. The assembly should adapt it to `RecallRerankPort` and
  bind `spend` to part six's reservation.
- **Conversation driver:** calling `captureExchange` on each admitted inbound message and each
  sent outbound message, and `groundTurn` before drafting, happens in the assembly's
  context-delivery path.
- **Register:** the new module changes the source roster, so `generated/register.json` must be
  regenerated at a commit that includes it.

Tests: `tests/recall/` covers capture, retrieval quality on a small fixture set, reveal and
grounding, and a session-A to session-B recall across a real encrypted-disk restart.
