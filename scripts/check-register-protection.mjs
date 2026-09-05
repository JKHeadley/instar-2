export function checkProtectedTests(register, files) {
  const patterns = register.entries.filter(e => e.declaration.kind === 'protected artifacts' && e.declaration.status === 'live').map(e => e.declaration.requiredFacts.pattern);
  const matches = (path, pattern) => {
    const regex = pattern.split('**').map(part => part.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*');
    return new RegExp('^' + regex + '$').test(path);
  };
  const missing = [...new Set(files)].filter(path => !patterns.some(pattern => matches(path, pattern)));
  if (missing.length) throw new Error('R8 unprotected P3 fixture files: ' + missing.join(', '));
  return true;
}
