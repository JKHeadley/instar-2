# Part Twelve — re-slice of slice A into A1 (this branch) and A2 (later)

Granted as SEAM-LEDGER row 82 (Echo, 2026-09-12 ~10:45Z; reversible by Justin). Reason: slice A reviews ran 9 → 10 → 8 → 4 → 6 → 7 → 3 → 4 → 2 → 3 → 5 findings over ten rounds without converging, and rereview10's five findings all sit in one surface — the delivery-status / response-evidence assessment in `src/conversation/telegram.ts`. The adapter foundation around it had been clean for several rounds.

## A1 — stays on impl-part-twelve (the landing slice)

- The Telegram adapter declaration and admission, including one admitted intake mode per bot; declared operational limits are bound into the immutable contract/conformance subject, and a changed limit is a new admission.
- Inbound custody before acknowledgment; exact update identity (bot + authenticated chat + `update_id`) and topic routing; one source-identity resolver for every update variant.
- The handoff into Part Four's landed registered ingress input.
- The registered Telegram ordinary-reply operation: prepare, dispatch through the landed Part Six/Eight ports, durable Part Eight response recording, and the source-bounded local Part Nine response assessment added during the A1 repair rounds. Real settlement remains held on its separately named owner grant.
- The contract map for exactly the P12-NF checks these cover. Every missing owner positive and every Slice B check remains explicitly non-executable by name.

## A2 — removed from this branch, built later as its own slice

- The other conversation platforms and media custody beyond metadata.
- Every production positive that still depends on a named unlanded owner seam, including the real-model, real-settlement, production-grounding, minimal-responder, held-receipt continuation, stable-attempt redelivery, and optional-effect paths.

## Row 99 — Part Ten conditional append integration

The following dependency is copied verbatim from `.instar/lanes/seam-response-part-twelve-ten-conditional-append.md`:

> Granted conditional by Echo at 23:33Z 2026-09-13 on the operator's confirmed authority boundary (sequencing and seam grants are the agent's; topic 52075, 2026-09-13).
>
> Request (from P12 A1 rereview14 finding 1): a compare-and-set append emulated in src/assembly/conformance-commit.ts (read, ordinary record, post-write check) leaves two passing mode records when two admissions race across processes, and then refuses both after restart.
>
> Grant: Part Ten exposes ONE public operation, "append only if the per-bot frontier equals the frontier the caller read; refuse otherwise", built on Part Two's existing physical compare-head append (SegmentStoragePort.append(bytes, expectedHead)). Built later as a Ten owner slice. Until it lands, P12 keeps an in-process single-flight guard (executable) and holds its cross-process one-admitted-mode arm NON-EXECUTABLE-UNTIL-row-99-ten-conditional-append; the emulated compare-and-set is removed, not kept as a stand-in.

Row 99 landed on main in `f144f1435a11914b79ffcb6c1cfb19444f70e3ef`. Slice A1 now consumes
Part Ten's public `createConditionalAssemblyAppendPort` and its `appendIfSubjectFrontier` operation
for the exact per-bot `AdapterConformance` frontier read by each admission caller. The former hold
is over: the competing-process one-admitted-mode arms of P12-NF-16, P12-NF-18, and P12-NF-46 are
executable. `tests/conversation/held/admission-process.ts`, `run-admission-matrix.py`, and
`admission-restart-matrix.py` permanently require one durable winner in either process order and a
fresh-process readmission of that winner after restart.
