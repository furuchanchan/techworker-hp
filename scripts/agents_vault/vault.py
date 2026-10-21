#!/usr/bin/env python3
"""エージェント保管庫（/media/agents/）の検証と組み立て。

正本は media/agents/data/<slug>.json（1件1ファイル、型は schema.json）。
このスクリプトが、各ページ・一覧・メディアトップの枠・サイトマップの枠・表紙の元HTMLを作る。

  python3 scripts/agents_vault/vault.py check            # 全件を検証するだけ
  python3 scripts/agents_vault/vault.py build            # 検証してページを書き出す
  python3 scripts/agents_vault/vault.py covers <dir>     # 表紙の元HTMLを <dir> に書く（cover.mjs が PNG にする）
"""
import datetime
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
VAULT = ROOT / "media/agents"
DATA = VAULT / "data"
SCHEMA = json.loads((Path(__file__).parent / "schema.json").read_text())
SITE = "https://techworker.co.jp"
BASE = SITE + "/media/agents/"
CSS_V = "20261021-vault"
META_KEYS = {"published_on", "checked_on"}

PRODUCTS = {
    "Microsoft 365 Copilot": {"icon": "/assets/copilot/microsoft/copilot.svg", "token": "copilot"},
    "Copilot Studio": {"icon": "/assets/copilot/microsoft/studio.svg", "token": "copilot"},
    "Claude": {"icon": "/assets/copilot/ai-tools/claude.svg", "token": "claude"},
    "Claude Code": {"icon": "/assets/copilot/ai-tools/claude.svg", "token": "claude"},
    "Gemini": {"icon": "/assets/copilot/ai-tools/gemini.svg", "token": "gemini"},
}
TRAINING = {
    "common": ("共通編", ""),
    "copilot": ("Microsoft 365 Copilot 編", "copilot"),
    "claude-code": ("Claude Code 編", "claude-code"),
    "gemini": ("Gemini 編", "gemini"),
}
OFFICIAL_DOMAINS = (
    "microsoft.com", "learn.microsoft.com", "support.microsoft.com", "adoption.microsoft.com",
    "techcommunity.microsoft.com", "claude.com", "claude.ai", "anthropic.com",
    "google.com", "blog.google", "gemini.google",
)
BANNED = ["実質無料", "認定", "パートナー", "No.1", "ナンバーワン", "業界初", "必ず", "絶対", "保証します", "完全自動"]
COUNTS = {
    "before": (2, 4), "after": (2, 4), "steps": (4, 7), "admin": (2, 5), "human_checks": (2, 4),
    "pitfalls": (2, 4), "measure": (2, 3), "variations": (2, 3), "sources": (2, 6),
}

e = html.escape


# ---------- 検証 ----------

def _type_ok(value, spec):
    t = spec.get("type")
    if t == "string":
        return isinstance(value, str) and value.strip() != "" and ("enum" not in spec or value in spec["enum"])
    if t == "array":
        return isinstance(value, list) and all(_type_ok(v, spec["items"]) for v in value)
    if t == "object":
        if not isinstance(value, dict):
            return False
        props = spec["properties"]
        return set(value) == set(spec["required"]) and set(value) <= set(props) and all(_type_ok(value[k], props[k]) for k in value)
    return False


def _texts(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, list):
        for v in obj:
            yield from _texts(v)
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _texts(v)


