#!/usr/bin/env python3
"""エージェント保管庫に1件足す（GitHub Actions の平日の定時実行から呼ぶ）。

流れ：題材を選ぶ → 書き手（Opus 5.5）が公式のページだけを検索・閲覧し、submit_entry に型どおり提出
→ 機械の検証（vault.validate と出典URLの到達確認）→ 審査（別の会話の Opus 5.5 が出典を開いて確かめる）
→ 合格したら media/agents/data/<slug>.json を書き、題材を待ち行列から外し、ページを組み立てる。
不合格のまま上限に達したら何も書かずに失敗で終わる（翌日は次の題材に進む）。

  ANTHROPIC_API_KEY=... python3 scripts/agents_vault/generate.py [--dry-run]

上限：1回の実行の推定費用 MAX_RUN_USD、月の公開件数 MONTHLY_CAP、書き直し MAX_REVISIONS 回。
"""
import datetime
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

import anthropic

sys.path.insert(0, str(Path(__file__).parent))
import vault  # noqa: E402

MODEL = "claude-opus-5-5"
MAX_RUN_USD = 3.5
MONTHLY_CAP = 25
MAX_REVISIONS = 2
TOPICS = Path(__file__).parent / "topics.json"
JST = datetime.timezone(datetime.timedelta(hours=9))
TODAY = datetime.datetime.now(JST).date().isoformat()
ALLOWED = [
    "learn.microsoft.com", "support.microsoft.com", "adoption.microsoft.com", "www.microsoft.com",
    "techcommunity.microsoft.com", "support.claude.com", "docs.claude.com", "code.claude.com",
    "claude.com", "www.claude.com", "academy.claude.com", "www.anthropic.com", "platform.claude.com",
    "support.google.com", "knowledge.workspace.google.com", "workspace.google.com", "blog.google",
    "cloud.google.com", "docs.cloud.google.com", "gemini.google",
]

WRITER_SYSTEM = f"""あなたは TechWorker（法人向け生成AI研修の会社）のメディア「エージェント保管庫」の編集者です。
日本の会社の担当者が読んで、その日のうちに自社でエージェントを作り始められる1件を書きます。今日は {TODAY} です。

大事にすること
- 機能、画面の名前、必要な契約、管理者の設定は、提供元の公式ページを開いて確かめたことだけを書きます。今日時点の最新の仕様で書き、名前が変わった機能は新しい名前で書きます。日本語の公式ページがあれば、画面の名前は日本語版に合わせます。
- どの業務にどう使うかは、TechWorker の例として具体的に書いてかまいません。機能そのものは公式に書いてある範囲に限ります。
- 確かめられない機能に頼る題材なら、同じ部署の別の業務に変えてかまいません。題は「〜エージェント」で終えます。
- 効果の数字（〇%、〇時間短縮など）は書きません。
- 指示文（prompt）は、日本の会社でそのまま貼って使える実用品にします。役割、受け取るもの、進め方、答え方、根拠の示し方、わからないときの返し方、させないことを含め、会社名は「当社」、置き換える所は［　］にします。
- 「管理者が先に決めること」はこの見本帳の柱です。データの範囲、共有の範囲、接続の権限、ログ、使う人の範囲など、その製品の管理者が実際に決める設定を、公式の設定名で書きます。
- 「30日後に測ること」は、使われているか、時間、出来の3つの観点で、その業務で測れるものを具体的に書きます。

文章
- です・ます。1つの文で1つのことだけ言います。職場でふだん使う言葉（担当者、決まり、下書き、確かめる、任せる）を選びます。
- 「AではなくB」「〜のは〜からだ」、「〜だ。」で言い切る文、翻訳調、中黒の羅列は使いません。
- 「実質無料」「認定」「パートナー」「No.1」「必ず」「絶対」は使いません。
- 補助動詞と「事」「為」はひらがなで書きます（してください、できます、すること、するために）。
- 短い主語や主題のすぐあとに、間を作るだけの読点を打ちません（「担当者は、」「設定を、」）。
- 「〜を行う」より、対象と動詞をそのままつなぎます（「確認を行います」→「確かめます」）。
- 手順や先に済ませる作業を括弧に入れず、行う順に文で書きます。目的や理由を「〜ためです。」の短い文に切り出しません。

境界
- 根拠にするのは製品の提供元の公式ページだけです。sources には実際に開いて中身を確かめたURLだけを2〜6件載せます。
- 書き終えたら submit_entry を1回呼んで提出します。検証や審査で直す所が返ってきたら、直して submit_entry を呼び直します。"""

