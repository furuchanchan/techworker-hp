// AI活用度診断: 会社名＋回答 → LLMで「御社の状況」＋「業界での活用事例」を生成
// 必要な Cloudflare シークレット:
//   ANTHROPIC_API_KEY (必須・未設定なら課金ゼロで安全にフォールバック)
//   TURNSTILE_SECRET  (任意・設定するとbot検証を強制し公開エンドポイントの乱用を防止)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' };

// 感動体験のため品質最優先で Opus 4.8。速さ優先に戻すなら 'claude-sonnet-4-6'（速い）/ 'claude-haiku-4-5'（最速）。
const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1600;

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function verifyTurnstile(token, secret, ip) {
  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token || '');
    if (ip) body.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const d = await r.json();
    return !!(d && d.success);
  } catch (e) {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const industry = (data.industry || '').toString().trim().slice(0, 40);
  const levelName = (data.levelName || '').toString().slice(0, 40);
  const pct = parseInt(data.pct, 10);
  const dims = Array.isArray(data.dims) ? data.dims.slice(0, 6) : [];

  if (!industry || !levelName || !dims.length) {
    return json({ error: 'missing fields' }, 400);
  }

  // bot対策: TURNSTILE_SECRET が設定されている場合のみ強制（未設定でも動作はする）
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(data.turnstileToken, env.TURNSTILE_SECRET, request.headers.get('CF-Connecting-IP'));
    if (!ok) return json({ error: 'verification failed' }, 403);
  }

  // APIキー未設定なら安全にフォールバック（課金ゼロ）
  if (!env.ANTHROPIC_API_KEY) {
    return json({ ok: false, fallback: true, reason: 'not_configured' });
  }

  const dimText = dims.map((d) => `${(d.theme || '').toString().slice(0, 20)}: ${parseInt(d.pct, 10) || 0}%`).join(' / ');

  const sys = `あなたは日本企業向けの生成AI活用コンサルタントです。出力は日本語。経営者に向けた、断定的だが誇張のない実務的な文章。次を厳守してください:
- ユーザーが選んだ業界と、回答した診断結果（レベル・各項目スコア）のみに基づいて書く。特定企業の固有の事実（売上・導入状況・社内体制・実績など）は一切創作・断定しない。
- 業界の活用事例は、その業界で一般的に行われている／効果が出やすい生成AI活用を、一般論として具体的に示す。実在の他社名・架空の固有数値は出さない。
- 前提フレームワークは Microsoft の AI 成熟度モデル（5段階×能力の柱）。現在地に即した実務的な次の一手を示す。
- 経営者が「よく分かっている」と感じる、具体的で示唆に富む内容にする。スコアの高低の意味を読み解き、最も成果に効く一手を一点に絞って示す。誇張・空虚な美辞麗句は避け、必ず回答スコアに紐づける。
- 出力は必ず指定のJSONのみ。前後に文章・説明・コードフェンスを付けない。`;

  const indLabel = industry === 'その他' ? '業種共通（特定の業界に限らない）' : industry;
  const user = `# 診断対象
業界: ${indLabel}
総合レベル: ${levelName}（活用度スコア ${isNaN(pct) ? '-' : pct}%）
項目別スコア: ${dimText}

# 依頼
1) 診断結果に基づく「御社の状況」を経営者向けに4〜5文で。①現在地（Microsoftの成熟度の言葉で）②相対的な強み ③最大のボトルネック（最も成果に効く一手）を、スコアの高低の意味を読み解いて具体的に。読んだ経営者が「次に何をすべきか腹落ちする」レベルまで。特定企業の未確認事実は書かない。
2) ${indLabel}でよくある／効果が出やすい生成AI活用事例を3つ。その業界の具体的な業務に踏み込むこと。各事例は title（短い見出し）と detail（1〜2文。どんな業務をどう変えるか）。

# 出力JSON（このスキーマのみ・キー名厳守）
{"summary":"御社の状況（4〜5文）","useCases":[{"title":"見出し","detail":"説明"},{"title":"見出し","detail":"説明"},{"title":"見出し","detail":"説明"}]}`;

  let resp;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25000);
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: sys,
        messages: [{ role: 'user', content: user }],
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
  } catch (e) {
    return json({ ok: false, fallback: true, reason: 'upstream_error' });
  }

  if (!resp.ok) {
    return json({ ok: false, fallback: true, reason: 'api_' + resp.status });
  }

  let out;
  try {
    out = await resp.json();
  } catch (e) {
    return json({ ok: false, fallback: true, reason: 'bad_response' });
  }

  const text = out && out.content && out.content[0] && out.content[0].text ? out.content[0].text : '';
  let parsed = null;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch (e) {
    parsed = null;
  }

  if (!parsed || !parsed.summary || !Array.isArray(parsed.useCases)) {
    return json({ ok: false, fallback: true, reason: 'parse_failed' });
  }

  const clean = {
    ok: true,
    industry: (parsed.industry || '').toString().slice(0, 40),
    summary: (parsed.summary || '').toString().slice(0, 800),
    useCases: parsed.useCases
      .slice(0, 3)
      .map((u) => ({
        title: (u.title || '').toString().slice(0, 60),
        detail: (u.detail || '').toString().slice(0, 300),
      }))
      .filter((u) => u.title || u.detail),
  };
  return json(clean);
}
