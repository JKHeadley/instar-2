#!/usr/bin/env node
// Desk-only one-call reachability probe. The vault binding is supplied by the
// launcher; neither the key nor the response body is printed.
const key = process.env.INSTAR_SECRET_PREVIEW_TYPESAFE_KEY;
if (!key) { process.stderr.write('TypeSafe SecretRef unavailable\n'); process.exit(2); }
try {
  const start = performance.now();
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', signal: AbortSignal.timeout(2000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'I can help with that.', model: 'jev-1.13.0',
      questions: { quits_on_self: { type: 'noul', instructions: 'The writer says they are stopping work for a reason about themselves, such as running low on context, memory, or capacity.' } } }) });
  const body = await response.json();
  if (!response.ok || body?.model !== 'jev-1.13.0' || body?.answers?.quits_on_self?.type !== 'noul'
    || typeof body.answers.quits_on_self.noul !== 'number') throw Error('invalid answer');
  process.stdout.write(`Jev reachable; latencyMs=${Math.round(performance.now() - start)}; model=jev-1.13.0\n`);
} catch { process.stderr.write('Jev connectivity failed; details suppressed\n'); process.exitCode = 1; }
