# Pre-launch reservation regression evidence

WSL run on 2026-10-10, branch w4-prelaunch-honest, base afa6be39.

Command: `nice -n 10 node_modules/.bin/vitest run tests/preview/journal-prelaunch.test.ts tests/preview/journal-provider.test.ts --maxWorkers 1`

Result at 14:04:12 PDT: 2 files passed, 9 tests passed, exit 0.

The actual subscription adapter's admission check throws before executing a model command. The new boundary identifies it as not started; the journal worker releases the reservation, sends the fixed short reply in topic 3, and does not send or invoke again after the encrypted journal is reopened. Tests also exercise tool liability, a lost delivery receipt, stop, and thrown/uncertain/later-refusal outcomes after executor entry. Those retain UNKNOWN. Physical provider and Telegram IO are replaced; this is offline pipeline and restart evidence, not a live Telegram deployment claim.

Recorded replay: `tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json`, all 384 rows, updates 715672479–715672500. Accepted summaries 715672480/481/484, uncertain summary reservations 715672492/496/497, Jev unsure/unavailable, reply reviews, deliveries and undecided cancellation 715672496 replay unchanged. A new not-started hold then fires the actual minimal responder without clearing any prior UNKNOWN. The captured fixture has no real empty delivered bubble; the inherited w4-group-carry2 review records the desk's 2026-10-09 22:05 ruling on that absence. No synthetic bubble is represented as a live capture.

Build and architecture checks passed. Typecheck passed after tightening the test genesis's forum literal. Lint/register checks report the desk-owned source pin trailing the changed launcher. Broader direct-import testing and the desk's independent gate have separate outcomes; this evidence does not assert those passed.
