// One owning host, one encrypted record per topic. No process is stopped here:
// the session host supplies its exact, serialized between-turn retirement.
export function createTopicLoginHandoff({ topic, pool, entries, store, physical, project, framework, admit }) {
  const loaded = store.load();
  if (!loaded && (pool.state.topicLogins ?? []).includes(topic)) throw Error('topic login custody lost; reconciliation required');
  let state = loaded ?? { version: 1, topic, identity: pool.state.identity, selected: 0, claim: null, pending: null, sequence: 0 };
  if (state.version !== 1 || state.topic !== topic || state.identity !== pool.state.identity || !entries[state.selected]
    || !Number.isSafeInteger(state.sequence) || state.sequence < 0
    || !(state.claim === null || typeof state.claim === 'string')
    || (state.pending && (!entries[state.pending.from] || !entries[state.pending.to]
      || state.pending.from === state.pending.to || !Number.isSafeInteger(state.pending.attempt))))
    throw Error('topic login custody differs; reconciliation required');
  const save = patch => { const next = { ...state, ...patch }; store.save(next); state = next; };
  // Install identity before a worker can be created, including the initial account.
  save({}); pool.registerTopic(topic);
  const current = () => entries[state.selected];
  return Object.freeze({ current,
    async prepareTurn({ claim, retire }) {
      // A pool completion is durable before the topic snapshot. Reconcile that fact
      // before selecting against current capacity; completion is not a fresh admission.
      const completed = state.pending && (pool.state.handoffs ?? []).find(move => move.id === `${topic}:${state.sequence}`);
      if (completed) save({ selected: state.pending.to, pending: null, continuity: completed.continuity });
      if (!state.pending) {
        const next = pool.selectSession(state.selected);
        if (!next) return false;
        if (next.index === state.selected) return true;
        const attempt = pool.state.handoffAttempts.at(-1).sequence;
        save({ sequence: state.sequence + 1, pending: { from: state.selected, to: next.index,
          claim: claim ?? state.claim, attempt } }); // intent durable before retirement or account change
      }
      const move = state.pending, source = entries[move.from], target = entries[move.to];
      if (!pool.readySession(move.to)) return false; // Recheck a prepared destination after delays or restart.
      // Admission has not dispatched work or begun retirement. Reuse the host's
      // queued wait path; custody/copy/retirement failures below remain errors.
      try { await admit(target); } catch { return false; }
      await retire();
      const io = physical(source), journal = io.load(), id = move.claim ? journal.resumes[move.claim] : null;
      const copy = id ? io.carryTranscript({ framework, id, project, source: source.profile.configDirectory,
        target: target.profile.configDirectory }) : 'missing';
      // Keep the old handle even on a cache miss: the driver's existing continuation path
      // uses it to distinguish a resumed conversation from a genuinely new conversation.
      const record = { id: `${topic}:${state.sequence}`, topic, attempt: move.attempt, claim: move.claim,
        from: source.profile.reference, to: target.profile.reference,
        continuity: copy === 'copied' || copy === 'identical' ? 'transcript' : 'journal', copy };
      pool.recordHandoff(record); // idempotent across a crash before the topic commit
      save({ selected: move.to, pending: null, continuity: record.continuity });
      return true;
    },
    bindClaim(claim) {
      const io = physical(current()), journal = io.load();
      const id = state.claim ? journal.resumes[state.claim] : null;
      if (id && claim !== state.claim) io.save({ ...journal, resumes: { ...journal.resumes, [claim]: id } });
      save({ claim, continuing: state.continuing === true || state.claim !== null && state.claim !== claim });
    },
    get continuing() { return state.continuing === true; },
    get resumeAllowed() { return state.continuity !== 'journal'; },
    launched() { save({ continuity: 'transcript' }); },
    get state() { return structuredClone(state); },
  });
}
