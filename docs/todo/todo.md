# TODO

## TODO-2026-017 Tauri HTML形式仕様書表示対応

- status: open
- workflow: spec-change
- source_report: `docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md`
- depends_on: TODO-2026-005
- execution_order: TODO-2026-006（Tauri Split view 導入）より先に実施する。
- summary: Tauri版Viewerで、選択rootのExplorerからHTML形式仕様書を開き、root内resourceと外部参考文献linkを安全に表示できるようにする。
- target_users:
  - Tauri版Viewerで、Agentまたは人間が作成し内容を信頼できるローカルHTML形式仕様書をMarkdownと並べて参照する利用者。
  - SVG、Canvas、画像、同梱JavaScript runtime等を使うグラフィカルな仕様書を、選択project root内で完結させて閲覧する利用者。
- current_spec:
  - ExplorerはMarkdownと画像だけを列挙し、`read_text_file`はroot配下のMarkdownだけをUTF-8 textとして読み込む。
  - MarkdownはReact DOMへ`dangerouslySetInnerHTML`で表示し、Markdown内raw HTMLは`markdown-it`の`html: false`で拒否する。
  - 相対画像は全filesystem対象のasset protocol、外部`http:` / `https:`と`mailto:`はOS opener、相対Markdown linkは同一root内tab遷移を使う。
- new_spec:
  - Explorerとtab stateをMarkdown / HTMLの型付きdocument modelへ一般化し、UTF-8の`.html`を独立したHTML document contextで開く。
  - HTML本体と許可resourceは選択rootだけを配信するcustom URI protocolを通し、CSP付きsandboxed iframeでactive contentを実行する。
  - HTMLから親DOM、Tauri IPC、root外local file、外部network、top-level navigation、popupへ到達させない。
  - HTML内でuser clickされた`http:` / `https:`だけをscheme検証後にOS標準ブラウザへ委譲し、fragment linkはiframe内で処理する。
- use_cases:
  - Open Folder / Recent Foldersで選択したrootのExplorerからHTMLを選び、既存Multi-tabと同じactivate / close / Reload操作で閲覧する。
  - self-contained HTML、またはHTML位置基準のroot内相対resourceを使う仕様書を表示する。
  - HTML自身のinline SVG / Canvas、描画済みUML、root内同梱runtimeによるdiagramとinteractionを実行する。
  - HTML内の外部参考文献linkをOS標準ブラウザで開き、Viewer内のHTML表示を維持する。
- scope:
  - 対応document拡張子はcase-insensitiveな`.html`とし、open時にRust側でcanonicalizeしたroot境界、通常file、UTF-8を再検証する。
  - root-scoped custom URI protocolでHTML、PNG、JPG / JPEG、GIF、WebP、BMP、ICO、AVIF、SVG、CSS、JavaScript、JSON、WOFF / WOFF2を適切なMIME typeとCSP付きで配信する。
  - sandboxed iframeはscriptを許可する一方、same-origin privilege、親DOM / Tauri IPC、form submit、download、popup、top navigation、外部networkを許可しない。
  - `DocumentType`をExplorer nodeとopen tabへ保持し、HTMLではMarkdown変換、Mermaid effect、PlantUML commandを実行せず、HTML固有のloading / error / Reload状態を管理する。
  - HTMLのThemeとscrollは文書側の状態としてViewer themeから独立させ、Markdown tabとHTML tabの切替で状態を混線させない。
  - HTML内の`http:` / `https:` clickをuser gestureとactive iframeに限定して受理し、Viewer内navigationを拒否してOS openerへ渡す。
  - custom protocolのURL decode、`..`、absolute path、symlink、resource拡張子、MIME、CSP / CORS / opaque originをRust側の検証とplatform実機確認で扱う。
- non_scope:
  - `.htm`、非UTF-8 HTML、任意の第三者製HTMLなど信頼できないactive contentの安全な閲覧は含めない。
  - root外resource、外部network resource、CDN依存runtime、`file:` / `javascript:` / `data:` navigation、`mailto:` / `tel:`のHTML外部openは含めない。既存Markdownの`mailto:`動作は維持する。
  - relative `.html` / `.md` linkのtab遷移、HTML内raw Mermaid / PlantUML sourceのViewer側自動描画、編集、保存、印刷、downloadは含めない。
  - Tauri全体の既存`assetProtocol.scope: ["**"]`縮小は横断security課題として分離し、HTML resourceにはasset protocolを使わない。
  - Avalonia版への対応はTODO-2026-007の評価・仕様化後にTODO-2026-018で扱う。
