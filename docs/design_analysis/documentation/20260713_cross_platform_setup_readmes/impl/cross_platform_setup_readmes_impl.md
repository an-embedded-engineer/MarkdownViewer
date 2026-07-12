# クロスプラットフォーム環境構築・README 整備 実施記録

## 更新した文書

- `README.md` を新設し、プロジェクト概要、実装比較、OS 別セットアップ、主要文書への入口を追加した。
- `docs/setup/README.md` を新設し、対応状況、共通要件、依存復元、PlantUML の共通手順を集約した。
- `docs/setup/windows.md` を新設し、Windows の前提ツール、clone、build、実行、publish/bundle、troubleshooting を記載した。
- `docs/setup/macos.md` を新設し、macOS の前提ツール、clone、build、実行、macOS 専用統合 publish、個別 publish を記載した。
- `docs/setup/linux.md` を新設し、Tauri の Debian/Ubuntu 依存、clone、build、実行、bundle と Avalonia `NativeWebView` の実行制約を記載した。
- `Avalonia/MarkdownViewer.Avalonia/README.md` を日本語化し、OS 別セットアップ、実行、publish への導線と Linux 非対応を明記した。
- `markdown-viewer-tauri/README.md` を日本語化し、OS 別セットアップ、実行、bundle への導線を追加した。
- `docs/rules/development_workflow.md` の clone 後の依存復元を `npm ci` へ統一し、`npm install` は依存更新時に限定した。
- `docs/rules/project_overview.md` に利用者向け入口を追加した。

## 移動・削除・統合

- 文書の移動・削除は行っていない。
- OS 固有の詳細は `docs/setup/`、実装固有の概要とクイックスタートは各実装 README、全体の入口はルート README へ責務を分けた。
- 既存 Avalonia README の Linux/WPE WebKit 要件は、`NativeWebView` の公式な platform support と整合しないため、Linux 実行非対応の記載へ置き換えた。

## リンク・索引・参照元・archive・履歴の整合

- ルート README から OS 別 setup と各実装 README へリンクした。
- 各実装 README から OS 別 setup、実行、publish/bundle、共通開発ルールへリンクした。
- `docs/rules/project_overview.md` にルート README、setup 索引、各実装 README を追加した。
- architecture、component、ADR の仕様は変更していない。
- publish 方式自体は変更していないため、新規 history 文書は作成しない。
- TODO archive は Phase 4 で更新する。

## 文書検証コマンド

```text
git diff --check
rg -n "npm install|WPE WebKit|WPE WebKit runtime|NativeWebView|publish_apps_with_plantuml" README.md Avalonia/MarkdownViewer.Avalonia/README.md markdown-viewer-tauri/README.md docs/setup docs/rules/development_workflow.md docs/rules/project_overview.md
ruby -e 'errors=[]; ARGV.each { |f| File.read(f).scan(/\[[^\]]*\]\(([^)]+)\)/).flatten.each { |href| next if href =~ /\A(?:https?:|mailto:|#)/; path=href.split("#",2).first; next if path.empty?; target=File.expand_path(path, File.dirname(f)); errors << "#{f}: #{href}" unless File.exist?(target) } }; puts(errors.empty? ? "relative links: OK (#{ARGV.size} files)" : errors.join("\n")); exit(errors.empty? ? 0 : 1)' README.md Avalonia/MarkdownViewer.Avalonia/README.md markdown-viewer-tauri/README.md docs/setup/README.md docs/setup/windows.md docs/setup/macos.md docs/setup/linux.md docs/rules/development_workflow.md docs/rules/project_overview.md docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/design/cross_platform_setup_readmes_design.md docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/impl/cross_platform_setup_readmes_impl.md
rg -n "npm install" README.md Avalonia/MarkdownViewer.Avalonia/README.md markdown-viewer-tauri/README.md docs/setup docs/rules/development_workflow.md
rg -n "WPE WebKit runtime libraries are required|Linux: WPE WebKit" Avalonia/MarkdownViewer.Avalonia/README.md docs/setup
git diff --name-only --diff-filter=ACMRT
```

## docs-only 確認

変更対象は `.md` ファイルだけであり、ソースコード、project/manifest、設定、スクリプト、runtime asset は変更していない。documentation-workflow に従い、アプリ起動や実行時動作確認は Phase 3 の必須検証に含めない。
