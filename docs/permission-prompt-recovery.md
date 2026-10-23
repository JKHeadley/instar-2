# Permission prompts in admitted harness sessions

An admitted call gets an explicit one-call answer from the existing tool admission
hook. No response installs an “always allow” rule. The underlying tool still passes
the same scope, secret, spend, stop and effect checks.

Claude's native `PermissionRequest` event can resolve a remaining prompt without
terminal keypresses. Its envelope omits the tool-call ID. The hook therefore requires
exactly one unfinished ordinary admission with the same session, prompt, agent,
tool and complete effective input. It rereads the current scope and checkpoint,
checks that a shell rewrite has not changed, and durably consumes one response
claim before returning allow. A completed, denied, ambiguous, changed, clipped or
already-consumed call cannot be approved. A crash consumes the attempt; it does not
permit another response. No model judgment or quoted terminal text grants authority.

The first slice's recovery covers ordinary calls with complete recorded input and a
live checkpoint. Consequential calls still get their explicit allow from their
original effect admission; a later permission request for one stays refused because
this recovery cannot re-resolve that prepared effect. A missing native envelope or
an older admission record stays refused with an explanation. Codex keeps its existing
per-call admission response; it has no verified native permission-request envelope
in this slice. There is no generic menu auto-clicker.

For menus that remain on screen, the session adapter ports 1.x's genuine-bottom,
focused-option observation and persistence test. Four advancing samples spanning at
least five seconds produce a signal. The existing bounded progress surface explains
the wait without exposing terminal content. This signal does not type, interrupt,
end a turn, reset its deadline, or authorize a replay. A changed frame resets the
observation. The normal stop, deadline, ownership, durable intake and send-uniqueness
mechanisms retain control.

Implementation: `src/assembly/production-session-driver.ts`,
`src/assembly/production-provider.ts`, `tests/preview/tool-admission-hook.mjs`,
`tests/preview/tool-admission.mjs`, `tests/preview/working-activity.mjs` and
`tests/preview/working-progress.ts`. These host modules are installed by the existing
content-addressed hook/update path. Existing workers adopt the new hook on their
normal next launch; no running process or installed account is edited by this change.
Per-call response claims live with the bounded step admission state and share its
retention. Terminal samples are deliberately machine-local, bound to the existing
worker identity; conversation ownership still fences every effect.

The port starts from JKHeadley/instar main
`2461cfcf734bbd41d189c55e6e0ddd1b7598bf66`:

- `src/monitoring/PermissionPromptAutoResolver.ts`: exact one-call choice,
  unresolved-menu visibility, genuine-bottom checks and four-sample persistence.
- `src/monitoring/PromptGate.ts`: structured numbered-option observation and
  separation of ephemeral terminal text from durable identity.
- `src/monitoring/InputClassifier.ts`: separate approval from relay/refusal. Its
  keyword safety rules and extra classifier are replaced by the existing governed
  admission, which already has the complete operation and authority.

The 1.x full-access assumption and blind Enter response are deliberately omitted.
The native event is the action-time binding to the displayed call, avoiding a
second authority or a terminal scrape that cannot prove which operation it approves.
Fixtures preserve the 1.x recorded Claude and Grok menu bytes and the native Claude
2.1.303 hook envelopes captured on 2026-10-22 in an isolated PTY with a scripted
loopback provider. They do not represent a live-model or user-acceptance claim.
