#!/usr/bin/env python3
"""公開前の点検（記事1本ずつ）。落ちた項目があれば exit 1。
使い方: python3 scripts/check_media_onpage.py media/kenshu/<slug>.html [...]
見る物（2026-11-11。Google の検索結果に出る形と、AI検索に引用される形）:
- title: 「 — TechWorker」を除いて 70 字以内（検索語を先頭に置くのは書く側の決まり。長さで切らない：平均6位の claude-code-cost も 60 字超）
- meta description: 80〜160 字
- h1 は1つ
- canonical が自分の URL
- 構造化データ: Article と FAQPage
- 画像に alt
- 申込み枠（.tw-lead）と lead.js（新作は記事中と記事末の2つ）
- 他の記事から本文の中で張られたリンクが2本以上（一覧・ホーム・sitemap は数えない）
- sitemap.xml に載っている
- 図（2026-11-20 古野さん「視覚的な情報少なすぎて最悪」「リアルタイム系は特にリアルタイムな画像を」）:
  本文の図（figure.fig-inline）が3枚以上。公式の原文を引用する記事（.source-quote がある＝発表・時事・料金の記事）は、
  公式の画面（figure.fig-inline.fig-real。page_shot.mjs で撮った製品の画面）を入れるときは、直後の .fig-cap に「出典：」と撮影日。原文の切り抜き画像（-quote-N）は使わず、引用の形だけにする。
"""
import html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://techworker.co.jp/"
sitemap = (ROOT / "sitemap.xml").read_text()
others = [p for p in (ROOT / "media").rglob("*.html") if p.name != "index.html"]


def inbound(path):
    slug = path.stem
    rel = path.relative_to(ROOT).as_posix()[:-5]
    n = []
    for p in others:
        if p == path:
            continue
        s = p.read_text(errors="ignore")
        body = s[s.find("<article"):s.find("</article>")] if "<article" in s else ""
        if re.search(r'href="(?:[./]*%s|/%s|%s%s)(?:\.html)?(?:[#?"])' % (re.escape(slug), re.escape(rel), re.escape(SITE), re.escape(rel)), body):
            n.append(p.relative_to(ROOT).as_posix())
    return n


def check(f):
    path = (ROOT / f).resolve()
    s = path.read_text()
    rel = path.relative_to(ROOT).as_posix()[:-5]
    bad = []
    title = html.unescape(re.search(r"<title>(.*?)</title>", s, re.S).group(1)).replace(" — TechWorker", "").strip()
    if len(title) > 70: bad.append(f"title {len(title)}字（70字以内）")
    m = re.search(r'<meta name="description" content="([^"]*)"', s)
    d = html.unescape(m.group(1)) if m else ""
    if not 80 <= len(d) <= 160: bad.append(f"description {len(d)}字（80〜160字）")
    if len(re.findall(r"<h1[\s>]", s)) != 1: bad.append("h1 が1つでない")
    if f'<link rel="canonical" href="{SITE}{rel}">' not in s: bad.append("canonical が自分の URL でない")
    types = set()
    for j in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            o = json.loads(j)
        except json.JSONDecodeError:
            bad.append("JSON-LD が壊れている"); continue
        for x in (o if isinstance(o, list) else [o]):
            types.add(x.get("@type"))
    for t in ("Article", "FAQPage"):
        if t not in types: bad.append(f"構造化データ {t} が無い")
    if [i for i in re.findall(r"<img[^>]*>", s) if "facebook.com/tr" not in i and not re.search(r'\balt="[^"]+"', i) and 'aria-hidden' not in i and 'avatar' not in i]: bad.append("alt の無い画像")
    if s.count('class="tw-lead"') < 1 or "lead.js" not in s: bad.append("申込み枠（.tw-lead と lead.js）が無い")
    body = s[s.find("<article"):s.find("</article>")] if "<article" in s else s
    figs = re.findall(r'<figure class="([^"]*\bfig-inline\b[^"]*)"', body)
    if len(figs) < 3: bad.append(f"本文の図が {len(figs)}枚（3枚以上）")
    # 2026-11-20 本人「赤文字で引くだけのところはいらない」「視認性が下がっている」：原文の切り抜き画像は使わず、引用（blockquote.source-quote）で見せる
    if re.search(r'figs/[a-z0-9-]+-quote-\d\.(jpg|png)', body) or "下線は弊社" in body: bad.append("原文の切り抜き画像がある（引用の形だけにする）")
    real = re.findall(r'<figure class="[^"]*\bfig-real\b[^"]*">.*?</figure>\s*(<p class="fig-cap">.*?</p>)?', body, re.S)
    if any(not (c and "出典：" in c and "撮影" in c) for c in real): bad.append("公式の画面の直後に、出典と撮影日の .fig-cap が無い")
    links = inbound(path)
    if len(links) < 2: bad.append(f"他の記事の本文からのリンクが {len(links)}本（2本以上）")
    if f"<loc>{SITE}{rel}</loc>" not in sitemap: bad.append("sitemap に無い")
    return bad, links


fail = 0
for f in sys.argv[1:]:
    bad, links = check(f)
    print(("NG " if bad else "OK ") + f + (" ｜ " + " ／ ".join(bad) if bad else f" ｜ 被リンク{len(links)}本"))
    fail |= bool(bad)
sys.exit(fail)
