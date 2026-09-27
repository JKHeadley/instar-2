// Read the agent server's own append-only message logs. The preview journal is the
// only writer: source offsets are journal frames, never sidecar bookmarks.
import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { importChannelFixture } from './journal.js';

const PASS_BYTES = 256 * 1024;
const PASS_LINES = 64;

export function agentState(root) {
  if (!root || resolve(root) !== root || basename(root) !== '.instar' || realpathSync(root) !== root
    || lstatSync(root).isSymbolicLink() || basename(dirname(dirname(root))) !== 'agents'
    || !basename(dirname(root)))
    throw Error('preview: agent state directory refused');
  return { root, agent: basename(dirname(root)) };
}

function boundChannels(root, agent, source) {
  const path = join(root, source === 'slack' ? 'slack-channel-registry.json' : 'topic-session-registry.json');
  if (!existsSync(path)) {
    if (source === 'slack') throw Error('preview: Slack registry unavailable');
    return new Set();
  }
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw Error('preview: channel registry refused');
    const bytes = Buffer.alloc(1024 * 1024 + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, length);
      if (!count) break;
      length += count;
    }
    if (length > 1024 * 1024) throw Error('preview: channel registry refused');
    const raw = JSON.parse(bytes.subarray(0, length).toString('utf8'));
    return new Set(Object.entries(source === 'slack' ? raw.channelToSession ?? {} : raw.topicToSession ?? {})
      .filter(([, value]) => (source === 'slack' ? value?.sessionName : value)?.startsWith?.(`${agent}-`))
      .map(([channel]) => channel));
  } finally { closeSync(fd); }
}

function channelRow(source, raw, agent, previewChat, channels) {
  if (!raw || typeof raw !== 'object' || raw.fromUser !== true || typeof raw.text !== 'string'
    || !raw.text.trim() || typeof raw.timestamp !== 'string') return null;
  const at = Date.parse(raw.timestamp);
  if (!Number.isSafeInteger(at) || at <= 0) return null;
  if (source === 'telegram') {
    const topic = raw.topicId ?? raw.channelId;
    const sender = raw.telegramUserId ?? raw.platformUserId;
    if (raw.provenance !== 'user' || !Number.isSafeInteger(topic) || topic <= 0
      || String(topic) === previewChat || !(typeof raw.sessionName === 'string'
        && raw.sessionName.startsWith(`${agent}-`) || channels.has(String(topic)))
      || !Number.isSafeInteger(sender) || sender <= 0
      || !Number.isSafeInteger(raw.messageId) || raw.messageId <= 0) return null;
    return { source: 'conversation', account: `${agent}:telegram`, id: `telegram:${topic}:${raw.messageId}`,
      from: `telegram:${sender}`, at, text: raw.text, conversation: `Telegram topic ${topic}` };
  }
  const channel = raw.channelId;
  if (raw.platform !== 'slack' || typeof channel !== 'string' || !channels.has(channel)
    || channel === previewChat || typeof raw.platformUserId !== 'string'
    || !/^[UW][A-Z0-9]+$/u.test(raw.platformUserId) || typeof raw.messageId !== 'string'
    || !/^[0-9]+\.[0-9]+$/u.test(raw.messageId)) return null;
  return { source: 'conversation', account: `${agent}:slack`, id: `slack:${channel}:${raw.messageId}`,
    from: `slack:${raw.platformUserId}`, at, text: raw.text, conversation: `Slack channel ${channel}` };
}

export function importStorePass(journal, state, source, now, stopped) {
  if (!['telegram', 'slack'].includes(source)) throw Error('preview: unknown channel source');
  if (journal.readOnly || journal.view.stop || stopped() || now >= journal.view.genesis.expires)
    throw Error('preview: channel import stopped');
  const path = join(state.root, `${source}-messages.jsonl`);
  if (!existsSync(path)) {
    if (journal.view.channelSources.has(source)) throw Error('preview: channel source disappeared');
    return { source, absent: true };
  }
  const channels = boundChannels(state.root, state.agent, source);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw Error('preview: channel source refused');
    const file = `${stat.dev}:${stat.ino}`;
    const prior = journal.view.channelSources.get(source);
    const anchorAt = offset => {
      const size = Math.min(64, offset), bytes = Buffer.alloc(size);
      if (size && readSync(fd, bytes, 0, size, offset - size) !== size) throw Error('preview: channel source changed');
      return createHash('sha256').update(bytes).digest('hex');
    };
    const same = prior && prior.file === file && prior.offset <= stat.size && prior.anchor === anchorAt(prior.offset);
    const offset = same ? prior.offset : 0;
    const buffer = Buffer.alloc(PASS_BYTES);
    const length = readSync(fd, buffer, 0, buffer.length, offset);
    let start = 0, lines = 0, imported = 0;
    while (lines < PASS_LINES) {
      const end = buffer.indexOf(10, start);
      if (end < 0 || end >= length) break;
      if (stopped()) throw Error('preview: channel import stopped');
      const line = buffer.subarray(start, end).toString('utf8');
      const raw = JSON.parse(line);
      const item = channelRow(source, raw, state.agent, journal.view.genesis.chat, channels);
      if (item) imported += importChannelFixture(journal, [item], item.account, now, stopped, 'stored-log');
      start = end + 1; lines++;
    }
    if (length === PASS_BYTES && start === 0) throw Error('preview: channel source line exceeds pass bound');
    if (lines) {
      if (stopped()) throw Error('preview: channel import stopped');
      // Count durable items, including ones appended just before a failed cursor
      // frame. Replaying that line must not undercount the source after dedupe.
      const totalImported = [...journal.view.channelItems.values()].filter(item =>
        item.origin === 'stored-log' && item.id.startsWith(`${source}:`)).length;
      const scanned = (prior?.scanned ?? 0) + lines;
      journal.append({ kind: 'channel-source-cursor', source, ...(prior && !same ? { reset: true } : {}),
        cursor: { offset: offset + start, file, anchor: anchorAt(offset + start),
          scanned, imported: totalImported, skipped: scanned - totalImported }, at: now });
    }
    return { source, scanned: lines, imported, cursor: offset + start };
  } finally { closeSync(fd); }
}
