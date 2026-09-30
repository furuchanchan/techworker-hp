const DATABASE_ID  = 'e6ed3221-1c4f-460d-a15a-b9d18aa677c7';

// 自サイトのオリジンのみ許可（スパム・他サイトからの不正POST対策）
const ALLOWED_ORIGINS = new Set([
  'https://techworker.co.jp',
  'https://www.techworker.co.jp',
]);

// リクエスト Origin が許可リストにあればその値を反映（無ければ ACAO を付けずブラウザ側で遮断）
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (ALLOWED_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

// サーバ側でも送信元を検証（CORSはブラウザ越しのみ。Origin/Referer で他サイト発を弾く）
function isAllowedSource(request) {
  const origin = request.headers.get('Origin');
  if (origin) return ALLOWED_ORIGINS.has(origin);
  // 同一オリジンPOSTで Origin が省略される場合は Referer のオリジンで判定
  const ref = request.headers.get('Referer') || '';
  try { return ALLOWED_ORIGINS.has(new URL(ref).origin); } catch { return false; }
}

// 営業の連絡に使うため、すべてのフォームで必須にしている項目。空や形式違いの送信は受け付けない
const REQUIRED_FIELDS = ['name', 'company', 'email', 'phone', 'department', 'position', 'company_size'];
// Notion の「会社規模」select の選択肢と一致させる
const COMPANY_SIZES = new Set(['1-10名', '11-50名', '51-100名', '101-300名', '301名以上']);

// CoeSignal（worker の /api/contact）からの転送は会社規模を送っていない。
// CoeSignal のフォームに会社規模を足したら、この例外を消す
const fromCoeSignal = (data) => String(data.source || '').startsWith('CoeSignal');

function invalidFields(data) {
  const bad = REQUIRED_FIELDS.filter((k) => !data[k] && !(k === 'company_size' && fromCoeSignal(data)));
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) bad.push('email');
  const digits = data.phone.replace(/\D/g, '').length;
  if (data.phone && (digits < 10 || digits > 15)) bad.push('phone');
  if (data.company_size && !COMPANY_SIZES.has(data.company_size)) bad.push('company_size');
  return bad;
}

const INQUIRY_MAP = {
  consultation: '無料相談',
  document:     '資料請求',
};

// ===== Intent scoring =====
// 既存の sessionStorage 計測(intent_pages / intent_visits / source 等)を
// スコア化し、高意図リードを Slack で優先表示する。
function computeIntent(data) {
  const pages   = (data.intent_pages || '').toLowerCase();
  const visits  = parseInt(data.intent_visits || '1', 10) || 1;
  const reasons = [];
  let score = 0;
  const occ = (re) => (pages.match(re) || []).length;

  const nTraining = occ(/training/g);
  const nCases    = occ(/cases/g);
  const nLP       = occ(/launch-simulation/g);
  const nLibrary  = occ(/library/g);
  const nMedia    = occ(/\/media/g);
  const isDiag    = /診断|security-check|diagnos/i.test((data.source || '') + ' ' + pages) || data.diag_score != null;

  if (nTraining) { score += Math.min(nTraining * 3, 6); reasons.push(`研修ページ${nTraining}回`); }
  if (nCases)    { score += Math.min(nCases * 2, 4);     reasons.push(`実績/事例${nCases}回`); }
  if (nLP)       { score += Math.min(nLP * 2, 4);        reasons.push(`シミュLP${nLP}回`); }
  if (isDiag)    { score += 4;                           reasons.push('AI活用度診断を実施'); }
  if (nLibrary)  { score += Math.min(nLibrary, 2);       reasons.push(`資料DL${nLibrary}回`); }
  if (nMedia)    { score += 1;                           reasons.push('メディア閲覧'); }
  if (visits >= 3)      { score += 3; reasons.push(`${visits}回目の訪問`); }
  else if (visits === 2){ score += 1; reasons.push('再訪問'); }
  if (/301名以上|101-300名|51-100名/.test(data.company_size || '')) { score += 1; reasons.push('中堅〜大企業'); }

  let emoji = '', label = '通常', priority = 'normal';
  if (score >= 8)      { emoji = '🔥🔥🔥'; label = '最優先リード'; priority = 'hot'; }
  else if (score >= 4) { emoji = '🔥';     label = '高インテント'; priority = 'warm'; }
  return { score, emoji, label, priority, reasons };
}

