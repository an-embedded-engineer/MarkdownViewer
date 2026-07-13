# クロスプラットフォーム環境構築・README 整備 変更レポート

## 変更概要

GitHub から clone した直後の開発者が Windows、macOS、Linux の各環境で必要な SDK と OS 固有依存を導入し、対象実装の restore/install、build、実行、publish/bundle へ進める文書構成を整備した。リポジトリルート README を全体の入口とし、詳細を OS 別 setup 文書と Avalonia/Tauri の各 README に分離した。

## 更新した文書

- `README.md`
- `docs/setup/README.md`
- `docs/setup/windows.md`
- `docs/setup/macos.md`
- `docs/setup/linux.md`
- `Avalonia/MarkdownViewer.Avalonia/README.md`
- `markdown-viewer-tauri/README.md`
- `docs/rules/development_workflow.md`
- `docs/rules/project_overview.md`
- `docs/todo/todo.md`
- `docs/todo/todo_archive_2026.md`
- `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/` 配下の workflow 成果物

## 削除・移動・統合

- 既存文書の削除・移動は行っていない。
- ルート README は全体概要と入口、各実装 README は実装固有の概要とクイックスタート、`docs/setup/` は OS 固有の詳細という責務に整理した。
- `TODO-2026-013` を active TODO から `todo_archive_2026.md` へ移した。

## 主な判断

- clone 直後の Tauri 依存復元は `package-lock.json` を再現する `npm ci` とし、`npm install` は依存更新時に限定した。
- Avalonia 版は `NativeWebView` を使用する現構成では Linux 実行非対応とし、Linux では Tauri 版を案内した。
- macOS 専用の統合 publish スクリプトと、各 OS 上の標準 CLI による個別 publish/bundle を区別した。
- PlantUML の jar 探索先を Avalonia と Tauri で分けて記載した。
- Windows、macOS、Linux の実環境で今後判明する固有問題は、本変更を再オープンせず別 issue で追跡する。

## 実行した確認

```text
git diff --check
ruby による対象 Markdown 11 ファイルの相対リンク存在確認
rg による npm install / 旧 Linux WPE WebKit 記述 / PlantUML 配置記述の確認
git diff --name-only による docs-only 拡張子確認
```

- 相対リンク確認: `relative links: OK (11 files)`
- Design review: Approved、未解決指摘 0
- Implementation review: Approved、未解決指摘 0
- ユーザ最終確認: 2026-07-13 に承認済み

documentation-workflow のため、アプリ起動、単体テスト、E2E、OS 別実機動作確認は必須工程に含めていない。

## docs-only と diff.zip

変更は Markdown 文書だけであり、ソースコード、project/manifest、設定、スクリプト、runtime asset は変更していない。したがって documentation-workflow の禁止事項に従い、`diff.zip` は作成していない。

## History

アプリ仕様、アーキテクチャ、runtime、publish 実装は変更していないため、新規 history 文書は作成していない。文書整備の経緯は本 change report、design、impl、review 文書から参照できる。

## 残課題

現時点で未解決の文書レビュー指摘はない。将来、Windows、macOS、Linux の実環境で手順差異や不足が判明した場合は、再現環境とエラー内容を添えて別 issue を起票する。
