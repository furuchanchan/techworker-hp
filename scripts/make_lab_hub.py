#!/usr/bin/env python3
"""ラボの一覧ページ（media/<ラボ>/index.html）を、Claude ラボの一覧（media/claude/index.html）を型にして作る。
使い方: python3 scripts/make_lab_hub.py <ラボ> [リポジトリ]   例: python3 scripts/make_lab_hub.py copilot
- 色・文・研修と資料の行き先・壁の画像を、下の LABS の値に置き換える。型の中で置き換える所が見つからなければ止まる。
- 壁の画像は、記事の図（media/<フォルダ>/figs/<名前>.png、1920×1080）の上下の札を切って 560×254 にした物（f-）と、ラボの記事の表紙を 560×294 にした物（c-）を media/<ラボ>/wall/ に作り、交互に並べる。表紙を描き直したら流し直す。
  図の中に製品のロゴが入っている物は使わない（ラボは公式のロゴを使わない）。
- 記事の一覧と ItemList は空のまま。続けて media/audiences.json の labs に足し、scripts/build_lab_hubs.py を流すと入る。
2026-11-23 に Copilot ラボ・Gemini ラボを作るときに足した。同じ日に、研修以外へ案内するラボ（業務図ラボ→ギョウムズAI）と運営元の書き方を、LABS の cta・about_who で変えられるようにした。"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

KEY = sys.argv[1]
ROOT = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path(__file__).resolve().parents[1]
SITE = "https://techworker.co.jp/"
UTM = "utm_source=techworker_media&amp;utm_medium=hub&amp;utm_campaign="

# Claude の色 → ラボの色。地・字・線は製品の画面の明るい色、差し色は白い字との比 4.5 以上（色の地に黒い字は使わない）
CLAUDE_COLORS = ["#FAF9F5", "#F0EEE6", "#E8E6DC", "#D1CFC5", "#141413", "#30302E", "#5E5D59",
                 "#D97757", "#C6613F", "#B5532F", "#9C4527", "#EFEDE5", "#DCD8CC", "250,249,245"]

LABS = {
    # Microsoft Fluent 2 の web の明るい色（neutral background 2・4・stroke 2・1、foreground 1・2・3、brand 80・70・60）
    "copilot": {
        "name": "Copilot ラボ",
        "colors": ["#FAFAFA", "#F0F0F0", "#E0E0E0", "#D1D1D1", "#242424", "#424242", "#616161",
                   "#0F6CBD", "#115EA3", "#0F6CBD", "#0F548C", "#EBEBEB", "#D6D6D6", "250,250,250"],
        "color_note": "Microsoft 365 の画面の色（地 #FAFAFA・差し色 #0F6CBD）",
        "title": "Copilot ラボ｜Microsoft 365 Copilot・GitHub Copilot を法人で使うための実務メディア",
        "desc": ("Microsoft 365 Copilot と GitHub Copilot を法人で使うための実務メディアです。ライセンスと料金、SharePoint の権限の棚卸しと管理者の設定、エージェントとコネクタ、社内への広げ方と研修を、Microsoft・GitHub の公式資料で確かめた日付つきで解説します。"),
        "h1": "Copilot を、",
        "line": "Microsoft 365 Copilot と GitHub Copilot を法人で使うときの判断を扱うメディアです。",
        "lead": "ライセンスと料金、SharePoint の権限の棚卸しと管理者の設定、エージェントとコネクタ、社内への広げ方と研修を書いています。",
        "train_anchor": "copilot",
        "train_name": "Copilot 研修",
        "train_text": ("Copilot Chat と Microsoft 365 Copilot の違い、Word・Excel・Outlook・Teams での実務から、社内の規程に答えるエージェントと、"
                       "申請の受付から承認・通知までのフローづくりまでを、1日（6時間）の講義と操作演習で行います。"),
        "offer": "copilot-ignite-sheet",
        "docs": [("cases", "2026年版 生成AI活用事例集")],
        "about": ("料金や機能の記事は Microsoft・GitHub の公式の料金表・ドキュメント・発表をもとに書き、確かめた日付を記事に書いています。"),
        "figs": ["copilot-adoption-s1", "copilot-bpr-s1", "copilot-bpr-s2", "copilot-bpr-s3", "copilot-cowork-toha-1", "copilot-cowork-toha-2",
                 "copilot-houjin-keiyaku-2", "copilot-mcp-connector-jouken", "copilot-mcp-connector-kata", "copilot-mcp-connector-kimeru",
                 "copilot-scheduled-prompts-shuryo-s1", "copilot-sharepoint-permission-audit-s1", "copilot-sharepoint-permission-audit-s2",
                 "github-copilot-houjin-keiyaku-2"],
    },
    # Google Material 3 の明るい色（surface・surface container・high、outline variant、on surface、on surface variant、primary）
    "gemini": {
        "name": "Gemini ラボ",
        "colors": ["#F8FAFD", "#F0F4F9", "#E9EEF6", "#C4C7C5", "#1F1F1F", "#3C4043", "#444746",
                   "#0B57D0", "#0842A0", "#0B57D0", "#0842A0", "#EDF2FA", "#D3DBE5", "248,250,253"],
        "color_note": "Google Workspace の画面の色（地 #F8FAFD・差し色 #0B57D0）",
        "title": "Gemini ラボ｜Google Workspace の Gemini を法人で使うための実務メディア",
        "desc": ("Google Workspace の Gemini を法人で使うための実務メディアです。Workspace のプランと料金、Gmail・Gems・Gemini Notebook の管理者の設定、利用の上限、社内ルールの決め方、Copilot との選び方を、Google の公式資料で確かめた日付つきで解説します。"),
        "h1": "Gemini を、",
        "line": "Google Workspace の Gemini を法人で使うときの判断を扱うメディアです。",
        "lead": "Workspace のプランと料金、Gmail・Gems・Gemini Notebook の管理者の設定、利用の上限、社内ルールの決め方と、Copilot との選び方を書いています。",
        "train_anchor": "gemini",
        "train_name": "Gemini 研修",
        "train_text": ("Docs・Gmail・Meet・Drive での実務から、資料を根拠に答えるノートブックと Gem、Workspace Studio の自動化までを、"
                       "1日（6時間）の講義と操作演習で行います。"),
        "offer": "ai-contract-pack",
        "docs": [("cases", "2026年版 生成AI活用事例集")],
        "about": "料金や機能の記事は Google の公式の料金表・ヘルプ・発表をもとに書き、確かめた日付を記事に書いています。",
        "figs": ["gemini-4-argon-business-trial-s1", "gemini-enterprise-riyou-jougen-s1", "gemini-gems-s1", "gemini-gems-s2", "gemini-gems-s3",
                 "gemini-gmail-kitei-on-s1", "gemini-gmail-kitei-on-s2", "gemini-houjin-keiyaku-s1", "gemini-houjin-keiyaku-s2",
                 "gemini-notebook-in-gemini-app-s2", "google-workspace-skills-s1", "google-workspace-skills-s2"],
    },
    # 導入ラボ（2026-11-23）：/media/kenshu/ のまま、ほかのラボに入らない kenshu の記事すべて（audiences.json の rest）。TechWorker の Paper と Electric（#005EFF）
    "kenshu": {
        "name": "導入ラボ",
        "colors": ["#FAFBFC", "#F0F2F5", "#E6E9EE", "#D5D9E0", "#11161D", "#2B323C", "#5A6677",
                   "#005EFF", "#0050D9", "#005EFF", "#0047C2", "#EDF0F4", "#D9DEE5", "250,251,252"],
        "color_note": "TechWorker の色（地 #FAFBFC・差し色 #005EFF）",
        "title": "導入ラボ｜生成AIを会社で選び、入れ、根づかせるための実務メディア",
        "desc": ("生成AIを会社で選び、入れ、根づかせるための実務メディアです。ChatGPT・Claude・Gemini・Copilot・Cursor の法人契約と料金の比べ方、"
                 "研修の委託先の選び方と効果の測り方、助成金、事故への備えを、公式資料で確かめた日付つきで解説します。"),
        "h1": "生成AIを、",
        "line": "生成AIを会社に入れるときの、契約の選び方と社内への広げ方を扱うメディアです。",
        "lead": "ChatGPT・Claude・Gemini・Copilot・Cursor の法人契約と料金、研修の委託先の選び方と効果の測り方、助成金、誤回答や情報漏えいへの備えを書いています。",
        "train_anchor": "how",
        "train_name": "生成AI研修",
        "train_text": ("最初の60分は全員が共通編を受け、そのあと、お使いの製品の編に進みます。"
                       "受講者は全員、事前に実際の業務を1つ書き、研修の中でその業務をAIに任せる形まで作ります。"),
        "offer": "ai-contract-pack",
        "docs": [("cases", "2026年版 生成AI活用事例集")],
        "about": ("料金や契約の記事は各社の公式の料金表・ヘルプ・発表を、助成金の記事は厚生労働省の資料をもとに書き、確かめた日付を記事に書いています。"),
        "figs": ["ai-training-outcome-first-exercise-s1", "ai-training-outcome-first-exercise-s2", "chatgpt-houjin-keiyaku-2", "company-brain-toha-s1",
                 "cursor-houjin-keiyaku-hikaku", "cursor-houjin-keiyaku-seki", "cursor-houjin-keiyaku-shiharai", "cursor-houjin-keiyaku-tasha",
                 "generative-ai-incident-tabletop-training-s1", "generative-ai-kenshu-joseikin-s1", "generative-ai-training-effectiveness-s1",
                 "generative-ai-training-effectiveness-s2", "generative-ai-training-rfp-vendor-selection-s1", "generative-ai-training-rfp-vendor-selection-s2"],
    },
    # 業務図ラボ（2026-11-23 に一覧を作り直した）：/media/gyomuzu/ の記事すべて。案内はギョウムズAI（研修ではない）。TechWorker の色
    "gyomuzu": {
        "name": "業務図ラボ",
        "colors": ["#FAFBFC", "#F0F2F5", "#E6E9EE", "#D5D9E0", "#11161D", "#2B323C", "#5A6677",
                   "#005EFF", "#0050D9", "#005EFF", "#0047C2", "#EDF0F4", "#D9DEE5", "250,251,252"],
        "color_note": "TechWorker の色（地 #FAFBFC・差し色 #005EFF）",
        "title": "業務図ラボ｜業務図で、AIに任せる仕事を決める実務メディア",
        "desc": ("部署の仕事を業務図にして、どの工程をAIに任せ、どこを人が決めるかを決めるための実務メディアです。"
                 "経理の月次締め・見積もり・市場調査・用途探しなどの部署別の業務図と、AI Ready の条件、AIの作業者への任せ方と点検、部署への広げ方を解説します。"),
        "h1": "業務図で、",
        "h1_rest": '<span class="nw">AIに任せる<br class="sp">仕事を決める。</span>',
        "line": "部署の仕事を業務図にして、AIに任せる工程と人が決める工程を分けるメディアです。",
        "lead": "経理の月次締め・見積もり・市場調査・用途探しなどの部署別の業務図と、AI Ready の条件、AIの作業者への任せ方と点検、部署への広げ方を書いています。",
        "train_anchor": "",
        "train_name": "ギョウムズAI",
        "train_text": "業務図を起点に、貴社の生成AI環境でAIエージェントを構築し、毎月の検証と改善まで弊社が担います。",
        "cta": {"url": "../../gyoumuzuai", "k": "AIが作る業務図", "btn": "ギョウムズAIを見る"},
        "offer": "gyomuzu-templates",
        "docs": [("cases", "2026年版 生成AI活用事例集")],
        "about_who": "業務図を起点にAIエージェントを作るギョウムズAIを提供する",
        "about": ("業務図は、TechWorker の社内で回している業務、支援の事例（会社名は伏せています）、記事で提案する設計例のどれかで、どれなのかを図の下に書いています。"),
        "figs": ["accounting-monthly-close-process-map-s1", "accounting-monthly-close-process-map-s2", "ai-ready-s1", "ai-ready-s2",
                 "ai-task-allocation-process-map-s1", "ai-worker-review-process-map-s1", "company-memory-nightly-process-map-s1",
                 "department-ai-rollout-process-map-s1", "market-research-inhouse-process-map-s1", "material-use-ideation-process-map-s1",
                 "material-use-ideation-process-map-s2", "media-article-automation-process-map-s1", "quotation-draft-review-process-map-s1",
                 "site-weekly-improvement-process-map-s1", "site-weekly-improvement-process-map-s2"],
    },
    # AIセキュリティ・ラボ（2026-11-23 に一覧を作り直した）：/media/security/ の記事すべて。案内は研修（共通編が漏えいと誤りを防ぐ）。TechWorker の色
    "security": {
        "name": "AIセキュリティ・ラボ",
        "colors": ["#FAFBFC", "#F0F2F5", "#E6E9EE", "#D5D9E0", "#11161D", "#2B323C", "#5A6677",
                   "#005EFF", "#0050D9", "#005EFF", "#0047C2", "#EDF0F4", "#D9DEE5", "250,251,252"],
        "color_note": "TechWorker の色（地 #FAFBFC・差し色 #005EFF）",
        "title": "AIセキュリティ・ラボ｜生成AIを安全に使い、自社のAIサービスを守るための実務メディア",
        "desc": ("生成AIを社内で安全に使い、自社のサイトやAIサービスを守るための実務メディアです。AI DLP で機密データを止める設計、ブラウザ操作AIのセッション分離、"
                 "LLM API の高額請求を防ぐ上限、Markdown 表示の XSS 対策、AIクローラーの制御を、公式資料で確かめた日付つきで解説します。"),
        "h1": "生成AIを、",
        "h1_rest": '<span class="nw">安全に使える<br class="sp">形にする。</span>',
        "line": "生成AIを社内で安全に使う設計と、自社のサイトやAIサービスを守る設計を扱うメディアです。",
        "lead": "AI DLP で機密データを止める設計、ブラウザ操作AIのセッション分離、LLM API の高額請求を防ぐ上限、Markdown 表示の XSS 対策、AIクローラーの制御を書いています。",
        "train_anchor": "how",
        "train_name": "生成AI研修",
        "train_text": ("最初の60分の共通編で、漏えいと誤りを防ぐ線引きを全員でそろえます。入れてよい情報を仕分け、罠の入った文書で試す演習のあと、お使いの製品の編に進みます。"),
        "offer": "ai-contract-pack",
        "docs": [("security", "Claude Code 企業導入 セキュリティ＆セットアップ実践ガイド"), ("cases", "2026年版 生成AI活用事例集")],
        "about": "記事は各社の公式ドキュメントと規格（RFC など）をもとに書き、確かめた日付を記事に書いています。",
        "figs": ["ai-crawler-control-s1", "ai-crawler-control-s2", "ai-crawler-control-s3", "browser-agent-session-isolation-design-s1",
                 "browser-agent-session-isolation-design-s2", "generative-ai-dlp-design-s1", "generative-ai-dlp-design-s2", "generative-ai-dlp-design-s3",
                 "llm-api-cost-abuse-controls-s1", "llm-api-cost-abuse-controls-s2", "llm-markdown-output-xss-sanitization-s1",
                 "llm-markdown-output-xss-sanitization-s2"],
    },
    # AIインタビュー・ラボ（2026-11-23 に一覧を作り直した）：/media/interview/ の記事すべて。案内はギョウムズAI（聞き取りから業務図を作る）。
    # CoeSignal は売らない方針（2026-10-27）なので、一覧からは案内しない。右下の枠（cv-dock.js）もギョウムズAI
    "interview": {
        "name": "AIインタビュー・ラボ",
        "colors": ["#FAFBFC", "#F0F2F5", "#E6E9EE", "#D5D9E0", "#11161D", "#2B323C", "#5A6677",
                   "#005EFF", "#0050D9", "#005EFF", "#0047C2", "#EDF0F4", "#D9DEE5", "250,251,252"],
        "color_note": "TechWorker の色（地 #FAFBFC・差し色 #005EFF）",
        "title": "AIインタビュー・ラボ｜AIの聞き取りを、社内の調査と判断に使うための実務メディア",
        "desc": ("AIが聞き手になるインタビュー（AIインタビュー）を、社内の聞き取りや調査に使うための実務メディアです。"
                 "AIモデレーターと人の分担、AI面接との違い、人はAIに本音を話すかの研究、何人に聞けば足りるか、社内の活用事例、分析の進め方、ツールの選び方を、論文と各社の公開資料をもとに解説します。"),
        "h1": "AIの聞き取りを、",
        "h1_rest": '<span class="nw">社内の判断に<br class="sp">使う。</span>',
        "line": "AIが聞き手になるインタビューを、社内の聞き取りと調査に使うためのメディアです。",
        "lead": "AIモデレーターと人の分担、AI面接との違い、人はAIに本音を話すか、何人に聞けば足りるか、社内の活用事例、分析とツールの選び方を書いています。",
        "train_anchor": "",
        "train_name": "ギョウムズAI",
        "train_text": "AIのインタビューと既存の資料・記録から、AIが業務図を作ります。8つの質問で判断の理由まで確かめ、業務図を起点に貴社の生成AI環境でAIエージェントを構築します。",
        "cta": {"url": "../../gyoumuzuai", "k": "AIが聞き取る業務図", "btn": "ギョウムズAIを見る"},
        "offer": "gyomuzu-templates",
        "docs": [("cases", "2026年版 生成AI活用事例集")],
        "about_who": "業務図を起点にAIエージェントを作るギョウムズAIを提供する",
        "about": "記事は論文と各社の公開資料をもとに書き、出典を記事に載せています。",
        "figs": ["ai-moderator-s1", "ai-moderator-s2", "honesty-with-ai-s1", "honesty-with-ai-s2", "honesty-with-ai-s3",
                 "how-many-interviews-s1", "how-many-interviews-s2", "internal-interview-cases-s1", "interview-analysis-s1",
                 "interview-tools-comparison-s2"],
    },
}

# 研修へ案内するラボの既定。研修以外へ案内するラボは LABS に cta（行き先・上の札・釦の字）を書く
TRAIN_URL = "https://kenshu.techworker.co.jp/program/"
CTA_DEFAULT = {"k": "法人研修", "btn": "研修の内容を見る"}
ABOUT_WHO = "生成AIの法人研修と導入支援を行う"

ARW = '<svg class="arw" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg>'


def sub(text, old, new, label, count=1):
    n = text.count(old)
    if n != count:
        raise SystemExit(f"{label}: 型の中に「{old[:50]}」が {n} 個（{count} 個のはず）")
    return text.replace(old, new)


def rx(text, pattern, repl, label, flags=re.S):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"{label}: 型の中に置き換える所が無い（{pattern[:60]}）")
    return out


def walls(lab, out_dir):
    """記事の図を切った画像（f-）と、ラボの記事の表紙（c-、560×294）を交互に並べる。Claude ラボの壁と同じ組み方"""
    out_dir.mkdir(parents=True, exist_ok=True)
    labs = json.loads((ROOT / "media/audiences.json").read_text())["labs"]
    rule = labs[KEY]
    names = []
    for f in lab["figs"]:
        src = ROOT / "media" / rule["dir"] / "figs" / f"{f}.png"
        im = Image.open(src).convert("RGB")
        if im.size != (1920, 1080):
            raise SystemExit(f"{src}: 図が 1920×1080 でない")
        # 上の札（製品の印）と下の札（媒体の名前）を切る。Claude ラボの壁と同じ切り方
        im.crop((0, 120, 1920, 991)).resize((560, 254), Image.LANCZOS).save(out_dir / f"f-{f}.jpg", quality=82, optimize=True)
        names.append(f"f-{f}.jpg")

    def mine(stem):  # rest のラボ（導入ラボ）は、同じフォルダのほかのラボに入らない記事
        if rule.get("rest"):
            return not any(k != KEY and o["dir"] == rule["dir"] and stem.startswith(tuple(o["prefixes"])) for k, o in labs.items())
        return stem.startswith(tuple(rule["prefixes"]))
    covers = []
    for path in sorted((ROOT / "media" / rule["dir"] / "covers").glob("*.png")):
        if mine(path.stem) and (ROOT / "media" / rule["dir"] / f"{path.stem}.html").is_file():
            Image.open(path).convert("RGB").resize((560, 294), Image.LANCZOS).save(out_dir / f"c-{path.stem}.jpg", quality=82, optimize=True)
            covers.append(f"c-{path.stem}.jpg")
    mixed = []
    for i in range(max(len(names), len(covers))):
        mixed += ([names[i]] if i < len(names) else []) + ([covers[i]] if i < len(covers) else [])
    return mixed


def column(names, start, length):
    seq = [names[(start + i) % len(names)] for i in range(length)]
    return "".join(f'<img src="wall/{n}" alt="" width="560" height="{294 if n.startswith("c-") else 254}">' for n in seq)


def main():
    lab = LABS[KEY]
    t = (ROOT / "media/claude/index.html").read_text()
    names = walls(lab, ROOT / "media" / KEY / "wall")

    # 色（CSS の中だけ。記事の一覧の画像の名前などは触らない）
    def recolor(m):
        css = m.group(0)
        for a, b in zip(CLAUDE_COLORS, lab["colors"]):
            css = css.replace(a, b)
        return css
    t = re.sub(r"<style>.*?</style>", recolor, t, flags=re.S)
    t = rx(t, r"/\* ===== Claude ラボ（2026-11-23）：1画面目は本体HPの壁を Claude の色（[^）]*）で敷く。",
           f"/* ===== {lab['name']}（2026-11-23。Claude ラボの一覧を型に scripts/make_lab_hub.py で作った）：1画面目は本体HPの壁を {lab['color_note']}で敷く。", "CSS の頭の説明")

    # 頭
    name, title, desc = lab["name"], lab["title"], lab["desc"]
    t = sub(t, 'data-media="claude"', f'data-media="{KEY}"', "html の data-media")
    t = rx(t, r"<title>[^<]*</title>", f"<title>{title}</title>", "title")
    for attr in ('name="description"', 'property="og:description"'):
        t = rx(t, rf'(<meta {attr} content=")[^"]*(")', rf"\g<1>{desc}\g<2>", attr)
    for attr in ('property="og:title"', 'name="twitter:title"'):
        t = rx(t, rf'(<meta {attr} content=")[^"]*(")', rf"\g<1>{title}\g<2>", attr)
    t = sub(t, f"{SITE}media/claude/", f"{SITE}media/{KEY}/", "canonical・og:url・構造化データの URL", count=4)

    def fix_ld(m):
        data = json.loads(m.group(2))
        if data.get("@type") == "CollectionPage":
            data.update({"name": name, "description": desc})
            data["mainEntity"] = {"@type": "ItemList", "itemListElement": []}
        elif data.get("@type") == "BreadcrumbList":
            data["itemListElement"][2]["name"] = name
        return m.group(1) + json.dumps(data, ensure_ascii=False) + m.group(3)
    t = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)', fix_ld, t, flags=re.S)

    # 上の帯と1画面目
    t = sub(t, '<a class="subnav__name" href="index.html">Claude ラボ</a>', f'<a class="subnav__name" href="index.html">{name}</a>', "上の帯の名前")
    cta = {**CTA_DEFAULT, **lab.get("cta", {})}
    url = cta.get("url", TRAIN_URL)
    anchor = f"#{lab['train_anchor']}" if lab.get("train_anchor") else ""
    t = sub(t, f"{TRAIN_URL}?{UTM}claude&amp;utm_content=nav#claude-code\" class=\"subnav__cta\">Claude Code 研修</a>",
            f"{url}?{UTM}{KEY}&amp;utm_content=nav{anchor}\" class=\"subnav__cta\">{lab['train_name']}</a>", "上の帯の研修")
    t = sub(t, '<section class="hero" aria-label="Claude ラボ">', f'<section class="hero" aria-label="{name}">', "1画面目の名前")
    t = sub(t, "<h1>Claude を、<br>", f"<h1>{lab['h1']}<br>", "見出し")
    if lab.get("h1_rest"):
        t = sub(t, '<span class="nw">会社で使える<br class="sp">形にする。</span></h1>', f"{lab['h1_rest']}</h1>", "見出しの2行目")
    t = rx(t, r'<p class="hero__line">[^<]*</p>', f'<p class="hero__line">{lab["line"]}</p>', "一言")
    t = rx(t, r'<p class="hero__desc">[^<]*</p>', f'<p class="hero__desc">{lab["lead"]}</p>', "説明")

    # 壁（1画面目は6列×36枚、研修の段は5列×10枚。Claude の型と同じ数）
    def hero_wall(m):
        cols = re.findall(r'<div class="wall__col( wall__col--move)?">', m.group(0))
        return '<div class="wall wall--hero" aria-hidden="true"><div class="wall__cam"><div class="wall__plane">' + "".join(
            f'<div class="wall__col{mv}">{column(names, i * 2, 36)}</div>' for i, mv in enumerate(cols)) + "</div></div>"
    t = rx(t, r'<div class="wall wall--hero" aria-hidden="true"><div class="wall__cam"><div class="wall__plane">.*?</div></div></div>(?=<div class="wall__veil">)', hero_wall, "1画面目の壁")
    t = rx(t, r'<div class="wall wall--still" aria-hidden="true"><div class="wall__cam"><div class="wall__plane">.*?</div></div></div>(?=<div class="wall__veil">)',
           lambda m: '<div class="wall wall--still" aria-hidden="true"><div class="wall__cam"><div class="wall__plane">' + "".join(
               f'<div class="wall__col">{column(names, i * 3 + 1, 10)}</div>' for i in range(5)) + "</div></div>", "研修の段の壁")

    # 記事の一覧は空にする（build_lab_hubs.py が入れる）
    t = rx(t, r'(<div id="audience-results" class="jz-cards">).*?(</div>\n<p class="audience-empty")', r"\1\n\2", "記事の一覧")

    # 資料
    docs = "".join(f'<a class="c-docs__o" href="../../library/?doc={d}&amp;{UTM}{KEY}&amp;utm_content=docs_{d}">{label}{ARW}</a>' for d, label in lab["docs"])
    t = rx(t, r'(<p class="c-docs__k">ほかの資料</p>).*?(</div>\n    <div class="tw-lead")', rf"\1{docs}\2", "ほかの資料")
    t = sub(t, '<div class="tw-lead" data-offer="claude-cost-sheet" data-campaign="claude-lab" data-pos="hub"></div>',
            f'<div class="tw-lead" data-offer="{lab["offer"]}" data-campaign="{KEY}-lab" data-pos="hub"></div>', "資料の申込み")

    # 研修
    t = sub(t, '<section class="c-train" aria-label="Claude Code 研修">', f'<section class="c-train" aria-label="{lab["train_name"]}">', "研修の段の名前")
    t = sub(t, "<h2>Claude Code 研修</h2>", f"<h2>{lab['train_name']}</h2>", "研修の見出し")
    t = rx(t, r'(<h2>' + re.escape(lab["train_name"]) + r'</h2>\n    <p>)[^<]*(</p>)', rf"\g<1>{lab['train_text']}\g<2>", "研修の説明")
    t = sub(t, f"{TRAIN_URL}?{UTM}claude&amp;utm_content=band#claude-code\">研修の内容を見る",
            f"{url}?{UTM}{KEY}&amp;utm_content=band{anchor}\">{cta['btn']}", "研修の釦")
    t = sub(t, '<div class="c-train__k">法人研修</div>', f'<div class="c-train__k">{cta["k"]}</div>', "研修の段の上の札")

    # このメディアについて（Claude for Startups の行は Claude ラボだけ）
    t = rx(t, r'(<h2>このメディアについて</h2>\n    <div>\n).*?(\n    </div>)',
           rf'\g<1>      <p>「{name}」は、{lab.get("about_who", ABOUT_WHO)}<a href="../../index.html">株式会社TechWorker</a>が運営するメディアです。</p>\n      <p>{lab["about"]}</p>\g<2>',
           "このメディアについて")

    # 型の Claude の言葉が残っていないか（ラボ自身の文に出てくる製品の名前は数えない。導入ラボの文は Claude を含む）
    body = re.sub(r"<style>.*?</style>", "", t, flags=re.S)
    for k in ("title", "desc", "line", "lead", "train_text", "about"):
        body = body.replace(lab[k], "")
    for _, label in lab["docs"]:
        body = body.replace(label, "")
    left = [w for w in ("Claude", "Anthropic", "claude") if w in body]
    if left:
        raise SystemExit(f"Claude の言葉が残っている：{left}")
    out = ROOT / "media" / KEY / "index.html"
    out.write_text(t)
    print(f"{out}（壁の画像 {len(names)} 枚）")


if __name__ == "__main__":
    main()
