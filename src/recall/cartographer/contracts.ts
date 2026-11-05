// Carried from CartographerTree.ts:24–95 at 4f88880a; durable originals belong to Part Two.
export type NodeKind = 'dir' | 'file';
export type StalenessStatus = 'fresh' | 'stale' | 'never-authored' | 'path-gone' | 'dirty';

export interface CartographerNodeProvenance {
  framework?: string;
  /** Size tier of the model that authored the summary — never a vendor name. */
  modelTier?: 'light' | 'standard';
  /**
   * Which tier authored this summary (spec #2 — doc-freshness). 'inline-agent' =
   * a Tier-1 opportunistic refresh by the agent that edited the code; 'sweep' =
   * the background CartographerSweep poller. Inline summaries are NOT protected
   * ground truth — the sweep may re-author them on a later pass.
   */
  source?: 'inline-agent' | 'sweep';
}

/** Coarse trust signal for a summary (spec #2). `fresh` ≠ correct; this hints how much. */
export type CartographerConfidence = 'low' | 'medium' | 'high';

export interface CartographerNode {
  /** Repo-relative POSIX path this node covers ('' = repo root). */
  path: string;
  kind: NodeKind;
  /** Plain-language description of what the code here does. '' until authored. */
  summary: string;
  /** ISO timestamp the summary was last authored; null = never. */
  summaryUpdatedAt: string | null;
  /** The git object id of the covered code AT authoring time (dir→tree, file→blob). null = never. */
  codeHash: string | null;
  /** Short HEAD sha when the summary was authored (provenance only). */
  codeRev: string | null;
  /** Child node paths (dirs only; sorted, repo-relative). */
  children: string[];
  /** Provenance marker — this file is cartographer state, not a user file. */
  builtinKind: 'cartographer-node';
  provenance?: CartographerNodeProvenance;
  /** True if codeHash was a working-tree hash rather than a committed oid. */
  dirtyAtAuthor?: boolean;

  // ── Spec #2 (doc-freshness) — owned-here fields ──────────────────────────
  // These are added by spec #2; spec #1 leaves them undefined. They are
  // preserved across scaffold() (structure-only refresh) like the authored
  // fields, and never wipe spec #1 behavior.
  /** ISO timestamp this node path was first scaffolded — the grace-clock anchor. */
  firstSeenAt?: string;
  /** Who last authored: 'inline-agent' | `sweep:<framework>`. Consumers must not read fresh as trusted. */
  lastAuthoredBy?: string;
  /** Coarse trust signal — `fresh` means fingerprint-current, NOT verified-correct. */
  confidence?: CartographerConfidence;
  /**
   * Hash of the concatenated DIRECT-child summaries at this dir's last author.
   * The dir re-author amplification guard: a dir whose tree-oid flipped but whose
   * childDigestHash is unchanged (e.g. a comment-only deep edit) gets its
   * fingerprint refreshed WITHOUT an LLM call. Leaf nodes leave this null.
   */
  childDigestHash?: string | null;
  /** Anti-starvation: passes this node has been deferred (dir authored after its children). */
  staleSincePass?: number;
  /** Consecutive failed author attempts — drives per-node quarantine. */
  consecutiveAuthorFailures?: number;
  /** True once consecutiveAuthorFailures crossed the quarantine threshold. Surfaced in health(). */
  authorFailed?: boolean;
}


/** A read is scoped by the existing root owner before this port is handed to navigation.
 * childCount is represented by children.length; children access must be indexed, never scanned.
 * currentOidMap accepts only the bounded emitted paths, from one pinned committed revision. */
export interface CartographerReader {
  getNode(path: string): CartographerNode | null;
  getChildren(path: string, limit: number): CartographerNode[];
  currentOidMap(paths: readonly string[]): ReadonlyMap<string, string>;
}
