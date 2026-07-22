# GitHub Release 配布手順書 変更レポート

## 変更概要

Avalonia 版と Tauri 版の publish 済み成果物を、GitHub Release の asset として手動配布するためのリポジトリ固有手順を追加した。

## 更新した文書

- `docs/release/README.md`
  - release commit / tag、OS別 publish、ライセンスを含む梱包、asset別 checksum、Draft Release へのOS別upload、smoke test、公開後確認、将来自動化を追加した。
- `README.md`
  - GitHub Release 配布手順への導線を追加した。
- `docs/design_analysis/documentation/20260721_github_release_guide/`
  - 設計、設計レビュー、実施記録、実装文書レビュー、変更レポートを追加した。

## 削除、移動、統合

- 削除、移動、既存文書の統合は行っていない。

## 主なレビュー反映

- release tag と macOS / Windows 成果物を同じ commit へ結び付けた。
- version 不一致と第三者ライセンス未確認を公開停止条件にした。
- 現行 Tauri DMG は `plantuml.jar` 未同梱のため配布対象外とした。
- macOS / Windows の全配布物を、プロジェクト LICENSE と第三者通知を含む ZIP に統一した。
- OS別assetを1台へ集約せず、各OSから同じDraft Releaseへassetと個別SHA-256をuploadする手順にした。
- 古いassetを再利用しないfail-fast条件と、成果物version / インストール後実体の確認を追加した。

## 実行した確認

- `git diff --check`: error なし。
- 変更ファイル一覧: Markdown 文書のみであることを確認。
- ローカル相対リンク: README、development workflow、sample document、LICENSE の存在を確認。
- `rg` 確認: 旧 checksum 集約手順、DMG制約の曖昧表現、旧asset表現が残っていないことを確認。
- 外部公式リンク: GitHub、Tauri、PlantUML の参照先を確認。
- 設計レビューと実装文書レビューを実施し、必須指摘を解消した。

## docs-only と diff.zip

変更は Markdown 文書だけであり、アプリケーションコード、スクリプト、設定、runtime asset を変更していない。documentation workflow のため `diff.zip` は作成していない。

## todo / history

- 単独の文書追加であるため `docs/todo/todo.md` への追跡項目は追加していない。
- アプリケーション挙動や publish 方式自体は変更していないため、実装 history は追加していない。

## 残る前提作業

初回の正式 Release 前に、別 workflow で次を整備する必要がある。

- Avalonia を含む version 定義の一元化
- `THIRD_PARTY_NOTICES.txt` と `third_party_licenses/` の作成
- 必要に応じて署名、notarization、DMG、GitHub Actions の実装
