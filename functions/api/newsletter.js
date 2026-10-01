// メディアのメール配信の登録（POST /api/newsletter）。読者が選んだテーマを Resend の連絡先に記録する。
// 配信は founder-os/scripts/newsletter/send_digest.py が、テーマごとに週1回 Broadcasts で送る。
// 配信停止・テーマの変更は、メールの下のリンクから開く Resend のページで読者が行う。

const ALLOWED_ORIGINS = new Set([
  'https://techworker.co.jp',
  'https://www.techworker.co.jp',
]);

// Resend のセグメント（General）と、テーマ（Topics）の ID。配信スクリプトの config.json と同じ値。
// テーマは既定で購読しない（opt_out）設定。選んだテーマだけ opt_in にするので、選ばなかったテーマは届かない
const SEGMENT_ID = 'fe158366-2ada-4c6d-a089-f184a31d83bb';
const TOPICS = {
  kenshu:    'd9a6f426-95a2-4079-88cd-390007ac8d3d',
  shigyo:    'b8a1ccb0-96e6-4a27-b135-9a5f4a0a236c',
  interview: '56ef8a46-9b78-4425-9bed-aca15e511688',
  security:  'e6366e95-1896-4cc9-b6f5-875e32192ef9',
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
