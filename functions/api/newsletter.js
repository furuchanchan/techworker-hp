// メディアのメール配信の登録（POST /api/newsletter）。読者が選んだテーマを Resend の連絡先に記録する。
// 配信は founder-os/scripts/newsletter/send_digest.py が、テーマごとに週1回 Broadcasts で送る。
// 配信停止・テーマの変更は、メールの下のリンクから開く Resend のページで読者が行う。

const ALLOWED_ORIGINS = new Set([
  'https://techworker.co.jp',
  'https://www.techworker.co.jp',
]);

// Resend のセグメント（General）と、テーマ（Topics）の ID。配信スクリプトの config.json と同じ値
const SEGMENT_ID = 'fe158366-2ada-4c6d-a089-f184a31d83bb';
const TOPICS = {
  kenshu:    '8ac180d5-dc59-4a25-bddb-3ab2c21147cf',
  shigyo:    '3ad2584d-ab11-4d4c-b57e-27422384889a',
  interview: '3aa35e67-ca36-4d4a-86cc-ca6d8d1c1b0d',
  security:  '219eba26-0c2f-403b-97f2-899c30623df5',
};

const API = 'https://api.resend.com';

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// 他サイトからのPOSTを弾く（同一オリジンで Origin が省略されたときは Referer で見る）
function isAllowedSource(request) {
  const origin = request.headers.get('Origin');
  if (origin) return ALLOWED_ORIGINS.has(origin);
  try { return ALLOWED_ORIGINS.has(new URL(request.headers.get('Referer') || '').origin); } catch { return false; }
}

async function resend(apiKey, method, path, body) {
  const res = await fetch(API + path, {
    method,
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

export async function onRequestPost({ request, env }) {
  if (!isAllowedSource(request)) return json({ error: 'forbidden' }, 403);

  let data;
  try { data = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  // ハニーポット: 人には見えない欄が埋まっていれば bot として、成功を装って捨てる
  if (data.hp && String(data.hp).trim()) return json({ success: true }, 200);

  const email = String(data.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400);
  const keys = Array.isArray(data.topics) ? [...new Set(data.topics.map(String))] : [];
  if (!keys.length || keys.some((k) => !TOPICS[k])) return json({ error: 'invalid_topics' }, 400);
  if (!env.RESEND_API_KEY) return json({ error: 'not_configured' }, 500);

  const key = env.RESEND_API_KEY;
  const topics = keys.map((k) => ({ id: TOPICS[k], subscription: 'opt_in' }));
  const id = encodeURIComponent(email);

  // 前に登録した人: 配信停止を戻し、選んだテーマを足す（今回選ばなかったテーマはそのまま）
  let r = await resend(key, 'PATCH', `/contacts/${id}`, { unsubscribed: false });
  if (r.status === 404) {
    r = await resend(key, 'POST', '/contacts', {
      email,
      segments: [{ id: SEGMENT_ID }],
      topics,
      properties: { signup_page: String(data.page || '').slice(0, 300) },
    });
  } else if (r.ok) {
    r = await resend(key, 'PATCH', `/contacts/${id}/topics`, topics);
    if (r.ok) r = await resend(key, 'POST', `/contacts/${id}/segments/${SEGMENT_ID}`);
  }

  if (!r.ok) {
    console.error('Resend error:', r.status, r.text.slice(0, 500));
    return json({ error: 'failed' }, 502);
  }
  return json({ success: true }, 200);
}
