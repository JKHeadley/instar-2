# Model-provider return-capture lifecycle flake

**Status:** OPEN  
**Opened:** 2026-09-25  
**Owner:** R5 landing agent until explicitly handed to the model-provider test maintainer.  
**Exact case:** `tests/e2e/model-provider-review.test.ts` — `MODEL-PROVIDER-PATH REVIEW lifecycle SIGKILL return-capture`.

## Evidence and disposition

At R5 revision `1417eda98c9137a0fcf681369ccdca69f2508424`, against `origin/main` `d774ab37e374d475a2150e166a93c237f4cc139a`, the case failed in `par-qual/r5-1417eda-iso/gate.log` after 4,231 ms. The assertion was `0 !== 1` for the first `http.requests.length` check at `cuts.mjs:5:1173`, after the cut-marker and SIGKILL checks. The gate reported 3,301 passed, 1 failed, 156 skipped.

The unchanged case passed in these comparison gates:

| Gate log under `.instar/lanes/` | Case duration |
|---|---:|
| `par-qual/awareness-7b45804-iso/gate.log` | 3,627 ms |
| `par-qual/memory-3ef5830-iso/gate.log` | 3,636 ms |
| `par-qual/sentinels-cebe023-iso/gate.log` | 3,960 ms |
| `par-qual/scheduler-55c049a-iso/gate.log` | 3,683 ms |
| `par-qual/enforce-330097e-iso/gate.log` | 3,602 ms |

These are results for this case, not claims that every comparison gate passed. The scheduler comparator `55c049a` has identical existing provider and effect sources, scripts, model-provider fixtures and harness, common fixture, setup, and Vitest configuration. R5's added sampler is outside this test's import path. No semantic connection to R5's changes is established.

The 100 ms HTTP abort budget in `tests/model-provider/fixture.ts` could cause a transport failure before the server observes a request. `provider-invocation.ts` can then durably capture an uncertain observation, while `cut-loader.mjs` triggers `return-capture` after **any** `putReserved` return. The cut marker therefore does not prove a successful response or a server-observed request. This timeout explanation is a hypothesis; the exact failed transport event is unconfirmed. On a successful response, `http-provider.ts` records the request before responding, so the evidence does not support a claim that SIGKILL outran recording a successful request.

Rule 37 quarantine skips only this exact case, visibly in its test title and provider contract seam output. **Coverage gap:** return-capture crash recovery is unexecuted while quarantined. The other ten lifecycle cuts remain active and do not replace its proof. The checker reads no old or current proof for this skipped case and excludes it from the provider-call claim. Runtime timeout, authority, durability, and retry safeguards are unchanged.

The owner carries repair in the existing queue. Every provider and landing gate report must re-surface this OPEN defect until closure; a green gate is reported as **green with Rule 37 quarantine**, never as all provider cuts passed. Preserve this record and the original logs after closure.

## Closure

Identify and repair the actual harness failure, then remove the test skip and narrow checker exception together. In the normal six-worker gate, demonstrate the intended successful-return capture boundary, exactly one server request, SIGKILL, durable pending work, and replay refusal using the preserved assertions and a fresh native proof. Record host and overlapping-work conditions, and exercise the diagnosed failure condition enough to show the mechanism changed. A timeout increase or another unchanged green run does not close this defect. If the repair regresses, restore the explicit quarantine and reopen this record.

**Multi-machine posture:** The HTTP fixture is deliberately machine-local. The defect record and quarantine travel with the repository, without a peer dependency.
