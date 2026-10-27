// Public test certificates only; never reads an existing account or keychain.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export function ipcCertificates(root) {
  const run = args => execFileSync('/usr/bin/openssl', args, { stdio: 'pipe', timeout: 10000 });
  const ca = join(root, 'ca.pem'), key = join(root, 'ca.key');
  run(['req', '-x509', '-sha256', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-pkeyopt', 'ec_param_enc:named_curve', '-nodes', '-keyout', key,
    '-out', ca, '-days', '1', '-subj', '/CN=Instar isolated IPC test CA']);
  chmodSync(key, 0o600); chmodSync(ca, 0o600);
  const result = {};
  for (const name of ['server', 'client', 'other']) {
    const directory = join(root, name); mkdirSync(directory, { mode: 0o700 });
    const paths = { ca: join(directory, 'ca.pem'), cert: join(directory, 'cert.pem'), key: join(directory, 'key.pem') };
    const csr = join(root, `${name}.csr`), ext = join(root, `${name}.ext`);
    writeFileSync(ext, 'basicConstraints=CA:FALSE\nkeyUsage=digitalSignature\nextendedKeyUsage=clientAuth,serverAuth\nsubjectAltName=DNS:localhost\n');
    run(['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-pkeyopt', 'ec_param_enc:named_curve', '-nodes', '-keyout', paths.key,
      '-out', csr, '-subj', `/CN=${name}`]);
    run(['x509', '-req', '-sha256', '-in', csr, '-CA', ca, '-CAkey', key, '-set_serial', String(Object.keys(result).length + 1),
      '-out', paths.cert, '-days', '1', '-extfile', ext]);
    copyFileSync(ca, paths.ca);
    for (const path of Object.values(paths)) chmodSync(path, 0o600);
    result[name] = paths;
  }
  return result;
}