REVIEW_SYSTEM = f"""あなたは「エージェント保管庫」の独立した審査担当です。今日は {TODAY} です。
書き手とは別の立場で、提出された1件を公開してよいかを決めます。sources の公式ページを web_fetch で開き、書いてあることと照らします。

不合格（FAIL）にするのは、公開すると読み手が困る大きな問題だけです。
- 公式に無い機能や設定を、あるものとして書いている。名前が古い、または違う。
- 必要な契約や手順が公式と食い違い、その通りに作れない。
- 管理者の設定が危ない（広く共有しすぎる、権限が強すぎる）か、実在しない。
- 効果の数字や、確かめられない約束を書いている。
- 日本語が不自然で、お客さまにそのまま出せない。指示文がそのままでは使えない。
公式と食い違う記述と、公式より言い過ぎ・言い足りない記述は、1文でも blocking を true にします。読み手が設定や手順を取り違えるためです。
細かな言い回しの好みは不合格の理由にしません。好みの直しは blocking を false にして problems に書きます。
最後に submit_review を1回呼んで結果を返します。"""

REVIEW_TOOL = {
    "name": "submit_review",
    "description": "審査の結果を返す",
    "strict": True,
    "input_schema": {
        "type": "object", "additionalProperties": False, "required": ["verdict", "problems", "summary"],
        "properties": {
            "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
            "problems": {"type": "array", "items": {
                "type": "object", "additionalProperties": False, "required": ["field", "issue", "fix", "blocking"],
                "properties": {"field": {"type": "string"}, "issue": {"type": "string"}, "fix": {"type": "string"}, "blocking": {"type": "boolean"}}}},
            "summary": {"type": "string"},
        },
    },
}
ENTRY_TOOL = {"name": "submit_entry", "description": "エージェント保管庫の1件を提出する", "strict": True, "input_schema": vault.SCHEMA}


