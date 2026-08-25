#!/usr/bin/env node
// Validate a governed document's changelog (NAME.changelog.json) against rule 91's
// required-field contract. Fails (exit 1) on any missing field, so "link the change to
// git" is enforced by the build rather than left to habit.
//
// Usage: node scripts/validate-changelog.mjs <path-to-.changelog.json> [more...]
//        node scripts/validate-changelog.mjs docs/**/*.changelog.json
import { readFileSync } from "node:fs";

const STATUSES = new Set(["draft", "approved", "superseded"]);
const CAUSE_KINDS = new Set(["draft", "review", "conversation", "migration"]);

function fail(file, msg) {
  errors.push(`${file}: ${msg}`);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: validate-changelog.mjs <NAME.changelog.json> [...]");
  process.exit(2);
}

const errors = [];
for (const file of files) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(file, `not valid JSON: ${e.message}`);
    continue;
  }
  if (!Array.isArray(doc)) {
    fail(file, "top level must be an array of revision entries");
    continue;
  }
  if (doc.length === 0) fail(file, "changelog is empty (needs at least one revision)");

  const seen = new Set();
  let prev = Infinity;
  doc.forEach((e, i) => {
    const at = `entry[${i}]`;
    if (typeof e.revision !== "number" || !Number.isInteger(e.revision) || e.revision < 1)
      fail(file, `${at}: revision must be a positive integer`);
    else {
      if (seen.has(e.revision)) fail(file, `${at}: duplicate revision ${e.revision}`);
      seen.add(e.revision);
      if (e.revision > prev) fail(file, `${at}: revisions must be newest-first (got ${e.revision} after ${prev})`);
      prev = e.revision;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || "")) fail(file, `${at}: date must be ISO YYYY-MM-DD`);
    if (!STATUSES.has(e.status)) fail(file, `${at}: status must be one of ${[...STATUSES].join("/")}`);
    // cause
    if (!e.cause || typeof e.cause !== "object") fail(file, `${at}: cause is required`);
    else {
      if (!CAUSE_KINDS.has(e.cause.kind)) fail(file, `${at}: cause.kind must be one of ${[...CAUSE_KINDS].join("/")}`);
      if (e.cause.kind === "review" && typeof e.cause.pr !== "number")
        fail(file, `${at}: a review cause must name its pr (number)`);
    }
    // approvedIn is optional; mergeCommit may be filled after merge
    if (e.approvedIn && e.approvedIn.mergeCommit != null && !/^[0-9a-f]{7,40}$/.test(e.approvedIn.mergeCommit))
      fail(file, `${at}: approvedIn.mergeCommit must be a git sha or null`);
    // changes
    if (!Array.isArray(e.changes) || e.changes.length === 0)
      fail(file, `${at}: changes must be a non-empty array`);
    else e.changes.forEach((c, j) => {
      const cat = `${at}.changes[${j}]`;
      if (!c || typeof c !== "object") { fail(file, `${cat}: not an object`); return; }
      if (!c.what || typeof c.what !== "string") fail(file, `${cat}: what is required`);
      if (!c.why || typeof c.why !== "string") fail(file, `${cat}: why is required`);
      const hasCommits = Array.isArray(c.commits) && c.commits.length > 0 &&
        c.commits.every((s) => typeof s === "string" && /^[0-9a-f]{7,40}$/.test(s));
      const hasRef = typeof c.ref === "string" && c.ref.trim().length > 0;
      if (!hasCommits && !hasRef)
        fail(file, `${cat}: each change needs a link — at least one of commits (git shas) or ref`);
      if (c.commits != null && !hasCommits && !(Array.isArray(c.commits) && c.commits.length === 0))
        fail(file, `${cat}: commits must be an array of git shas`);
    });
  });
}

if (errors.length) {
  console.error(`changelog validation FAILED (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`changelog validation OK (${files.length} file${files.length === 1 ? "" : "s"})`);
