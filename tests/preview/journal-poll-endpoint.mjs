import { createServer } from 'node:http';
import { appendFileSync, readFileSync } from 'node:fs';

const log = process.argv[2];
const updates = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : [];
let messageId = 1;
const server = createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const method = request.url?.split('/').at(-1), body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    appendFileSync(log, `${method}\n`);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ok: true, result: method === 'getMe'
      ? { id: 8820318295, is_bot: true, username: 'echo_mmtest_seam_b27x_bot' }
      : method === 'getUpdates' ? updates.filter(item => item.update_id >= body.offset).slice(0,body.limit)
        : { message_id: messageId++, chat: { id: Number(body.chat_id) },
          text: String(body.text).replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&') } }));
  });
});
server.listen(0, '127.0.0.1', () => process.stdout.write(`${server.address().port}\n`));
