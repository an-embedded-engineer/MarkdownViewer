# クロスプラットフォーム環境構築・README 整備 設計

## 背景と目的

リポジトリ直下に README がなく、clone 後に必要な SDK、OS 固有依存、restore、build、実行、publish の情報が複数文書へ分散している。Windows、macOS、Linux の開発者が、自分の OS と実装を選び、検証可能な最短経路で開発を開始できる入口を整備する。

## 対象文書

- 新規 `README.md`: プロジェクト全体の概要、実装比較、セットアップと各実装 README への入口
- 新規 `docs/setup/README.md`: 共通要件、OS 別ガイドの索引、対応状況
- 新規 `docs/setup/windows.md`: Windows の前提ツール、clone、セットアップ、build、実行、publish
- 新規 `docs/setup/macos.md`: macOS の前提ツール、clone、セットアップ、build、実行、publish
- 新規 `docs/setup/linux.md`: Linux の前提ツール、clone、セットアップ、build、実行、publish、Avalonia 制約
- 更新 `Avalonia/MarkdownViewer.Avalonia/README.md`: 日本語化し、環境構築、実行、publish への導線を追加。既存の「Linux では WPE WebKit runtime libraries が必要」という記載は、現構成の `NativeWebView` は Linux 実行をサポートしない旨へ訂正
- 更新 `markdown-viewer-tauri/README.md`: 日本語化し、環境構築、実行、publish への導線を追加
- 更新 `docs/rules/development_workflow.md`: clone 後の再現可能な依存復元コマンドを `npm ci` へ統一し、`npm install` は依存更新時に使うことを明記
- 更新 `docs/rules/project_overview.md`: 利用者向け入口を追加
- workflow 成果物、TODO archive

## 非対象

- ソースコード、project/manifest、設定、スクリプトの変更
- 未実装のクロスコンパイルや installer 作成機能の追加
- 各 OS 上でのアプリ動作保証
- .NET、Node.js、Rust、Java のインストーラー自体の再配布

## 読者と利用場面

- 初めて clone して Avalonia 版または Tauri 版を動かす開発者
- OS 固有のビルド依存を確認するコントリビューター
- 開発実行と配布用 publish の違いを確認する保守担当者

## 更新方針

1. ルート README は詳細を重複させず、プロジェクト概要と適切な詳細文書への入口にする。
2. `docs/setup/README.md` で共通要件と OS/実装の対応状況を示し、具体的なコマンドは OS 別文書に置く。
3. OS 別文書は「前提 → clone → バージョン確認 → 依存復元 → build → 実行 → PlantUML → publish → troubleshooting」の順で統一する。
4. 各実装 README は機能概要と実装固有コマンドを簡潔に示し、OS 固有依存は setup 文書へ委譲する。
5. `package-lock.json` があるため Tauri 依存復元には再現性を優先して `npm ci` を使う。既存の `npm install` は依存更新時の用途として区別する。
6. publish は原則として対象 OS 上で行う。macOS 専用の統合スクリプトと、各実装の標準 CLI による OS 別 publish を区別する。
7. Avalonia 版は `NativeWebView` を使用しており、現構成の Linux 実行はサポート対象外であることを明記する。Linux では Tauri 版の手順を提供し、Avalonia は restore/build 可否と実行対応を混同しない。
8. PlantUML は任意機能として Java と `plantuml.jar` の配置方法を案内し、jar をコミットしない運用を維持する。
9. `docs/rules/language_rules.md` が日本語を明示している範囲は `docs/` 配下だが、利用者向け入口の言語を統一するため、本案件ではルートと各実装の README にも同じ日本語方針を適用する。

## 削除・統合・移動・archive

- 既存文書の削除・移動は行わない。
- 各 README に重複している簡易 Development/Run 記述は、実装固有のクイックスタートとして整理し、OS 固有詳細を setup 文書へ集約する。
- 完了時に `TODO-2026-013` を `docs/todo/todo_archive_2026.md` へ移す。
- アーキテクチャやアプリ仕様は変更しないため、新規 history 文書は作らない。

## 確認観点

- Markdown の相対リンクが実在するファイルを指すこと
- ルート README → setup/実装 README → OS 別手順/開発ルールの双方向導線があること
- コマンドがリポジトリルート基準か、各サブディレクトリ基準か明示されていること
- `docs/rules/development_workflow.md`、project/manifest、publish スクリプトとコマンドが一致すること
- Windows PowerShell と macOS/Linux shell の記法を混在させないこと
- Linux の Avalonia `NativeWebView` 制約を誤って「必要パッケージを入れれば実行可能」と案内しないこと
- 生成物をコミットしない旨と、`plantuml.jar` の非コミット運用が維持されること
- README 間で用語（Avalonia 版、Tauri 版、セットアップ、publish）を統一すること

## レビュー方針

複数の入口文書を新設・横断更新し、OS 固有手順とサポート制約を扱うため、Phase 2 の構成レビューと Phase 3 の実装レビューを省略しない。
