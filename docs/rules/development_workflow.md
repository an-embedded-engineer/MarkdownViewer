# 開発・実行ルール

## 環境

- macOS arm64 を主な開発環境とする。
- .NET SDK: `10.0+`
- Node.js / npm: Tauri 版の `package-lock.json` と互換のある現行版
- Rust / Cargo: Tauri v2 の依存が要求する stable toolchain
- IDE: Visual Studio Code / Rider / Visual Studio

## セットアップ

```bash
# Avalonia
dotnet restore Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri
cd markdown-viewer-tauri
npm ci
```

clone 直後や CI では `package-lock.json` の内容を再現する `npm ci` を使う。依存 package を更新し、`package-lock.json` も更新する場合に限り `npm install` を使う。

### PlantUML

PlantUML表示を使う場合はJavaと `plantuml.jar` をローカルに用意する。`plantuml.jar` はコミットしない。

```bash
java -version
```

配置方法は以下のいずれかを使う。

- Tauri版の`File > Settings...`で`plantuml.jar`を選択する。
- runtime directory に `plantuml.jar` を置く。
- runtime directory に `plantuml.config.json` を置き、`plantUmlJarPath` にjar pathを記載する。

Tauri版の探索優先順位は、app config JSONの明示path、runtime directoryの`plantuml.config.json`、同directoryの`plantuml.jar`の順。明示pathが無効な場合は他のjarへfallbackせずerrorにする。Settingsで`Clear`した場合だけruntime directory探索へ戻る。Theme、logical window size、明示jar path、Recent FoldersはTauri app config directoryの`settings.json`へ保存する。

```json
{
  "plantUmlJarPath": "/absolute/path/to/plantuml.jar"
}
```

runtime directory:

- Avalonia開発実行: コマンド実行時のworking directory、または実行assemblyのdirectory。
- Tauri開発実行: `markdown-viewer-tauri/src-tauri/`、current working directory、Rust実行ファイルのdirectoryの順。
- Tauri macOS bundle: `<app>.app/Contents/MacOS/`。
- publish済みAvalonia: 実行ファイルのdirectory。

2026-05-21時点の開発環境では `openjdk 24.0.2` と PlantUML `1.2026.3` で確認している。

## アプリケーション実行

```bash
# Avalonia
dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri
cd markdown-viewer-tauri
npm run tauri dev
```

## ビルド

```bash
# Avalonia
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Avalonia Release
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj -c Release

# Tauri frontend
cd markdown-viewer-tauri
npm run build

# Tauri Rust backend
cd markdown-viewer-tauri/src-tauri
cargo check
```

## Publish

Avalonia / Tauri の publish と `plantuml.jar` 配置は、原則として以下のスクリプトで行う。`plantuml.jar` はコミット対象外のため、リポジトリ直下へ置くか `--plantuml-jar` で明示する。

```bash
# Default: ./plantuml.jar を publish へコピーする
scripts/publish_apps_with_plantuml.sh

# jar の場所を明示する場合
scripts/publish_apps_with_plantuml.sh --plantuml-jar /absolute/path/to/plantuml.jar

# dmg も作る場合
scripts/publish_apps_with_plantuml.sh --tauri-bundles app,dmg
```

Windows PowerShell では以下を使う。

```powershell
# Default: .\plantuml.jar を publish へコピーする
.\scripts\publish_apps_with_plantuml.ps1

# jar の場所を明示する場合
.\scripts\publish_apps_with_plantuml.ps1 -PlantUmlJar C:\path\to\plantuml.jar

# Avalonia ARM64 publish
.\scripts\publish_apps_with_plantuml.ps1 -Runtime win-arm64

# MSI も作る場合
.\scripts\publish_apps_with_plantuml.ps1 -TauriBundles "nsis,msi"
```

先頭に `. ` を付けて source 実行しない。source 実行すると shell option や終了処理が現在のターミナルへ影響するため、スクリプト側で検出して中断する。

出力先:

- Avalonia: `publish/avalonia/raw/`
- Avalonia app bundle: `publish/avalonia/MarkdownViewer.Avalonia.app`
- Tauri app bundle: `publish/tauri/markdown-viewer-tauri.app`
- Avalonia 用 `plantuml.jar`: `publish/avalonia/raw/plantuml.jar`
- Avalonia app bundle 用 `plantuml.jar`: `publish/avalonia/MarkdownViewer.Avalonia.app/Contents/MacOS/plantuml.jar`
- Tauri 用 `plantuml.jar`: `publish/tauri/markdown-viewer-tauri.app/Contents/MacOS/plantuml.jar`
- Windows Avalonia: `publish/avalonia/win-x64/`
- Windows Tauri raw: `publish/tauri/raw/`
- Windows Tauri installer: `publish/tauri/bundle/`

個別に実行する必要がある場合は以下を使う。

```bash
# Avalonia self-contained publish
dotnet publish Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj \
  -c Release \
  -r osx-arm64 \
  --self-contained true \
  -o publish/avalonia/raw

# Tauri app bundle
cd markdown-viewer-tauri
npm run tauri -- build --bundles app --ci
```

Finder から直接起動する `.app` は `publish/` 配下へ配置する。`publish/` は生成物として扱い、原則コミットしない。

## テスト

現時点で専用テストプロジェクトは未整備である。変更時は以下を最低限の検証として扱う。

```bash
# Avalonia compile check
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri frontend check
cd markdown-viewer-tauri
npm run build
npm test -- --run

# Tauri Rust check
cd markdown-viewer-tauri/src-tauri
cargo check

# Tauri Rust unit tests
cargo test
```

UI 動作を変更した場合は、少なくとも以下を手動確認する。