def validate(entry, filename_slug=None):
    """1件を検証し、問題の一覧を返す（空なら合格）。"""
    errs = []
    props = SCHEMA["properties"]
    keys = set(entry)
    missing = set(SCHEMA["required"]) - keys
    extra = keys - set(props) - META_KEYS
    if missing:
        errs.append(f"欠けている欄: {sorted(missing)}")
    if extra:
        errs.append(f"型に無い欄: {sorted(extra)}")
    for k in set(props) & keys:
        if not _type_ok(entry[k], props[k]):
            errs.append(f"{k}: 型か選択肢が違う")
    if errs:
        return errs
    slug = entry["slug"]
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug) or len(slug) > 60:
        errs.append("slug: 英小文字・数字・ハイフンで60字以内")
    if filename_slug and filename_slug != slug:
        errs.append("slug がファイル名と違う")
    if PRODUCTS[entry["product"]]["token"] not in slug:
        errs.append(f"slug に製品の印（{PRODUCTS[entry['product']]['token']}）が無い")
    if len(entry["product_feature"]) > 20:
        errs.append("product_feature: 機能の公式名だけを20字以内で（テンプレート名や公開先の説明は steps に書く）")
    if len(entry["required_plan"]) > 60:
        errs.append("required_plan: 60字以内の1行で（課金の方式などの詳しい話は admin へ）")
    if not entry["title"].endswith("エージェント") or len(entry["title"]) > 40:
        errs.append("title: 「〜エージェント」で終わる40字以内")
    if not 40 <= len(entry["summary"]) <= 140:
        errs.append(f"summary: 40〜140字（今 {len(entry['summary'])}字）")
    for k, (lo, hi) in COUNTS.items():
        if not lo <= len(entry[k]) <= hi:
            errs.append(f"{k}: {lo}〜{hi}項目（今 {len(entry[k])}）")
    if not 1 <= len(entry["flow"]["knowledge"]) <= 4 or len(entry["flow"]["tools"]) > 4:
        errs.append("flow: 渡す資料は1〜4、道具は0〜4")
    if not 300 <= len(entry["prompt"]) <= 4000:
        errs.append(f"prompt: 300〜4,000字（今 {len(entry['prompt'])}字）")
    for s in entry["sources"]:
        u = urlsplit(s["url"])
        host = (u.hostname or "").lower()
        if u.scheme != "https" or not any(host == d or host.endswith("." + d) for d in OFFICIAL_DOMAINS):
            errs.append(f"sources: 公式のドメインではない {s['url']}")
    if len({s["url"] for s in entry["sources"]}) != len(entry["sources"]):
        errs.append("sources: 同じURLが重なっている")
    for k in ("title", "summary", "before", "after"):
        for t in _texts(entry[k]):
            if re.search(r"\d+\s*[%％割倍]", t):
                errs.append(f"{k}: 効果の数字は書かない（{t[:30]}…）")
    for t in _texts({k: v for k, v in entry.items() if k not in ("sources", "prompt")}):
        for w in BANNED:
            if w in t:
                errs.append(f"使わない言葉「{w}」: {t[:40]}…")
    for k in META_KEYS & keys:
        try:
            datetime.date.fromisoformat(entry[k])
        except (TypeError, ValueError):
            errs.append(f"{k}: YYYY-MM-DD")
    return errs


def load_all():
    entries, problems = [], {}
    for p in sorted(DATA.glob("*.json")):
        entry = json.loads(p.read_text())
        errs = validate(entry, p.stem)
        for k in META_KEYS - set(entry):
            errs.append(f"{k} が無い")
        if errs:
            problems[p.name] = errs
        entries.append(entry)
    titles = [x["title"] for x in entries]
    for t in {t for t in titles if titles.count(t) > 1}:
        problems.setdefault("(全体)", []).append(f"同じ題が重なっている: {t}")
    entries.sort(key=lambda x: (x["published_on"], x["slug"]), reverse=True)
    return entries, problems


# ---------- 部品 ----------

def dot(d):
    return d.replace("-", ".")


def training_url(entry, content):
    anchor = TRAINING[entry["training"]][1]
    q = f"?utm_source=techworker_media&utm_medium=agents_vault&utm_campaign={entry['slug']}&utm_content={content}"
    return "https://kenshu.techworker.co.jp/program/" + q + (f"#{anchor}" if anchor else "")


def product_chip(entry, feature=True):
    p = PRODUCTS[entry["product"]]
    feat = f'<span class="av-feat">{e(entry["product_feature"])}</span>' if feature else ""
    return f'<span class="av-prod"><img src="{p["icon"]}" alt="" width="20" height="20">{e(entry["product"])}{feat}</span>'


GTAG = """<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3V34NWXVCJ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  try{var twq=/[?&]tw_internal=([01])/.exec(location.search);if(twq)twq[1]==='1'?localStorage.setItem('tw_internal','1'):localStorage.removeItem('tw_internal');if(localStorage.getItem('tw_internal')==='1')gtag('set',{traffic_type:'internal'});}catch(e){}if(location.hostname==='techworker.co.jp')gtag('config', 'G-3V34NWXVCJ');
</script>
<script src="/assets/tw-track.js" defer></script>
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','1264057945446029');fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1264057945446029&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->"""

