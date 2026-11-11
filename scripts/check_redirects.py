#!/usr/bin/env python3
"""_redirects が Cloudflare Pages で全部効く並びかを確かめる。

Pages は、* や :name を含む最初の転送（動的な転送）から後ろの行をすべて動的として数え、
100件で打ち切る。打ち切られた行は警告なしに無視され、本番で404になる
（2026-11-11 に、7行目の /.github/* のせいで106件目以降の転送が全部効いていなかった）。
そこで、動的な転送は必ず末尾に置き、静的は2,000件・動的は100件の上限を守る。

使い方: python3 scripts/check_redirects.py [_redirects のパス]
"""
import sys
from pathlib import Path

STATIC_MAX = 2000
DYNAMIC_MAX = 100


def is_dynamic(src: str) -> bool:
    return "*" in src or any(part.startswith(":") for part in src.split("/"))


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "_redirects")
    errors = []
    rules = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        parts = s.split()
        if len(parts) < 2:
            errors.append(f"{path}:{n}: 行き先がない: {s}")
            continue
        if len(line) > 1000:
            errors.append(f"{path}:{n}: 1行が1,000字を超えている")
        rules.append((n, parts[0], is_dynamic(parts[0])))

    first_dynamic = next((i for i, r in enumerate(rules) if r[2]), None)
    if first_dynamic is not None:
        late_static = [r for r in rules[first_dynamic:] if not r[2]]
        for n, src, _ in late_static:
            errors.append(f"{path}:{n}: 静的な転送 {src} が動的な転送（{rules[first_dynamic][0]}行目）より後ろにある。動的な転送を末尾へ移す")
        counted_dynamic = len(rules) - first_dynamic
    else:
        counted_dynamic = 0
    counted_static = len(rules) - counted_dynamic
    if counted_dynamic > DYNAMIC_MAX:
        errors.append(f"{path}: 動的として数えられる転送が {counted_dynamic} 件で、上限 {DYNAMIC_MAX} 件を超える（超えた分は本番で無視される）")
    if counted_static > STATIC_MAX:
        errors.append(f"{path}: 静的な転送が {counted_static} 件で、上限 {STATIC_MAX} 件を超える")

    if errors:
        print("\n".join(errors))
        return 1
    print(f"ok: 静的 {counted_static} 件・動的 {counted_dynamic} 件（動的は末尾）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
