import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipManager, memoryRelationshipStore } from './relationship-manager.js';
import type { RelationshipManagerConfig, RelationshipManagerPorts, UserChannel } from './relationship-manager.js';

// 1.x tests ran against a directory of JSON files and the wall clock; the 2.0 manager takes a store
// port and clock/id ports, so every case here is deterministic and writes nothing to disk.
const CLOCK = Date.UTC(2026, 9, 10, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

describe('RelationshipManager', () => {
  let store: ReturnType<typeof memoryRelationshipStore>;
  let config: RelationshipManagerConfig;
  let ports: RelationshipManagerPorts;
  let manager: RelationshipManager;

  beforeEach(() => {
    let ids = 0;
    store = memoryRelationshipStore();
    config = { maxRecentInteractions: 20 };
    ports = { now: () => CLOCK, id: () => `r${++ids}` };
    manager = new RelationshipManager(config, ports, store);
  });

  describe('findOrCreate', () => {
    it('creates a new relationship', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      expect(record.name).toBe('Alice');
      expect(record.id).toBeTruthy();
      expect(record.channels).toHaveLength(1);
      expect(record.channels[0]).toEqual(channel);
      expect(record.interactionCount).toBe(0);
      expect(record.significance).toBe(1);
    });

    it('returns existing relationship for same channel', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const first = manager.findOrCreate('Alice', channel);
      const second = manager.findOrCreate('Alice', channel);

      expect(first.id).toBe(second.id);
    });

    it('creates separate relationships for different channels', () => {
      const ch1: UserChannel = { type: 'telegram', identifier: '111' };
      const ch2: UserChannel = { type: 'email', identifier: 'bob@test.com' };

      const r1 = manager.findOrCreate('Alice', ch1);
      const r2 = manager.findOrCreate('Bob', ch2);

      expect(r1.id).not.toBe(r2.id);
    });

    it('persists to the store', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      const saved = store.records().find((r) => r.id === record.id);
      expect(saved).toBeDefined();
      expect(saved!.name).toBe('Alice');
    });

    it('survives reload from the store', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const original = manager.findOrCreate('Alice', channel);

      // Create a new manager over the same store
      const manager2 = new RelationshipManager(config, ports, store);
      const loaded = manager2.resolveByChannel(channel);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(original.id);
      expect(loaded!.name).toBe('Alice');
    });
  });

  describe('resolveByChannel', () => {
    it('returns null for unknown channel', () => {
      const result = manager.resolveByChannel({ type: 'telegram', identifier: '99999' });
      expect(result).toBeNull();
    });

    it('resolves known channel', () => {
      const channel: UserChannel = { type: 'email', identifier: 'test@example.com' };
      const created = manager.findOrCreate('Test User', channel);
      const resolved = manager.resolveByChannel(channel);

      expect(resolved).not.toBeNull();
      expect(resolved!.id).toBe(created.id);
    });
  });

  describe('recordInteraction', () => {
    it('increments interaction count and updates recency', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      manager.recordInteraction(record.id, {
        timestamp: new Date(CLOCK).toISOString(),
        channel: 'telegram',
        summary: 'Discussed project setup',
        topics: ['onboarding', 'architecture'],
      });

      const updated = manager.get(record.id)!;
      expect(updated.interactionCount).toBe(1);
      expect(updated.recentInteractions).toHaveLength(1);
      expect(updated.themes).toContain('onboarding');
      expect(updated.themes).toContain('architecture');
    });

    it('caps recent interactions at max', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      // Record more than maxRecentInteractions
      for (let i = 0; i < 25; i++) {
        manager.recordInteraction(record.id, {
          timestamp: new Date(CLOCK + i * 1000).toISOString(),
          channel: 'telegram',
          summary: `Interaction ${i}`,
        });
      }

      const updated = manager.get(record.id)!;
      expect(updated.recentInteractions.length).toBeLessThanOrEqual(config.maxRecentInteractions);
      expect(updated.interactionCount).toBe(25);
    });

    it('ignores unknown relationship id', () => {
      // Should not throw
      manager.recordInteraction('nonexistent-id', {
        timestamp: new Date(CLOCK).toISOString(),
        channel: 'telegram',
        summary: 'Should be ignored',
      });
    });

    it('auto-derives significance from interactions', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      // Record many interactions with varied topics
      for (let i = 0; i < 20; i++) {
        manager.recordInteraction(record.id, {
          timestamp: new Date(CLOCK).toISOString(),
          channel: 'telegram',
          summary: `Discussion ${i}`,
          topics: [`topic-${i}`],
        });
      }

      const updated = manager.get(record.id)!;
      // 20 interactions (3pts) + recent (3pts) + 20 themes (3pts) = 9
      expect(updated.significance).toBeGreaterThanOrEqual(7);
    });
  });

  describe('updateNotes', () => {
    it('updates notes on a relationship', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      manager.updateNotes(record.id, 'Very thoughtful conversationalist');
      const updated = manager.get(record.id)!;
      expect(updated.notes).toBe('Very thoughtful conversationalist');
    });
  });

  describe('updateArcSummary', () => {
    it('updates arc summary on a relationship', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      manager.updateArcSummary(record.id, 'Started as curious user, became collaborator');
      const updated = manager.get(record.id)!;
      expect(updated.arcSummary).toBe('Started as curious user, became collaborator');
    });
  });

  describe('linkChannel', () => {
    it('adds a new channel to an existing relationship', () => {
      const ch1: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', ch1);

      const ch2: UserChannel = { type: 'email', identifier: 'alice@example.com' };
      expect(manager.linkChannel(record.id, ch2)).toBe(true);

      const updated = manager.get(record.id)!;
      expect(updated.channels).toHaveLength(2);

      // Should be resolvable by either channel
      expect(manager.resolveByChannel(ch1)!.id).toBe(record.id);
      expect(manager.resolveByChannel(ch2)!.id).toBe(record.id);
    });

    it('does not duplicate existing channels', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      manager.linkChannel(record.id, channel);
      const updated = manager.get(record.id)!;
      expect(updated.channels).toHaveLength(1);
    });

    it('refuses the fifty-first channel and records the refusal instead of a console warning', () => {
      const record = manager.findOrCreate('Alice', { type: 'telegram', identifier: '0' });
      for (let i = 1; i < 50; i++) manager.linkChannel(record.id, { type: 'telegram', identifier: String(i) });
      expect(manager.get(record.id)!.channels).toHaveLength(50);
      expect(manager.linkChannel(record.id, { type: 'telegram', identifier: '50' })).toBe(false);
      expect(manager.get(record.id)!.channels).toHaveLength(50);
      expect(manager.refusedChannelLinks).toEqual([{ id: record.id, channel: { type: 'telegram', identifier: '50' } }]);
    });
  });

  describe('mergeRelationships', () => {
    it('merges two relationship records', () => {
      const ch1: UserChannel = { type: 'telegram', identifier: '111' };
      const ch2: UserChannel = { type: 'email', identifier: 'alice@test.com' };

      const r1 = manager.findOrCreate('Alice (Telegram)', ch1);
      const r2 = manager.findOrCreate('Alice (Email)', ch2);

      // Add interactions to both
      manager.recordInteraction(r1.id, {
        timestamp: new Date(CLOCK - 10000).toISOString(),
        channel: 'telegram',
        summary: 'Chat on Telegram',
        topics: ['ai'],
      });
      manager.recordInteraction(r2.id, {
        timestamp: new Date(CLOCK).toISOString(),
        channel: 'email',
        summary: 'Email exchange',
        topics: ['philosophy'],
      });

      // Merge r2 into r1
      manager.mergeRelationships(r1.id, r2.id);

      const merged = manager.get(r1.id)!;
      expect(merged.channels).toHaveLength(2);
      expect(merged.interactionCount).toBe(2);
      expect(merged.themes).toContain('ai');
      expect(merged.themes).toContain('philosophy');

      // r2 should be gone, in the manager and in the store
      expect(manager.get(r2.id)).toBeNull();
      expect(store.records().some((r) => r.id === r2.id)).toBe(false);

      // Both channels should resolve to r1
      expect(manager.resolveByChannel(ch1)!.id).toBe(r1.id);
      expect(manager.resolveByChannel(ch2)!.id).toBe(r1.id);
    });

    it('handles merge with nonexistent source gracefully', () => {
      const r1 = manager.findOrCreate('Dave', { type: 'telegram', identifier: '111' });
      expect(() => manager.mergeRelationships(r1.id, 'nonexistent-id')).not.toThrow();
      const unchanged = manager.get(r1.id)!;
      expect(unchanged.name).toBe('Dave');
      expect(unchanged.channels).toHaveLength(1);
    });
  });

  describe('getContextForPerson', () => {
    it('returns null for unknown id', () => {
      expect(manager.getContextForPerson('nonexistent')).toBeNull();
    });

    it('generates XML context block', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);
      manager.updateNotes(record.id, 'Test note');

      manager.recordInteraction(record.id, {
        timestamp: new Date(CLOCK).toISOString(),
        channel: 'telegram',
        summary: 'Discussed testing',
        topics: ['testing'],
      });

      const context = manager.getContextForPerson(record.id)!;
      expect(context).toContain('<relationship_context person="Alice">');
      expect(context).toContain('</relationship_context>');
      expect(context).toContain('Name: Alice');
      expect(context).toContain('Key themes: testing');
      expect(context).toContain('Notes: Test note');
      expect(context).toContain('Discussed testing');
    });
  });

  describe('getAll', () => {
    it('returns empty array when no relationships', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('sorts by significance by default', () => {
      const ch1: UserChannel = { type: 'telegram', identifier: '111' };
      const ch2: UserChannel = { type: 'telegram', identifier: '222' };

      const r1 = manager.findOrCreate('Low', ch1);
      const r2 = manager.findOrCreate('High', ch2);

      // Give r2 more interactions to boost significance
      for (let i = 0; i < 10; i++) {
        manager.recordInteraction(r2.id, {
          timestamp: new Date(CLOCK).toISOString(),
          channel: 'telegram',
          summary: `Discussion ${i}`,
          topics: [`topic-${i}`],
        });
      }

      const all = manager.getAll();
      expect(all[0]!.id).toBe(r2.id);
      expect(all[1]!.id).toBe(r1.id);
    });

    it('sorts by name when requested', () => {
      manager.findOrCreate('Charlie', { type: 'telegram', identifier: '3' });
      manager.findOrCreate('Alice', { type: 'telegram', identifier: '1' });
      manager.findOrCreate('Bob', { type: 'telegram', identifier: '2' });

      const byName = manager.getAll('name');
      expect(byName.map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  describe('resolveByName', () => {
    it('resolves exact name match (case-insensitive)', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      const matches = manager.resolveByName('alice');
      expect(matches).toHaveLength(1);
      expect(matches[0]!.id).toBe(record.id);
    });

    it('resolves with leading @ stripped', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('ColonistOne', channel);

      const matches = manager.resolveByName('@ColonistOne');
      expect(matches).toHaveLength(1);
      expect(matches[0]!.id).toBe(record.id);
    });

    it('resolves collapsed name (underscores/hyphens/spaces)', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('colonist-one', channel);

      // "ColonistOne" collapsed matches "colonist one" collapsed
      const matches = manager.resolveByName('ColonistOne');
      expect(matches).toHaveLength(1);
      expect(matches[0]!.id).toBe(record.id);
    });

    it('returns empty for unknown name', () => {
      const matches = manager.resolveByName('Nobody');
      expect(matches).toHaveLength(0);
    });

    it('returns multiple matches when names collide', () => {
      // Two different people with the same normalized name but different channels
      manager.findOrCreate('Alice', { type: 'telegram', identifier: '111' });
      manager.findOrCreate('alice', { type: 'email', identifier: 'alice@test.com' });

      // Since findOrCreate now resolves by name first, the second call
      // should have linked to the first. Verify:
      const matches = manager.resolveByName('alice');
      expect(matches).toHaveLength(1); // Merged via findOrCreate name resolution
    });
  });

  describe('findDuplicates', () => {
    it('returns empty when no duplicates', () => {
      manager.findOrCreate('Alice', { type: 'telegram', identifier: '111' });
      manager.findOrCreate('Bob', { type: 'telegram', identifier: '222' });

      const dupes = manager.findDuplicates();
      expect(dupes).toHaveLength(0);
    });

    it('detects collapsed-name duplicates loaded from the store', () => {
      // Two stored records whose names differ only in separators (the store came from elsewhere, so
      // findOrCreate's own name resolution never had the chance to link them).
      const loaded = new RelationshipManager(config, ports, memoryRelationshipStore([
        { id: 'a', name: 'test user', channels: [{ type: 'telegram', identifier: '111' }], firstInteraction: new Date(CLOCK).toISOString(),
          lastInteraction: new Date(CLOCK).toISOString(), interactionCount: 1, themes: [], notes: '', significance: 1, recentInteractions: [] },
        { id: 'b', name: 'TestUser', channels: [{ type: 'email', identifier: 'test@example.com' }], firstInteraction: new Date(CLOCK).toISOString(),
          lastInteraction: new Date(CLOCK).toISOString(), interactionCount: 1, themes: [], notes: '', significance: 1, recentInteractions: [] },
      ]));
      const dupes = loaded.findDuplicates();
      expect(dupes).toHaveLength(1);
      expect(dupes[0]!.reason).toBe('Similar collapsed name: "testuser"');
      expect(dupes[0]!.records.map((r) => r.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('findOrCreate with name resolution', () => {
    it('links new channel to existing person when name matches', () => {
      const ch1: UserChannel = { type: 'telegram', identifier: '111' };
      const r1 = manager.findOrCreate('Alice', ch1);

      const ch2: UserChannel = { type: 'email', identifier: 'alice@test.com' };
      const r2 = manager.findOrCreate('Alice', ch2);

      // Should be same record — name resolution linked them
      expect(r1.id).toBe(r2.id);
      expect(r2.channels).toHaveLength(2);
    });

    it('creates separate records for different names', () => {
      const r1 = manager.findOrCreate('Alice', { type: 'telegram', identifier: '111' });
      const r2 = manager.findOrCreate('Bob', { type: 'telegram', identifier: '222' });

      expect(r1.id).not.toBe(r2.id);
    });

    it('resolves case-insensitive name across channels', () => {
      const r1 = manager.findOrCreate('ColonistOne', { type: 'colony', identifier: 'colonist-one' });
      const r2 = manager.findOrCreate('colonistone', { type: 'dirabook', identifier: 'colonistone' });

      // Collapsed match should link them
      expect(r1.id).toBe(r2.id);
    });

    it('never guesses between two people sharing a name: an ambiguous match creates a third record', () => {
      const loaded = new RelationshipManager(config, ports, memoryRelationshipStore([
        { id: 'a', name: 'Sam', channels: [{ type: 'telegram', identifier: '1' }], firstInteraction: new Date(CLOCK).toISOString(),
          lastInteraction: new Date(CLOCK).toISOString(), interactionCount: 1, themes: [], notes: '', significance: 1, recentInteractions: [] },
        { id: 'b', name: 'sam', channels: [{ type: 'email', identifier: 'sam@x.io' }], firstInteraction: new Date(CLOCK).toISOString(),
          lastInteraction: new Date(CLOCK).toISOString(), interactionCount: 1, themes: [], notes: '', significance: 1, recentInteractions: [] },
      ]));
      const third = loaded.findOrCreate('Sam', { type: 'slack', identifier: 'U1' });
      expect(['a', 'b']).not.toContain(third.id);
      expect(loaded.getAll()).toHaveLength(3);
    });
  });

  describe('category and tags', () => {
    it('updates category', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      manager.updateCategory(record.id, 'collaborator');
      const updated = manager.get(record.id)!;
      expect(updated.category).toBe('collaborator');
    });

    it('adds and removes tags', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      manager.addTags(record.id, ['ai', 'consciousness', 'builder']);
      let updated = manager.get(record.id)!;
      expect(updated.tags).toEqual(['ai', 'consciousness', 'builder']);

      // Deduplicates
      manager.addTags(record.id, ['ai', 'new-tag']);
      updated = manager.get(record.id)!;
      expect(updated.tags).toEqual(['ai', 'consciousness', 'builder', 'new-tag']);

      // Remove
      manager.removeTags(record.id, ['consciousness']);
      updated = manager.get(record.id)!;
      expect(updated.tags).toEqual(['ai', 'builder', 'new-tag']);
    });

    it('includes category and tags in context', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      manager.updateCategory(record.id, 'kindred_ai');
      manager.addTags(record.id, ['consciousness', 'builder']);

      const context = manager.getContextForPerson(record.id)!;
      expect(context).toContain('Category: kindred_ai');
      expect(context).toContain('Tags: consciousness, builder');
    });
  });

  describe('cross-platform context', () => {
    it('includes platform summary for multi-channel relationships', () => {
      const ch1: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', ch1);

      const ch2: UserChannel = { type: 'email', identifier: 'alice@test.com' };
      manager.linkChannel(record.id, ch2);

      const context = manager.getContextForPerson(record.id)!;
      expect(context).toContain('Platforms: telegram, email');
    });

    it('omits platform line for single-channel relationships', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      const context = manager.getContextForPerson(record.id)!;
      expect(context).not.toContain('Platforms:');
    });
  });

  describe('merge preserves category and tags', () => {
    it('merges tags from both records', () => {
      const ch1: UserChannel = { type: 'telegram', identifier: '111' };
      const ch2: UserChannel = { type: 'email', identifier: 'alice@test.com' };

      const r1 = manager.findOrCreate('Alice (Telegram)', ch1);
      const r2 = manager.findOrCreate('Alice (Email)', ch2);

      manager.updateCategory(r1.id, 'collaborator');
      manager.addTags(r1.id, ['ai']);
      manager.addTags(r2.id, ['philosophy', 'ai']);

      manager.mergeRelationships(r1.id, r2.id);

      const merged = manager.get(r1.id)!;
      expect(merged.category).toBe('collaborator');
      expect(merged.tags).toContain('ai');
      expect(merged.tags).toContain('philosophy');
    });

    it('takes category from merged record if keeper has none', () => {
      const ch1: UserChannel = { type: 'telegram', identifier: '111' };
      const ch2: UserChannel = { type: 'email', identifier: 'bob@test.com' };

      const r1 = manager.findOrCreate('Bob (Telegram)', ch1);
      const r2 = manager.findOrCreate('Bob (Email)', ch2);

      manager.updateCategory(r2.id, 'community_member');

      manager.mergeRelationships(r1.id, r2.id);

      const merged = manager.get(r1.id)!;
      expect(merged.category).toBe('community_member');
    });
  });

  describe('getStaleRelationships', () => {
    it('finds relationships older than threshold with sufficient significance', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      const record = manager.findOrCreate('Alice', channel);

      // Boost significance with old interactions (30 days ago)
      for (let i = 0; i < 6; i++) {
        manager.recordInteraction(record.id, {
          timestamp: new Date(CLOCK - 30 * DAY).toISOString(),
          channel: 'telegram',
          summary: `Old discussion ${i}`,
          topics: [`topic-${i}`],
        });
      }

      const stale = manager.getStaleRelationships(14);
      expect(stale.length).toBeGreaterThanOrEqual(1);
      expect(stale[0]!.id).toBe(record.id);
    });

    it('excludes low-significance relationships', () => {
      const channel: UserChannel = { type: 'telegram', identifier: '12345' };
      manager.findOrCreate('Stranger', channel);
      // No interactions → significance stays at 1

      const stale = manager.getStaleRelationships(0); // Any age
      // Significance < 3 should be excluded
      expect(stale).toHaveLength(0);
    });
  });

  describe('readAll', () => {
    it('counts records with an invalid id instead of returning them', () => {
      const read = RelationshipManager.readAll({ load: () => [
        { id: 'ok', name: 'Alice', channels: [], firstInteraction: 'x', lastInteraction: 'x', interactionCount: 0, themes: [], notes: '', significance: 1, recentInteractions: [] },
        { id: '../escape', name: 'Mallory', channels: [], firstInteraction: 'x', lastInteraction: 'x', interactionCount: 0, themes: [], notes: '', significance: 1, recentInteractions: [] },
      ] });
      expect(read.records.map((r) => r.id)).toEqual(['ok']);
      expect(read.skipped).toBe(1);
    });
  });
});
