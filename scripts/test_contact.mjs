// functions/contact.js の確かめ。Notion・Slack・Anthropic への送信はすべて偽の fetch で受けるので、本物の行も通知もできない。
// 実行: node --test scripts/test_contact.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/contact.js';

const FORM = {
  name: '試験 太郎', company: '試験株式会社', email: 'test@example.com', phone: '03-1234-5678',
  department: '情報システム部', position: '部長', inquiry_type: 'consultation', message: 'AI研修の相談です',
};

// url の頭で返事を決める偽の fetch。呼ばれた url と body を calls に残す
function fakeFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) throw new Error(`unexpected fetch: ${url}`);
    const r = routes[key];
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  };
  return calls;
}

const SALES_VERDICT = { body: { content: [{ type: 'tool_use', input: { sales: true, reason: '広告の売り込み' } }] } };

function post(env) {
  const request = new Request('https://techworker.co.jp/contact', {
    method: 'POST',
    headers: { Origin: 'https://techworker.co.jp', 'Content-Type': 'application/json' },
    body: JSON.stringify(FORM),
  });
  return onRequestPost({ request, env: { NOTION_API_KEY: 'n', SLACK_WEBHOOK_URL: 'https://hooks.slack.test/x', ...env } });
}

const notionSlack = (calls) => calls.find((c) => c.url.startsWith('https://api.notion.com')).body.properties['Slack通知'].select.name;

test('Slack に届いたら Notion の「Slack通知」は「届いた」で、成功を返す', async () => {
  const calls = fakeFetch({ 'https://hooks.slack.test': {}, 'https://api.notion.com': {} });
  const res = await post();
  assert.equal(res.status, 200);
  assert.equal(notionSlack(calls), '届いた');
});

test('Slack が失敗しても受付は成功を返し、Notion に「届かず」を残す', async () => {
  const calls = fakeFetch({ 'https://hooks.slack.test': { status: 500 }, 'https://api.notion.com': {} });
  const res = await post();
  assert.equal(res.status, 200);
  assert.equal(notionSlack(calls), '届かず');
});

test('Slack の住所が未登録でも「届かず」を残す', async () => {
  const calls = fakeFetch({ 'https://api.notion.com': {} });
  const res = await post({ SLACK_WEBHOOK_URL: undefined });
  assert.equal(res.status, 200);
  assert.equal(notionSlack(calls), '届かず');
});

test('Slack への通信が落ちても「届かず」を残す', async () => {
  const calls = fakeFetch({ 'https://hooks.slack.test': new TypeError('network'), 'https://api.notion.com': {} });
  const res = await post();
  assert.equal(res.status, 200);
  assert.equal(notionSlack(calls), '届かず');
});

test('営業と判定したら Slack に送らず「流さず（営業）」を残す', async () => {
  const calls = fakeFetch({ 'https://api.anthropic.com': SALES_VERDICT, 'https://api.notion.com': {} });
  const res = await post({ ANTHROPIC_API_KEY: 'a' });
  assert.equal(res.status, 200);
  assert.ok(!calls.some((c) => c.url.startsWith('https://hooks.slack.test')));
  assert.equal(notionSlack(calls), '流さず（営業）');
});

test('Notion への保存が失敗したら、Slack に届いていても失敗を返す', async () => {
  fakeFetch({ 'https://hooks.slack.test': {}, 'https://api.notion.com': { status: 400, body: { message: 'bad' } } });
  const res = await post();
  assert.equal(res.status, 500);
});
