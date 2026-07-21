# GitHub Release 配布手順書 設計

## 背景と目的

Avalonia 版と Tauri 版の publish 手順は `docs/rules/development_workflow.md` に定義されているが、生成物を配布用に梱包し、GitHub Release へ登録して公開後確認を行うまでの一連の手順はまとまっていない。

リリース担当者が過去の会話を参照せず、チェックリストとして繰り返し利用できる手順書を `docs/release/` に追加する。

## 対象文書

- 新規: `docs/release/README.md`
- 更新: `README.md`
- workflow 記録:
  - `meta.md`
  - `design/github_release_guide_design.md`
  - `impl/github_release_guide_impl.md`
  - `change_report.md`

## 非対象

- アプリケーションコード、publish スクリプト、GitHub Actions、Tauri 設定の変更
- GitHub Release の実作成
- コード署名、notarization、CI/CD の実装手順を秘密情報の具体値まで記載すること

## 読者と利用場面

- 初めて GitHub Release を作るリリース担当者
- 新しいバージョンを手動 publish して Release asset を差し替える担当者
- 将来 GitHub Actions による自動化を設計する担当者

## 更新方針

1. 既存の publish コマンドは `docs/rules/development_workflow.md` を正とし、Release 手順書では利用順序と出力先を示す。
2. 初回リリースで推奨する配布対象を Windows x64 と macOS arm64 に限定して明記する。
3. macOS の `.app` は ZIP、Windows の Avalonia 出力は ZIP、Windows の Tauri は NSIS / MSI を Release asset とする。
4. バージョン整合、PlantUML と MIT のライセンス通知、SHA-256、署名警告を公開前チェックに含める。
5. 現行 macOS publish スクリプトの DMG には `plantuml.jar` が含まれない可能性があるため、修正前は jar 入り `.app` の ZIP を配布する制約を記載する。
6. GitHub Web UI と `gh` CLI の両方を記載し、最初は Draft Release を使う。
7. GitHub Actions 自動化は将来案として必要な構成要素だけを示し、未実装であることを明記する。

## 文書構成

1. 対象範囲と前提
2. リリース前準備
3. macOS / Windows の publish
4. Release asset の作成と命名
5. ライセンス、署名、チェックサム
6. Git tag と Draft Release の作成
7. 公開前後の確認チェックリスト
8. 既知制約と将来の自動化

## 整合確認観点

- `docs/rules/development_workflow.md` のコマンド、既定 runtime、出力先と一致していること
- ルート README から手順書へ到達できること
- Markdown の相対リンクが実在すること
- `publish/` や `plantuml.jar` をコミットする説明になっていないこと
- GitHub Actions、署名、DMG 対応を実装済みと誤読させないこと
- Linux 版や macOS Intel 版を現行スクリプトで配布可能と誤記しないこと

## レビュー方針

新しい `docs/release/` 区分と複数実装にまたがる運用手順を追加するため、設計レビューと実装文書レビューを実施する。