- フォルダ選択
- Explorer から Markdown 選択
- Explorer separatorをpointer / ArrowLeft / ArrowRight / Home / Endで操作し、180pxからworkspaceに応じたdynamic最大幅まで変更できること
- Explorer separatorのpointer drag後もseparatorにfocusが残り、続けてkeyboardで幅を変更できること
- windowを506px未満へ縮めてもExplorer幅とseparatorのARIA値が180pxを下回らず、再拡大時に直前の要求幅へ戻ること
- `View > Split View`でsingle / 左右2 paneを切り替え、primary維持、secondary隣接tab選択、active secondaryからsingleへの引き継ぎ、空secondaryからのprimary維持が仕様どおりであること
- primary / secondaryのTabStripから別文書または同じ文書を独立に選択し、pointer / focusでactive paneを変えるとExplorer強調、Reload、相対Markdown link、StatusBar、ErrorBannerの対象が切り替わること
- Split separatorをpointer / ArrowLeft / ArrowRight / Home / Endで操作し、preferred minimum 240px、狭幅時の等幅縮退、ARIA値、focus維持、再拡大時のrequested ratio復元を確認すること
- active / non-active tab close、両paneで同じtab、最後のtab、root変更でpane selectionが一貫して復旧し、無効tab IDが残らないこと
- 深い階層・長いMarkdown / HTML / image名で必要時だけExplorer内の水平scrollbarが現れ、縦横の末尾へ到達できること
- 短いtreeでは不要な水平scrollbarが出ず、directory / Markdown / HTML / imageのicon、開閉、選択、disabled状態をLight / Darkで判別できること
- Markdown プレビュー表示
- `sample_docs/preview_width.md`を開き、preview paneが1028pxを超えるwindow幅でMarkdown本文が固定980pxに止まらず、左右24pxのgutterを残してpane幅へ追従すること
- `sample_docs/preview_width.md`の横長table、Mermaid、PlantUML、image、codeが拡張後の本文幅を利用し、本文幅を超える場合は既存の要素内横scrollまたは縮小が機能すること
- `sample_docs/preview_width.md`のMermaidが初期表示後、window幅とExplorer幅を変更してもSVG表示を維持し、diagram source文字列へ戻らないこと
- window viewportを760px以下へ縮めるとMarkdown左右gutterが14pxになり、760px超のままExplorer resizeでpreview paneだけを狭めた場合は左右gutterが24pxのまま維持されること
- Markdown / HTML tabとExplorer幅を切り替え、Markdown本文とHTML iframeが残りのpreview pane幅へ追従し、HTML文書自身のlayoutは維持されること
- `sample_docs/image_link.md` のroot内相対PNG画像が表示されること
- `sample_docs/image_viewer.md`で通常画像、描画済みMermaid、描画済みPlantUMLをclick / keyboardからviewerへ開けること
- 画面外の画像に対応するviewer buttonへTab移動した時、対象画像が表示領域へ入り、pillがその右上へずれずに表示されること
- image viewerの初期fit、最大800% zoom、wheel / trackpad、drag / Arrow pan、Fit / 100%、Escape / Close / backdrop、focus trapと復帰focusを確認すること
- pointerでimage viewerを開いてClose / Escapeで閉じた場合はkeyboard用`Open image viewer` pillやMarkdown本文全体のoutlineが表示されず、Tab移動したbuttonから開いてClose / Escapeで閉じた場合だけ同buttonへfocusが戻ること
- image viewerを閉じた通常表示でinline画像段落の行組み、diagramのborder / padding / horizontal scroll、linked image / SVG anchor操作が退行しないこと
- Mermaid 描画
- Mermaid と PlantUML が同居する `sample_docs/plantuml.md` で両方の図が描画されること
- 同じMermaid文書を両paneへ表示し、SVG / marker / clipPathのIDと参照がpane間で衝突せず、Theme / split resize後も両方が正しく表示されること
- PlantUML 描画
- PlantUML 描画中に読み込み中表示が出ること
- Light / Dark 切替
- Settings dialogでTheme / window size / PlantUML jar pathを確認・保存できること
- resizeと再起動後にlogical window sizeが復元され、最大化中のsizeを保存しないこと
- 既存Recent Foldersを保持し、明示jar pathの設定 / invalid path / Clearが仕様どおり動くこと
- Reload 後の再描画
- Explorerからtrusted UTF-8 HTMLを開き、self-contained SVG / Canvasとroot内relative CSS / JS / MJS / JSON / imageが表示されること
- HTMLのfragment linkがiframe内で移動し、user-clicked `http(s)`だけがOS既定browserで1回開くこと
- HTMLからroot外resource、external network、popup、form、download、Tauri IPCへ到達できないこと
- HTML表示中にThemeを切り替えてもiframeがreloadされず、Markdown / HTML tab切替で状態が混線しないこと
- HTML表示中のExplorer resizeがiframe上でも継続し、cursor表示に操作上の違和感がないこと
- Markdown + HTMLおよびHTML + HTMLをsplit表示し、片paneのready / timeout / external-open状態が他paneへ混線せず、Split separatorのdragがiframe上でも継続すること
- secondaryの画像viewerを開いた状態でtab closeまたはsplit offし、viewerが閉じて接続済み起点またはprimary paneへfocusが戻ること
- `sample_docs/html_fixture/` と `sample_docs/html_fixture/malicious.html` をHTML手動fixtureとして使用すること

## 静的解析・整形

```bash
# C# format check
dotnet format Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj --verify-no-changes

# Rust format check
cd markdown-viewer-tauri/src-tauri
cargo fmt -- --check

# Rust format apply
cargo fmt
```

Tauri フロントエンドは現時点で lint script 未定義のため、`npm run build` の TypeScript compile を完了条件に含める。
