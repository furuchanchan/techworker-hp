const DATABASE_ID  = 'e6ed3221-1c4f-460d-a15a-b9d18aa677c7';

// 自サイトのオリジンのみ許可（スパム・他サイトからの不正POST対策）
const ALLOWED_ORIGINS = new Set([
  'https://techworker.co.jp',
  'https://www.techworker.co.jp',
]);

// 自サイトに加え、techworker.co.jp 配下のサブドメイン（電材卸向けサイトなど）の https オリジンも許可する
function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.origin !== origin || u.protocol !== 'https:') return false;
    return u.hostname === 'techworker.co.jp' || u.hostname.endsWith('.techworker.co.jp');
  } catch { return false; }
}

// リクエスト Origin が許可されていればその値を反映（無ければ ACAO を付けずブラウザ側で遮断）
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (isAllowedOrigin(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

// サーバ側でも送信元を検証（CORSはブラウザ越しのみ。Origin/Referer で他サイト発を弾く）
function isAllowedSource(request) {
  const origin = request.headers.get('Origin');
  if (origin) return isAllowedOrigin(origin);
  // 同一オリジンPOSTで Origin が省略される場合は Referer のオリジンで判定
  const ref = request.headers.get('Referer') || '';
  try { return isAllowedOrigin(new URL(ref).origin); } catch { return false; }
}

// 営業の連絡に使うため、すべてのフォームで必須にしている項目。空や形式違いの送信は受け付けない
const REQUIRED_FIELDS = ['name', 'company', 'email', 'phone', 'department', 'position'];

// 電材卸向けサイトの実演申込・承継HD向けサイトの相談は、部署・役職を求めない
const SHORT_FORM_TYPES = new Set(['denzai_demo', 'denzai_document', 'shokei_consult']);
// 本体以外のサイト（電材卸・卸・商社・承継HD）からの申込。Slack の件名の頭に【種別】を付ける
const SITE_FORM_TYPES = new Set([...SHORT_FORM_TYPES, 'sokumitsu_demo', 'sokumitsu_report', 'kenshu_consult', 'kenshu_document', 'kenshu_check']);
const SHORT_FORM_REQUIRED_FIELDS = ['name', 'company', 'email', 'phone'];

function invalidFields(data) {
  const required = SHORT_FORM_TYPES.has(data.inquiry_type) ? SHORT_FORM_REQUIRED_FIELDS : REQUIRED_FIELDS;
  const bad = required.filter((k) => !data[k]);
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) bad.push('email');
  const digits = data.phone.replace(/\D/g, '').length;
  if (data.phone && (digits < 10 || digits > 15)) bad.push('phone');
  return bad;
}

const INQUIRY_MAP = {
  consultation: '無料相談',
  document:     '資料請求',
  denzai_demo:  '電材卸の見積の実演',
  denzai_document: '電材卸の資料ダウンロード',
  shokei_consult: '承継の買収後100日の相談',
  sokumitsu_demo: '卸・商社の見積の実演',
  sokumitsu_report: '卸・商社のAI活用レポート',
  kenshu_consult: '研修の相談',
  kenshu_document: '研修の資料ダウンロード',
  kenshu_check: '研修の点検30分の申込',
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
  if (data.inquiry_type === 'kenshu_check') { score += 4; reasons.push('安全度チェックに回答'); }
  if (nLibrary)  { score += Math.min(nLibrary, 2);       reasons.push(`資料DL${nLibrary}回`); }
  if (nMedia)    { score += 1;                           reasons.push('メディア閲覧'); }
  if (visits >= 3)      { score += 3; reasons.push(`${visits}回目の訪問`); }
  else if (visits === 2){ score += 1; reasons.push('再訪問'); }

  let emoji = '', label = '通常', priority = 'normal';
  if (score >= 8)      { emoji = '🔥🔥🔥'; label = '最優先リード'; priority = 'hot'; }
  else if (score >= 4) { emoji = '🔥';     label = '高インテント'; priority = 'warm'; }
  return { score, emoji, label, priority, reasons };
}

// ===== 営業・売り込みの自動判定 =====
// 人が書いた本文がある送信だけを Claude Haiku に判定させる。
// 判定できない（キー未設定・タイムアウト・APIエラー）ときは通す：
// 本物の相談を取りこぼす損のほうが、営業が1通混ざる損より大きいため。
const SALES_MODEL = 'claude-haiku-5-5';
const SALES_STATUS = '営業（自動判定）';

// 各サイトのフォームが本文の頭に入れる定型の1行（site.js の message_prefix。例「資料の請求：…」「ご用件：研修内容・費用を相談したい」）
const PREFIX_LINE = /^(資料の請求|ご用件)：/;

// 人が書いた本文。定型の1行を除いて空なら、判定にかけない
function writtenMessage(message) {
  const lines = String(message ?? '').trim().split('\n');
  if (PREFIX_LINE.test(lines[0])) lines.shift();
  return lines.join('\n').trim();
}

const SALES_SYSTEM = `あなたは株式会社TechWorker（法人向け生成AI研修・AI活用支援・業務図サービスCompanyMap AI・見積AI（電材卸向けのデンミツAI、卸・商社向けのソクミツAI）を提供）の問い合わせフォームの受付係です。
送られてきた問い合わせが「TechWorkerに対する営業・売り込み」かどうかを判定してください。

営業・売り込み（sales=true）の例:
- 送信者が自社の商品・サービス・ツールを紹介し、導入や商談を持ちかけている
- 業務提携・代理店・協業・アライアンスの打診で、送信者側のサービスを売る目的のもの
- SEO・広告・Web制作・営業代行・採用代行・人材紹介・オフショア開発・M&A仲介・資金調達・補助金申請代行などの案内
- メディア掲載・アワード・展示会出展などの有料枠の勧誘
- 「貴社のお役に立てると思い」「ご提案させていただきたく」など、送信者側が提供する立場で連絡している

営業ではない（sales=false）の例:
- TechWorkerの研修・AI活用支援・CompanyMap AI・見積AI（デンミツAI・ソクミツAI）の導入検討、実演・見積・資料・レポートの申込、質問
- 自社のAI活用の悩みの相談
- 公募・協創プログラム・オープンイノベーションの窓口、自治体・業界団体・大企業の担当者が、TechWorkerのサービスの導入・実証・共同の取り組みを相談しているもの（「協業のご相談」と書かれていても、送信者が自社の商品を売り込んでいなければ営業ではない）
- 事業承継・M&Aで会社を買った（買う）側が、買収後の引き継ぎ・PMIについて相談しているもの
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

// 最初のページに参照元が無い（直接の訪問）とき、フォームは直前に見ていたサイト内のページを流入元として送ってくる。
// サイト内のURLは流入元ではないので (direct) にそろえる
function normalizeReferrer(ref) {
  try { if (ALLOWED_ORIGINS.has(new URL(ref).origin)) return '(direct)'; } catch {}
  return ref;
}

// 流入元とUTMから、どこから来たかを分ける（Notionの「流入チャネル」とSlackの行動シグナルに出す）
const AI_HOST     = /(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|copilot\.com|notebooklm\.google\.com|felo\.ai|genspark\.ai)$/;
const SEARCH_HOST = /^(www\.)?(google\.[a-z.]+|bing\.com|duckduckgo\.com|ecosia\.org|baidu\.com)$|^(search\.)?yahoo\.co\.jp$|^search\.yahoo\.com$|^search\.naver\.com$/;
const SNS_HOST    = /(^|\.)(t\.co|x\.com|twitter\.com|facebook\.com|fb\.com|instagram\.com|linkedin\.com|lnkd\.in|youtube\.com|threads\.net)$/;
const MAIL_HOST   = /^(mail\.google\.com|outlook\.(live|office|office365)\.com|mail\.yahoo\.co\.jp)$/;

function hostChannel(host) {
  if (AI_HOST.test(host))     return 'AI検索';
  if (SEARCH_HOST.test(host)) return '検索';
  if (SNS_HOST.test(host))    return 'SNS';
  if (MAIL_HOST.test(host))   return 'メール';
  return null;
}

function classifyChannel({ intent_referrer: ref, intent_landing: landing, intent_utm: utm }) {
  if (!ref && !landing) return '記録なし';
  const [source = '', medium = ''] = String(utm || '').toLowerCase().split('|');
  if (/^(cpc|ppc|cpm|paid|paid[-_]?social|display|banner|ads?)$/.test(medium)) return '広告';
  if (/^(e-?mail|mail|newsletter)$/.test(medium)) return 'メール';
  if (/^(social|sns|social[-_]?network)$/.test(medium)) return 'SNS';
  // utm_source は「chatgpt.com」のようなドメインのことも「google」のような名前だけのこともある
  if (source) return hostChannel(source) || hostChannel(`${source}.com`) || '外部サイト';
  if (!ref || ref === '(direct)') return '直接';
  try { return hostChannel(new URL(ref).hostname) || '外部サイト'; } catch { return '外部サイト'; }
}

// 「どこから来たか」は、初めてサイトに来たときの記録を使う（後日あらためて来て問い合わせた人も、最初の入口が分かる）。
// その記録が無い送信は、今回の訪問を使う
const pageTitle = (t) => String(t || '').replace(/\s*(｜|\||—|-)\s*(株式会社)?TechWorker\s*$/, '');

function firstTouch(data) {
  if (data.intent_first_landing) {
    return { intent_referrer: data.intent_first_referrer, intent_landing: data.intent_first_landing, intent_utm: data.intent_first_utm, title: pageTitle(data.intent_first_title), at: data.intent_first_at };
  }
  return { intent_referrer: data.intent_referrer, intent_landing: data.intent_landing, intent_utm: data.intent_utm, title: pageTitle(data.intent_landing_title) };
}

const hasUtm = (utm) => !!(utm && utm.replace(/\|/g, ''));

// 今回の訪問を1行にまとめる（例: 3回目の訪問（初回 2026-09-12）｜今回の流入元 (direct)（直接）｜/training > /contact）
function visitSummary(data) {
  const first = data.intent_first_at && Number(data.intent_visits) > 1 ? `（初回 ${data.intent_first_at}）` : '';
  return `${data.intent_visits || '1'}回目の訪問${first}｜今回の流入元 ${data.intent_referrer || '-'}（${classifyChannel(data)}）｜${data.intent_pages || '-'}`;
}

async function saveToNotion(data, apiKey, salesReason = null) {
  let msg = ((data.diag_score != null)
    ? `【📊AI活用度診断 ${data.diag_band || ''}（${data.diag_score}/${data.diag_max || 100}）】\n${data.diag_answers || ''}\n${data.message || ''}`
    : (data.message || '')).trim();
  if (salesReason) msg = `【営業と自動判定・Slackに流さず】${salesReason}\n${msg}`;
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
  if (data.inquiry_type) properties['問い合わせ種別'] = { select:       { name: INQUIRY_MAP[data.inquiry_type] || '無料相談' } };
  if (data.source)       properties['ソース']         = { select:       { name: data.source } };
  const first = firstTouch(data);
  const text = (v) => ({ rich_text: [{ text: { content: String(v).slice(0, 1900) } }] });
  properties['流入チャネル'] = { select: { name: classifyChannel(first) } };
  if (first.intent_referrer)     properties['流入元']      = text(first.intent_referrer);
  if (first.intent_landing)      properties['ランディング'] = text(first.title ? `${first.intent_landing}｜${first.title}` : first.intent_landing);
  if (hasUtm(first.intent_utm))  properties['UTM']         = text(first.intent_utm);
  if (data.intent_landing)       properties['今回の訪問']   = text(visitSummary(data));

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
  const intent = computeIntent(data);
  const first = firstTouch(data);
  const intentText = [
    '*行動シグナル*',
    `どこから来たか: ${first.intent_referrer || '(フォームから届いていない)'}（${classifyChannel(first)}）`,
    `入口のページ: ${first.intent_landing ? (first.title ? `${first.intent_landing}｜${first.title}` : first.intent_landing) : '-'}`,
    ...(hasUtm(first.intent_utm) ? [`UTM: ${first.intent_utm}`] : []),
    ...(data.intent_landing ? [`今回: ${visitSummary(data)}`] : []),
  ].join('\n');
  const typeTag = SITE_FORM_TYPES.has(data.inquiry_type) ? `【${type}】` : '';
  const headerText = `${intent.emoji ? intent.emoji + ' ' + intent.label + '｜' : ''}${typeTag}問い合わせ: ${data.name || '(名前なし)'}`;
  const payload = {
    text: `${intent.emoji ? intent.emoji + ' ' : ''}${typeTag}HP問い合わせ: ${data.name || '(名前なし)'} / ${data.company || '(会社名なし)'}`,
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
  // 下でサーバーが足す定型の行（見積の月の件数・買収の頻度など）より前に、人が書いた本文があるかを見ておく
  const written = writtenMessage(data.message);
  if (data.inquiry_type === 'denzai_demo' || data.inquiry_type === 'sokumitsu_demo') {
    const quotes = String(data.quotes_per_month ?? '').trim().slice(0, 50);
    data.message = [String(data.message ?? '').trim(), quotes ? `見積の月の件数：${quotes}` : ''].filter(Boolean).join('\n');
  }
  if (data.inquiry_type === 'kenshu_check') {
    // 研修サイトの安全度チェック（15問）の点数と回答。人が書いた本文ではないので、営業の判定より後に足す
    const result = String(data.check_result ?? '').trim().slice(0, 1000);
    data.message = [String(data.message ?? '').trim(), result ? `安全度チェック: ${result}` : ''].filter(Boolean).join('\n');
  }
  if (data.inquiry_type === 'shokei_consult') {
    const deals = String(data.deals ?? '').trim().slice(0, 50);
    const diag = String(data.diag ?? '').trim().slice(0, 1000);
    data.message = [String(data.message ?? '').trim(), deals ? `買収の頻度: ${deals}` : '', diag ? `診断: ${diag}` : ''].filter(Boolean).join('\n');
  }
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

  if (data.intent_referrer)       data.intent_referrer       = normalizeReferrer(String(data.intent_referrer));
  if (data.intent_first_referrer) data.intent_first_referrer = normalizeReferrer(String(data.intent_first_referrer));

  // 営業・売り込みと判定した送信は Slack に流さず、Notion に「営業（自動判定）」で残す。
  // 送った人には受付の画面を出す（公募・協創窓口の「協業のご相談」のような本物を誤って止めても、相手に失敗と見せない。
  // 拾い直しは朝の1通に出る件数から Notion を見る）
  const verdict = written ? await classifySales(data, env.ANTHROPIC_API_KEY) : null;
  console.log('Sales verdict:', verdict ? JSON.stringify(verdict) : 'skipped');
  const salesReason = verdict?.sales ? (verdict.reason || '理由なし') : null;

  // Run Notion + Slack in parallel
  const [notionResult, slackResult] = await Promise.allSettled([
    saveToNotion(data, env.NOTION_API_KEY, salesReason),
    salesReason ? 'skipped (sales)' : sendSlackNotification(data, env.SLACK_WEBHOOK_URL),
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
