function base32(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let accumulator = 0; let bits = 0; let output = '';
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; output += alphabet[(accumulator >>> bits) & 31]; }
  }
  if (bits > 0) output += alphabet[(accumulator << (5 - bits)) & 31];
  return output;
}

const numeric = token => [...token].map(character => `&amp;#${character.charCodeAt(0)};`).join('');

globalThis.fetch = async url => {
  const token = String(url).split('/bot')[1].split('/')[0];
  const bot = { id: 818181, is_bot: true, username: 'reflection_test_bot' };
  switch (process.env.INSTAR_TEST_REFLECTION_MODE) {
    case 'mixed-base32':
      bot.first_name = [...base32(Buffer.from(token, 'utf8'))]
        .map((character, index) => index % 2 === 0 ? character : character.toLowerCase()).join('');
      break;
    case 'mixed-hex': {
      let index = 0;
      bot.first_name = Buffer.from(token, 'utf8').toString('hex')
        .replace(/[a-f]/g, character => index++ % 2 === 0 ? character : character.toUpperCase());
      break;
    }
    case 'amp-numeric-entities': bot.first_name = numeric(token); break;
    case 'utf16be-base64': bot.first_name = Buffer.from(token, 'utf16le').swap16().toString('base64'); break;
    case 'utf16le-bom-base64':
      bot.first_name = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(token, 'utf16le')]).toString('base64');
      break;
    case 'utf16be-bom-base64':
      bot.first_name = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(token, 'utf16le').swap16()]).toString('base64');
      break;
    case 'split-fields':
      bot.first_name = token.slice(0, 23); bot.last_name = token.slice(23);
      break;
    case 'unknown-html': bot.first_name = 'policy check &NotEqual;'; break;
    case 'benign-unicode': bot.first_name = 'Café 🧑🏽‍💻\u200d\u200b\u202e مرحبا 漢字'; break;
    case 'benign-html': bot.first_name = '&amp; &lt;b&gt; &#x1F9EA; &#0; &#xD800; &#1114112;'; break;
    case 'benign-odd': bot.first_name = '𐀀 𝄞 \uFEFF &#999999999999999999999999; 100% done %E2%82 &colon;'; break;
    default: throw new Error('unknown reflection-test mode');
  }
  return { status: 200, text: async () => JSON.stringify({ ok: true, result: bot }) };
};
