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
import { decodeAssemblyRecord, resolveActivePackage, stageLocalCapability } from '../../src/assembly/index.js';

const take = result => { if (result.kind !== 'Success') throw Error(`self-host: refused ${result.detail ?? ''}`); return result.value; };
const fsyncPath = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
const probeOf = pkg => JSON.parse(pkg.probes[0]);

/**
 * Rules 26, 90 (D14 §9): the immutable package identity is the whole package — its declaration
 * (namespace, version, entrypoints and probe) and every retained executable and test byte — so two
 * versions with the same code are two packages. `sourceDigest` is the entrypoint bytes alone.
 */
export function packageIdentity(declaration, archive, tests) {
  return hashBytes(JSON.stringify({ namespace: declaration.namespace, version: declaration.version,
    entrypoints: archive.map((entry, index) => [declaration.entrypoints[index].id, entry.path, entry.digest]),
    probe: { entrypoint: declaration.probe.entrypoint, export: declaration.probe.export, input: declaration.probe.input ?? null,
      expect: declaration.probe.expect ?? null }, tests: tests.map(file => [file.path, file.digest]) }));
}

/** The package record for a declaration over exact archive bytes (inert until staged and switched). */
export function packageRecord(declaration, archive, prior, tests) {
  const contentDigest = packageIdentity(declaration, archive, tests), sourceDigest = hashBytes(JSON.stringify(archive.map(entry => [entry.path, entry.digest])));
  return { type: 'LocalCapabilityPackage', schemaVersion: 1, id: `package:${declaration.namespace}@${declaration.version}:${contentDigest.slice(7, 19)}`,
    predecessors: [], dependencyFacts: [], namespace: declaration.namespace, ownerPrincipal: 'agent', version: declaration.version,
    contentDigest, sourceDigest, parent: '', upstream: '', priorPackage: prior?.id ?? '',
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

  /** One confined probe of exact retained bytes: the entrypoint export called with the declared input. */
  const probe = async pkg => {
    verify(pkg);
    const declared = probeOf(pkg), entry = pkg.entrypoints.find(item => item.id === declared.entrypoint);
    if (!entry) throw Error('self-host: probe names no entrypoint');
    const probed = await harness.run({ mode: 'confined', kind: 'probe', tool: 'probe', work, entry: join(directory(pkg), entry.path), export: declared.export, input: declared.input });
    const line = probed.stdout?.split('\n').find(text => text.startsWith('@probe '));
    let actual; try { actual = line ? JSON.parse(line.slice(7)).value : undefined; } catch { actual = undefined; }
    const passed = !probed.refused && probed.code === 0 && line !== undefined && JSON.stringify(actual) === JSON.stringify(declared.expect);
    return { passed, probed, actual, probeEvidence: passed ? [probed.observation] : [] };
  };
  /** Exercise exact retained bytes in confinement: the package's tests over them, then its entrypoint probe. */
  const exercise = async pkg => {
    verify(pkg);
    const declared = probeOf(pkg);
    const retained = [...pkg.entrypoints, ...declared.tests].map(entry => ({ path: entry.path, bytes: readFileSync(join(directory(pkg), entry.path), 'utf8') }));
    const tested = declared.tests.length ? await harness.run({ mode: 'confined', kind: 'test', tool: 'package-test', work,
      directory: harness.stageWork(retained), files: declared.tests.map(file => file.path) }) : null;
    const probed = await probe(pkg);
    const testsPassed = tested === null || (!tested.refused && tested.code === 0);
    return { ...probed, passed: probed.passed && testsPassed, tested, testEvidence: tested && testsPassed ? [tested.observation] : [] };
  };

  /**
   * D14 §9: every lifecycle step names the six/eight operation that caused it — the admitted launch
   * (its Six operation and the consumed dispatch claim) that exercised or observed this exact package.
   * A step with no admitted launch behind it is refused, never given an invented reference.
   */
  const causeOf = (...runs) => {
    const run = runs.find(item => item && !item.refused && item.operation && item.claim);
    if (!run) throw Error('self-host: no admitted operation stands behind this lifecycle step');
    return { operation: run.operation, claim: run.claim };
  };
  const draft = (pkg, from, to, predecessors, evidence, prior, cause, admitted) => ({ type: 'PackageTransition', schemaVersion: 1,
    id: `transition:${pkg.namespace}:${randomUUID()}`, predecessors, dependencyFacts: [], package: pkg.namespace, manifestDigest: pkg.contentDigest,
    priorActiveDigest: prior?.contentDigest ?? '', machine: 'local', scope: 'workspace', cause, responsiblePrincipal: 'agent', grants: ['local-install'],
    generation: 'self-host:generation:1', testEvidence: evidence.testEvidence, migrationEvidence: [], probeEvidence: evidence.probeEvidence,
    operation: admitted.operation, claim: admitted.claim, observedArtifactDigest: pkg.contentDigest, from, to, outstandingWork: [] });
  const transition = (...args) => log.append(draft(...args));
  const byDigest = digest => packages().find(pkg => pkg.contentDigest === digest) ?? null;
  /** The owner's resolution must name exactly this package before a switch counts as done. */
  const resolvesTo = pkg => active(pkg.namespace)?.contentDigest === pkg.contentDigest;
  /** Whether the owner would resolve this package if the candidate switch were recorded (nothing is written). */
  const wouldResolve = (pkg, candidate) => {
    const decoded = take(decodeAssemblyRecord('PackageTransition', candidate, context));
    const resolved = resolveActivePackage(pkg.namespace, [...log.rows(), { fact: { id: decoded.id, kind: 'assembly-PackageTransition' }, record: decoded,
      taint: [], conflicts: [] }], context);
    return resolved.kind === 'Success' && resolved.value.contentDigest === pkg.contentDigest;
  };
  const lastActive = pkg => transitions(pkg.namespace).filter(row => row.to === 'active' && row.observedArtifactDigest === pkg.contentDigest).at(-1);
  /**
   * Record `active` only when the owner will resolve exactly this package from it, and confirm that
   * it does after the write; otherwise nothing reports the switch as done.
   */
  const commitActive = candidate => {
    const pkg = byDigest(candidate.observedArtifactDigest) ?? { namespace: candidate.package, contentDigest: candidate.observedArtifactDigest };
    if (!wouldResolve(pkg, candidate)) return null;
    const written = log.append(candidate);
    return resolvesTo(pkg) ? written : null;
  };

  /** Re-prove a retained earlier version and make it the head again (rollback); null unless the owner then resolves it. */
  const restore = async (prior, after) => {
    const proven = await exercise(prior);
    if (!proven.passed) return null;
    return commitActive(draft(prior, 'activating', 'active', [after.id], { testEvidence: lastActive(prior)?.testEvidence ?? proven.testEvidence,
      probeEvidence: proven.probeEvidence }, null, 'rollback: the replacement was inhibited', causeOf(proven.probed)));
  };
  /**
   * The switch (D14 §9 activating): observe the exact retained artifact in confinement, then record
   * `active` only if the owner resolves it. An unobservable or unresolvable switch is inhibited under
   * that observation's operation and the prior usable version is restored, in this same step.
   */
  const activate = async (pkg, after, prior, testEvidence, cause) => {
    const observed = await probe(pkg);
    const admitted = causeOf(observed.probed);
    if (observed.passed && commitActive(draft(pkg, 'activating', 'active', [after.id], { testEvidence, probeEvidence: observed.probeEvidence }, prior, cause, admitted)))
      return { completed: true, evidence: observed };
    const head = transitions(pkg.namespace).find(row => row.predecessors.includes(after.id) && row.to === 'active');
    // A written-but-unresolved active head (the owner changed between check and write) is inhibited under a fresh observation.
    const inhibited = head ? transition(pkg, 'active', 'inhibited', [head.id], { testEvidence: [], probeEvidence: [] }, prior,
      'owner resolution refused the switch', causeOf((await probe(pkg)).probed))
      : transition(pkg, 'activating', 'inhibited', [after.id], { testEvidence: [], probeEvidence: [] }, prior,
        observed.passed ? 'owner resolution refused the switch' : 'the switch observation failed', admitted);
    const restored = prior ? await restore(prior, inhibited) : null;
    return { completed: false, inhibited: inhibited.id, restored: restored ? prior.contentDigest : null, evidence: observed };
  };

  return Object.freeze({
    active, head, directory, exercise, probe,
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
    async install(staged, { crashAfterActivating = false } = {}) {
      if (stopped()) throw Error('self-host: stop latched before install');
      const pkg = staged.package, prior = active(pkg.namespace), current = head(pkg.namespace);
      if (current === 'ambiguous') throw Error('self-host: package history ambiguous');
      retain(pkg, staged.entries, staged.tests ?? []);
      if (!packages().some(item => item.id === pkg.id)) log.append(pkg);
      const evidence = await exercise(pkg);
      if (!evidence.passed) {
        const inhibited = transition(pkg, 'staged', 'inhibited', current ? [current.id] : [], evidence, prior, 'exercise failed', causeOf(evidence.probed, evidence.tested));
        const restored = prior ? await restore(prior, inhibited) : null;
        return { passed: false, inhibited: inhibited.id, active: restored ? prior.contentDigest : null, evidence };
      }
      if (stopped()) throw Error('self-host: stop latched before activation');
      const activating = transition(pkg, 'eligible', 'activating', current ? [current.id] : [], evidence, prior, 'exercised in confinement', causeOf(evidence.probed));
      if (crashAfterActivating) throw Object.assign(Error('self-host: simulated crash during activation'), { cut: true });
      const switched = await activate(pkg, activating, prior, evidence.testEvidence, 'activation observed');
      // The owner cannot resolve the switch: never report success; the prior usable version is kept.
      if (!switched.completed) return { passed: false, inhibited: switched.inhibited, active: switched.restored, evidence };
      return { passed: true, active: pkg.contentDigest, evidence };
    },
    /**
     * Complete or roll back every interrupted switch, and repair an active head the owner cannot
     * resolve (run before new work). `completed` is reported only when the owner resolves the package.
     */
    async recover() {
      const namespaces = [...new Set(packages().map(pkg => pkg.namespace))], outcomes = [];
      for (const namespace of namespaces) {
        const current = head(namespace);
        if (!current || current === 'ambiguous' || current.to === 'retired') continue;
        const pkg = byDigest(current.observedArtifactDigest), prior = current.priorActiveDigest ? byDigest(current.priorActiveDigest) : null;
        if (current.to === 'active') {
          if (active(namespace)) continue;
          // An active label the owner cannot resolve is not a usable version: inhibit it and restore the prior one. The
          // inhibition names a real admitted launch — a fresh observation of that package, or else the rollback's own
          // re-proof of the prior version; with neither, nothing is written and the head is reported unresolved.
          const observed = pkg ? await probe(pkg).catch(() => null) : null;
          const proven = observed && !observed.probed.refused ? null : prior ? await exercise(prior).catch(() => null) : null;
          const cause = observed && !observed.probed.refused ? observed.probed : proven?.passed && proven.tested ? proven.tested : null;
          if (!cause) { outcomes.push({ namespace, unresolved: current.observedArtifactDigest }); continue; }
          const inhibited = transition(pkg ?? { namespace, contentDigest: current.observedArtifactDigest }, 'active', 'inhibited', [current.id],
            { testEvidence: [], probeEvidence: [] }, prior, 'owner resolution refused the active head', causeOf(cause));
          const restored = !prior ? null : proven ? commitActive(draft(prior, 'activating', 'active', [inhibited.id], { testEvidence: lastActive(prior)?.testEvidence
            ?? proven.testEvidence, probeEvidence: proven.probeEvidence }, null, 'rollback: the replacement was inhibited', causeOf(proven.probed)))
            : await restore(prior, inhibited);
          outcomes.push({ namespace, inhibited: current.observedArtifactDigest, restored: restored ? prior.contentDigest : null }); continue;
        }
        if (current.to === 'activating' && pkg) {
          const switched = await activate(pkg, current, prior, current.testEvidence, 'recovered interrupted activation');
          outcomes.push(switched.completed ? { namespace, completed: pkg.contentDigest }
            : { namespace, inhibited: pkg.contentDigest, restored: switched.restored }); continue;
        }
        if (current.to === 'inhibited' && prior) outcomes.push({ namespace, restored: await restore(prior, current) ? prior.contentDigest : null });
      }
      return outcomes;
    },
  });
}
