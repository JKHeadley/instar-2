# Conversation adapter tests

Test suites for the Telegram and Slack adapters (Part Twelve). The fixture module here is also loaded at runtime by `tests/preview/agent.mjs`, so it is shipped code: the preview drivers build their stand-in owners from it (see `tests/preview/README.md`, stand-in ledger). Changes to it change the live preview. Captured and hand-written update shapes live in `fixtures/`; the register records which are genuine captures.