# 書体は OS の物だけ（共通の見た目 /assets/site/site.css。2026-10-21 外の Web フォントをやめた）


def head(title, desc, canonical, image, og_type, ld):
    lds = "\n".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
{GTAG}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{image}">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="TechWorker">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:image" content="{image}">
<link rel="stylesheet" href="/media/article.css?v=20261006-source-notes">
<link rel="stylesheet" href="/assets/site/site.css">
<link rel="stylesheet" href="/media/agents/vault.css?v={CSS_V}">
{lds}
</head>
<body>"""


# 頭と足は本体HPの全ページと同じ（/assets/site/site.css）。2段目に保管庫の名前と行き先
NAV = """<header class="hd">
  <a class="logo" href="/" aria-label="TechWorker ホーム">Tech<i>Worker</i></a>
  <nav id="hd-nav" aria-label="主な行き先">
    <a href="/services">事業・サービス</a>
    <a href="/#concept">考え方</a>
    <a href="/agent-cases/">事例</a>
    <a href="/news">ニュース</a>
    <a href="/company">会社情報</a>
    <a href="/contact">お問い合わせ</a>
  </nav>
  <button class="menu" type="button" aria-label="メニューを開く" aria-controls="hd-nav" aria-expanded="false"></button>
</header>
<div class="subnav">
  <div class="wrap subnav__in">
    <a class="subnav__name" href="/media/agents/">エージェント保管庫</a>
    <nav aria-label="メディアの行き先"><a href="/media/agents/#list">一覧</a><a href="/media/agents/#format">1件の読み方</a><a href="/media/">メディア</a><a href="https://kenshu.techworker.co.jp/contact/?utm_source=techworker_media&amp;utm_medium=agents_vault&amp;utm_content=nav" class="subnav__cta">研修の相談</a></nav>
  </div>
</div>"""

FOOT = """<footer class="ft">
  <div class="wrap">
    <div class="ft__in">
      <div>
        <p class="ft__name">株式会社TechWorker</p>
        <p class="ft__addr">〒169-0051 東京都新宿区西早稲田一丁目22番3号<br>早稲田アントレプレナーシップセンター</p>
      </div>
      <nav aria-label="フッターの行き先">
        <a href="/services">事業・サービス</a>
        <a href="/company">会社情報</a>
        <a href="/news">ニュース</a>
        <a href="/#concept">考え方</a>
        <a href="/agent-cases/">事例</a>
        <a href="/contact">お問い合わせ</a>
        <a href="/privacy">プライバシーポリシー</a>
      </nav>
    </div>
    <p class="ft__note">Microsoft、Microsoft 365、Copilot は Microsoft グループの商標です。Claude は Anthropic の商標です。Gemini は Google LLC の商標です。TechWorker は各社と提携していません。画面や機能は変わることがあります。最新の情報は各社の公式ページでご確認ください。</p>
    <small>© TechWorker Inc.</small>
  </div>
