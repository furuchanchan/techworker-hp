#!/usr/bin/env python3
"""会社の実績の数字が、ページによって割れていないかを確かめる。

支援社数は「50社超」（英語は 50+ companies）と書く。
出どころ：2026-11-08 本人「45社というピンポイントは違和感」→ 端数まで言わず丸める。

2026-11-21 に、45社が78ファイル・50社超が4ファイルに割れていたのを直したときに足した。
数字を変える日は、CURRENT を新しい書き方に、STALE に古い数を足す。
残っているページがここで全部出るので、それを直す。

使い方: python3 scripts/check_company_facts.py [調べるフォルダ]
"""
import pathlib
import re
import sys

CURRENT = "50社超"
STALE = ["37", "45"]

# 資料そのものの題や中身を言う行は、その資料の数字のまま残す
# （ホワイトペーパー「生成AI活用事例集 2026：7業種・45社の導入から見えた成功法則」）
ALLOW = (
    "7業種・",
    "seven industries",
    "導入事例の中から",
    "ホワイトペーパー。資料請求",
    "white paper compiling",
    "37 client deployments",
)

SKIP_DIRS = {".git", ".github", "node_modules", "_site", ".wrangler", "scripts"}
SKIP_FILES = {"CHANGELOG.md"}
EXTS = {".html", ".md", ".js", ".json", ".xml", ".txt"}

n = "|".join(STALE)
PATTERNS = [
    re.compile(rf"(?<![0-9,.])(?:{n})社"),
    re.compile(rf"(?<![0-9,.$])(?:{n})\+? (?:compan|client)"),
    re.compile(rf">(?:{n})<small>(?:社|\+)"),
    re.compile(rf'class="num">(?:{n})<'),
    # 束ねた JS（assets/copilot）の中の数字
    re.compile(rf"`(?:{n})`,\(0,\w+\.jsx\)\(`small`,\{{children:`社"),
]


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    hits = []
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.suffix not in EXTS or p.name in SKIP_FILES:
            continue
        if SKIP_DIRS & set(p.relative_to(root).parts):
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for i, line in enumerate(text.split("\n"), 1):
            if any(a in line for a in ALLOW):
                continue
            for rx in PATTERNS:
                m = rx.search(line)
                if m:
                    s = max(m.start() - 20, 0)
                    hits.append(f"{p.relative_to(root)}:{i}: …{line[s:m.end() + 12].strip()}…")
                    break
    if hits:
        print(f"支援社数の古い書き方が {len(hits)} か所に残っています。今の書き方は「{CURRENT}」です。")
        for h in hits:
            print("  " + h)
        print("別の事実を指す数字なら、scripts/check_company_facts.py の ALLOW にその行の言葉を足してください。")
        return 1
    print(f"支援社数の書き方はそろっています（{CURRENT}）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
