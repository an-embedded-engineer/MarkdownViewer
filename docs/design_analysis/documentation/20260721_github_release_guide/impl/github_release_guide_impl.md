# GitHub Release 配布手順書 実施記録

## 更新した文書

- `docs/release/README.md`
  - 初回配布対象、release commit / tag、OS別 publish、asset 梱包、ライセンス、checksum、Draft Release、smoke test、公開後確認、将来自動化を追加した。
- `README.md`
  - ドキュメント節から GitHub Release 配布手順への入口を追加した。
- documentation workflow 記録
  - 設計レビューの指摘を設計と手順書へ反映した。

## 移動、削除、統合

- 移動、削除、既存文書の統合は行っていない。
- publish コマンドの正本は `docs/rules/development_workflow.md` のままとし、Release 手順書はその後工程を扱う。

## 整合確認

- macOS / Windows の publish コマンドと出力先を既存スクリプトおよび development workflow と照合した。
- 現行 Tauri DMG の jar 未同梱を既知制約として明記した。
- GitHub Actions、署名、notarization は未実装であることを明記した。
- ルート README から新しい手順書へ到達できるようにした。
- `publish/` と `plantuml.jar` をコミット対象にする記述がないことを確認対象とした。

## 文書検証

- `git diff --check`
  - whitespace error なし。
- `git diff --name-only 5152c15..HEAD` と未コミット差分一覧
  - workflow 記録を含め、変更対象が Markdown 文書だけであることを確認した。
- `test -f` によるローカルリンク先確認
  - `README.md`、`docs/release/README.md`、`docs/rules/development_workflow.md`、`sample_docs/plantuml.md`、`LICENSE` が存在することを確認した。
- `rg` による旧記述、重複、必須停止条件の確認
  - 単一の `SHA256SUMS.txt` へ全 OS asset を集約する旧手順がないことを確認した。
  - DMG に jar が入らない点を可能性として扱う旧記述がないことを確認した。
  - `THIRD_PARTY_NOTICES.txt`、`third_party_licenses/`、個別 `.sha256`、`gh release upload`、version、必要環境の記述が存在することを確認した。
- 外部公式リンク確認（2026-07-21）
  - GitHub Release 管理、Tauri GitHub Actions、Tauri macOS / Windows code signing、PlantUML FAQ のリンク先を確認した。

documentation workflow のため、アプリケーション build、test、publish、起動確認は実施していない。手順内の publish / smoke test は実際の Release 作業時に行う。

## docs-only 確認

変更対象は Markdown 文書だけであり、ソースコード、スクリプト、設定、runtime asset は変更していない。