</footer>
<script>
// スマホの行き先：右上の釦で開け閉めする。行き先を押したら閉じる
(() => {
  const hd = document.querySelector('.hd'), btn = hd.querySelector('.menu');
  const set = open => { hd.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く'); };
  btn.addEventListener('click', () => set(!hd.classList.contains('is-open')));
  hd.querySelector('nav').addEventListener('click', e => { if (e.target.closest('a')) set(false); });
})();
</script>
<script src="/media/agents/vault.js?v=__CSSV__" defer></script>
<script src="/media/article-tracker.js?v=20261006-media-home" defer></script>
</body>
</html>
""".replace("__CSSV__", CSS_V)


def mini_flow(entry, big=False):
    """一覧のカードと表紙に使う、受け取る→エージェント→返す→人 の小さな図。"""
    f = entry["flow"]
    p = PRODUCTS[entry["product"]]
    cls = "av-mf big" if big else "av-mf"
    box = lambda c, label, text, icon="": f'<span class="mf-box{c}">{icon}<b>{label}</b><span class="mf-t">{e(text)}</span></span>'
    arr = '<i class="mf-arr"></i>'
    return (f'<div class="{cls}" aria-hidden="true">'
            + box("", "受け取る", f["input"]) + arr
            + box(" mf-ai", "エージェント", entry["product_feature"], f'<img src="{p["icon"]}" alt="" width="18" height="18">') + arr
            + box("", "返す", f["output"]) + arr
            + box(" mf-human", "人が確かめる", f["human"]) + '</div>')


def card(entry, content="list"):
    return (f'<a class="av-card" href="/media/agents/{entry["slug"]}" data-dept="{e(entry["department"])}" data-prod="{e(entry["product"])}">'
            f'<div class="av-card-vis"><div class="av-card-top">{product_chip(entry, False)}<span class="av-dept">{e(entry["department"])}</span></div>{mini_flow(entry)}</div>'
            f'<div class="av-card-b"><span class="av-card-t">{e(entry["title"])}</span><span class="av-card-s">{e(entry["summary"])}</span>'
            f'<span class="av-card-m"><span>作る時間 {e(entry["build_time"])}</span><span>{e(entry["difficulty"])}</span><span>{dot(entry["published_on"])}</span></span></div></a>')


# ---------- 1件のページ ----------

def entry_page(entry, entries):
    slug, title = entry["slug"], entry["title"]
    url = BASE + slug
    image = f"{BASE}covers/{slug}.png"
    page_title = f"{title}｜{entry['product']}での作り方 — エージェント保管庫"
    desc = f"{entry['summary']} できること、作り方、そのまま貼れる指示文、管理者が先に決める設定をまとめています。"
    ld = [
        {"@context": "https://schema.org", "@type": "Article", "headline": f"{title}｜{entry['product']}での作り方",
         "description": entry["summary"], "datePublished": entry["published_on"], "dateModified": entry["checked_on"],
         "inLanguage": "ja", "image": image,
         "author": {"@type": "Person", "name": "古野光太朗", "jobTitle": "株式会社TechWorker 代表取締役 CEO兼CTO", "url": SITE + "/company.html"},
         "publisher": {"@type": "Organization", "name": "株式会社TechWorker", "url": SITE + "/",
                       "logo": {"@type": "ImageObject", "url": SITE + "/assets/ogp.png", "width": 1200, "height": 630}},
         "mainEntityOfPage": {"@type": "WebPage", "@id": url}},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "ホーム", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "メディア", "item": SITE + "/media/"},
            {"@type": "ListItem", "position": 3, "name": "エージェント保管庫", "item": BASE},
            {"@type": "ListItem", "position": 4, "name": title, "item": url}]},
    ]
    f = entry["flow"]
    p = PRODUCTS[entry["product"]]
    li = lambda xs: "".join(f"<li>{e(x)}</li>" for x in xs)
    tools = li(f["tools"]) if f["tools"] else "<li>なし（つなぐ道具は使いません）</li>"
    steps = "".join(f'<li><span class="st-n">{i}</span><div><h3>{e(s["title"])}</h3><p>{e(s["body"])}</p></div></li>' for i, s in enumerate(entry["steps"], 1))
    admin = "".join(f'<div class="av-row"><h3>{e(a["item"])}</h3><p>{e(a["why"])}</p></div>' for a in entry["admin"])
    pits = "".join(f'<div class="av-row"><h3>{e(x["symptom"])}</h3><p>{e(x["fix"])}</p></div>' for x in entry["pitfalls"])
    meas = "".join(f'<div class="av-meas"><h3>{e(m["metric"])}</h3><p>{e(m["how"])}</p></div>' for m in entry["measure"])
    srcs = "".join(f'<li><a href="{e(s["url"])}" target="_blank" rel="noopener">{e(s["title"])}</a><span>{e(s["publisher"])}</span></li>' for s in entry["sources"])
    related = [x for x in entries if x["slug"] != slug and (x["department"] == entry["department"] or x["product"] == entry["product"])]
    related += [x for x in entries if x["slug"] != slug and x not in related]
    rel = "".join(card(x, "related") for x in related[:3])
    tr_name = TRAINING[entry["training"]][0]
    toc = [("s1", "できること"), ("s2", "仕組み"), ("s3", "作り方"), ("s4", "指示文"), ("s5", "管理者が先に決めること"),
           ("s6", "人が確かめるところ"), ("s7", "うまくいかないとき"), ("s8", "30日後に測ること"), ("s9", "広げ方")]
    toc_html = "".join(f'<a href="#{i}">{t}</a>' for i, t in toc)
    return head(page_title, desc, url, image, "article", ld) + f"""
<div class="progress" id="progress"></div>
{NAV}
<header class="av-hero">
  <nav class="crumb" aria-label="パンくず"><a href="/">ホーム</a><span class="sep">/</span><a href="/media/">メディア</a><span class="sep">/</span><a href="/media/agents/">エージェント保管庫</a></nav>
  <div class="av-chips">{product_chip(entry, False)}<span class="av-tag av-tag-feat">{e(entry["product_feature"])}</span><span class="av-dept">{e(entry["department"])}</span><span class="av-tag">作る時間 {e(entry["build_time"])}</span><span class="av-tag">{e(entry["difficulty"])}</span></div>
  <h1>{e(title)}</h1>
  <p class="av-sum">{e(entry["summary"])}</p>
  <div class="av-meta"><span>公開 {dot(entry["published_on"])}</span><span>公式の情報で確認 {dot(entry["checked_on"])}</span><span>監修 古野光太朗（TechWorker 代表）</span></div>
</header>

<div class="av-layout">
<aside class="av-spec" aria-label="このエージェントの設計書">
  <div class="av-spec-in">
    <div class="av-spec-h">このエージェントの設計書</div>
    <dl>
      <dt>部署</dt><dd>{e(entry["department"])}</dd>
      <dt>業務</dt><dd>{e(entry["task"])}</dd>
      <dt>製品</dt><dd>{e(entry["product"])}</dd>
      <dt>使う機能</dt><dd>{e(entry["product_feature"])}</dd>
      <dt>必要な契約</dt><dd>{e(entry["required_plan"])}</dd>
      <dt>作る時間</dt><dd>{e(entry["build_time"])}</dd>
      <dt>難しさ</dt><dd>{e(entry["difficulty"])}</dd>
    </dl>
    <a class="av-spec-btn" href="#s4">指示文を見る <span aria-hidden="true">↓</span></a>
    <nav class="av-toc" aria-label="目次">{toc_html}</nav>
  </div>
</aside>

<main class="av-main">
<section id="s1" class="av-sec"><h2><span>01</span>できること</h2>
  <div class="av-ba">
    <div class="av-ba-c before"><div class="av-ba-h">これまで</div><ul>{li(entry["before"])}</ul></div>
    <div class="av-ba-c after"><div class="av-ba-h">このエージェントを使うと</div><ul>{li(entry["after"])}</ul></div>
  </div>
</section>

<section id="s2" class="av-sec"><h2><span>02</span>仕組み</h2>
  <p class="av-lead">エージェントが何を受け取り、何を見て、何を返すか。最後に人が確かめるところまでを1枚にしています。</p>
  <div class="av-flow">
    <div class="fl-box"><span class="fl-tag">受け取るもの</span><p>{e(f["input"])}</p></div>
    <div class="fl-arr" aria-hidden="true"></div>
    <div class="fl-box fl-ai"><span class="fl-tag ai"><img src="{p["icon"]}" alt="" width="16" height="16">エージェント</span><p class="fl-feat">{e(entry["product"])}　{e(entry["product_feature"])}</p>
      <div class="fl-part"><b>指示文</b><p>役割と進め方、答え方を決める（04 指示文）</p></div>
      <div class="fl-part"><b>渡す資料</b><ul>{li(f["knowledge"])}</ul></div>
      <div class="fl-part"><b>つなぐ道具</b><ul>{tools}</ul></div>
    </div>
    <div class="fl-arr" aria-hidden="true"></div>
    <div class="fl-box"><span class="fl-tag">返すもの</span><p>{e(f["output"])}</p></div>
    <div class="fl-arr" aria-hidden="true"></div>
    <div class="fl-box fl-human"><span class="fl-tag human">人が確かめる</span><p>{e(f["human"])}</p></div>
  </div>
</section>

<section id="s3" class="av-sec"><h2><span>03</span>作り方</h2>
  <ol class="av-steps">{steps}</ol>
</section>

<section id="s4" class="av-sec"><h2><span>04</span>指示文（そのまま貼れます）</h2>
  <p class="av-lead">{e(entry["prompt_where"])}に貼ります。［　］のところは自社の言葉に置き換えてください。</p>
  <div class="av-prompt">
    <div class="pr-bar"><span class="pr-dots"><i></i><i></i><i></i></span><span class="pr-name">指示文 — {e(entry["product"])} {e(entry["product_feature"])}</span><button type="button" class="pr-copy" data-copy="pr-{slug}">コピー</button></div>
    <pre id="pr-{slug}">{e(entry["prompt"])}</pre>
  </div>
</section>

<section id="s5" class="av-sec"><h2><span>05</span>管理者が先に決めること</h2>
  <p class="av-lead">使い始める前に、{e(entry["product"])} の管理者が決めておく設定です。ここを決めてから配ると、情報の扱いで止まりにくくなります。</p>
  <div class="av-rows">{admin}</div>
</section>

<section id="s6" class="av-sec"><h2><span>06</span>人が確かめるところ</h2>
  <ul class="av-checks">{li(entry["human_checks"])}</ul>
</section>

<section id="s7" class="av-sec"><h2><span>07</span>うまくいかないとき</h2>
  <div class="av-rows pit">{pits}</div>
</section>

<section id="s8" class="av-sec"><h2><span>08</span>30日後に測ること</h2>
  <p class="av-lead">使われているか、どれだけ時間が浮いたか、出来は十分か。使い始めて30日後に、次の点を確かめます。</p>
  <div class="av-meas-g">{meas}</div>
</section>

<section id="s9" class="av-sec"><h2><span>09</span>広げ方</h2>
  <ul class="av-vars">{li(entry["variations"])}</ul>
</section>

<section class="av-sec av-src"><h2>公式の情報</h2>
  <ul>{srcs}</ul>
  <p>機能と画面の名前は、{dot(entry["checked_on"])} に上の公式の情報で確かめました。業務での使い方は TechWorker の例です。</p>
</section>
</main>
</div>

<div class="art-cta" data-cta-placement="vault_end"><div class="inner"><div><h3>このエージェントを、御社の業務で作ります。</h3><p>TechWorker の研修では、受講者の実際の業務を1つ選び、研修の中でこの形のエージェントを作ります。教材は毎週更新し、受講から30日後に使われ方を測ってご報告します（{e(tr_name)}）。</p></div><a href="{e(training_url(entry, "end"))}" class="btn">研修の内容を見る <i>→</i></a></div></div>

<section class="av-related"><div class="av-wrap"><h2>ほかのエージェント</h2><div class="av-grid">{rel}</div><a class="av-more" href="/media/agents/#list">保管庫の一覧に戻る <span aria-hidden="true">→</span></a></div></section>

{FOOT}"""


# ---------- 一覧 ----------

FORMAT_ITEMS = [
    ("01", "できること", "これまでの仕事と、使ったあとの仕事を並べます。"),
    ("02", "仕組み", "受け取るもの、渡す資料、つなぐ道具、返すものを1枚の図に。"),
    ("03", "作り方", "製品の画面の名前どおりに、手順を順番に。"),
    ("04", "指示文", "そのまま貼って使える指示文。コピーできます。"),
    ("05", "管理者が先に決めること", "データの範囲や共有、接続の権限など、配る前の設定。"),
    ("06", "30日後に測ること", "使われているか、時間、出来を確かめる方法。"),
]


def index_page(entries):
    n = len(entries)
    latest = entries[0]["published_on"] if entries else datetime.date.today().isoformat()
    depts = [d for d in SCHEMA["properties"]["department"]["enum"] if any(x["department"] == d for x in entries)]
    prods = [d for d in SCHEMA["properties"]["product"]["enum"] if any(x["product"] == d for x in entries)]
    chip = lambda kind, v, label: f'<button type="button" class="av-f" data-kind="{kind}" data-val="{e(v)}" aria-pressed="{"true" if v == "" else "false"}">{e(label)}</button>'
    dchips = chip("dept", "", "すべての部署") + "".join(chip("dept", d, d) for d in depts)
    pchips = chip("prod", "", "すべての製品") + "".join(chip("prod", d, d) for d in prods)
    fmt = "".join(f'<li><span>{a}</span><b>{b}</b><p>{c}</p></li>' for a, b, c in FORMAT_ITEMS)
    feat = entries[0] if entries else None
    feat_html = ""
    if feat:
        feat_html = (f'<a class="av-feat-card" href="/media/agents/{feat["slug"]}"><div class="av-feat-vis">'
                     f'<div class="av-card-top">{product_chip(feat, False)}<span class="av-dept">{e(feat["department"])}</span></div>{mini_flow(feat, big=True)}</div>'
                     f'<div class="av-feat-b"><span class="av-new">新着</span><span class="av-feat-t">{e(feat["title"])}</span><span class="av-card-s">{e(feat["summary"])}</span>'
                     f'<span class="av-more">作り方を見る <span aria-hidden="true">→</span></span></div></a>')
    title = "エージェント保管庫｜業務ごとのAIエージェントの作り方 — TechWorker Media"
    desc = "Microsoft 365 Copilot、Copilot Studio、Claude、Claude Code、Gemini で作る業務のAIエージェントを、できること・作り方・そのまま貼れる指示文・管理者が先に決める設定の決まった形でまとめた見本帳です。平日に1件ずつ増えます。"
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": "エージェント保管庫", "description": desc, "url": BASE, "inLanguage": "ja",
           "isPartOf": {"@type": "WebSite", "name": "TechWorker", "url": SITE + "/"},
           "publisher": {"@type": "Organization", "name": "株式会社TechWorker", "url": SITE + "/"},
           "mainEntity": {"@type": "ItemList", "numberOfItems": n, "itemListElement": [
               {"@type": "ListItem", "position": i, "url": BASE + x["slug"], "name": x["title"]} for i, x in enumerate(entries, 1)]}}]
    cards = "".join(card(x) for x in entries)
    image = (f"{BASE}covers/{feat['slug']}.png" if feat else SITE + "/assets/ogp.png")
    return head(title, desc, BASE, image, "website", ld) + f"""
{NAV}
<main>
<header class="av-ihero"><div class="av-wrap">
  <div class="av-ihero-copy">
    <nav class="crumb" aria-label="パンくず"><a href="/">ホーム</a><span class="sep">/</span><a href="/media/">メディア</a></nav>
    <span class="av-kicker">TechWorker Media</span>
    <h1>エージェント保管庫</h1>
    <p>いつもの業務を、AIエージェントに任せるための見本帳です。1件ごとに、できること、作り方、そのまま貼れる指示文、管理者が先に決める設定を、同じ形でまとめています。</p>
    <div class="av-stats"><span><b>{n}</b>件のエージェント</span><span><b>平日</b>に1件ずつ追加</span><span><b>{dot(latest)}</b>最終更新</span></div>
  </div>
  {feat_html}
</div></header>

<section class="av-format" id="format"><div class="av-wrap">
  <div class="av-sec-h"><h2>1件に入っていること</h2><p>どのエージェントも、この6つを同じ順番で載せています</p></div>
  <ol class="av-fmt">{fmt}</ol>
</div></section>

<section class="av-list" id="list"><div class="av-wrap">
  <div class="av-sec-h"><h2>エージェントを探す</h2><p class="av-count" aria-live="polite"><b id="av-n">{n}</b>件</p></div>
  <p class="av-ac">当社で動いている実物は、<a href="/agent-cases/" data-ac-location="vault_list" data-ac-case="vault" data-ac-offering="agent_cases">AIエージェントの事例</a>へ。</p>
  <div class="av-filters"><div class="av-frow" role="group" aria-label="部署で絞り込む">{dchips}</div><div class="av-frow" role="group" aria-label="製品で絞り込む">{pchips}</div></div>
  <div class="av-grid" id="av-grid">{cards}</div>
  <p class="av-empty" hidden>この組み合わせのエージェントは、まだありません。</p>
</div></section>
<script>
/* 事例への案内のクリックを GA4 の agent_case_cta_click で数える（case_id・offering・location） */
document.addEventListener('click',function(ev){{
  var a=ev.target.closest&&ev.target.closest('[data-ac-location]');if(!a||typeof gtag!=='function')return;
  gtag('event','agent_case_cta_click',{{case_id:a.dataset.acCase,offering:a.dataset.acOffering,location:a.dataset.acLocation}});
}});
</script>

<section class="av-wrap"><div class="mh-band av-band" data-cta-placement="vault_band">
  <div><h2>自社の業務で、1本作ってみませんか。</h2><p>TechWorker の生成AI研修では、受講者の実際の業務を1つ選び、研修の中でエージェントを作ります。教材は毎週更新し、受講から30日後に使われ方を測ってご報告します。</p></div>
  <div class="mh-btns"><a class="btn" href="https://kenshu.techworker.co.jp/program/?utm_source=techworker_media&amp;utm_medium=agents_vault&amp;utm_content=band">研修の内容を見る</a><a class="mh-btn2" href="https://kenshu.techworker.co.jp/contact/?utm_source=techworker_media&amp;utm_medium=agents_vault&amp;utm_content=band">研修の相談をする</a></div>
</div></section>
</main>
{FOOT}"""


# ---------- メディアトップの枠・サイトマップの枠 ----------

def replace_block(text, name, body, path):
    start, end = f"<!-- {name}:start -->", f"<!-- {name}:end -->"
    pat = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pat.search(text):
        raise SystemExit(f"{path}: {start} … {end} の印が見つかりません")
    return pat.sub(lambda m: start + body + end, text)


def media_home_block(entries):
    cards = "".join(card(x, "media_home") for x in entries[:3])
    return (f'\n<section class="mh-sec av-home" id="agents">\n  <div class="mh-sec-h"><h2>エージェント保管庫</h2>'
            f'<p>業務ごとのAIエージェントの作り方を、決まった形で。平日に1件ずつ増えます</p></div>\n'
            f'  <div class="av-grid">{cards}</div>\n  <a class="av-more" href="agents/">保管庫のエージェントをすべて見る（{len(entries)}件） <span aria-hidden="true">→</span></a>\n</section>\n')


def sitemap_block(entries):
    rows = [f"  <url><loc>{BASE}</loc><lastmod>{entries[0]['published_on']}</lastmod><priority>0.8</priority><changefreq>daily</changefreq></url>"]
    rows += [f"  <url><loc>{BASE}{x['slug']}</loc><lastmod>{x['checked_on']}</lastmod><priority>0.7</priority><changefreq>monthly</changefreq></url>" for x in entries]
    return "\n" + "\n".join(rows) + "\n  "


# ---------- 表紙（1200×630） ----------

def cover_html(entry):
    p = PRODUCTS[entry["product"]]
    return f"""<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
{FONTS}
<link rel="stylesheet" href="{ROOT.as_uri()}/media/article.css">
<link rel="stylesheet" href="{ROOT.as_uri()}/media/agents/vault.css">
</head><body class="av-cover-body"><div class="av-cover" id="cover">
<div class="cv-top"><span class="cv-brand">エージェント保管庫<i>TechWorker Media</i></span><span class="av-dept">{e(entry["department"])}</span></div>
<div class="cv-prod"><img src="{ROOT.as_uri()}{p["icon"]}" alt="" width="40" height="40"><span>{e(entry["product"])}<em>{e(entry["product_feature"])}</em></span></div>
<h1>{e(entry["title"])}</h1>
<p class="cv-sum">{e(entry["summary"])}</p>
{mini_flow(entry, big=True).replace('src="/assets', f'src="{ROOT.as_uri()}/assets')}
</div></body></html>"""


# ---------- 実行 ----------

def build():
    entries, problems = load_all()
    if problems:
        print(json.dumps(problems, ensure_ascii=False, indent=2))
        raise SystemExit("検証に通らない件があるため、書き出しません")
    if not entries:
        raise SystemExit("data に1件もありません")
    for x in entries:
        (VAULT / f"{x['slug']}.html").write_text(entry_page(x, entries))
    (VAULT / "index.html").write_text(index_page(entries))
    home = ROOT / "media/index.html"
    home.write_text(replace_block(home.read_text(), "agents-vault", media_home_block(entries), home))
    sm = ROOT / "sitemap.xml"
    sm.write_text(replace_block(sm.read_text(), "agents-vault", sitemap_block(entries), sm))
    missing = [x["slug"] for x in entries if not (VAULT / "covers" / f"{x['slug']}.png").exists()]
    print(json.dumps({"entries": len(entries), "covers_missing": missing}, ensure_ascii=False))


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "check"
    if cmd == "check":
        entries, problems = load_all()
        print(json.dumps({"entries": len(entries), "problems": problems}, ensure_ascii=False, indent=2))
        return 1 if problems else 0
    if cmd == "build":
        build()
        return 0
    if cmd == "covers":
        out = Path(argv[2])
        out.mkdir(parents=True, exist_ok=True)
        entries, _ = load_all()
        for x in entries:
            (out / f"{x['slug']}.html").write_text(cover_html(x))
        print(len(entries))
        return 0
    raise SystemExit(__doc__)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