def web_tools(search=True):
    # 読むページの量が費用の大半になる（1回目の試しで入力が約80万トークン）。1ページ6,000トークン、閲覧8件、検索4回まで
    tools = [{"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 8, "max_content_tokens": 6000, "allowed_domains": ALLOWED}]
    if search:
        tools.insert(0, {"type": "web_search_20260209", "name": "web_search", "max_uses": 4, "allowed_domains": ALLOWED})
    return tools


class Budget:
    def __init__(self):
        self.usd = 0.0

    def add(self, usage):
        cost = (usage.input_tokens * 4 + (usage.cache_creation_input_tokens or 0) * 5
                + (usage.cache_read_input_tokens or 0) * 0.2 + usage.output_tokens * 20) / 1e6
        stu = getattr(usage, "server_tool_use", None)
        cost += (getattr(stu, "web_search_requests", 0) or 0) * 0.01
        self.usd += cost
        print(f"  cost +${cost:.3f} (total ${self.usd:.3f}) in={usage.input_tokens} cache_read={usage.cache_read_input_tokens or 0} "
              f"cache_write={usage.cache_creation_input_tokens or 0} out={usage.output_tokens}", flush=True)
        if self.usd > MAX_RUN_USD:
            raise SystemExit(f"1回の上限 ${MAX_RUN_USD} を超えたので止めます")


def call(client, budget, system, messages, tools, effort="high"):
    """1往復。pause_turn は続きを頼み、tool_use か end_turn で返す。2回目以降は読み込み済みの分をキャッシュから読む。"""
    for _ in range(6):
        with client.beta.messages.stream(
            model=MODEL, max_tokens=64000, system=system, messages=messages, tools=tools,
            thinking={"type": "adaptive"}, output_config={"effort": effort}, cache_control={"type": "ephemeral"},
            betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        ) as stream:
            msg = stream.get_final_message()
        budget.add(msg.usage)
        messages.append({"role": "assistant", "content": msg.content})
        if msg.stop_reason == "refusal":
            raise SystemExit(f"断られました: {getattr(msg, 'stop_details', None)}")
        if msg.stop_reason == "max_tokens":
            raise SystemExit("出力が max_tokens で切れました（提出が途中で切れるため止めます）")
        if msg.stop_reason != "pause_turn":
            return msg
    raise SystemExit("pause_turn が続いたので止めます")


def tool_call(msg, name):
    return next((b for b in msg.content if b.type == "tool_use" and b.name == name), None)


def feedback(messages, use_id, text):
    """直す所を書き手に返す。直前の応答がその提出なら tool_result、そうでなければふつうの発言で返す。"""
    last = messages[-1]["content"] if messages and messages[-1]["role"] == "assistant" else []
    if any(getattr(b, "type", "") == "tool_use" and b.id == use_id for b in last):
        messages.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": use_id, "is_error": True, "content": text}]})
    else:
        messages.append({"role": "user", "content": text})


def reachable(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (TechWorker agents-vault link check)"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status < 400
    except Exception as err:  # 失敗の理由は書き手に返す
        print(f"  link check failed: {url} ({err})")
        return False


def check(entry, existing):
    errs = vault.validate(entry)
    if entry.get("slug") in {x["slug"] for x in existing} or (vault.DATA / f"{entry.get('slug')}.json").exists():
        errs.append("slug が既存の件と重なっています。別の slug にしてください")
    if entry.get("title") in {x["title"] for x in existing}:
        errs.append("題が既存の件と重なっています")
    if not errs:
        errs += [f"sources: 開けないURL {s['url']}" for s in entry["sources"] if not reachable(s["url"])]
    return errs


def lint_notes(entry):
    """お客さまが読む欄を yomiyasu の点検にかけ、見直し候補を返す（合否には使わない）。"""
    keys = ["title", "summary", "task", "before", "after", "flow", "steps", "prompt_where", "admin", "human_checks", "pitfalls", "measure", "variations"]
    text = "\n\n".join(t for k in keys for t in vault._texts(entry.get(k, "")))
    lint = Path(__file__).parent / "yomiyasu" / "yomiyasu_lint.py"
    out = subprocess.run([sys.executable, str(lint), "--json", "--doc-type", "manual", "-"], input=text, capture_output=True, text=True, timeout=60)
    findings = json.loads(out.stdout).get("findings", []) if out.stdout.strip() else []
    return [f"「{f['snippet'][:40]}」: {f['message'][:110]}" for f in findings if f.get("severity") in ("info", "warn", "error")][:15]


def write(client, budget, topic, existing):
    listing = "\n".join(f"- {x['title']}（{x['department']}／{x['product']}）" for x in existing)
    example = json.dumps(existing[0], ensure_ascii=False, indent=1) if existing else "（まだありません）"
    if topic:
        ask = (f"今日の題材：{topic['title']}\n部署：{topic['department']}\n製品：{topic['product']}（{topic.get('feature', '')}）\n"
               f"手がかりになる公式のページ：\n" + "\n".join(topic.get("hints", [])))
    else:
        ask = "今日の題材は決まっていません。既存の件と部署や製品が偏らないように、法人のよくある業務を1つ選んでください。"
    messages = [{"role": "user", "content": f"""{ask}

すでに載っている件（題や業務を重ねないでください）：
{listing or '（まだありません）'}

型の見本（書き方の参考。中身は写さないでください）：
{example}

公式のページで確かめてから、submit_entry で提出してください。"""}]
    tools = web_tools() + [ENTRY_TOOL]
    msg = call(client, budget, WRITER_SYSTEM, messages, tools)
    linted, last_ok = False, None
    for attempt in range(MAX_REVISIONS + 4):
        use = tool_call(msg, "submit_entry")
        if not use:
            if last_ok:
                return last_ok  # 推敲の候補に対して「直す所なし」と答えたとき
            if attempt >= 1:
                raise SystemExit("submit_entry が呼ばれませんでした")
            messages.append({"role": "user", "content": "submit_entry で提出してください。"})
            msg = call(client, budget, WRITER_SYSTEM, messages, tools)
            continue
        entry = dict(use.input)
        errs = check(entry, existing)
        if not errs and not linted:
            linted = True
            notes = lint_notes(entry)
            print(f"  yomiyasu: {len(notes)} 件の見直し候補")
            if notes:
                last_ok = (entry, messages, use.id)
                feedback(messages, use.id, "日本語の見直し候補です。意味、設定名、数値を変えずに直せる所だけ直し、submit_entry を呼び直してください。直す所が無ければ同じ内容で呼び直してください。\n- " + "\n- ".join(notes))
                msg = call(client, budget, WRITER_SYSTEM, messages, tools)
                continue
        if not errs:
            return entry, messages, use.id
        print(f"  validation: {errs}")
        if attempt >= MAX_REVISIONS:
            raise SystemExit(f"検証に通りませんでした: {errs}")
        feedback(messages, use.id, "検証で次の点が見つかりました。直して submit_entry を呼び直してください。\n- " + "\n- ".join(errs))
        msg = call(client, budget, WRITER_SYSTEM, messages, tools)
    raise SystemExit("書き直しの上限に達しました")


def review(client, budget, entry):
    messages = [{"role": "user", "content": "次の1件を審査してください。\n\n" + json.dumps(entry, ensure_ascii=False, indent=1)}]
    msg = call(client, budget, REVIEW_SYSTEM, messages, web_tools(search=False) + [REVIEW_TOOL], effort="medium")
    use = tool_call(msg, "submit_review")
    if not use:
        messages.append({"role": "user", "content": "submit_review で結果を返してください。"})
        msg = call(client, budget, REVIEW_SYSTEM, messages, web_tools(search=False) + [REVIEW_TOOL], effort="medium")
        use = tool_call(msg, "submit_review")
    if not use:
        raise SystemExit("審査の結果が返りませんでした")
    return dict(use.input)


def main():
    dry = "--dry-run" in sys.argv
    existing, problems = vault.load_all()
    if problems:
        raise SystemExit(f"既存の件が検証に通りません: {problems}")
    month = TODAY[:7]
    if sum(x["published_on"].startswith(month) for x in existing) >= MONTHLY_CAP:
        print(f"今月はすでに {MONTHLY_CAP} 件を公開したので、今日は足しません")
        return 0
    # 同じ日の2件目は足さない。手で起動したとき（--allow-same-day）だけは足してよい
    if any(x["published_on"] == TODAY for x in existing) and not dry and "--allow-same-day" not in sys.argv:
        print("今日の分はすでに公開済みです")
        return 0
    topics = json.loads(TOPICS.read_text())
    titles = {x["title"] for x in existing}
    topics = [t for t in topics if t["title"] not in titles]
    topic = topics[0] if topics else None
    print(f"topic: {topic['title'] if topic else '(自由に選ぶ)'}", flush=True)

    try:
        return publish(topic, existing, dry)
    except (SystemExit, anthropic.APIError):
        if topic and not dry:
            # 通らなかった題材は待ち行列の最後に回し、翌日は次の題材に進む
            queue = json.loads(TOPICS.read_text())
            queue = [t for t in queue if t["title"] != topic["title"]] + [topic]
            TOPICS.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n")
            gh_out = os.environ.get("GITHUB_OUTPUT")
            if gh_out:
                with open(gh_out, "a") as f:
                    f.write("rotated=1\n")
        raise


def publish(topic, existing, dry):
    client = anthropic.Anthropic(max_retries=3)
    budget = Budget()
    entry, messages, use_id = write(client, budget, topic, existing)
    for round_ in range(MAX_REVISIONS + 1):
        result = review(client, budget, entry)
        print(f"  review: {result['verdict']} {result['summary']}", flush=True)
        for p in result["problems"]:
            print(f"    - [{'直す' if p['blocking'] else '参考'}] {p['field']}：{p['issue']} → {p['fix']}", flush=True)
        blocking = [p for p in result["problems"] if p["blocking"]]
        if result["verdict"] == "PASS" and not blocking:
            break
        if round_ >= MAX_REVISIONS:
            raise SystemExit(f"審査に通りませんでした: {json.dumps(result, ensure_ascii=False)}")
        notes = "\n".join(f"- {p['field']}：{p['issue']} → {p['fix']}" for p in result["problems"])
        feedback(messages, use_id, "審査で次の点が見つかりました。公式のページで確かめて直し、直していない項目も省かずに全項目を入れて submit_entry を呼び直してください。\n" + notes)
        # 直した項目だけを出してくることがある（2026-10-21 の失敗）。検証の結果を返して1回だけ出し直させる
        for retry in range(2):
            msg = call(client, budget, WRITER_SYSTEM, messages, web_tools() + [ENTRY_TOOL])
            use = tool_call(msg, "submit_entry")
            if not use:
                raise SystemExit("書き直しが提出されませんでした")
            use_id, entry = use.id, dict(use.input)
            errs = check(entry, existing)
            if not errs:
                break
            if retry:
                raise SystemExit(f"書き直しが検証に通りませんでした: {errs}")
            print(f"  validation: {errs}", flush=True)
            feedback(messages, use_id, "検証で次の点が見つかりました。直した項目だけでなく、全項目を入れて submit_entry を呼び直してください。\n- " + "\n- ".join(errs))

    entry["published_on"] = TODAY
    entry["checked_on"] = TODAY
    out = Path(os.environ.get("VAULT_DRY_OUT", "/tmp")) / f"{entry['slug']}.json"
    if dry:
        out.write_text(json.dumps(entry, ensure_ascii=False, indent=2) + "\n")
        print(f"dry-run: {out} (${budget.usd:.2f})")
        return 0
    (vault.DATA / f"{entry['slug']}.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2) + "\n")
    if topic:
        rest = [t for t in json.loads(TOPICS.read_text()) if t["title"] != topic["title"]]
        TOPICS.write_text(json.dumps(rest, ensure_ascii=False, indent=2) + "\n")
    vault.build()
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a") as f:
            f.write(f"slug={entry['slug']}\ntitle={entry['title']}\ncost={budget.usd:.2f}\n")
    print(f"published: {entry['slug']} (${budget.usd:.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
