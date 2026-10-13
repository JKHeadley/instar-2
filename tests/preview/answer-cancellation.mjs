/** In-flight liveness only. New admissions still require a fresh successful check.
 * Rules 4/55: only unreadable records get eight 25ms re-reads (200ms); an observed
 * withdrawal or stop wins on the very next poll, even during that allowance. */
export function cancellationProbe({ stop, activation, tools, now }) {
  let unreadableSince = null, reads = 0;
  return phase => {
    const stopped = stop();
    if (stopped) return stopped;
    const states = [activation(), ...(tools ? [tools()] : [])];
    const withdrawn = states.find(state => state !== null && state !== 'records-unreadable');
    if (withdrawn) return withdrawn;
    if (!states.includes('records-unreadable')) { unreadableSince = null; reads = 0; return false; }
    if (phase === 'admission') return 'records-unreadable';
    unreadableSince ??= now();
    reads++;
    return reads >= 9 || now() - unreadableSince >= 200 ? 'records-unreadable' : false;
  };
}
/** A present changed record is withdrawal; a failed parse/read is unavailable evidence. */
export function recordLiveness(read, expected, withdrawn, check = () => {}) {
  return () => {
    let bytes;
    try { bytes = read(); JSON.parse(bytes); } catch { return 'records-unreadable'; }
    if (bytes !== expected) return withdrawn;
    try {
      check();
      return null;
    } catch (error) {
      return error?.code === 'RECORDS_UNREADABLE' || error?.code?.startsWith('E') || error instanceof SyntaxError
        ? 'records-unreadable' : withdrawn;
    }
  };
}
