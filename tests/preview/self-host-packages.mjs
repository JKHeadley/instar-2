// Rules 26, 44, 68, 90, 115 (D14 §9): the local-capability package lifecycle, on the owners'
// records. Staging is the core `stageLocalCapability`; every package and transition is an
// owner-decoded `LocalCapabilityPackage` / `PackageTransition` in the durable record log; the
// current version is whatever the owner's `resolveActivePackage` resolves. Artifact bytes are
// immutable and content-addressed; a candidate is exercised in confinement before any switch;
// a failed candidate is inhibited and the prior version re-proven and kept active.
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hashBytes } from '../../src/facts/index.js';
import { resolveActivePackage, stageLocalCapability } from '../../src/assembly/index.js';

const take = result => { if (result.kind !== 'Success') throw Error(`self-host: refused ${result.detail ?? ''}`); return result.value; };
const fsyncPath = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
const probeOf = pkg => JSON.parse(pkg.probes[0]);

/** The package record for a declaration over exact archive bytes (inert until staged and switched). */
export function packageRecord(declaration, archive, prior, tests) {
  const contentDigest = hashBytes(JSON.stringify(archive.map(entry => [entry.path, entry.digest])));
  return { type: 'LocalCapabilityPackage', schemaVersion: 1, id: `package:${declaration.namespace}@${declaration.version}:${contentDigest.slice(7, 19)}`,
    predecessors: [], dependencyFacts: [], namespace: declaration.namespace, ownerPrincipal: 'agent', version: declaration.version,
    contentDigest, sourceDigest: contentDigest, parent: '', upstream: '', priorPackage: prior?.id ?? '',
    portRequirements: [{ port: 'OperationAdapterPort', version: '1' }], dependencies: [],
    entrypoints: archive.map((entry, index) => ({ id: declaration.entrypoints[index].id, path: entry.path, digest: entry.digest })),
    declarationIds: [`${declaration.namespace}.operation`], dataScopes: ['workspace'], custodyScopes: [], grants: ['local-install'],
    resources: [{ resource: 'wall-ms', limit: 20000 }], platforms: [`${process.platform}-${process.arch}`], modes: ['governed'],
    migrationCompatibility: ['none'], rollbackCompatibility: prior ? [prior.version] : [declaration.version],
    // Declared checks: the package's own tests, its confined entrypoint probe and its activation.
    checks: { unit: tests.map(file => file.path), integration: [`confined-probe:${declaration.probe.entrypoint}.${declaration.probe.export}`],
      lifecycle: [`activation:${declaration.namespace}`] }, maturation: ['dark'],
    probes: [JSON.stringify({ entrypoint: declaration.probe.entrypoint, export: declaration.probe.export, input: declaration.probe.input ?? null,
      expect: declaration.probe.expect ?? null, tests: tests.map(file => ({ path: file.path, digest: file.digest })) })],
    awarenessSource: `${declaration.namespace}.operation` };
}

