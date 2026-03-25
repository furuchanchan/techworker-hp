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

async function saveToNotion(data, apiKey) {
  const properties = {
    'お名前':     { title:     [{ text: { content: data.name    || '' } }] },
    '会社名':     { rich_text: [{ text: { content: data.company || '' } }] },
    '相談内容':   { rich_text: [{ text: { content: data.message || '' } }] },
    'ステータス': { select:    { name: '未対応' } },
  };
  if (data.email)        properties['メール']         = { email:        data.email };
  if (data.phone)        properties['電話番号']       = { phone_number: data.phone };
  if (data.department)   properties['部署']           = { rich_text: [{ text: { content: data.department } }] };
  if (data.position)     properties['役職']           = { rich_text: [{ text: { content: data.position } }] };
  if (data.company_size) properties['会社規模']       = { select:       { name: data.company_size } };
  if (data.inquiry_type) properties['問い合わせ種別'] = { select:       { name: INQUIRY_MAP[data.inquiry_type] || '無料相談' } };

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
  const payload = {
    text: `HP問い合わせ: ${data.name || '(名前なし)'} / ${data.company || '(会社名なし)'}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `HP問い合わせ: ${data.name || '(名前なし)'}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*会社名*\n${data.company || '-'}` },
          { type: 'mrkdwn', text: `*部署*\n${data.department || '-'}` },
          { type: 'mrkdwn', text: `*役職*\n${data.position || '-'}` },
          { type: 'mrkdwn', text: `*種別*\n${type}` },
          { type: 'mrkdwn', text: `*メール*\n${data.email || '-'}` },
          { type: 'mrkdwn', text: `*電話番号*\n${data.phone || '-'}` },
          { type: 'mrkdwn', text: `*会社規模*\n${data.company_size || '-'}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*相談内容*\n${data.message || '-'}` },
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
