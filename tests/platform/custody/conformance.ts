import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** A platform implements the lifecycle; the fixture runs hostile operations as real
 * separate identities. An unprivileged fake must never be passed as this fixture. */
export interface CustodyConformanceFixture {
  install(variant?: 'valid' | 'signature' | 'content' | 'untrusted'): Promise<unknown> | unknown;
  verify(): Promise<{ digest: string; identities: { uid: number; gid: number }[] }> | { digest: string; identities: { uid: number; gid: number }[] };
  start(): Promise<{ pid: number; uid: number }>;
  request(request: object): Promise<{ state: string; bytes?: string[]; observations?: number }>;
  status(): Promise<{ state: string; pid?: number; uid?: number }>;
  stop(): Promise<void>;
  probe(identity: 'agent' | 'harness' | 'broker', operation: 'read-key' | 'write-entry' | 'replace-entry' | 'elevate' | 'administer'): { allowed: boolean; reason: string };
  tamper(): void;
  cleanup(): Promise<void>;
}
export function custodyConformance(label: string, setup: () => Promise<CustodyConformanceFixture>, unavailable?: string) {
  describe.skipIf(Boolean(unavailable))(`${label}${unavailable ? ` — NOT RUN: ${unavailable}` : ''}`, () => {
    let fixture: CustodyConformanceFixture;
    beforeAll(async () => { fixture = await setup(); }, 30000);
    afterAll(async () => { if (fixture) await fixture.cleanup(); }, 15000);
    it('rejects corrupt or untrusted distribution before placing an installation', async () => {
      for (const variant of ['signature', 'content', 'untrusted'] as const) {
        await expect(async () => fixture.install(variant)).rejects.toThrow();
        await expect(async () => fixture.verify()).rejects.toThrow();
      }
    });
    it('installs verified distribution with three distinct non-root identities', async () => {
      await fixture.install();
      const status = await fixture.verify();
      expect(status.digest).toMatch(/^[a-f0-9]{64}$/);
      expect(status.identities).toHaveLength(3);
      expect(status.identities.every(row => row.uid > 0 && row.gid > 0)).toBe(true);
      expect(new Set(status.identities.map(row => row.uid)).size).toBe(3);
    });
    it('starts as the broker and serves one harmless scoped custody request', async () => {
      const started = await fixture.start();
      expect(started.uid).toBe((await fixture.verify()).identities[0]!.uid);
      expect(await fixture.status()).toMatchObject({ state: 'running', ...started });
      expect(await fixture.request({ operation: 'read', scope: 'probe', maxBytes: 128 }))
        .toEqual({ state: 'allowed', bytes: ['Instar custody isolation challenge'], observations: 1 });
      for (const request of [{ operation: 'read', scope: 'keys', maxBytes: 128 },
        { operation: 'read', scope: 'probe', maxBytes: 1 }, { operation: 'read', scope: 'probe', maxBytes: 129 },
        { operation: 'export-key' }, { operation: 'read', scope: 'probe', maxBytes: 128, requester: 'root' }])
        expect(await fixture.request(request)).toEqual({ state: 'refused' });
    });
    it('the broker can read the private canary (positive control)', () => {
      expect(fixture.probe('broker', 'read-key')).toEqual({ allowed: true, reason: 'opened' });
    });
    for (const identity of ['agent', 'harness'] as const)
      for (const operation of ['read-key', 'write-entry', 'replace-entry', 'elevate', 'administer'] as const)
        it(`${identity} cannot ${operation}`, () => {
          expect(fixture.probe(identity, operation)).toEqual({ allowed: false, reason: 'kernel-denied' });
        });
    it('stop settles the exact started process; tampering is refused before restart', async () => {
      await fixture.stop(); expect((await fixture.status()).state).toBe('stopped');
      fixture.tamper();
      await expect(async () => fixture.verify()).rejects.toThrow();
      await expect(fixture.start()).rejects.toThrow();
    });
  });
}