- changed_contracts:
  - Rust / TypeScriptの`FileNodeType`、open tab、preview stateをMarkdown固定からtyped document契約へ変更する。
  - Markdown限定のread契約を、root内Markdown / HTMLをdocument type付きで安全に開ける契約へ変更する。
  - Tauri custom URI protocol handlerとcurrent root stateを追加し、Explorer openとresource requestで同じtrusted root境界を使う。
  - Preview UI契約を`MarkdownPreview`単独からdocument type別`MarkdownPreview` / `HtmlPreview`へ変更する。
  - 外部link契約はMarkdown既存動作を維持しつつ、HTMLではuser-clickされた`http:` / `https:`だけをhostへ委譲する。
- integration_points:
  - `markdown-viewer-tauri/src/App.tsx`のfile tree、tab state、document load、Reload、preview分岐、external link、Mermaid / PlantUML effect、UI文言。
  - `markdown-viewer-tauri/src/App.css`のiframe preview layout、loading / error、focus、Light / Dark shell表示。
  - `markdown-viewer-tauri/src-tauri/src/lib.rs`のdirectory scan、document read、current root state、custom protocol、path / resource / MIME / CSP検証とunit test。
  - `markdown-viewer-tauri/src-tauri/tauri.conf.json`、`capabilities/default.json`、`Cargo.toml`のprotocol / CSP / capability境界。
  - `README.md`、`markdown-viewer-tauri/README.md`、`docs/architecture/`、`docs/components/tauri_viewer/`、`docs/rules/development_workflow.md`、`docs/tests/README.md`の恒久仕様と検証手順。
- completion:
  - 選択root配下のUTF-8 HTMLがMarkdownと同じExplorerに表示され、選択して開ける。
  - self-contained HTMLと、root内の相対画像、SVG、CSS、JavaScript、JSON、fontを利用するHTMLを表示できる。
  - inline SVG、Canvas、描画済みUML、root内runtimeによるdiagramを表示できる。
  - HTML内の`http:` / `https:` linkをViewer内で遷移させず、scheme検証後にOS標準ブラウザで開く。
  - root外resource、外部network resource、`file:`、`javascript:`、許可外custom protocolを拒否する。
  - sandboxed iframe、root-scoped custom protocol、CSP、opaque originのplatform差をmacOS / Windows / Linuxで検証する。
  - 既存Markdown、相対画像、内部／外部link、Mermaid、PlantUML、Multi-tabの表示が退行しない。
- success_metrics:
  - `npm run build` in `markdown-viewer-tauri/`、`cargo check`と`cargo test` in `markdown-viewer-tauri/src-tauri/`が成功する。
  - Rust unit testでHTML列挙・document read・custom protocolのroot境界、URL decode、`..`、symlink、許可拡張子、MIME、CSPを確認できる。
  - frontend testまたは同等の検証でdocument type分岐、iframe sandbox、HTML時のMermaid / PlantUML非実行、外部link委譲、Markdown回帰を確認できる。
  - macOS / Windows / Linuxの手動確認で、root内resourceとJSON `fetch`、inline SVG / Canvas / diagram、外部link、悪性fixtureの拒否が設計どおり一致する。

## TODO-2026-006 Tauri Split view 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-004
- depends_on: TODO-2026-005, TODO-2026-017
- summary: Tauri 版に 2 ペイン split view を追加する。
- completion:
  - single / split の切替ができる。
  - primary / secondary に別タブを表示できる。
  - 各 pane で Markdown preview、Mermaid、PlantUML、scroll、loading/error 表示が破綻しない。

## TODO-2026-007 Tauri 先行 UX 評価と Avalonia 反映仕様化

- status: open
- workflow: documentation
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-005
- depends_on: TODO-2026-003, TODO-2026-004, TODO-2026-005, TODO-2026-006, TODO-2026-014, TODO-2026-017
- summary: Tauri 先行実装の UX 評価を行い、Avalonia へ適用する確定仕様を文書化する。
- completion:
  - MenuBar、StatusBar、Recent Folders、TabStrip、split view、設定確認・変更 UI と設定永続化の評価結果が文書化される。
  - Tauri版HTML形式仕様書表示の操作性、resource表示、外部link、安全性を評価し、Avaloniaへ反映する共通仕様とstack差分を確定する。
  - Avalonia 反映時の共通仕様と stack 差分方針が明確になる。
  - 未解決 UI 調整が必要な場合は todo 化される。

## TODO-2026-018 Avalonia HTML形式仕様書表示対応