// ===== 営業・売り込みの自動判定 =====
// 本文が書かれた送信だけを Claude Haiku に判定させる。
// 判定できない（キー未設定・タイムアウト・APIエラー）ときは通す：
// 本物の相談を取りこぼす損のほうが、営業が1通混ざる損より大きいため。
const SALES_MODEL = 'claude-haiku-4-5-20251001';
const SALES_STATUS = '営業（自動判定）';
const SALES_SYSTEM = `あなたは株式会社TechWorker（法人向け生成AI研修・AI活用支援・業務図サービスCompanyMap AIを提供）の問い合わせフォームの受付係です。
送られてきた問い合わせが「TechWorkerに対する営業・売り込み」かどうかを判定してください。

営業・売り込み（sales=true）の例:
- 送信者が自社の商品・サービス・ツールを紹介し、導入や商談を持ちかけている
- 業務提携・代理店・協業・アライアンスの打診で、送信者側のサービスを売る目的のもの
- SEO・広告・Web制作・営業代行・採用代行・人材紹介・オフショア開発・M&A仲介・資金調達・補助金申請代行などの案内
- メディア掲載・アワード・展示会出展などの有料枠の勧誘
- 「貴社のお役に立てると思い」「ご提案させていただきたく」など、送信者側が提供する立場で連絡している

営業ではない（sales=false）の例:
- TechWorkerの研修・AI活用支援・CompanyMap AIの導入検討、見積・資料請求・質問
- 自社のAI活用の悩みの相談
- 取材依頼（掲載料を求めないもの）、採用への応募
- 定型文（例:「【資料ダウンロード】…」「ご希望: …」）だけの送信

迷うときは sales=false にしてください。本物のお客さんを止めることが一番の失敗です。`;

async function classifySales(data, apiKey) {
  const message = String(data.message || '').trim();
  if (!message || !apiKey) return null;
  const content = [
    `会社名: ${data.company || '-'}`,
    `部署: ${data.department || '-'}`,
    `役職: ${data.position || '-'}`,
    `ご用件: ${INQUIRY_MAP[data.inquiry_type] || data.inquiry_type || '-'}`,
    `お問い合わせ内容:\n${message.slice(0, 4000)}`,
  ].join('\n');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: SALES_MODEL,
        max_tokens: 300,
        system: SALES_SYSTEM,
        tools: [{
          name: 'judge',
          description: '問い合わせが営業・売り込みかどうかの判定結果を返す',
          input_schema: {
            type: 'object',
            properties: {
              sales:  { type: 'boolean', description: '営業・売り込みなら true' },
              reason: { type: 'string',  description: '判定理由（日本語で1文）' },
            },
            required: ['sales', 'reason'],
          },
        }],
        tool_choice: { type: 'tool', name: 'judge' },
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      console.error('Sales classifier error:', res.status, await res.text());
      return null;
    }
    const body = await res.json();
    const out = (body.content || []).find((c) => c.type === 'tool_use');
    if (!out || typeof out.input?.sales !== 'boolean') return null;
    return { sales: out.input.sales, reason: String(out.input.reason || '') };
  } catch (err) {
    console.error('Sales classifier failed:', err?.message || err);
    return null;
  }
}

async function saveToNotion(data, apiKey, salesReason = null) {
  let msg = ((data.diag_score != null)
    ? `【📊AI活用度診断 ${data.diag_band || ''}（${data.diag_score}/${data.diag_max || 100}）】\n${data.diag_answers || ''}\n${data.message || ''}`
    : (data.message || '')).trim();
  if (salesReason) msg = `【営業と自動判定・送信を停止】${salesReason}\n${msg}`;
  msg = msg.slice(0, 1900);
  const properties = {
    'お名前':     { title:     [{ text: { content: data.name    || '' } }] },
    '会社名':     { rich_text: [{ text: { content: data.company || '' } }] },
    '相談内容':   { rich_text: [{ text: { content: msg } }] },
    'ステータス': { select:    { name: salesReason ? SALES_STATUS : '未対応' } },
  };
  if (data.email)        properties['メール']         = { email:        data.email };
  if (data.phone)        properties['電話番号']       = { phone_number: data.phone };
  if (data.department)   properties['部署']           = { rich_text: [{ text: { content: data.department } }] };
  if (data.position)     properties['役職']           = { rich_text: [{ text: { content: data.position } }] };
  if (data.company_size) properties['会社規模']       = { select:       { name: data.company_size } };
  if (data.inquiry_type) properties['問い合わせ種別'] = { select:       { name: INQUIRY_MAP[data.inquiry_type] || '無料相談' } };
  if (data.source)       properties['ソース']         = { select:       { name: data.source } };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization:    `Bearer ${apiKey}`,
      'Content-Type':   'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ parent: { database_id: DATABASE_ID }, properties }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error('Notion API error:', res.status, body);
    throw new Error(`Notion ${res.status}: ${body}`);
  }
  return true;
}

