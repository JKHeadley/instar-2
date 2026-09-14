import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { providerFixture, value, refused } from '../model-provider/fixture.js';
import { localProvider } from '../model-provider/http-provider.js';
it.each(['before-receipt', 'before-assessment', 'before-settlement', 'before-accounting', 'before-five'].map(cut => ({ cut, state: cut === 'before-receipt' ? 'missing receipt' : 'retained owner facts' })))('P7-NF-14 P8-NF-14 P9-NF-22 MODEL-PROVIDER-PATH lifecycle SIGKILL after real HTTP invocation at $cut with $state preserves pending work and never recalls', async ({ cut }) => {
  const http = await localProvider(), directory = mkdtempSync(join(tmpdir(), 'provider-kill-'));
  try {
    http.respond({ state: 'complete', bytes: '{}', providerOperation: 'kill-operation',
      usage: { inputTokens: 1, outputTokens: 1, charge: 3, source: 'test-http' }, retryBlocked: false });
    const killed = await new Promise<{ signal: string | null; output: string }>((resolve, reject) => {
      const child = spawn(process.execPath, ['--loader', './tests/model-provider/loader.mjs', './tests/model-provider/crash-worker.mjs'], {
        env: { ...process.env, PROVIDER_TEST_CUT: cut, PROVIDER_TEST_DIRECTORY: directory, PROVIDER_TEST_ENDPOINT: http.endpoint, PROVIDER_TEST_CREDENTIAL: http.credential },
        stdio: ['ignore', 'pipe', 'pipe'] });
      const watchdog = setTimeout(() => child.kill('SIGKILL'), 60000);
      let output = ''; child.stdout.on('data', b => { output += String(b); }); child.stderr.on('data', b => { output += String(b); });
      child.on('error', error => { clearTimeout(watchdog); reject(error); }); child.on('exit', (_code, signal) => { clearTimeout(watchdog); resolve({ signal, output }); });
    });
    expect(killed.output).toContain('provider-invoked'); expect(killed.signal).toBe('SIGKILL'); expect(http.requests).toHaveLength(1);
    const rebuilt = providerFixture({ directory, ...http });
    const { prepared, request } = rebuilt.prepare();
    refused(await rebuilt.api.dispatch(request, rebuilt.fence), 'uncertain');
    const reservation = value(rebuilt.six.inspect()).filter(r => r.record.type === 'AdmissionReservation').at(-1)!;
    expect(reservation.record).toMatchObject({ state: 'consumed', charge: 20 });
    if (reservation.record.type !== 'AdmissionReservation') throw new Error('reservation absent');
    if (cut === 'before-receipt') refused(rebuilt.api.assess(reservation.record.operation), 'missing Seven receipt');
    expect(rebuilt.all().filter(f => f.kind === 'effect-EffectSettlement')).toHaveLength(['before-accounting', 'before-five'].includes(cut) ? 1 : 0);
    expect(rebuilt.all().filter(f => f.kind === 'transport-SettlementApplication')).toHaveLength(cut === 'before-five' ? 1 : 0);
    expect(rebuilt.all().filter(f => f.kind === 'judgment-provider-ProviderJudgmentResolution')).toHaveLength(0);
    expect(value(rebuilt.graph.read(rebuilt.id)).pending).toHaveLength(1);
    expect(http.requests).toHaveLength(1); expect(rebuilt.calls()).toBe(0); expect(prepared.value.attempt).toBe(request.attempt);
  } finally { await http.close(); }
}, 90000);
