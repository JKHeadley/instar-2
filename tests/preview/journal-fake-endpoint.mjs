// Offline Bot API endpoint for the physical bridge contract test. It records
// acceptance, then closes the socket before replying.
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
const log = process.argv[2];
const server = createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    appendFileSync(log, `${JSON.stringify({ path: request.url, body: JSON.parse(Buffer.concat(chunks).toString()) })}\n`);
    response.socket?.destroy();
  });
});
server.listen(0, '127.0.0.1', () => process.stdout.write(`${server.address().port}\n`));
