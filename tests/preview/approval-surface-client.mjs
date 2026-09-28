// The runner's side of the independent approval surface (scripts/approval-surface.mjs). It implements
// the worker's `approvalSurface` port: `issue` writes a request into the agent's own outbox for the
// surface to render; `acts` and `verify` only READ the operator-owned store, which the agent's OS
// identity cannot write, and re-verify each act's passkey signature over the exact challenge. The agent
// holds no key that could produce an approval (Purpose: the agent never administers its own safeguards).
import { randomBytes } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ACT_RECORD, actChallenge, canonical, check, checkChallenge, nameFor, readOwnedFile, SURFACE, SURFACE_LIMITS, verifyAssertion,
  writeOnce } from '../../scripts/approval-surface-core.mjs';
import { refusal, success } from '../../src/types/internal.js';

export function createApprovalSurfaceClient({ store, outbox, operatorUid, agentUid = process.getuid(), now }) {
  const storeDir = resolve(store), outboxDir = resolve(outbox), actsDir = join(storeDir, 'acts');
  const stat = lstatSync(outboxDir);
  check(realpathSync(outboxDir) === outboxDir && stat.isDirectory() && (stat.mode & 0o022) === 0,
    'approval outbox must be a directory only its owner can write');
  check(Number.isSafeInteger(operatorUid) && operatorUid !== agentUid, 'approval surface must run under another OS identity');
  const read = path => readOwnedFile(path, operatorUid, agentUid);
  /** The operator's published page description and enrolled passkeys; refused unless operator-owned. */
  const surface = () => {
    const described = JSON.parse(read(join(storeDir, 'surface.json'))), keys = JSON.parse(read(join(storeDir, 'keys.json')));
    check(described?.type === 'PreviewApprovalSurface' && typeof described.origin === 'string' && described.origin.startsWith('https://')
      && typeof described.rpId === 'string' && /^[a-f0-9]{32}$/u.test(described.token ?? '') && typeof described.operator === 'string'
      && Array.isArray(keys), 'approval surface description invalid');
    return { ...described, keys };
  };
  const wordings = new Map();
  const guard = (run, owner) => { try { return run(); } catch (error) {
    return refusal(`approval surface: ${error instanceof Error ? error.message : 'refused'}`, owner); } };
  const verifier = Object.freeze({ owner: 'part-nine', administration: 'independent',
    issue: subject => guard(() => {
      const page = surface(), at = now();
      check(page.operator === subject?.operator, 'operator differs from the surface');
      check(page.keys.length > 0, 'no operator passkey enrolled');
      const text = subject.action === 'raise-caps' ? wordings.get(subject.renderingDigest) : undefined;
      check(subject.action !== 'raise-caps' || typeof text === 'string', 'request wording missing');
      const challenge = checkChallenge({ ...subject, id: `challenge:${randomBytes(32).toString('hex')}` },
        { operator: page.operator, maxLifetime: SURFACE_LIMITS.maxLifetime, now: at });
      // The outbox stays bounded: lapsed requests are removed, and a full outbox refuses (Rule 60).
      let open = 0;
      for (const file of readdirSync(outboxDir).filter(name => name.endsWith('.request.json'))) {
        let expired = true;
        try { expired = JSON.parse(readFileSync(join(outboxDir, file), 'utf8')).challenge.expiresAt <= at; } catch { expired = true; }
        if (expired) unlinkSync(join(outboxDir, file)); else open++;
      }
      check(open < SURFACE_LIMITS.maxRequests, 'request outbox full');
      writeOnce(outboxDir, `${nameFor(challenge.id)}.request.json`, canonical({ challenge, ...(text === undefined ? {} : { text }) }), 0o644);
      return success(Object.freeze(challenge));
    }, 'preview:approval-surface'),
    verify: (challenge, proof, decision) => guard(() => {
      const page = surface(), record = JSON.parse(proof);
      check(record?.type === ACT_RECORD && canonical(record.challenge) === canonical(challenge) && record.decision === decision
        && (decision === 'approve' || decision === 'decline' && challenge.action !== 'emergency-stop'), 'act differs from the exact challenge or decision');
      check(challenge.surface === SURFACE && challenge.operator === page.operator && now() < challenge.expiresAt, 'challenge expired or foreign');
      verifyAssertion({ keys: page.keys, origin: page.origin, rpId: page.rpId,
        expected: actChallenge(challenge, decision, record.nonce), assertion: record.assertion });
      // One use on this side too: a consumed act is never applied twice, even across a crash.
      try { writeOnce(outboxDir, `${nameFor(challenge.id)}.consumed`, canonical({ decision }), 0o600); }
      catch { throw Error('act already consumed'); }
      return success(Object.freeze({ challenge: challenge.id, principal: { id: challenge.operator, kind: 'person' },
        provenance: { class: 'verified', adapter: SURFACE,
          record: { reference: `approval-surface:${nameFor(challenge.id)}`, hash: `sha256:${nameFor(proof)}` } },
        // A verified yes to a raise is the operator's authorization for exactly this subject; a stop never carries one.
        act: decision === 'approve' && challenge.audience !== 'independent-emergency-stop'
          ? { type: 'Authorization', request: challenge.request, requestDigest: challenge.requestDigest } : null,
        capture: { reference: `approval-surface:${nameFor(challenge.id)}` } }));
    }, 'preview:approval-surface'),
  });
  return Object.freeze({ verifier,
    /** The exact wording a raise will show, handed over before its challenge is issued. */
    wording: (renderingDigest, text) => { wordings.clear(); wordings.set(renderingDigest, text); },
    link: challenge => { const page = surface(); return `${page.origin}/${page.token}/c/${nameFor(challenge.id)}`; },
    /** Acts the operator recorded on the surface and this runner has not consumed yet (bounded). */
    acts: () => {
      if (!existsSync(actsDir)) return [];
      const at = now();
      return readdirSync(actsDir).filter(file => /^[a-f0-9]{64}\.json$/u.test(file)
        && !existsSync(join(outboxDir, `${file.slice(0, 64)}.consumed`))).flatMap(file => {
        try { const proof = read(join(actsDir, file)), record = JSON.parse(proof);
          return typeof record?.challenge?.id === 'string' && nameFor(record.challenge.id) === file.slice(0, 64)
            && record.challenge.expiresAt > at ? [{ at: record.at, act: { challenge: record.challenge.id, proof, decision: record.decision } }] : [];
        } catch { return []; }
      }).sort((a, b) => b.at - a.at).slice(0, 256).map(item => item.act);
    },
    /** Pull-only status: whether the page is installed and can approve right now. */
    status: () => { try { const page = surface(); return { installed: true, page: `${page.origin}/${page.token}/`,
      passkeys: page.keys.length, ready: page.keys.length > 0 }; }
    catch (error) { return { installed: true, ready: false, reason: error instanceof Error ? error.message : 'unreadable' }; } },
  });
}