async function sendSlackNotification(data, webhookUrl) {
  if (!webhookUrl) {
    console.error('SLACK_WEBHOOK_URL is not set');
    return;
  }
  const type = INQUIRY_MAP[data.inquiry_type] || data.inquiry_type || '-';
  const pages = data.intent_pages || '';
  const intent = computeIntent(data);
  const utm = (data.intent_utm && data.intent_utm.replace(/\|/g, '')) ? `\nUTM: ${data.intent_utm}` : '';
  const intentText = `*行動シグナル*\n流入元: ${data.intent_referrer || '(direct)'}\nランディング: ${data.intent_landing || '-'}\n閲覧経路: ${pages || '-'}\n訪問回数: ${data.intent_visits || '1'}回目${utm}`;
  const headerText = `${intent.emoji ? intent.emoji + ' ' + intent.label + '｜' : ''}問い合わせ: ${data.name || '(名前なし)'}`;
  const payload = {
    text: `${intent.emoji ? intent.emoji + ' ' : ''}HP問い合わせ: ${data.name || '(名前なし)'} / ${data.company || '(会社名なし)'}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: headerText },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*インテントスコア: ${intent.score}* ${intent.emoji} ${intent.label}${intent.reasons.length ? `\n→ ${intent.reasons.join('・')}` : ''}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*会社名*\n${data.company || '-'}` },
          { type: 'mrkdwn', text: `*部署*\n${data.department || '-'}` },
          { type: 'mrkdwn', text: `*役職*\n${data.position || '-'}` },
          { type: 'mrkdwn', text: `*種別*\n${type}` },
          { type: 'mrkdwn', text: `*ソース*\n${data.source || 'HP本体'}` },
          { type: 'mrkdwn', text: `*メール*\n${data.email || '-'}` },
          { type: 'mrkdwn', text: `*電話番号*\n${data.phone || '-'}` },
          { type: 'mrkdwn', text: `*会社規模*\n${data.company_size || '-'}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*相談内容*\n${data.message || '-'}` },
      },
      ...(data.diag_score != null ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*📊 AI活用度診断結果*\n成熟度: ${data.diag_band || '-'}（${data.diag_score}/${data.diag_max || 100}）${data.diag_answers ? '\n' + data.diag_answers : ''}` },
      }] : []),
      {
        type: 'section',
        text: { type: 'mrkdwn', text: intentText },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `TechWorker HP | ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}` },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('Slack webhook error:', res.status, body);
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestPost({ request, env }) {
  const CORS = corsHeaders(request);

  // 他サイト・不明な送信元からのPOSTを拒否
  if (!isAllowedSource(request)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ハニーポット: 人間には見えない隠しフィールド(website / hp)が埋まっていればbotとみなし、
  // 成功を装って黙って破棄（保存・通知しない）
  if ((data.website && String(data.website).trim()) || (data.hp && String(data.hp).trim())) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // 必須項目チェック: 全角で入力された電話番号は半角にそろえてから数字の桁数を見る
  for (const k of REQUIRED_FIELDS) data[k] = String(data[k] ?? '').trim();
  data.phone = data.phone.normalize('NFKC');
  const invalid = invalidFields(data);
  if (invalid.length) {
    return new Response(JSON.stringify({ error: 'Missing required fields', fields: invalid }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!env.NOTION_API_KEY) {
    return new Response(JSON.stringify({ error: 'NOTION_API_KEY not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // 営業・売り込みと判定したら送信を止める。誤判定をあとで拾えるよう Notion には残し、Slack には流さない
  const verdict = await classifySales(data, env.ANTHROPIC_API_KEY);
  console.log('Sales verdict:', verdict ? JSON.stringify(verdict) : 'skipped');
  if (verdict?.sales) {
    try {
      await saveToNotion(data, env.NOTION_API_KEY, verdict.reason || '理由なし');
    } catch (err) {
      console.error('Notion save (sales) failed:', err.message);
    }
    return new Response(JSON.stringify({ error: 'sales_blocked' }), {
      status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Run Notion + Slack in parallel
  const [notionResult, slackResult] = await Promise.allSettled([
    saveToNotion(data, env.NOTION_API_KEY),
    sendSlackNotification(data, env.SLACK_WEBHOOK_URL),
  ]);

  console.log('Notion result:', notionResult.status, notionResult.reason?.message || '');
  console.log('Slack result:', slackResult.status, slackResult.reason?.message || '');

  if (notionResult.status === 'fulfilled' && notionResult.value) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const errMsg = notionResult.reason?.message || 'unknown';
  console.error('Notion save failed:', errMsg);
  return new Response(JSON.stringify({ error: 'Failed to save', detail: String(errMsg) }), {
    status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
