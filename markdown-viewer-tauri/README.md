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
- `View > Split View` による左右2 pane比較、pane-local tab group、local close、pane間tab移動、可変separator
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

1. Explorerまたは相対Markdown linkから文書を開くと、active paneのTabStrip末尾へ追加されて選択されます。同じpaneですでに開いている文書は重複せず、反対paneで開くと共有document dataを参照するtabがそのpane groupへ追加されます。
2. `View > Split View`を有効にします。primary groupは維持され、secondary groupは初回emptyです。secondary paneをclickまたはfocusしてからExplorerで文書を開くか、primary tabの`→` buttonで移動します。
3. split中は各active tabの`→` / `←` buttonで反対paneへ移動できます。move後はdestination tabが選択されfocusが移り、sourceは右隣、なければ左隣へ復旧します。
4. close buttonは操作元pane groupだけからtabを外します。同じdocumentが反対groupに残る場合はdataと表示を維持し、どのgroupからも参照されなくなった時だけglobal dataを破棄します。
5. 各paneのTabStripはArrowLeft / ArrowRight / Home / Endでlocal順に選択できます。active tabからTabキーでmove、closeへ到達できます。Explorer、Reload、StatusBar、Error表示、相対Markdown linkはaccent枠で示されるactive paneを対象にします。
6. pane間のseparatorをdragするか、focus後にArrowLeft / ArrowRight / Home / Endで幅を調整します。

splitを無効にしてもsecondary groupの順序と選択はsession内で保持され、再度有効にすると復元されます。primaryがemptyでsecondaryだけに文書が残る場合は、hidden件数と`Enable Split View`の回復案内を表示します。group、tab順、split比率は永続化せず、再起動後はsingle / empty group / 50:50へ戻ります。狭いwindowでもSplit Viewを自動解除せず、両paneを可能な範囲で等幅へ縮めます。

## 複数ウィンドウとフォルダ別設定

`File > New Window`でRoot未選択の別プロセスを起動します。macOSではメニューバーの`File > New Window`（Cmd+Shift+N）も使えます。各Viewerは独立して終了できます。macOSの`Window`メニューでRoot名からViewerを選び、一覧が古い時は`Refresh Window List`で更新します。Dock独自一覧やアイコンの集約は行いません。

タイトルにはRoot名と親pathを表示します。同名の一覧項目にはIDが付きます。`File > Reapply Window Settings`は現在Rootのサイズ・タイトルを再適用します。最大化・最小化・フルスクリーン中にはサイズを適用・保存しません。

Tauriのユーザー用app config領域に、共通`settings.json`（初期値・Recent Folders）と`projects/<path hash>/settings.json`（テーマ・サイズ・PlantUMLパス）を保存します。対象フォルダ内へ設定は書き込みません。初めて正常に開いたフォルダでは共通初期値から生成し、次回openで復元します。再起動直後は共通初期値で表示し、フォルダを選んだ時点でその設定へ切り替わります。未選択時のSettingsは新しいフォルダ用初期値を変更します。

同じフォルダを複数Viewerで開いた時は、同じ設定項目への最後の保存が有効です。別の項目は保持します。Settings open / Reloadで最新値を読み、常時同期はしません。フォルダの移動・renameは別設定として扱います。

旧版Viewerとの同時起動は避けてください。旧版が共通ファイルへ保存すると新版の初期値を失うため、移行前に旧版を終了してください。破損・未知schema・削除された設定は自動resetしません。errorに出る設定ファイルを、全Viewerを終了してから退避し、再起動または対象folderの再openで生成し直せます。

macOS 26.6.2では検証用Tauri bundleの通常・最小化・別Spaceフルスクリーンからの切り替えを確認済みです。製品UIの操作matrixは別途確認します。Cmd+Tab / Dockに同じiconが複数現れる場合があり、Cmd+`はprocess間巡回を保証しません。dev子はVite server終了後の表示を保証しません。Windows固有build・UI、Linux UI、macOS 14未満・App Translocationは未確認です。

WebViewを再読み込みしても、選択済みRootと設定対象を復元します。IPCの初期化に失敗した場合でもNew Windowは利用でき、Window一覧には利用不可を表示します。一時的な通信受付エラーは再試行し、停止した場合はエラーに従ってそのViewerを再起動してください。
