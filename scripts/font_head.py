#!/usr/bin/env python3
"""site.css を使うページの head に、書体の先読み（preconnect と書体の CSS への直リンク）を入れる。

使い方: python3 scripts/font_head.py [フォルダ]   （deploy.yml は _site に対して毎回走らせる。何度走らせても同じ結果）

理由: 書体は assets/site/site.css の先頭の @import で読んでいて、HTML → site.css → 書体の CSS の順に1つずつ待つ。
head に同じ URL の直リンクを置くと、site.css と並んで取りに行ける。2026-11-21 の計測（スマホ相当：下り 1.6Mbps・遅延 150ms・
CPU 4倍遅く、/media/kenshu/claude-code-cost を3回×2）で、最初の表示が 2.79 秒 → 2.07 秒。読み込む書体ファイルの数は同じ 44。
書体の URL は site.css の @import から取るので、書体を替える時は site.css だけ直せばよい。@import は残す（この処理を
通らないページでも書体が当たるように）。
"""
import pathlib, re, sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent)
css = (ROOT / "assets/site/site.css").read_text(encoding="utf-8")
m = re.search(r'@import url\("(https://fonts\.googleapis\.com/[^"]+)"\);', css)
if not m:
    sys.exit("font_head: assets/site/site.css の先頭に書体の @import が見つからない")
URL = m.group(1).replace("&", "&amp;")
TAGS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        f'<link rel="stylesheet" href="{URL}">')
n = skip = 0
for p in sorted(ROOT.rglob("*.html")):
    if any(x in p.relative_to(ROOT).parts for x in ("_site", "node_modules", ".git")):
        continue
    t = p.read_text(encoding="utf-8", errors="ignore")
    if "/assets/site/site.css" not in t:
        continue
    if f'href="{URL}"' in t or f'href="{m.group(1)}"' in t:
        skip += 1
        continue
    # 文字コードの指定は先頭に残し、そのすぐ後ろに入れる（無ければ <head> の直後）
    t2, k = re.subn(r"(<head[^>]*>\s*<meta charset=[^>]*>)", lambda h: h.group(1) + "\n" + TAGS, t, count=1, flags=re.I)
    if not k:
        t2, k = re.subn(r"(<head[^>]*>)", lambda h: h.group(1) + "\n" + TAGS, t, count=1)
    if not k:
        sys.exit(f"font_head: <head> が無い {p}")
    p.write_text(t2, encoding="utf-8")
    n += 1
print(f"font_head: 書体の先読みを {n} ページに入れた（既にある {skip} ページはそのまま）")
