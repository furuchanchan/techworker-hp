"""CompanyMap AI Docs を Markdown から HTML に組み立てる。

使い方（リポジトリのルートで）:
  uv run --with markdown companymap/docs/build.py

- 元の文章は companymap/docs/*.md（公開もする。AI が読みやすいように .md のまま置く）
- 出力は companymap/docs/*.html と llms.txt。sitemap.xml の Docs の行も書き換える
- ページの並びとサイドバーは PAGES が正本
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

import markdown
from markdown.extensions.toc import slugify_unicode

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "companymap" / "docs"
SITE = "https://techworker.co.jp"
BASE = "/companymap/docs"
CSS_VER = "20261007a"

# (グループ名, [(slug, サイドバーの表示名)])。slug "index" は Docs のトップ
PAGES: list[tuple[str, list[tuple[str, str]]]] = [
    ("はじめに", [
        ("index", "はじめに"),
        ("overview", "CompanyMap AIとは"),
    ]),
    ("進め方", [
        ("how-it-works", "進め方と分担"),
        ("first-two-weeks", "最初の2週間"),
        ("collecting", "業務の情報の集め方"),
        ("deliverables", "お渡しするもの"),
        ("reading-the-map", "業務図の読み方"),
    ]),
    ("導入の判断", [
        ("status", "機能と提供状況"),
        ("security", "データの取り扱い"),
        ("procurement", "導入前の確認事項"),
        ("not-fit", "向いていない使い方"),
    ]),
    ("その他", [
        ("company", "運営会社と実績"),
        ("faq", "よくある質問"),
        ("changelog", "更新履歴"),
    ]),
]

FLAT = [(g, s, label) for g, items in PAGES for s, label in items]


def url(slug: str) -> str:
    return f"{BASE}/" if slug == "index" else f"{BASE}/{slug}"


def parse(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        sys.exit(f"{path.name}: 先頭に --- で囲んだ title / description / updated が要る")
    meta = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    for key in ("title", "description", "updated"):
        if not meta.get(key):
            sys.exit(f"{path.name}: {key} が空")
    return meta, text[m.end():]


def render_md(body: str) -> tuple[str, list[tuple[str, str]]]:
    md = markdown.Markdown(
        extensions=["tables", "attr_list", "md_in_html", "sane_lists", "toc"],
        extension_configs={"toc": {"slugify": slugify_unicode, "toc_depth": "2-3"}},
    )
    out = md.convert(body)
    h2 = [(t["id"], t["name"]) for t in md.toc_tokens if t["level"] == 2]
    return out, h2


SVG_DEFS = """<svg width="0" height="0" style="position:absolute"><defs><symbol id="logo" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0B0B0C"/><path d="M45 17H30C23.9 17 19 21.9 19 28V36C19 42.1 23.9 47 30 47H45" fill="none" stroke="#FFFFFF" stroke-width="5.2" stroke-linecap="round"/><circle cx="47" cy="17" r="5.6" fill="#FFFFFF"/><rect x="12.5" y="25.5" width="13" height="13" rx="3.5" fill="#0B0B0C" stroke="#FFFFFF" stroke-width="4.4"/><circle cx="47" cy="47" r="5.6" fill="#FFFFFF"/></symbol></defs></svg>"""

