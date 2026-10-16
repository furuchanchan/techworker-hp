# エージェント保管庫（/media/agents/）

業務ごとのAIエージェントの作り方を、決まった型で1件ずつ載せる見本帳。平日 7:30（JST）に GitHub Actions が1件足す。Mac が眠っていても止まらない。

## 置き場所

- `media/agents/data/<slug>.json` … 1件の正本。型は `schema.json`。ページはここから毎回作り直す（HTML を手で直さない）。
- `media/agents/<slug>.html`・`media/agents/index.html` … `vault.py build` が作る。
- `media/agents/covers/<slug>.png` … 1200×630 の表紙。`vault.py covers` → `cover.cjs` で作る。
- `media/index.html`・`sitemap.xml` の `<!-- agents-vault:start/end -->` の間 … `vault.py build` が書き換える。印の外は触らない。
- `topics.json` … 題材の待ち行列。先頭から使い、公開したら外す。通らなかった題材は最後に回る。空になったら書き手が自分で題材を選ぶ。

## 1日の流れ（`.github/workflows/agents-vault.yml`）

1. `generate.py` が先頭の題材を選ぶ。
2. 書き手（claude-opus-5-5）が公式のドメインだけを検索・閲覧し、`submit_entry`（strict な道具。入力欄＝schema.json）で提出する。
3. 機械の検証（`vault.validate`：欄の数・字数・使わない言葉・効果の数字・公式ドメイン、出典URLが開けるか、既存と重ならないか）。通らなければ書き手に返して直させる。
4. 審査（別の会話の claude-opus-5-5）が出典を開いて照らし、`submit_review` で PASS／FAIL を返す。大きな問題だけを不合格にする。不合格なら書き手が直し、もう一度審査する。
5. 合格したら JSON を書き、ページ・一覧・メディアトップの枠・サイトマップを作り直し、表紙を作り、master に push し、`deploy.yml` を手動起動のきっかけで呼び、本番に出たことを確かめる。

## 上限（従量課金なので必ず止まる）

- 1回の推定費用が `MAX_RUN_USD`（3.5ドル。書き直しが1回入っても収まる額）を超えたら止める。出力が max_tokens で切れたときも止める。ログに1呼び出しごとの費用の目安が出る。
- 書き直しは `MAX_REVISIONS`（2回）まで。pause_turn の続きは6回まで。
- 月の公開は `MONTHLY_CAP`（25件）まで。同じ日の2件目は足さない（Actions の画面から手で起動し、試しを外したときだけ足す）。
- 検索は1回4件、閲覧は1回8件・1ページ6,000トークンまで（公式のドメインだけ）。2回目以降の呼び出しは、読み込み済みの分をキャッシュから読む。

## 手で動かす

```bash
python3 scripts/agents_vault/vault.py check
python3 scripts/agents_vault/vault.py build
python3 scripts/agents_vault/vault.py covers /tmp/vault-covers && node scripts/agents_vault/cover.cjs /tmp/vault-covers media/agents/covers
```

GitHub の Actions 画面から「Agents vault daily entry」を手動で起動すると、既定は試し（dry run）で、書いた1件を artifact に残すだけで公開しない。

鍵はリポジトリの Secrets の `ANTHROPIC_API_KEY`。無ければ最初の手順で失敗して止まる。
