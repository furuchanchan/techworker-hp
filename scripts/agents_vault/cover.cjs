// エージェント保管庫の表紙（1200×630 PNG）を書き出す。
// 使い方: node scripts/agents_vault/cover.cjs <元HTMLのフォルダ> <出力フォルダ> [--force]
// 元HTMLは `python3 scripts/agents_vault/vault.py covers <フォルダ>` で作る。既にあるPNGは --force が無い限り作り直さない。
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async () => {
  const [src, out, flag] = process.argv.slice(2);
  if (!src || !out) throw new Error("usage: cover.cjs <src> <out> [--force]");
  fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(src).filter((f) => f.endsWith(".html"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  let made = 0;
  for (const f of files) {
    const dest = path.join(out, f.replace(/\.html$/, ".png"));
    if (fs.existsSync(dest) && flag !== "--force") continue;
    await page.goto(pathToFileURL(path.resolve(src, f)).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const box = await page.$("#cover");
    await box.screenshot({ path: dest });
    made++;
  }
  await browser.close();
  console.log(JSON.stringify({ covers: files.length, made }));
})().catch((err) => { console.error(err); process.exit(1); });
