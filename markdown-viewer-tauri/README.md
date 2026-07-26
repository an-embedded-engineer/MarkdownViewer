# MarkdownViewer Tauri 版

Tauri v2、React、TypeScript、Rust で実装した読み取り専用 document Viewer です。Markdown に加え、選択 root 内の trusted UTF-8 `.html` 仕様書を sandboxed iframe で表示します。プロジェクト全体は [ルート README](../README.md) を参照してください。

## 対応 OS と環境構築

Windows、macOS、Linux で開発・実行できます。Node.js/npm と Rust/Cargo に加え、Tauri の OS 固有依存が必要です。

- [Windows](../docs/setup/windows.md)
- [macOS](../docs/setup/macos.md)
- [Linux](../docs/setup/linux.md)
- [環境構築ガイド索引](../docs/setup/README.md)

## 実行

`markdown-viewer-tauri/` で実行します。

```text
npm ci
npm run tauri dev
```

確認コマンド:

```text
npm run build
npm test -- --run
cd src-tauri
cargo check
cargo test
```

## Publish / bundle

- [Windows bundle](../docs/setup/windows.md#5-publish--bundle)
- [macOS bundle](../docs/setup/macos.md#5-publish--bundle)
- [Linux bundle](../docs/setup/linux.md#5-tauri-bundle)
- [共通の開発・publish ルール](../docs/rules/development_workflow.md#publish)

## 主な機能

- native folder picker からフォルダを開く
- directory、Markdown、HTML、画像を Explorer tree に表示
- GitHub Flavored Markdown の基本表示
- Mermaid / PlantUML fenced code block の描画
- Light / Dark theme 切替
- window size、Theme、PlantUML jar pathの永続化と`File > Settings...` UI
- Tauri asset protocol による相対画像表示
- 相対 Markdown link のアプリ内遷移と外部 URL の既定ブラウザ起動
- 複数タブ、active paneのselected tabの Reload、recent folders
- `View > Split View` による左右2 pane比較、paneごとのtab選択、可変separator
- trusted HTML の inline SVG / Canvas / root 内 CSS・JavaScript・JSON・画像表示
- root-scoped `mvhtml` protocol、iframe sandbox、CSP による HTML preview 境界
- HTML 内の user-clicked `http:` / `https:` link のみを既定ブラウザで開く

## 注意事項

- folder scan では `.git`、`node_modules`、`bin`、`obj`、`target`、`.venv`、`__pycache__` を除外します。
- local image 表示のため、現在の MVP は選択フォルダに対して広い asset scope を許可しています。
- HTML は利用者が内容を信頼できる active document に限定します。第三者由来の untrusted HTML、`.htm`、非 UTF-8 HTML、root 外／外部 network resource は対象外です。
- HTML preview は asset protocol を使わず、current root に限定した `mvhtml` protocol で allowlist resource だけを配信します。
- Split View は左右2 pane固定です。上下分割、3 pane以上、layout persistence、tab persistence/reorder、file watching は現在の対象外です。

## Split View

1. 複数のMarkdownまたはHTMLをtabで開きます。
2. `View > Split View`を有効にします。primary paneは現在の文書を維持し、secondary paneは隣接する別tabを初期選択します。
3. 各paneのTabStripから文書を独立に選択します。Explorer、Reload、StatusBar、Error表示、相対Markdown linkはaccent枠で示されるactive paneを対象にします。
4. pane間のseparatorをdragするか、focus後にArrowLeft / ArrowRight / Home / Endで幅を調整します。

同じtabを両paneへ表示できますが、tab自体は複製されません。split比率はsession中だけ保持され、再起動後は50/50へ戻ります。狭いwindowでもSplit Viewを自動解除せず、両paneを可能な範囲で等幅へ縮めます。
