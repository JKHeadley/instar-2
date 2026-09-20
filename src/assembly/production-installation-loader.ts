import { decode } from '../index.js';
import type { BoundaryContext, DecodeContext, Json, Result, SecretRef } from '../index.js';
import { hashBytes, secretShape } from '../facts/index.js';
import type { MachineKey } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

export interface ProductionBootstrapPackage {
  readonly installation: string; readonly machine: string; readonly genesisHash: string; readonly generation: string;
  readonly trustRoots: readonly Json[]; readonly key: MachineKey; readonly signer: SecretRef;
}
declare class BootstrapIdentity { private readonly verifiedBootstrap: true }
export interface VerifiedProductionBootstrap extends BootstrapIdentity {
  readonly package: ProductionBootstrapPackage; readonly digest: string; readonly locator: string;
}
export interface InstallationImmutableIO {
  /** Resolve symlinks and return the actual location with its immutable bytes.
   * No history write, provider call, or activation occurs on this port. */
  read(locator: string): Result<Readonly<{ realPath: string; bytes: string }>>;
}
const verified = new WeakSet<object>();
const absolute = (path: string) => path.startsWith('/') && path !== '/'
  && path.slice(1).split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
export function isVerifiedProductionBootstrap(value: VerifiedProductionBootstrap): boolean { return verified.has(value); }
export function loadProductionBootstrap(input: Readonly<{ root: string; bootstrapLocator: string; expectedBootstrapDigest: string }>,
  io: InstallationImmutableIO, context: DecodeContext & BoundaryContext): Result<VerifiedProductionBootstrap> {
  return boundary('ProductionBootstrapLoad', null, context, () => {
    ensure(absolute(input.root) && absolute(input.bootstrapLocator), 'bootstrap: canonical absolute locations required');
    const outside = (path: string) => absolute(path) && path !== input.root && !path.startsWith(`${input.root}/`);
    ensure(outside(input.bootstrapLocator), 'bootstrap: locator must be outside authenticated root');
    ensure(/^sha256:[a-f0-9]{64}$/.test(input.expectedBootstrapDigest), 'bootstrap: external digest required');
    const loaded = take(io.read(input.bootstrapLocator));
    ensure(outside(loaded.realPath), 'bootstrap: resolved locator is inside authenticated root');
    ensure(loaded.bytes.length <= 1048576 && hashBytes(loaded.bytes) === input.expectedBootstrapDigest,
      'bootstrap: externally pinned digest differs');
    ensure(!secretShape(loaded.bytes), 'bootstrap: private credential bytes forbidden');
    // Digest verification precedes interpretation of every trust-root field.
    const value = JSON.parse(loaded.bytes) as ProductionBootstrapPackage;
    ensure(value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).sort().join(',') === 'generation,genesisHash,installation,key,machine,signer,trustRoots',
    'bootstrap: closed approved package required; signer-reference digests are forbidden');
    for (const field of ['installation', 'machine', 'generation']) {
      const content = (value as unknown as Record<string, unknown>)[field];
      ensure(typeof content === 'string' && content.length > 0 && content.length <= 4096, `bootstrap: invalid ${field}`);
    }
    ensure(/^sha256:[a-f0-9]{64}$/.test(value.genesisHash) && Array.isArray(value.trustRoots)
      && value.trustRoots.length > 0 && value.trustRoots.length <= 64, 'bootstrap: genesis and trust roots required');
    ensure(value.key && value.key.machine === value.machine && typeof value.key.id === 'string'
      && value.key.id.length > 0 && typeof value.key.publicKey === 'string'
      && value.key.publicKey.includes('PUBLIC KEY'), 'bootstrap: approved public machine key required');
    ensure(Object.keys(value.key).every(key => ['id', 'machine', 'publicKey', 'from', 'through'].includes(key)),
      'bootstrap: closed public key entry required');
    for (const point of [value.key.from, ...(value.key.through ? [value.key.through] : [])])
      ensure(point && Object.keys(point).sort().join(',') === 'epoch,position'
        && Number.isSafeInteger(point.epoch) && point.epoch >= 0
        && Number.isSafeInteger(point.position) && point.position >= 0, 'bootstrap: finite key range required');
    const signer = take(decode('SecretRef', value.signer, context));
    const result = freeze({ package: { ...value, signer }, digest: input.expectedBootstrapDigest,
      locator: loaded.realPath }) as VerifiedProductionBootstrap;
    // Freeze detached bytes; caller changes cannot alter the independently pinned input.
    ensure(encoded(result.package).bytes === encoded(value).bytes, 'bootstrap: decoded fields differ');
    verified.add(result); return result;
  });
}
