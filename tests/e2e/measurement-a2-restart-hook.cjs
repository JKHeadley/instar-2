const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');

const cut = process.env.ASTRA_CUT;
const root = process.env.ASTRA_DIRECTORY;
const descriptors = new Map();
const die = name => { if (cut === name) process.kill(process.pid, 'SIGKILL'); };
const original = { open: fs.openSync, write: fs.writeFileSync,
  sync: fs.fsyncSync, rename: fs.renameSync };

fs.openSync = function(path, ...args) {
  const descriptor = original.open(path, ...args);
  descriptors.set(descriptor, String(path));
  return descriptor;
};
fs.writeFileSync = function(path, ...args) {
  const resolved = typeof path === 'number' ? descriptors.get(path) : String(path);
  if (resolved === `${root}/facts.pending`) die('before-write');
  const value = original.write(path, ...args);
  if (resolved === `${root}/facts.pending`) die('after-write');
  return value;
};
fs.fsyncSync = function(descriptor) {
  const path = descriptors.get(descriptor);
  const value = original.sync(descriptor);
  if (path === `${root}/facts.pending`) die('after-file-sync');
  if (path === root) die('after-directory-sync');
  return value;
};
fs.renameSync = function(from, to) {
  const value = original.rename(from, to);
  if (String(to) === `${root}/facts.json`) die('after-rename');
  return value;
};
syncBuiltinESMExports();
