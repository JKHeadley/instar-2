# Change review — sb-w4-send-neveropened

Subject base: c54befc70b5802319236d4be42b83619be207d66
Review state: open
Reviewed content: none
Outcome: Merge the reviewed w4-send-neveropened d35d6e0176b683df3b3c94a1ed7ec11e5d879eb9 into the exact live train head. Proven connection-setup non-delivery reaches the existing bounded retry; ambiguous delivery remains unknown. The ordinary merge fast-forwarded without conflicts. No new implementation was authored.
Affected rules: purpose Rule 2; Rules 2, 26, 34, 42, 55, 70, 74, 77, 95, 100, 101, 102, 105, 113, 115 and 116, as explained in the carried unit record. Integration adds register replay evidence and preserves the unit's history.
Affected floors: secrets — closed diagnostic code/syscall lists; spend cap — unchanged dispatch checks and no added model calls; stop — unchanged; no duplicate sends — every attempt must prove connection setup failed before retry, and ambiguous sends are never replayed; durable intake — unchanged journal ordering. Default always-sent text-only bytes measured at 21726 against the unchanged 22959 guard; tools measure 23355 against the existing 24503 tool-adjusted bound.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries the unit's irreversible send classification and retry behavior.
Side effects: The unit's definite non-delivery may consume its existing single outer retry after two inner attempts; metadata is bounded and filtered. Integration changes only generated register publication and this record. No documents or changelogs conflicted.
Undo and recovery: Revert the unit commits and regenerate the register. Never replay historical unknown sends; their missing causes are not proof of non-delivery.
Multi-machine posture: Unchanged machine-local transport evidence from the admitted sender; retries remain inside the existing ownership, stop, cap and durability funnel. No new store, owner or replica requirement.
Layer below: Read the unit review and builder report; inspected bridge connectionNeverOpened, child protocol decoder and classifyTelegramSend. Re-ran changed tests and direct consumer tests, including native loopback recovery, persistent refusal, receipt loss and journal reopen. Refreshed inventory and owner pins through the desk tools (zero stale pins) and replayed the generated register at d35d6e0176b683df3b3c94a1ed7ec11e5d879eb9.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-send-outcome.test.ts
Hook bypass: none
Convergence: none
Decision: sb-send-merge | use one ordinary merge of d35d6e0176b683df3b3c94a1ed7ec11e5d879eb9 onto c54befc70b5802319236d4be42b83619be207d66; it fast-forwarded without conflicts and the carried unit record cites its original report | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-send-neveropened-PROGRESS.md
Decision: sb-send-desk | execute the exact cint-L37 desk chain: inventory repin, build, owner rehash and register replay; retain the unchanged context guard and measure its bytes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-send-neveropened-PROGRESS.md
Prompt review: No model prompt, model output parser or model accept/escalate/refuse policy changes. The deterministic transport path replays recorded D1c delivered-candidate bytes from tests/preview/fixtures/deferral-send-failure-2026-10-08.json, updates 46039702 and 46039703. No new live journal read or live Telegram mutation is claimed.
Validation limitation: The carried unit records two host-only native-harness-contract failures (uv_uptime EPERM and confined runner exit 71). The specific combine brief skips macOS-only tests; that host contract is not rerun here. Production/live proof and independent review remain gate-host work. Local change-review cannot read historical Studio report/evidence paths, including this record's required report destination; those findings are reported rather than bypassed.

## Closing block

simplestRobustRoute: Merge the reviewed unit unchanged and run the existing desk chain. No added machinery. Start guard: every native connection attempt proves setup failure. End state: exact receipt, definite non-delivery or unknown. Limit guards: unchanged timeout, two inner attempts and one outer retry with ownership/stop/cap/durability enforcement. Native loopback and shipped journal tests exercise unattended recovery and no retry after lost receipt; this build does not claim a new production deployment.
80/20: Targeted changed/direct-consumer tests, default-context-floor, register e2e, typecheck, lint, architecture, register and review checks only; no full suite or load burn.
VERDICT: author submission; independent landing review remains required
