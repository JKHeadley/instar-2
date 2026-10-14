// Turn-boundary pool port. All harness layout and copying stay in the physical adapter.
// The host retains its claim, checkpoint, lease and durable input queue across this move.
export function createContinuingLoginHandoff({ pool, current, physical, select, stop, record, project, admit = async () => {} }) {
  let carriedCalls = 0, baseline = 0, observedCalls = 0;
  const modelCalls = since => {
    const measured = physical().modelCalls(since);
    if (measured === null) return null;
    // A retained measurement cannot disappear with an evicted source transcript. This is
    // observed history, not a quota estimate; the unchanged dispatch gate holds the cap.
    observedCalls = Math.max(observedCalls, carriedCalls + Math.max(0, measured - baseline));
    return observedCalls;
  };
  return Object.freeze({ modelCalls,
    async prepareTurn({ claim, child, openedAt }) {
      const previous = current();
      const next = pool.selectSession(previous.index);
      if (!next) return 'waiting';
      if (next.index === previous.index) return 'ready';
      // The conversation port invokes this only when the previous turn is closed.
      const calls = openedAt === null ? 0 : modelCalls(openedAt);
      if (calls === null) throw Error('login handoff call accounting unavailable');
      await admit(next);
      if (child !== null) stop();
      const source = physical(), journal = source.load(), id = journal.resumes[claim];
      const copy = id ? source.carryTranscript({ id, project, source: previous.profile.configDirectory,
        target: next.profile.configDirectory }) : 'missing';
      if (copy !== 'copied' && copy !== 'identical') {
        // Never resume a divergent destination. Retain all session/delivery records: the
        // driver's existing cache-miss continuation reconstructs the conversation from them.
        const resumes = { ...journal.resumes }; delete resumes[claim];
        source.save({ ...journal, resumes });
      }
      select(next);
      const targetCalls = openedAt === null ? 0 : physical().modelCalls(openedAt);
      if (targetCalls === null) throw Error('login handoff destination accounting unavailable');
      carriedCalls = calls; baseline = targetCalls;
      record({ claim, from: previous.profile.reference, to: next.profile.reference,
        continuity: copy === 'copied' || copy === 'identical' ? 'transcript' : 'journal', copy, calls });
      return child === null ? 'ready' : 'replaced';
    },
  });
}