- status: open
- workflow: spec-change
- source_report: `docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md`
- depends_on: TODO-2026-007
- execution_order: TODO-2026-007（Tauri 先行 UX 評価と Avalonia 反映仕様化）の完了後に実施する。
- summary: Tauri先行UX評価で確定したHTML形式仕様書表示を、AvaloniaのWebViewと責務境界に合わせて水平展開する。
- completion:
  - 選択root配下のUTF-8 HTMLがMarkdownと同じExplorerに表示され、選択して開ける。
  - self-contained HTMLと、root内の相対画像、SVG、CSS、JavaScript、JSON、fontを利用するHTMLを表示できる。
  - inline SVG、Canvas、描画済みUML、root内runtimeによるdiagramを表示できる。
  - HTML内の`http:` / `https:` linkをViewer内で遷移させず、scheme検証後にOS標準ブラウザで開く。
  - trusted root契約、top-level navigation制御、host bridge制限を主境界とし、利用可能なplatform adapterではsubresource監視を追加防御として適用する。
  - 既存Markdown経路を含む`openExternal`へscheme allowlistを共通適用し、raw HTMLを許可し続けるか`DisableHtml()`を採用するかを確定する。
  - macOS / Windows / Linuxでroot内resource、root外拒否、外部link、既存Markdown / Mermaid / PlantUMLの回帰を確認する。

## TODO-2026-008 Avalonia MenuBar / StatusBar 導入

- status: open
- workflow: spec-change
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-006
- depends_on: TODO-2026-007
- summary: Avalonia 版で MenuBar / StatusBar を導入し、Tauri 先行仕様に合わせて UI 領域を分離する。
- completion:
  - `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる。
  - root path、active file、loading、error が StatusBar に表示される。
  - 既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移が退行しない。

## TODO-2026-009 Avalonia Recent Folders 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-007
- depends_on: TODO-2026-008
- summary: Avalonia 版に最近開いたディレクトリを追加し、MenuBar から再オープンできるようにする。
- completion:
  - root open 成功時に最近開いたディレクトリが保存される。
  - 最大件数、重複更新、存在しない path のエラー、削除 UI が機能する。
  - 再起動後も一覧が復元される。

## TODO-2026-010 Avalonia Multi-tab core 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-008
- depends_on: TODO-2026-008, TODO-2026-009, TODO-2026-015
- summary: Avalonia 版に複数タブの core state と TabControl を追加する。
- completion:
  - Explorer 選択で同一 path のタブがあれば activate、なければ新規タブを開く。
  - タブ切替、close、Reload、theme、Markdown 内リンクが仕様通り動く。
  - タブは現在の `RootPath` 内に限定される。

## TODO-2026-011 Avalonia Split view 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-009
- depends_on: TODO-2026-010
- summary: Avalonia 版に 2 ペイン split view を追加する。
- completion:
  - single / split の切替ができる。
  - primary / secondary に別タブを表示できる。
  - 各 pane で Markdown preview、Mermaid、PlantUML、loading/error 表示が破綻しない。

## TODO-2026-012 両実装 UI/UX docs 最終同期

- status: open
- workflow: documentation
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-010
- depends_on: TODO-2026-007, TODO-2026-011
- summary: 両実装の UI/UX 仕様・比較観点・残課題を最終同期する。
- completion:
  - Tauri / Avalonia の docs が実装と一致する。
  - 共通仕様、差分理由、残課題、今後の follow-up が整理される。
  - todo の完了 / 残項目が整合する。

## TODO-2026-015 Avalonia Viewer 設定永続化と設定 UI 水平展開

- status: open
- workflow: new-feature
- depends_on: TODO-2026-007, TODO-2026-009
- summary: Tauri 先行 UX 評価で確定した設定仕様を、Avalonia の自然な責務境界に合わせて水平展開する。
- completion:
  - Tauri 先行 UX 評価で確定した window width / height、Theme、`plantuml.jar` path の永続化仕様が反映される。
  - MenuBar から設定 UI を開き、現在値の確認と変更・保存ができる。
  - Avalonia の user config JSON と既存 Recent Folders が共存し、再起動後に設定が復元される。
  - `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj` が成功し、設定保存・再起動復元・既定値・無効 path の手動確認が完了する。

## TODO-2026-016 Tauri Viewer 設定 Windows platform verification

- status: open
- workflow: issue-resolution
- depends_on: TODO-2026-014
- summary: Windows環境でTauri Viewer設定永続化のtarget固有atomic replaceとpath境界を検証する。
- completion:
  - Windows targetで`cargo check`または同等のTauri buildが成功する。
  - 既存`settings.json`を`MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)`で置換し、Recent FoldersとViewer settingsが保持される。
  - Unicode pathとWindows verbatim / drive / UNC path境界で設定保存・再起動復元を確認する。
  - 検証結果と、必要な修正があればsource / tests / Tauri component docsへ反映する。
