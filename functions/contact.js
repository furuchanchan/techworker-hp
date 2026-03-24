const DATABASE_ID  = 'ee00d003-9b42-4fa0-a5e9-67153d0a1435';
const NOTIFY_EMAIL = 'info@techworker.co.jp';

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
  return res.ok;
}

async function sendEmailNotification(data) {
  const body = [
    `【新規お問い合わせ】`,
    ``,
    `お名前: ${data.name || '-'}`,
    `会社名: ${data.company || '-'}`,
    `メール: ${data.email || '-'}`,
    `電話番号: ${data.phone || '-'}`,
    `会社規模: ${data.company_size || '-'}`,
    `種別: ${INQUIRY_MAP[data.inquiry_type] || data.inquiry_type || '-'}`,
    ``,
    `【相談内容】`,
    data.message || '-',
  ].join('\n');

  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: NOTIFY_EMAIL }] }],
      from: { email: 'noreply@techworker-hp.pages.dev', name: 'TechWorker お問い合わせフォーム' },
      subject: `【問い合わせ】${data.name || '（名前なし）'} / ${data.company || '（会社名なし）'}`,
      content: [{ type: 'text/plain', value: body }],
    }),
  });
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

  // Run both in parallel; email is best-effort backup
  const [notionOk] = await Promise.allSettled([
    saveToNotion(data, env.NOTION_API_KEY),
    sendEmailNotification(data),
  ]);

  if (notionOk.status === 'fulfilled' && notionOk.value) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Notion failed but email was attempted as backup
  console.error('Notion save failed for:', data.email);
  return new Response(JSON.stringify({ error: 'Failed to save' }), {
    status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
