import { createServer } from 'node:http';
import { appendFileSync, readFileSync } from 'node:fs';

const log = process.argv[2];
const updates = () => process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : [];
let messageId = 1;
const server = createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const method = request.url?.split('/').at(-1), body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    appendFileSync(log, `${method}\n`);
    if (method === 'sendMessage') appendFileSync(`${log}.sends`, `${JSON.stringify(body)}\n`);
    response.setHeader('content-type', 'application/json');
    const pending = method === 'getUpdates' ? updates().filter(item => item.update_id >= body.offset) : [];
    // Opt-in `long-poll`: an empty getUpdates waits its `timeout` as Telegram does, so a bounded
    // cycle count spans real time and a fast host cannot run out of cycles before its drain passes.
    const wait = process.argv[5] === 'long-poll' && method === 'getUpdates' && pending.length === 0
      ? Math.min(Number(body.timeout) || 0, 5) * 1000 : 0;
    setTimeout(() => response.end(JSON.stringify({ ok: true, result: method === 'getMe'
      ? { id: 8820318295, is_bot: true, username: 'echo_mmtest_seam_b27x_bot' }
      : method === 'getUpdates' ? pending.slice(0,body.limit)
        : { message_id: messageId++, chat: { id: Number(body.chat_id) },
          ...(body.message_thread_id === undefined || process.argv[4] === 'drop-thread' ? {} : { message_thread_id: body.message_thread_id, is_topic_message: true }),
          text: String(body.text).replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&') } })), wait);
  });
});
server.listen(0, '127.0.0.1', () => process.stdout.write(`${server.address().port}\n`));