GTAG = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-3V34NWXVCJ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  try{var twq=/[?&]tw_internal=([01])/.exec(location.search);if(twq)twq[1]==='1'?localStorage.setItem('tw_internal','1'):localStorage.removeItem('tw_internal');if(localStorage.getItem('tw_internal')==='1')gtag('set',{traffic_type:'internal'});}catch(e){}gtag('config', 'G-3V34NWXVCJ');
</script>
<script src="/assets/tw-track.js" defer></script>"""


def sidebar(current: str) -> str:
    parts = []
    here = ' aria-current="page"'
    for group, items in PAGES:
        lis = "".join(
            f'<li><a href="{url(s)}"{here if s == current else ""}>{html.escape(label)}</a></li>'
            for s, label in items
        )
        parts.append(f'<p class="g">{html.escape(group)}</p><ul>{lis}</ul>')
    return "".join(parts)


def page_html(slug: str, meta: dict[str, str], body_html: str, h2: list[tuple[str, str]]) -> str:
    i = [s for _, s, _ in FLAT].index(slug)
    prev = FLAT[i - 1] if i > 0 else None
    nxt = FLAT[i + 1] if i + 1 < len(FLAT) else None
    group = FLAT[i][0]
    title = meta["title"]
    desc = meta["description"]
    canon = SITE + url(slug)
    is_top = slug == "index"
    page_title = "CompanyMap AI Docs｜サービスの説明と導入の資料 — TechWorker" if is_top else f"{title}｜CompanyMap AI Docs — TechWorker"

    crumbs = [("CompanyMap AI", "/companymap"), ("Docs", f"{BASE}/")]
    if not is_top:
        crumbs.append((title, url(slug)))
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "TechArticle",
                "headline": title,
                "description": desc,
                "url": canon,
                "inLanguage": "ja",
                "dateModified": meta["updated"],
                "about": {"@type": "Service", "name": "CompanyMap AI", "url": SITE + "/companymap"},
                "publisher": {"@type": "Organization", "name": "株式会社TechWorker", "url": SITE + "/"},
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": n + 1, "name": name, "item": SITE + href}
                    for n, (name, href) in enumerate(crumbs)
                ],
            },
        ],
    }
    crumb_html = " <span>/</span> ".join(
        f'<a href="{href}">{html.escape(name)}</a>' for name, href in crumbs[:-1]
    ) if not is_top else '<a href="/companymap">CompanyMap AI</a>'

    toc = ""
    if len(h2) >= 2:
        toc = '<aside class="toc" aria-label="このページの見出し"><p>このページ</p><ol>' + "".join(
            f'<li><a href="#{hid}">{name}</a></li>' for hid, name in h2
        ) + "</ol></aside>"

    pager = '<nav class="pager" aria-label="前後のページ">'
    pager += f'<a class="prev" href="{url(prev[1])}"><small>前へ</small>{html.escape(prev[2])}</a>' if prev else "<span></span>"
    pager += f'<a class="next" href="{url(nxt[1])}"><small>次へ</small>{html.escape(nxt[2])}</a>' if nxt else "<span></span>"
    pager += "</nav>"

    head_block = "" if is_top else (
        f'<p class="crumb">{crumb_html}</p>'
        f'<p class="grp">{html.escape(group)}</p>'
        f"<h1>{html.escape(title)}</h1>"
        f'<p class="desc">{html.escape(desc)}</p>'
    )

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
{GTAG}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(page_title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{canon}">
<link rel="alternate" type="text/markdown" href="{BASE}/{slug}.md">
<link rel="icon" type="image/svg+xml" href="/assets/companymap/favicon.svg">
<link rel="icon" href="/assets/companymap/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/assets/companymap/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="TechWorker">
<meta property="og:title" content="{html.escape(page_title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{SITE}/assets/companymap/ogp.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Inter+Tight:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/companymap/docs.css?v={CSS_VER}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body class="docs{' top' if is_top else ''}">{SVG_DEFS}
<nav class="nav"><div class="bar"><a class="brand" href="/companymap"><svg class="mark"><use href="#logo"/></svg><span class="word">CompanyMap</span><span class="ai">AI</span></a><a class="dl" href="{BASE}/">Docs</a>
<div class="links"><a href="/companymap">サービスの紹介</a><a href="/companymap/download">資料ダウンロード</a></div><a class="btn sm" href="/companymap/contact">相談する</a></div></nav>
<div class="layout">
<aside class="side" aria-label="Docsの目次">{sidebar(slug)}</aside>
<main class="main">
<details class="mnav"><summary>Docsの目次</summary>{sidebar(slug)}</details>
<article class="doc">
{head_block}
{body_html}
<p class="upd">最終更新：{meta["updated"]}</p>
</article>
<section class="cta" aria-label="相談と資料">
<div><b>まずは1つの業務を、図にしてみませんか。</b><span>30分の無料相談で、その部署の業務図を1枚おつくりします。</span></div>
<div class="acts"><a class="btn" href="/companymap/contact">無料相談を申し込む <i>→</i></a><a class="btn ghost" href="/companymap/download">資料をダウンロード</a></div>
</section>
{pager}
</main>
{toc}
</div>
<footer><div class="bar"><a class="brand" href="/companymap"><svg class="mark"><use href="#logo"/></svg><span class="word">CompanyMap</span><span class="ai">AI</span></a><span>提供：<a href="/">株式会社TechWorker</a></span><a href="{BASE}/">Docs</a><a href="/companymap/cases">他社のAI活用事例</a><a href="/privacy">プライバシーポリシー</a><span class="r">© 2026 TechWorker Inc.</span></div></footer>
</body>
</html>
"""


