# Codex conversation protocol mapping

`codex-conversation.ts` maps persistent start/resume, further input and interruption to
Codex app-server requests and reads a bounded, identity-bound turn from captured frames.
It performs no I/O. The [registered worker](codex-conversation-worker.md) consumes this
mapping through the common conversation host and injected physical transport.

The host persists dispatch intent before sending. An RPC id is not an idempotency key;
unknown submission must never be replayed. Notifications arriving before the turn-start
response are retained until the returned turn id binds them. Duplicate completed items
are not concatenated. Only a completed turn exposes the last final answer; failed,
interrupted, malformed, oversized and empty outcomes cannot produce a successful reply.
The reader uses the legacy unphased final item only when no explicit final item exists.

Input is bounded to the common host's 1 MiB limit. Output and item counts remain bounded.
Thread token usage is cumulative, not per-turn cost or a model-call count. The existing
external model checkpoint still meters and caps every actual request.

Both start and resume carry the reviewed `bypass_hook_trust: true` app-server thread
configuration. This is the protocol equivalent of the existing externally-vetted hook
invocation: only host-prepared admission commands are supplied. Process overrides carry
the tool hooks, model checkpoint and prepared MCP launcher references on both paths.

Protocol fixtures are unchanged outer notifications from installed Codex 0.156.1, with
fabricated loopback-provider text and usage, captured 2026-10-13. The 2026-10-14 empty
thread configuration probe records rejection of a non-boolean trust override and
acceptance of the boolean override; it sent no turn/input and contacted no model or
account. Neither fixture proves runtime tool admission or real login access. The desk
owns that proof and the 33-message user walk.

Reference: [official app-server protocol](https://learn.chatgpt.com/docs/app-server).
