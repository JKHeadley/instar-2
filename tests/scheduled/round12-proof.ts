import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeLocalCapabilityPackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { clone, packageArchive, scheduledFixture, value } from './fixture.js';

export type Round12Decision = Readonly<{ status: 'accepted' | 'refused'; detail?: string }>;

function decision<T>(result: Result<T>): Round12Decision {
  return consumeResult<T, Round12Decision>(result, {
    Success: () => ({ status: 'accepted' }),
    Refused: refusal => ({ status: 'refused', detail: refusal.detail }),
  });
}

export type Round12ResourceKind = 'support' | 'second-valid' | 'second-missing-field'
  | 'second-trailing-comma' | 'second-truncated' | 'second-duplicate-type';

function resourceCase(kind: Round12ResourceKind) {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const second = clone(scheduled.manifest) as any; second.schedule.at = '2027-01-02T00:00:00Z';
  let bytes = JSON.stringify(second);
  if (kind === 'support') bytes = 'export const support = 1;\n';
  if (kind === 'second-missing-field') { delete second.bounds; bytes = JSON.stringify(second); }
  if (kind === 'second-trailing-comma') bytes = `${bytes.slice(0, -1)},}`;
  if (kind === 'second-truncated') bytes = bytes.slice(0, -1);
  if (kind === 'second-duplicate-type') bytes = bytes.replace('"type":"ScheduledWorkManifest"',
    '"type":"ScheduledWorkManifest","type":"support"');
  const input = clone(scheduled.package) as any;
  input.entrypoints.push({ id: 'extra-resource', path: 'data/extra.json', digest: hashBytes(bytes) });
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(input, assembly.c))));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: `transition:round12:${kind}:active`, operation: `operation:round12:${kind}:active`,
    package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
  const archive = packageArchive(pkg, { 'scheduled/manifest.json': scheduled.manifestBytes,
    'dist/maintenance.js': scheduled.bodyBytes, 'data/extra.json': bytes });
  const base = { package: pkg, archive, existingManifests: [] };
  const port = createScheduledWorkPackagePort();
  return {
    selectedPrimary: decision(port.admitPackageResource({ ...base, manifestPath: 'scheduled/manifest.json',
      manifestBytes: scheduled.manifestBytes }, assembly.c)),
    selectedAdditional: decision(port.admitPackageResource({ ...base, manifestPath: 'data/extra.json',
      manifestBytes: bytes }, assembly.c)),
  };
}

let cached: ReturnType<typeof buildP15Round12Proof> | undefined;

function buildP15Round12Proof() {
  const kinds: Round12ResourceKind[] = ['support', 'second-valid', 'second-missing-field',
    'second-trailing-comma', 'second-truncated', 'second-duplicate-type'];
  return { resources: Object.fromEntries(kinds.map(kind => [kind, resourceCase(kind)])) as
    Record<Round12ResourceKind, ReturnType<typeof resourceCase>> };
}

export function exerciseP15Round12Proof() {
  return cached ??= buildP15Round12Proof();
}
