const DATABASE_ID  = 'e6ed3221-1c4f-460d-a15a-b9d18aa677c7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  if (isDiag)    { score += 4;                           reasons.push('セキュリティ診断を実施'); }
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

async function saveToNotion(data, apiKey) {
  const msg = ((data.diag_score != null)
    ? `【🛡️セキュリティ診断 ${data.diag_score}/${data.diag_max || 14}・${data.diag_band || ''}】\n${data.diag_answers || ''}\n${data.message || ''}`
    : (data.message || '')).trim().slice(0, 1900);
  const properties = {
    'お名前':     { title:     [{ text: { content: data.name    || '' } }] },
    '会社名':     { rich_text: [{ text: { content: data.company || '' } }] },
    '相談内容':   { rich_text: [{ text: { content: msg } }] },
    'ステータス': { select:    { name: '未対応' } },
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
        text: { type: 'mrkdwn', text: `*🛡️ セキュリティ診断結果*\nスコア: ${data.diag_score}/${data.diag_max || 14}（${data.diag_band || '-'}）${data.diag_answers ? '\n' + data.diag_answers : ''}` },
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Debug: log which env vars are available
  console.log('ENV check - NOTION_API_KEY:', !!env.NOTION_API_KEY, 'SLACK_WEBHOOK_URL:', !!env.SLACK_WEBHOOK_URL);

  if (!env.NOTION_API_KEY) {
    return new Response(JSON.stringify({ error: 'NOTION_API_KEY not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
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
