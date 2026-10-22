// 効果の試算（/companymap/sim）の点検：例の数字と数字を替えたあとの合計・内訳・申込に添える要約、4つの幅での横のはみ出し、ページのエラー、1画面目の撮影。
// 実行: node scripts/companymap_sim_check.mjs [撮影の置き場]   （Playwright は PW で場所を指定。既定は sokumitsu-site の node_modules）
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const PW = process.env.PW || '/Users/koutaroufuruno/Projects/sokumitsu-site/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = path.resolve(process.argv[2] || path.join(root, '.sim-shots')); fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// Cloudflare Pages と同じく、/companymap/sim は companymap/sim.html を返す
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
await new Promise(r => srv.listen(8858, r));
const url = 'http://localhost:8858/companymap/sim';
const b = await chromium.launch(); let errs = 0, bad = 0;
for (const [W, H] of [[1440, 900], [1024, 768], [768, 1024], [390, 844]]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', e => { errs++; console.log('ERR', String(e)); });
  p.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await p.goto(url); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1800);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) bad++;
  const fit = await p.evaluate(() => { const r = document.getElementById('simtop').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
  console.log(W, 'overflow', over, 'simtop', JSON.stringify(fit), 'fits', fit.bottom <= H);
  const g = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#simtop [data-o], #simr [data-o]')].map(e => [e.dataset.o, e.textContent])));
  if (W === 1440 || W === 390) {
    console.log(W, 'default', JSON.stringify(await g()));
    await p.screenshot({ path: `${shots}/sim-first_${W}.png` });
    const box = await p.locator('#schart svg').boundingBox();
    await p.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5); await p.waitForTimeout(200);
    await p.locator('#schart').screenshot({ path: `${shots}/sim-hover_${W}.png` });
    console.log(W, 'tip', (await p.locator('.stip').innerText()).replace(/\n/g, ' / '));
    await p.screenshot({ path: `${shots}/sim-full_${W}.png`, fullPage: true });
  }
  if (W === 1440) {
    await p.fill('input[data-for=ppl]', '10'); await p.fill('input[data-for=hpd]', '4'); await p.fill('input[data-for=askm]', '60'); await p.fill('input[data-for=pay]', '600'); await p.click('.sscn button[data-s=hi]');
    await p.click('.sper button[data-y="5"]'); await p.waitForTimeout(1700);
    console.log(W, 'changed', JSON.stringify(await g()));
    console.log('stored', await p.evaluate(() => sessionStorage.getItem('tw_sim')));
    await p.screenshot({ path: `${shots}/sim-5y_${W}.png` });
  }
  await p.context().close();
}
console.log('errs', errs, 'overflow-widths', bad); await b.close(); srv.close();
process.exitCode = errs || bad ? 1 : 0;
