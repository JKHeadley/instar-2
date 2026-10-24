# Change review — MCP installation and account connection

Subject base: 099456d9745a90a50d637f7005aac17e4e57a408
Review state: open
Reviewed content: none
Outcome: fresh setup installs the 1.x Playwright default; the release updater merges it into existing roots; an installer stdin path stores account secrets in custody before publishing references.
Affected rules: 1, 26, 34, 44, 49, 74, 100, 101, 102, 113, 116
Affected floors: existing secrets custody and tool admission remain authoritative; spend cap, stop, durable intake and no duplicate sends are unchanged. Connector installation grants no account login or effect scope.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: installed connector configuration and custody are user-facing plumbing, with real consumer tests and an outstanding Studio live proof.
Side effects: new roots and updated roots receive Playwright; only browser_snapshot enters read scope. Operator server entries, metadata and read scopes survive migration. Explicit conflicting account additions refuse. Validate before secret injection as well as before publication, so injection cannot repair malformed input silently. Concurrent merges refuse behind one root-local lock. A dead installer leaves a visible lock requiring verified writer death before recovery. TypeScript remains pinned at 5.9.3 and moves to runtime dependencies so the installed migration can use the existing loader.
Undo and recovery: revert this change to stop future installations; existing operator configuration can be revised through the existing trust setup. The updater retains its root backup before migration. A failed validation leaves the old MCP bytes intact; secrets already sealed before a later failure remain in custody. Direct checkout switches bypass the product updater, so the desk must run the release migration against that root before restart.
Multi-machine posture: MCP configuration, custody and browser sessions are deliberately installation-local, matching the existing runtime. No credential/profile is copied across machines. Existing conversation ownership governs tool launch.
Layer below: read the 1.x setup/init Playwright installation, PostUpdateMigrator and PlaywrightProfileRegistry; traced 2.0 onboarding/configureTrust, readRootMcp, encrypted custody, durablePreviewWrite and updateRoot migration intent/backup/activation. The only 1.x default found is Playwright; none is omitted.
Bug class: integration
Bug evidence: reproducer=tests/preview/mcp-setup.test.ts
Hook bypass: none
Convergence: none
Decision: mcp-connect-existing-installers | use the 1.x Playwright default through existing setup and named release migration; preserve operator definitions and classify only browser_snapshot as a read | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-connect-1024-PROGRESS.md
Decision: mcp-connect-custody-merge | accept one account connector through installer stdin, reuse setupMcp to reject inline env values, seal secret env values before atomic publication, and serialize root merges to prevent lost operator entries | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-connect-1024-PROGRESS.md
Prompt review: no prompt or model output parser changes. Tests replay the existing captured summary-writer 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty candidate 715672550 from tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json through the installed read/effect boundary. This does not claim a live model or delivered empty bubble.
simplestRobustRoute: this is the simplest route: reuse the existing MCP consumer, custody, atomic writer, setup and update registry. The only added serialization prevents concurrent read/merge/write from discarding an operator entry. Existing path checks guard start, readRootMcp validates before publication, custody read-back precedes secret reference publication, and existing tool admission holds all effect floors. The unattended real model proof requires a Studio proof room, unavailable to this WSL builder; no live proof is claimed.
80/20: small installation plumbing, targeted consumer tests and unchanged admission engines; no new account registry, browser engine or policy framework.
VERDICT: author submission; no independent convergence claim