export function createPackageLifecycle({ context, log, harness, stopped, work }) {
  const store = join(harness.release.release, 'packages');
  const packages = () => log.records().filter(record => record.type === 'LocalCapabilityPackage');
  const transitions = namespace => log.records().filter(record => record.type === 'PackageTransition' && record.package === namespace);
  const head = namespace => { const all = transitions(namespace), superseded = new Set(all.flatMap(row => [...row.predecessors, ...row.dependencyFacts]));
    const heads = all.filter(row => !superseded.has(row.id)); return heads.length === 1 ? heads[0] : heads.length ? 'ambiguous' : null; };
  const active = namespace => { const resolved = resolveActivePackage(namespace, log.rows(), context); return resolved.kind === 'Success' ? resolved.value : null; };
  const directory = pkg => join(store, pkg.contentDigest.slice(7));

  /** Immutable, content-addressed bytes: written once (fsynced, then renamed into place), never overwritten. */
  const retain = (pkg, archive, tests) => {
    const target = directory(pkg);
    if (existsSync(target)) { verify(pkg); return target; }
    const pending = join(store, `.pending-${randomUUID()}`);
    for (const entry of [...archive, ...tests]) {
      const path = join(pending, entry.path); mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const fd = openSync(path, 'wx', 0o400); try { writeFileSync(fd, entry.bytes, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
    }
    mkdirSync(store, { recursive: true, mode: 0o700 }); renameSync(pending, target); fsyncPath(store);
    return target;
  };
  const verify = pkg => { for (const entry of [...pkg.entrypoints, ...probeOf(pkg).tests]) {
    const path = join(directory(pkg), entry.path);
    if (!existsSync(path) || hashBytes(readFileSync(path, 'utf8')) !== entry.digest) throw Error(`self-host: retained artifact ${pkg.id} changed`);
  } };

  /** Exercise exact retained bytes in confinement: the package's tests over them, then its entrypoint probe. */
  const exercise = pkg => {
    verify(pkg);
    const probe = probeOf(pkg);
    const retained = [...pkg.entrypoints, ...probe.tests].map(entry => ({ path: entry.path, bytes: readFileSync(join(directory(pkg), entry.path), 'utf8') }));
    const tested = probe.tests.length ? harness.run({ mode: 'confined', kind: 'test', tool: 'package-test', work,
      directory: harness.stageWork(retained), files: probe.tests.map(file => file.path) }) : null;
    const entry = pkg.entrypoints.find(item => item.id === probe.entrypoint);
    if (!entry) throw Error('self-host: probe names no entrypoint');
    const probed = harness.run({ mode: 'confined', kind: 'probe', tool: 'probe', work, entry: join(directory(pkg), entry.path), export: probe.export, input: probe.input });
    const line = probed.stdout?.split('\n').find(text => text.startsWith('@probe '));
    let actual; try { actual = line ? JSON.parse(line.slice(7)).value : undefined; } catch { actual = undefined; }
    const probePassed = !probed.refused && probed.code === 0 && line !== undefined && JSON.stringify(actual) === JSON.stringify(probe.expect);
    const testsPassed = tested === null || (!tested.refused && tested.code === 0);
    return { passed: probePassed && testsPassed, tested, probed, actual,
      testEvidence: tested && testsPassed ? [tested.observation] : [], probeEvidence: probePassed ? [probed.observation] : [] };
  };

  const transition = (pkg, from, to, predecessors, evidence, prior, cause) => log.append({ type: 'PackageTransition', schemaVersion: 1,
    id: `transition:${pkg.namespace}:${randomUUID()}`, predecessors, dependencyFacts: [], package: pkg.namespace, manifestDigest: pkg.contentDigest,
    priorActiveDigest: prior?.contentDigest ?? '', machine: 'local', scope: 'workspace', cause, responsiblePrincipal: 'agent', grants: ['local-install'],
    generation: 'self-host:generation:1', testEvidence: evidence.testEvidence, migrationEvidence: [], probeEvidence: evidence.probeEvidence,
    operation: `operation:switch:${randomUUID()}`, claim: `claim:${work}`, observedArtifactDigest: pkg.contentDigest, from, to, outstandingWork: [] });
  const byDigest = digest => packages().find(pkg => pkg.contentDigest === digest) ?? null;
  const lastActive = pkg => transitions(pkg.namespace).filter(row => row.to === 'active' && row.observedArtifactDigest === pkg.contentDigest).at(-1);

  /** Re-prove a retained earlier version and make it the head again (rollback). */
  const restore = (prior, after) => {
    const proven = exercise(prior);
    if (!proven.passed) return null;
    return transition(prior, 'activating', 'active', [after.id], { testEvidence: lastActive(prior)?.testEvidence ?? proven.testEvidence,
      probeEvidence: proven.probeEvidence }, null, 'rollback: the replacement was inhibited');
  };

  return Object.freeze({
    active, head, directory, exercise,
    /** Stage (inert): the core stager over exact bytes, refusing a version label that already names other bytes. */
    stage(declaration, archive, tests) {
      if (tests.length === 0) throw Error('self-host: a package needs its own tests before it can be activated');
      if (tests.some(file => archive.some(entry => entry.path === file.path) || hashBytes(file.bytes) !== file.digest)) throw Error('self-host: package tests malformed');
      const record = packageRecord(declaration, archive, active(declaration.namespace), tests);
      const clash = packages().find(pkg => pkg.namespace === record.namespace && pkg.version === record.version && pkg.contentDigest !== record.contentDigest);
      if (clash) throw Error(`self-host: ${record.namespace}@${record.version} already names different immutable bytes`);
      return { ...take(stageLocalCapability(record, archive, packages().filter(pkg => pkg.namespace !== record.namespace), context)), tests };
    },
    /** Install: retain bytes, record the package, exercise in confinement, then switch — or inhibit and keep the prior version. */
    install(staged, { crashAfterActivating = false } = {}) {
      if (stopped()) throw Error('self-host: stop latched before install');
      const pkg = staged.package, prior = active(pkg.namespace), current = head(pkg.namespace);
      if (current === 'ambiguous') throw Error('self-host: package history ambiguous');
      retain(pkg, staged.entries, staged.tests ?? []);
      if (!packages().some(item => item.id === pkg.id)) log.append(pkg);
      const evidence = exercise(pkg);
      if (!evidence.passed) {
        const inhibited = transition(pkg, 'staged', 'inhibited', current ? [current.id] : [], evidence, prior, 'exercise failed');
        const restored = prior ? restore(prior, inhibited) : null;
        return { passed: false, inhibited: inhibited.id, active: restored ? prior.contentDigest : null, evidence };
      }
      if (stopped()) throw Error('self-host: stop latched before activation');
      const activating = transition(pkg, 'eligible', 'activating', current ? [current.id] : [], evidence, prior, 'exercised in confinement');
      if (crashAfterActivating) throw Object.assign(Error('self-host: simulated crash during activation'), { cut: true });
      transition(pkg, 'activating', 'active', [activating.id], evidence, prior, 'activation observed');
      return { passed: true, active: pkg.contentDigest, evidence };
    },
    /** Complete or roll back every interrupted switch (run before new work). */
    recover() {
      const namespaces = [...new Set(packages().map(pkg => pkg.namespace))], outcomes = [];
      for (const namespace of namespaces) {
        const current = head(namespace);
        if (!current || current === 'ambiguous' || current.to === 'active' || current.to === 'retired') continue;
        const pkg = byDigest(current.observedArtifactDigest), prior = current.priorActiveDigest ? byDigest(current.priorActiveDigest) : null;
        if (current.to === 'activating' && pkg) {
          const evidence = exercise(pkg);
          if (evidence.passed) { transition(pkg, 'activating', 'active', [current.id], evidence, prior, 'recovered interrupted activation'); outcomes.push({ namespace, completed: pkg.contentDigest }); continue; }
          const inhibited = transition(pkg, 'activating', 'inhibited', [current.id], evidence, prior, 'recovery exercise failed');
          outcomes.push({ namespace, inhibited: pkg.contentDigest, restored: prior && restore(prior, inhibited) ? prior.contentDigest : null }); continue;
        }
        if (current.to === 'inhibited' && prior) outcomes.push({ namespace, restored: restore(prior, current) ? prior.contentDigest : null });
      }
      return outcomes;
    },
  });
}
