#!/usr/bin/env python3
"""記事のフォルダを動かさずに作る「ラボ」（例：Claude ラボ）の一覧ページを、記事のファイルから作り直す。
使い方: python3 scripts/build_lab_hubs.py [リポジトリ]
ラボの決まりは media/audiences.json の "labs"（dir のフォルダで、prefixes で始まる記事がそのラボの記事。"rest": true のラボは、同じフォルダのほかのラボに入らない記事すべてで、一覧はフォルダの一覧そのもの＝導入ラボ /media/kenshu/）。
1. ラボの記事の頭の行き先（上の帯・パンくず・構造化データ・一覧へ戻る）をラボにそろえる
2. 元のフォルダの一覧（例 media/kenshu/index.html）からラボの記事の行を外す
3. ラボの一覧ページ（media/<ラボ>/index.html）の記事一覧（主役1本＋新着2本＋残り）と ItemList を作り直す
読者の絞り込み（data-audience と件数）は、最後に scripts/build_media_audiences.py を流して付ける。
2026-11-23 に Claude ラボを作ったときに足した。"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
SITE = "https://techworker.co.jp/"


def esc(value):
    return html.escape(value, quote=True)


def one(pattern, repl, text, label, flags=0):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"{label}: 置き換える所が見つからない（{pattern[:60]}）")
    return out


def claimed(path, lab, labs):
    """記事がこのラボのものか。rest のラボ（導入ラボ＝kenshu）は、同じフォルダのほかのラボに入らない記事すべて"""
    if lab.get("rest"):
        return not any(o is not lab and o["dir"] == lab["dir"] and path.stem.startswith(tuple(o["prefixes"])) for o in labs.values())
    return path.stem.startswith(tuple(lab["prefixes"]))


def members(lab, labs):
    out = []
    for path in sorted((ROOT / "media" / lab["dir"]).glob("*.html")):
        if path.name == "index.html" or not claimed(path, lab, labs):
            continue
        text = path.read_text()
        if 'http-equiv="refresh"' in text or not re.search(r'<article\b[^>]*class="[^"]*art-body', text):
            continue
        out.append(path)
    return out


def read(path):
    text = path.read_text()
    title = html.unescape(re.sub(r"<[^>]+>", "", re.search(r"<h1[^>]*>(.*?)</h1>", text, re.S).group(1))).strip()
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', text).group(1))
    published = re.search(r'"datePublished"\s*:\s*"([^"]+)"', text).group(1)[:10]
    modified = re.search(r'"dateModified"\s*:\s*"([^"]+)"', text)
    kicker = re.search(r'<div class="kicker">(.*?)</div>', text)
    return {"slug": path.stem, "title": title, "desc": desc, "date": published,
            "modified": modified.group(1)[:10] if modified else published,
            "cat": html.unescape(kicker.group(1)) if kicker else ""}


def fix_article(path, key, lab):
    text = path.read_text()
    hub = f"../{key}/"
    name = esc(lab["name"])
    out = one(r'<a class="subnav__name" href="[^"]*">[^<]*</a>',
              f'<a class="subnav__name" href="{hub}">{name}</a>', text, f"{path.name} 上の帯")
    out = one(r'(<a href="\.\./index\.html">メディア</a><span class="sep">/</span>)<a href="[^"]*">[^<]*</a>',
              lambda m: m.group(1) + f'<a href="{hub}">{name}</a>', out, f"{path.name} パンくず")
    # 「一覧に戻る」は古い記事に無い物や、古い書き方（← AI研修・導入ラボに戻る など）がある。あれば付け替える
    out, n = re.subn(r'<div class="back-list"><a href="[^"]*">← [^<]*に戻る</a></div>',
                     f'<div class="back-list"><a href="{hub}">← {name}の記事一覧に戻る</a></div>', out)
    if n > 1:
        raise SystemExit(f"{path.name}: 一覧へ戻る行が {n} 個ある")
    crumbs = 0

    def fix_ld(m):
        nonlocal crumbs
        data = json.loads(m.group(2))
        if not isinstance(data, dict) or data.get("@type") != "BreadcrumbList":
            return m.group(0)
        third = [x for x in data["itemListElement"] if x.get("position") == 3]
        if len(third) != 1:
            raise SystemExit(f"{path.name}: パンくずの3段目が無い")
        third[0]["name"] = lab["name"]
        third[0]["item"] = f"{SITE}media/{key}/"
        crumbs += 1
        return m.group(1) + json.dumps(data, ensure_ascii=False) + m.group(3)

    out = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)', fix_ld, out, flags=re.S)
    if crumbs != 1:
        raise SystemExit(f"{path.name}: BreadcrumbList が1つでない（{crumbs}）")
    if out != text:
        path.write_text(out)
        return True
    return False


def list_span(text, label):
    """id="audience-results" の div の中身の範囲（入れ子の div を数える）。"""
    m = re.search(r'<div\b[^>]*id="audience-results"[^>]*>', text)
    if not m:
        raise SystemExit(f"{label}: 記事一覧（id=audience-results）が無い")
    depth = 1
    for t in re.finditer(r"<(/?)div\b[^>]*>", text[m.end():]):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            return m.end(), m.end() + t.start()
    raise SystemExit(f"{label}: 記事一覧の div が閉じていない")


def drop_from_source(key, lab, slugs):
    if key == lab["dir"]:  # 一覧がフォルダの一覧そのもの（導入ラボ＝kenshu）。行は render_hub が作り直す
        return 0
    path = ROOT / "media" / lab["dir"] / "index.html"
    text = path.read_text()
    start, end = list_span(text, str(path))
    rows = text[start:end]
    kept = re.sub(r'<a\b[^>]*\bhref="([^"/]+)\.html"[^>]*>.*?</a>\n?',
                  lambda m: "" if m.group(1) in slugs else m.group(0), rows, flags=re.S)
    if kept != rows:
        path.write_text(text[:start] + kept + text[end:])
        return len(re.findall(r"<a\b", rows)) - len(re.findall(r"<a\b", kept))
    return 0


ARROW = '<svg class="arw" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg>'


def card(d, i, kind, pick=""):
    """記事1本。kind は feat（主役）・side（新着の2本）・row（残り）。
    分類と日付は c-meta に入れる。build_media_audiences.py が c-meta の直後に読者の札を足すので、c-meta の中に span を入れない。"""
    slug, title = i["slug"], esc(i["title"])
    big, small = f"../{d}/covers/{slug}.png", f"../{d}/covers/thumbs/{slug}.jpg"
    if kind == "feat":
        img = f'<img src="{big}" alt="{title}" width="1200" height="630" fetchpriority="high">'
        shown = (i["date"] + ("（更新 " + i["modified"] + "）" if i["modified"] > i["date"] else "")).replace("-", ".")
    else:
        img = (f'<img src="{small}" srcset="{small} 600w, {big} 1200w" sizes="(max-width:760px) calc(100vw - 40px), (max-width:1100px) 46vw, 380px" '
               f'alt="{title}" width="600" height="315" loading="lazy">')
        shown = i["date"].replace("-", ".")
    head = f'<span class="cc-pick">{esc(pick)}</span>' if pick else ""
    go = f'<span class="c-go">記事を読む{ARROW}</span>' if kind == "feat" else ""
    return (f'<a class="cc cc--{kind}" href="../{d}/{slug}.html">{img}<span class="cc-b">{head}'
            f'<span class="cc-m"><span class="c-meta">{esc(i["cat"])}<i>{shown}</i></span></span>'
            f'<span class="cc-t">{title}</span><span class="cc-d">{esc(i["desc"])}</span>{go}</span></a>')


def render_hub(key, lab, items):
    path = ROOT / "media" / key / "index.html"
    text = path.read_text()
    d = lab["dir"]
    for i in items:
        for p in (f'covers/thumbs/{i["slug"]}.jpg', f'covers/{i["slug"]}.png'):
            if not (ROOT / "media" / d / p).is_file():
                raise SystemExit(f"{key}: 表紙が無い media/{d}/{p}")
    feat = next((i for i in items if i["slug"] == lab["featured"]), None)
    if not feat:
        raise SystemExit(f"{key}: 大きく見せる記事 {lab['featured']} がラボの記事に無い")
    # 並び：主役1本 → 新しい順の2本 → 残りを新しい順に（記事一覧の中に主役を2回出さない）
    rest = [i for i in items if i is not feat]
    rows = ([card(d, feat, "feat", lab["featured_label"])] + [card(d, i, "side") for i in rest[:2]]
            + [card(d, i, "row") for i in rest[2:]])
    start, end = list_span(text, str(path))
    text = text[:start] + "\n" + "\n".join(rows) + "\n" + text[end:]

    collections = 0

    def fix_ld(m):
        nonlocal collections
        data = json.loads(m.group(2))
        if not isinstance(data, dict) or data.get("@type") != "CollectionPage":
            return m.group(0)
        collections += 1
        data["mainEntity"] = {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": n + 1, "url": f"{SITE}media/{d}/{i['slug']}", "name": i["title"]}
            for n, i in enumerate(items)]}
        return m.group(1) + json.dumps(data, ensure_ascii=False) + m.group(3)

    text = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)', fix_ld, text, flags=re.S)
    if collections != 1:
        raise SystemExit(f"{key}: CollectionPage が1つでない")
    path.write_text(text)


def main():
    labs = json.loads((ROOT / "media/audiences.json").read_text()).get("labs", {})
    for key, lab in labs.items():
        paths = members(lab, labs)
        items = sorted((read(p) for p in paths), key=lambda i: (i["date"], i["slug"]), reverse=True)
        fixed = sum(fix_article(p, key, lab) for p in paths)
        dropped = drop_from_source(key, lab, {i["slug"] for i in items})
        render_hub(key, lab, items)
        print(f"{lab['name']}: 記事 {len(items)} 本、頭を直した記事 {fixed} 本、元の一覧から外した行 {dropped}")
    # 作り直した一覧の行には読者の札が無いので、続けて必ず付ける（片方だけ流すと点検で落ちる）
    subprocess.run([sys.executable, str(ROOT / "scripts/build_media_audiences.py"), str(ROOT)], check=True)


if __name__ == "__main__":
    main()