def llms_txt(metas: dict[str, dict[str, str]]) -> str:
    lines = [
        "# CompanyMap AI Docs",
        "",
        "> CompanyMap AI（株式会社TechWorker）は、担当者への聞き取りや手元の資料から、仕事の流れを1枚の業務図にするサービスです。図を見ながらAIに任せる仕事と人が判断する仕事を分け、実装担当（FDE）が構築から効果の確認まで一緒に進めます。",
        "",
        "各ページは .md でも読めます。",
        "",
    ]
    for group, items in PAGES:
        lines.append(f"## {group}")
        lines.append("")
        for s, _ in items:
            m = metas[s]
            lines.append(f"- [{m['title']}]({SITE}{BASE}/{s}.md): {m['description']}")
        lines.append("")
    lines += ["## 関連", "", f"- [サービスの紹介（LP）]({SITE}/companymap)", f"- [無料相談]({SITE}/companymap/contact)", ""]
    return "\n".join(lines)


def update_sitemap(metas: dict[str, dict[str, str]]) -> None:
    path = ROOT / "sitemap.xml"
    xml = path.read_text(encoding="utf-8")
    xml = re.sub(r"\s*<url><loc>https://techworker\.co\.jp/companymap/docs[^<]*</loc>.*?</url>", "", xml)
    rows = "".join(
        f"\n  <url><loc>{SITE}{url(s)}</loc><lastmod>{metas[s]['updated']}</lastmod><priority>{'0.7' if s == 'index' else '0.5'}</priority><changefreq>monthly</changefreq></url>"
        for _, s, _ in FLAT
    )
    anchor = re.search(r"\n  <url><loc>https://techworker\.co\.jp/companymap/contact</loc>.*?</url>", xml)
    if not anchor:
        sys.exit("sitemap.xml に /companymap/contact の行が無い")
    xml = xml[: anchor.end()] + rows + xml[anchor.end():]
    path.write_text(xml, encoding="utf-8")


def main() -> None:
    metas = {}
    for _, slug, _ in FLAT:
        src = DOCS / f"{slug}.md"
        if not src.exists():
            sys.exit(f"{src.name} が無い")
        meta, body = parse(src)
        body_html, h2 = render_md(body)
        (DOCS / f"{slug}.html").write_text(page_html(slug, meta, body_html, h2), encoding="utf-8")
        metas[slug] = meta
    stray = {p.stem for p in DOCS.glob("*.md")} - {s for _, s, _ in FLAT}
    if stray:
        sys.exit(f"PAGES に無い .md がある: {sorted(stray)}")
    (DOCS / "llms.txt").write_text(llms_txt(metas), encoding="utf-8")
    update_sitemap(metas)
    print(f"built {len(metas)} pages")


if __name__ == "__main__":
    main()
