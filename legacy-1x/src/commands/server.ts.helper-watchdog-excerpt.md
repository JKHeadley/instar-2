# Exact excerpt of 1.x src/commands/server.ts (JKHeadley/instar f3f94826ae7c0ae6203c2651698c02b95b89ccfa), the production wire-up of SubagentTracker and HelperWatchdog

The whole file is 29,000+ lines of unrelated server composition, so only the lines that wire this feature are copied, with their 1.x line numbers. sha256 of the whole file: 39497ebb1e49045420c9eaae42a4d2b48396ef260be03f064e357f70a2cdb935.

```ts
// lines 13965-13971: construction
    // Subagent Tracker — monitors subagent lifecycle via hook events. Constructed
    // BEFORE the silently-stopped trio block so ActiveWorkSilenceSentinel's
    // corroboration (HONEST-PROGRESS-MESSAGING A2 — "is a sub-agent live?") can be
    // wired into it (it was previously built after the trio block).
    const { SubagentTracker } = await import('../monitoring/SubagentTracker.js');
    const subagentTracker = new SubagentTracker({ stateDir: config.stateDir });
    console.log(pc.green('  Subagent tracker enabled'));

// lines 14112-14117: ActiveWorkSilenceSentinel corroboration (HONEST-PROGRESS-MESSAGING A2c)
            hasActiveSubagents: (name: string) => {
              const csid = sessionManager
                .listRunningSessions()
                .find((s) => s.tmuxSession === name)?.claudeSessionId;
              return csid ? subagentTracker.hasActiveSubagents(csid) : false;
            },

// lines 14280-14345: HelperWatchdog wire-up and subagent-aware zombie cleanup

    // Helper Watchdog — detects subagent stalls and rate-limit failures,
    // surfacing them back into the parent session's stdin so the agent
    // can decide whether to retry smaller. Complements SessionWatchdog,
    // which only covers the top-level session.
    const { HelperWatchdog } = await import('../monitoring/HelperWatchdog.js');
    const helperWatchdog = new HelperWatchdog({ subagentTracker });
    helperWatchdog.start();
    const findTmuxForClaudeSession = (claudeSessionId: string): string | null => {
      const running = sessionManager
        .listRunningSessions()
        .filter((s) => s.claudeSessionId === claudeSessionId);
      return running[0]?.tmuxSession ?? null;
    };
    const deliverHelperAlert = (tmux: string | null, msg: string): void => {
      console.warn(msg);
      if (!tmux) return;
      try {
        sessionManager.injectMessage(tmux, msg);
      } catch (err) {
        console.warn(
          `[HelperWatchdog] inject failed for ${tmux}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };
    helperWatchdog.on(
      'stall',
      (e: { agentId: string; agentType: string; sessionId: string; elapsedMs: number }) => {
        const minutes = Math.round(e.elapsedMs / 60_000);
        deliverHelperAlert(
          findTmuxForClaudeSession(e.sessionId),
          `[helper-watchdog] Your ${e.agentType} helper (agent ${e.agentId}) has been running for ${minutes}m with no stop event — likely stalled. Consider retrying with a smaller scope or aborting.`,
        );
      },
    );
    helperWatchdog.on(
      'helper-failed',
      (e: {
        record: { agentId: string; agentType: string; sessionId: string; lastMessage: string | null };
        reason: string;
      }) => {
        const snippet = (e.record.lastMessage ?? '').slice(0, 160);
        deliverHelperAlert(
          findTmuxForClaudeSession(e.record.sessionId),
          `[helper-watchdog] Your ${e.record.agentType} helper (agent ${e.record.agentId}) died with reason=${e.reason}. Last message: ${snippet}`,
        );
      },
    );
    console.log(pc.green('  Helper watchdog enabled'));

    // Wire subagent awareness into zombie cleanup — prevents killing sessions
    // that are idle at the prompt but waiting for subagent results.
    const MAX_SUBAGENT_WAIT_MS = 60 * 60_000; // 60 minutes — stale subagent safety cap
    sessionManager.setSubagentChecker((session: import('../core/types.js').Session) => {
      if (!session.claudeSessionId) return false;
      const active = subagentTracker.getActiveSubagents(session.claudeSessionId);
      if (active.length === 0) return false;
      // Safety cap: if ALL active subagents have been running > 60 minutes,
      // treat them as stale (likely missed a SubagentStop event) and allow the kill.
      const now = Date.now();
      const allStale = active.every(a =>
        now - new Date(a.startedAt).getTime() > MAX_SUBAGENT_WAIT_MS,
      );
      if (allStale) {
        console.warn(`[SessionManager] Session "${session.name}" has ${active.length} stale subagent(s) (>60m). Allowing zombie kill.`);
        return false;

// lines 20724-20735: SwapWorkGate subagent leg
      _swapWorkGate = new SwapWorkGate({
        checkSessionWorkState: (tmux) => sessionManager.checkSessionWorkState(tmux),
        getClaudeSessionId: (tmux) =>
          state.listSessions({ status: 'running' }).find((s) => s.tmuxSession === tmux)?.claudeSessionId ?? null,
        hasActiveSubagents: (id) => subagentTracker.hasActiveSubagents(id),
        getActiveSubagents: (id) =>
          subagentTracker.getActiveSubagents(id).map((r) => ({
            agentType: r.agentType,
            startedAt: r.startedAt,
            ...(r.transcriptPath ? { transcriptPath: r.transcriptPath } : {}),
          })),
      });

// lines 21123-21126: SessionReaper gate K
      activeSubagentCount: (csid) => {
        try { return csid ? subagentTracker.getActiveSubagents(csid).length : 0; }
        catch { return 1; } // cannot tell → protect
      },
```
