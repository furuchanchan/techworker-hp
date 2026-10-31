#!/usr/bin/env python3
"""記事ページを AI の検索（ChatGPT・Perplexity・Google の AI による概要など）に拾われやすくする仕上げ。

使い方: python3 scripts/geo_enrich.py [フォルダ]   （省略時はリポジトリの直下。deploy.yml は _site に対して毎回走らせる）

- 記事（media/<分野>/<slug>.html と media/token-management.html。noindex は除く）の Article の構造化データに、
  無い時だけ inLanguage・publisher.logo・citation（本文の外部の出典の URL）を足す。何度走らせても同じ結果になる。
- llms.txt（サイトの説明・主なページ・分野ごとの記事の一覧）を書き出す。llmstxt.org の提案（Jeremy Howard, 2024）の形。
根拠: Aggarwal ほか「GEO」（KDD 2024）は出典・数字を本文に示すと AI の答えでの見え方が上がると報告。
Google Search Central「AI features and your website」は、構造化データを見えている中身と合わせることを求める。
"""
import html, json, pathlib, re, sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent)
SITE = "https://techworker.co.jp"
LOGO = {"@type": "ImageObject", "url": f"{SITE}/assets/ogp.png", "width": 1200, "height": 630}
SKIP_HOSTS = ("techworker.co.jp", "facebook.com", "x.com", "twitter.com", "fonts.googleapis.com", "fonts.gstatic.com",
              "googletagmanager.com", "google-analytics.com", "linkedin.com/shareArticle", "line.me", "b.hatena.ne.jp")
LD = re.compile(r'(<script type="application/ld\+json">)(.*?)(</script>)', re.S)


def articles():
    for p in sorted((ROOT / "media").glob("*/*.html")) + [ROOT / "media" / "token-management.html"]:
        if p.name == "index.html" or not p.exists():
            continue
        t = p.read_text(encoding="utf-8")
        if 'name="robots" content="noindex' in t:
            continue
        yield p, t


def body_links(t):
    m = re.search(r"<article\b.*?</article>", t, re.S) or re.search(r"<main\b.*?</main>", t, re.S)
    seen = []
    for u in re.findall(r'href="(https?://[^"#]+)', m.group(0) if m else ""):
        u = html.unescape(u)
        if not any(h in u for h in SKIP_HOSTS) and u not in seen:
            seen.append(u)
    return seen


def enrich(p, t):
    links = body_links(t)

    def fix(m):
        try:
            d = json.loads(m.group(2))
        except json.JSONDecodeError:
            return m.group(0)
        if not isinstance(d, dict) or d.get("@type") not in ("Article", "BlogPosting", "TechArticle"):
            return m.group(0)
        d.setdefault("inLanguage", "ja")
        pub = d.setdefault("publisher", {"@type": "Organization", "name": "株式会社TechWorker", "url": f"{SITE}/"})
        pub.setdefault("logo", LOGO)
        if links and not d.get("citation"):
            d["citation"] = links
        return m.group(1) + json.dumps(d, ensure_ascii=False) + m.group(3)

    new = LD.sub(fix, t)
    if new != t:
        p.write_text(new, encoding="utf-8")
        return 1
    return 0


def meta(t, name):
    m = re.search(rf'<meta (?:name|property)="{name}" content="([^"]*)"', t)
    return html.unescape(m.group(1)) if m else ""


def title(t):
    m = re.search(r"<title>(.*?)</title>", t, re.S)
    return html.unescape(re.split(r"\s+—\s+", m.group(1))[0].strip()) if m else ""


def llms(arts):
    top = (ROOT / "index.html").read_text(encoding="utf-8")
    out = [f"# 株式会社TechWorker\n\n> {meta(top, 'description')}\n",
           "所在地は日本。代表取締役 CEO兼CTO 古野光太朗。\n",
           "## 主なページ\n",
           f"- [会社概要]({SITE}/company)", f"- [サービス]({SITE}/services)", f"- [生成AI研修]({SITE}/training)",
           f"- [Microsoft Copilot の導入支援]({SITE}/copilot)", f"- [CompanyMap AI]({SITE}/companymap)",
           f"- [支援事例]({SITE}/cases)", f"- [お知らせ]({SITE}/news)", f"- [TechWorker Media（記事の一覧）]({SITE}/media/)", ""]
    by = {}
    for p, t in arts:
        by.setdefault(p.parent, []).append((p, t))
    for d in sorted(by):
        if d.name == "media":
            name = "TechWorker Media"
        else:
            name = title((d / "index.html").read_text(encoding="utf-8")).split("｜")[0]
        out.append(f"## {name}\n")
        for p, t in by[d]:
            url = f"{SITE}/{p.relative_to(ROOT).with_suffix('')}"
            out.append(f"- [{title(t)}]({url})：{meta(t, 'description')}")
        out.append("")
    (ROOT / "llms.txt").write_text("\n".join(out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    arts = list(articles())
    n = sum(enrich(p, t) for p, t in arts)
    llms([(p, p.read_text(encoding="utf-8")) for p, _ in arts])
    print(f"geo_enrich: 記事 {len(arts)} 本、構造化データを直した {n} 本、llms.txt を書き出した")
