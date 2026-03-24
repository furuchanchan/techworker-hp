const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID    = 'ee00d003-9b42-4fa0-a5e9-67153d0a1435';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INQUIRY_TYPE_MAP = {
  consultation: '無料相談',
  document:     '資料請求',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const properties = {
    'お名前':      { title:      [{ text: { content: data.name    || '' } }] },
    '会社名':      { rich_text:  [{ text: { content: data.company || '' } }] },
    '相談内容':    { rich_text:  [{ text: { content: data.message || '' } }] },
    'ステータス':  { select:     { name: '未対応' } },
  };

  if (data.email)        properties['メール']       = { email:        data.email };
  if (data.phone)        properties['電話番号']     = { phone_number: data.phone };
  if (data.company_size) properties['会社規模']     = { select:       { name: data.company_size } };
  if (data.inquiry_type) properties['問い合わせ種別'] = { select:     { name: INQUIRY_TYPE_MAP[data.inquiry_type] || '無料相談' } };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization:    `Bearer ${NOTION_API_KEY}`,
      'Content-Type':   'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ parent: { database_id: DATABASE_ID }, properties }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Notion API error:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Failed to save' }) };
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
};
