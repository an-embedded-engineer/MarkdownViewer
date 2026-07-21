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

実行結果は Phase 3 レビュー反映後に追記する。

## docs-only 確認

変更対象は Markdown 文書だけであり、ソースコード、スクリプト、設定、runtime asset は変更していない。
