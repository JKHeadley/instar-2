// Rules 2, 28, 98; Purpose "the agent never administers its own safeguards, except for approval-account access
// expressly accepted by the operator"; Part One's account-assented condition. Reads the desk-written explicit-yes
// installation record (`--explicit-yes-installation`) exactly: every fact is required and none is defaulted. For the
// GitHub approving account the record holds EITHER the P-02 fact that the agent holds no access, OR the operator's
// recorded acceptance of the agent's access {account, installation, operator message references, acceptedAt,
// withdrawn}; never both. The launcher reads the file afresh on every use, so a withdrawal the desk records (on the
// operator's word) stops consumption from the next poll. Anything malformed is refused whole.
import type { ExplicitYesInstallation, OperatorAcceptance } from '../../src/operator/explicit-yes.js';

const text = (value: unknown, name: string, pattern?: RegExp): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 512 || (pattern && !pattern.test(value)))
    throw Error(`preview: explicit-yes installation: invalid ${name}`);
  return value;
};
const flag = (value: unknown, name: string): boolean => {
  if (typeof value !== 'boolean') throw Error(`preview: explicit-yes installation: ${name} must be stated (true or false)`);
  return value;
};
const instant = (value: unknown, name: string): number => {
  const at = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/u.test(value) ? Date.parse(value) : Number.NaN;
  if (!Number.isSafeInteger(at) || at <= 0) throw Error(`preview: explicit-yes installation: invalid ${name}`);
  return at;
};
const only = (value: Record<string, unknown>, keys: readonly string[], name: string) => {
  const extra = Object.keys(value).filter(key => !keys.includes(key));
  if (extra.length) throw Error(`preview: explicit-yes installation: unknown ${name} field ${extra[0]!}`);
};
const object = (value: unknown, name: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`preview: explicit-yes installation: invalid ${name}`);
  return value as Record<string, unknown>;
};

function acceptanceOf(value: unknown): OperatorAcceptance | null {
  if (value === null) return null;
  const a = object(value, 'acceptance');
  only(a, ['account', 'installation', 'operatorMessages', 'acceptedAt', 'withdrawn'], 'acceptance');
  if (!Array.isArray(a.operatorMessages) || !a.operatorMessages.length || a.operatorMessages.length > 16)
    throw Error('preview: explicit-yes installation: an acceptance cites the operator\'s recorded messages');
  if (!('withdrawn' in a)) throw Error('preview: explicit-yes installation: an acceptance states withdrawn (null or when)');
  return Object.freeze({ account: text(a.account, 'acceptance account'), installation: text(a.installation, 'acceptance installation'),
    operatorMessages: Object.freeze(a.operatorMessages.map(item => text(item, 'operator message reference'))),
    acceptedAt: instant(a.acceptedAt, 'acceptedAt'), withdrawn: a.withdrawn === null ? null : instant(a.withdrawn, 'withdrawn') });
}

/** The record, exactly as written, or a refusal naming the first wrong field. */
export function parseExplicitYesInstallation(raw: string): ExplicitYesInstallation {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw Error('preview: explicit-yes installation: not JSON'); }
  const r = object(value, 'record');
  only(r, ['type', 'schemaVersion', 'installation', 'adapter', 'machine', 'agentSpeaksAsOperatorInChat', 'chat', 'github'], 'record');
  if (r.type !== 'ExplicitYesInstallation' || r.schemaVersion !== 1) throw Error('preview: explicit-yes installation: not an ExplicitYesInstallation v1');
  const chat = object(r.chat, 'chat');
  only(chat, ['method', 'boundChatId', 'operatorAccountId', 'agentHoldsNoAccess'], 'chat');
  if (!('github' in r)) throw Error('preview: explicit-yes installation: github must be stated (null or the account)');
  let github: ExplicitYesInstallation['github'] = null;
  if (r.github !== null) {
    const g = object(r.github, 'github');
    only(g, ['method', 'repository', 'operatorLogin', 'agentHoldsNoAccess', 'acceptance'], 'github');
    if (!('acceptance' in g)) throw Error('preview: explicit-yes installation: github.acceptance must be stated (null or the acceptance)');
    const acceptance = acceptanceOf(g.acceptance), noAccess = flag(g.agentHoldsNoAccess, 'github.agentHoldsNoAccess');
    if (noAccess && acceptance !== null && acceptance.withdrawn === null)
      throw Error('preview: explicit-yes installation: github states both that the agent holds no access and an accepted access');
    github = Object.freeze({ method: text(g.method, 'github method'), repository: text(g.repository, 'github repository', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u),
      operatorLogin: text(g.operatorLogin, 'github operatorLogin', /^[A-Za-z0-9-]+$/u), agentHoldsNoAccess: noAccess, acceptance });
  }
  return Object.freeze({ installation: text(r.installation, 'installation'), adapter: text(r.adapter, 'adapter'), machine: text(r.machine, 'machine'),
    agentSpeaksAsOperatorInChat: flag(r.agentSpeaksAsOperatorInChat, 'agentSpeaksAsOperatorInChat'),
    chat: Object.freeze({ method: text(chat.method, 'chat method'), boundChatId: text(chat.boundChatId, 'chat boundChatId'),
      operatorAccountId: text(chat.operatorAccountId, 'chat operatorAccountId'), agentHoldsNoAccess: flag(chat.agentHoldsNoAccess, 'chat.agentHoldsNoAccess') }),
    github });
}
