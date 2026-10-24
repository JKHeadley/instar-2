# Change review — Default browser launches and checks empty read requests

Subject base: 8764000ec64ed42f416f2a06ee955746a64a83e7
Review state: open
Reviewed content: none
Outcome: the default Playwright browser launches in owned workspace state, and empty snapshot requests reach the runner's held-secret check.
Affected rules: 1, 4, 32, 34, 36, 44, 45, 49, 62, 70, 74, 86, 95, 100, 101, 111, 113, 116
Affected floors: secrets — existing check still refuses held material and unavailable custody; spend cap, stop, no duplicate sends and durable intake — existing owners unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: small repair through the existing installer, launch preparation and socket protocol, with real browser proof.
Side effects: the shipped browser is headless with a relative profile in its bounded workspace. macOS Foundation receives that absolute workspace as CFFIXED_USER_HOME because it ignores HOME and otherwise selects the harness account's /var/empty. Continuing sessions forward their actual workspace too. Explicit home overrides and other profiles remain unchanged. Only an exact legacy default is migrated; custom server choices survive. The socket keeps the empty payload separator instead of trimming it away; credential nonces and fail-closed checks remain intact.
Undo and recovery: revert the runtime change and restore the saved mcp.json on affected roots; this reintroduces the launch and empty-check defects. Workspace state follows existing volume retention; no agent journal or credential format changes.
Multi-machine posture: browser profile/cache is deliberately machine-local bounded workspace state, isolated by root/conversation or session; each host migrates its own configuration. No replicated authority or memory changes.
Layer below: inspected 1.x PlaywrightProfileRegistry and setup, runtime readRootMcp/prepareMcpLaunch/serveTurnSocket, session forwarding, harness volume grants, and Chromium/Foundation path resolution. HOME versus absolute CFFIXED_USER_HOME was tested with the real Foundation directory lookup. The first live run disproved profile-only repair; the second proved the home override under the actual harness user.
Bug class: integration
Bug evidence: reproducer=tests/preview/held-egress.test.ts
Hook bypass: none
Convergence: none
Decision: mcp-chrome-owned-home | reuse bounded workspace storage and existing launch preparation, without global user-home or permission changes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-chrome-1024-PROGRESS.md
Prompt review: no prompts or output parsers changed. The admission decision replays captured summary 715672480, uncertain summary 715672483, Jev undecided 715672482 and unsure 969389570, reply review 969389923, delivered reply 715672479 and empty candidate 715672550 through the real hook/socket check. Sources are the read-only journal captures named in retrospective-duty-followup-train-1-2026-10-08.json. The new browser fixture captures live update 840343974's actual empty snapshot input and both tools' results. Held-secret and unavailable-check neighbours still refuse.
ELI16: The browser now has a folder it can actually use. A snapshot with no arguments still gets its safety check, instead of being mistaken for a missing check. Private values remain blocked.
simplestRobustRoute: reuse the existing profile argument, bounded workspace and shared launch function; preserve one socket framing separator. This is the simplest robust route. Exact default configuration is the migration guard, existing custody and admission are the authority guards, and existing volume/call/stop limits remain. Unattended shipped-path evidence: proof room 3 update 840343974 opened https://example.com, completed browser_snapshot and reported title Example Domain. Today's page snapshot contains no heading element; the delivered reply states that honestly rather than inventing a heading. Evidence: lanes/mcp-chrome-1024-proof2/; launcher restored to its original bytes and root after the proof.
80/20: failing-first regressions, targeted direct-consumer tests and actual proof-room use; no new service or framework.
VERDICT: author submission; independent landing review belongs to the desk
