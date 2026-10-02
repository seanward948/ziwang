/* Zìwǎng feedback: receives the form on ziwang.app/feedback/ and emails it to the site owner.
   The destination address is a Worker secret (TO_EMAIL), so it never appears in the site or this repo. */
const SITE = ['https://ziwang.app', 'https://www.ziwang.app'];
const FROM = { email: 'feedback@ziwang.app', name: 'Zìwǎng feedback' };

const reply = (body, status, origin) => new Response(body === null ? null : JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': SITE.includes(origin) ? origin : SITE[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  },
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return reply(null, 204, origin);
    if (request.method !== 'POST') return new Response('Not found', { status: 404 });
    if (!SITE.includes(origin)) return reply({ ok: false }, 403, origin);

    let d;
    try { d = await request.json(); } catch { return reply({ ok: false, error: 'Unreadable message.' }, 400, origin); }

    // quiet spam checks: a hidden field people never fill in, and forms sent within 3 seconds of opening
    if (d.website || Date.now() - Number(d.t || 0) < 3000) return reply({ ok: true }, 200, origin);

    const message = String(d.message || '').trim().slice(0, 4000);
    if (message.length < 3) return reply({ ok: false, error: 'Please write a little more.' }, 400, origin);
    const email = String(d.email || '').trim().slice(0, 200);
    const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
    const page = String(d.page || '').slice(0, 300);

    try {
      await env.EMAIL.send({
        to: env.TO_EMAIL,
        from: FROM,
        ...(replyTo ? { replyTo } : {}),
        subject: 'Zìwǎng feedback: ' + message.replace(/\s+/g, ' ').slice(0, 60),
        text: `${message}\n\n---\nPage: ${page || '(not given)'}\nReply to: ${replyTo || '(no email given)'}`,
      });
    } catch (e) {
      console.log('send failed', e && (e.code || e.message));
      return reply({ ok: false, error: 'It couldn’t be sent just now. Please try again later.' }, 502, origin);
    }
    return reply({ ok: true }, 200, origin);
  },
};
