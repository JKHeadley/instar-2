# Channel memory CLI import timing flake (Rule 37) — CLOSED 2026-09-28: subject removed

**Status:** CLOSED 2026-09-28 (unit U6), because the case this record is about no longer exists — **not** because
its timing was repaired. **Owner:** memory health landing desk. **Opened:** 2026-09-26.

## What this recorded

The case `CLI reads an agent-owned JSONL fixture without changing it or advancing Telegram intake` in
`tests/preview/journal-channel-memory.test.ts` exceeded Vitest's 10 000 ms deadline during a six-file targeted run
at `ac148083` (reported 10 380 ms), and passed in isolation at 7 583 ms on unchanged code. It launched four
synchronous CLI subprocesses, each with its own 10 000 ms timeout inside a case carrying the same 10 000 ms
deadline — a budget mismatch that made timing sensitivity credible. The disposition was to keep the case active
with a 45 000 ms deadline and confirm headroom under the original parallel conditions before closing.

## Why it is closed

Commit `90882c34` ("cint-23-occam step 1: remove away, operator and cross-topic digests and the email import
route") removed the email import route, and with it this case. `tests/preview/journal-channel-memory.test.ts` now
holds four cases, none of which is the one above and none of which spawns a CLI subprocess; the 45 000 ms deadline
this record describes is not in the file either. A dangling comment about "four bounded child processes" was left
behind and is removed.

There is therefore nothing left to prove headroom for. Stated plainly: **the timing behaviour was never
diagnosed or repaired — its subject was deleted.** If the channel-memory CLI import path is ever reintroduced, this
record should be reopened alongside it, and the measured cold-child cost in `full-suite-load-timeouts.md` (about
90% of a cold preview child is uncached transpilation, roughly 50 s inside a 5-worker suite at load 42) is the
budget evidence to size it from — four such children cannot fit a 10 s deadline on a loaded host.

**Multi-machine posture:** The fixture was machine-local. This record travels with the repository.
