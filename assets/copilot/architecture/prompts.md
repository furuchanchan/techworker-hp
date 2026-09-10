# Architecture image prompts

All six assets use the supplied reference image only for visual language: polished Japanese enterprise Microsoft 365 architecture diagram, 1536×1024 landscape, white canvas, pale blue rounded environment boundary, navy type, blue right-angle arrows, numbered flow circles, Microsoft product icons. Each is a distinct spatial system diagram, never a four-column or step-card layout.

## automate
Title: 承認フローを、見える形で運用する
Supplement: 申請、承認、差戻し、例外対応を一つの流れに整理します。
Structure: SharePoint 申請リスト → Power Automate cloud flow → human approver; branch from approval to update list + Teams notification; branch from return to update list + Teams notification; error branch to error response owner.

## teams
Title: 会議の決定を、次の行動につなげる
Supplement: AIの整理案を主催者が原発言と照合して確定します。
Structure: participants → Teams meeting and transcription → Copilot in Teams → minutes draft → organizer checks original statements → finalized and shared.

## word
Title: 提案書の下書きを、根拠とともに進める
Supplement: 参照する資料を明示し、最終確認は営業担当が行います。
Structure: sales rep + meeting notes + explicitly referenced materials → Copilot in Word → human checks facts, amounts, terms → proposal.

## excel
Title: 数字の傾向を、検証可能な形で捉える
Supplement: 分析結果は因果を断定せず、元データと数式で検証します。
Structure: analyst + cleaned Excel table → Copilot in Excel → differences and trends → owner checks source data and formulas → report memo.

## powerpoint
Title: 報告資料の構成を、確かな根拠からつくる
Supplement: 数値、出典、企業テンプレートと体裁を確認して仕上げます。
Structure: report owner + report memo/reference materials → Copilot in PowerPoint → slide proposal → human checks numbers/sources/company template/layout → report deck.

## outlook
Title: メール対応を、確認を残して効率化する
Supplement: Copilotは要約と返信下書きまで。送信前の確認は担当者が行います。
Structure: owner + email thread → Copilot in Outlook → summary/reply draft → human separately checks recipients/terms/deadline/attachments → send. Never show automatic send.
