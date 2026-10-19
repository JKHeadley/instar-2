// Dummy unix-socket listener owned by this test; counts connections, reads nothing.
import net from 'node:net'; import fs from 'node:fs';
const [path, log] = process.argv.slice(2); fs.rmSync(path, { force: true });
let n = 0; net.createServer(s => { n++; fs.writeFileSync(log, `connections=${n}\n`); s.destroy(); }).listen(path, () => fs.writeFileSync(log, 'connections=0\n'));
