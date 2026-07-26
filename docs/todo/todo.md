# TODO

## TODO-2026-006 Tauri Split view 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- source_report: `docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md`
- work_package_id: WP-004
- depends_on: TODO-2026-005, TODO-2026-017
- summary: Tauri 版に 2 ペイン split view を追加する。
- target_users:
  - Tauri 版 Markdown Viewer で同一 root 内の 2 文書を並べ、仕様、設計、図を比較しながら参照する利用者。
  - Markdown / HTML、Mermaid、PlantUML を左右で同時に確認し、タブ切替による文脈喪失を減らしたい利用者。
- use_cases:
  - View メニューから single view と左右 2 ペイン split view を切り替える。
  - primary / secondary pane でそれぞれ表示対象の open tab を選び、異なる文書を同時に参照する。
  - active pane を切り替え、Explorer 選択、TabStrip 操作、Reload、Markdown 内リンクを操作対象 pane に反映する。
  - 各 pane で独立して文書を縦横 scroll し、Markdown、Mermaid、PlantUML、trusted HTML を確認する。
  - split 表示中に tab を close し、残存 tab または未選択状態へ破綻なく復旧する。
- scope:
  - 既存の `OpenDocumentTab[]` を文書データの正本として再利用し、single / split、active pane、pane ごとの active tab を型付き layout state で管理する。
  - preview workspace を single 時は 1 pane、split 時は左右 2 pane とし、各 pane に tab 選択導線と preview を設ける。
  - Explorer 選択、tab activate / close、Reload、relative Markdown link、StatusBar / ErrorBanner を active pane と pane ごとの tab state に統合する。
  - Markdown preview、Mermaid / PlantUML、trusted HTML iframe、anchor、scroll、loading / error、image viewer の DOM ref と非同期結果を pane / tab / revision に対応付け、pane 間の混線を防ぐ。
  - split on / off、root 変更、tab close 時に pane selection を有効な tab または未選択状態へ正規化する。
  - Light / Dark、responsive layout、Explorer resize、Settings dialog と既存 MenuBar / StatusBar の操作性を維持する。
- non_scope:
  - 3 ペイン以上、上下分割、任意方向・任意数の分割は含めない。
  - drag and drop による tab の pane 間移動、tab reorder、pin、tab / pane layout の再起動後復元は含めない。
  - 同一 tab の複製、root 外 document、編集・未保存状態、pane ごとの theme は含めない。
  - Avalonia 版 split view は TODO-2026-011、Tauri 先行 UX の評価と Avalonia 反映仕様化は TODO-2026-007 で扱う。
  - Rust command、HTML custom protocol、Tauri capability / CSP の契約変更は、設計で不可避と判明しない限り行わない。
- integration_points:
  - `markdown-viewer-tauri/src/App.tsx` の `tabs` / `activeTabId`、`TabStrip`、Explorer 選択、Reload、relative link、Mermaid / PlantUML effect、HTML message policy、image viewer、StatusBar / ErrorBanner。
  - `markdown-viewer-tauri/src/App.css` の `preview-workspace` / `preview-pane`、TabStrip、左右 2 pane grid、separator、responsive layout、Light / Dark theme。
  - `markdown-viewer-tauri/src/documentPolicy.ts` と既存 HTML iframe の `tabId + revision` message 検証。pane 識別が必要な場合も security boundary を緩和しない。
  - `docs/components/tauri_viewer/README.md`、`basic_design.md`、`detail_design.md`、`interface_spec.md` の恒久仕様。
- completion:
  - View メニューから single / 左右 2 pane split を切り替えられ、切替後も有効な表示対象と active pane が保たれる。
  - primary / secondary pane に同一 root 内の異なる open tab を選択して同時表示できる。
  - Explorer 選択、tab activate、Reload、relative Markdown link は active pane を対象とし、他方の pane selection を意図せず変更しない。
  - tab close、最後の tab close、root 変更、split off / on 後も各 pane が残存 tab または未選択状態へ一貫して復旧する。
  - 各 pane で Markdown preview、相対画像、Mermaid、PlantUML、trusted HTML、anchor、独立 scroll、loading / error 表示が破綻せず、非同期結果が他 pane / tab へ混線しない。
  - split 表示でも HTML iframe の sandbox / CSP / root boundary / external link policy と Markdown の raw HTML 禁止を維持する。
  - pane 幅変更または window / Explorer resize 後も preview が利用可能な幅へ追従し、Mermaid が source 表示へ戻らず、PlantUML と HTML iframe が不必要に再読み込みされない。
  - keyboard だけで split toggle、pane / tab 選択、pane 間移動、separator 操作へ到達でき、focus indicator と accessible name / role / state が確認できる。
  - single view の既存 Multi-tab、Markdown / HTML、image viewer、MenuBar / StatusBar、Settings、Recent Folders の操作が退行しない。
- success_metrics:
  - `npm test` と `npm run build` in `markdown-viewer-tauri/` が成功する。
  - `cargo check` in `markdown-viewer-tauri/src-tauri/` が成功する。
  - 手動確認で split on / off、左右別文書、active pane 切替、pane ごとの tab 選択 / Reload / link、tab close 復旧、root 変更を確認できる。
  - 手動確認で Markdown + Markdown、Markdown + HTML、Mermaid + PlantUML の同時表示、各 pane の独立 scroll、loading / error と非同期描画の分離を確認できる。
  - 手動確認で window / Explorer / pane resize、Light / Dark、keyboard / focus、HTML security boundary、single view 回帰を確認できる。

## TODO-2026-023 Tauri pane-local tab group 導入

- status: open
- workflow: new-feature
- depends_on: TODO-2026-006
- summary: Tauri版のprimary / secondaryでTabStripの所属・表示順を分離し、各paneで開いたtabだけを表示する。
- feasibility: 実現可能。現行の共有`OpenDocumentTab[]`はdocument cacheとして維持できるが、paneごとのordered tab ID collectionとactive tabを正本化し、open / close / Reload / root reset / split offのpolicyを移行する必要がある。
- scope:
  - primary / secondaryごとにtabの所属と表示順を管理する。
  - Explorerまたはlinkから開いたdocumentはactive paneのTabStripへ追加する。
  - 同じpathを両paneで開く場合のdocument data共有とpane-local runtime分離を両立する。
- completion:
  - 各paneのTabStripにはそのpaneで開いたtabだけが表示され、他paneのtab追加・closeで意図せず増減しない。
  - tab activate / close、Reload、relative link、root変更、split on / offでpane-local tab collectionとactive tabが一貫して復旧する。
  - Markdown / HTML / Mermaid / PlantUMLの非同期結果とloading / error表示がpane間で混線しない。
  - `npm test`、`npm run build`、`cargo check`が成功する。

## TODO-2026-024 Tauri pane間tab移動

- status: open
- workflow: new-feature
- depends_on: TODO-2026-023
- summary: Tauri版で開いているtabをprimary / secondaryのTabStrip間で移動できるようにする。
- feasibility: 実現可能。TODO-2026-023のpane-local tab ownershipを前提に、移動元・移動先のordered tab IDs、active tab fallback、pane runtime / focusを1つのtyped transitionで更新する必要がある。
- completion:
  - tabをprimaryからsecondary、secondaryからprimaryへ明示操作で移動できる。
  - 移動後もdocument data、scroll / preview、loading / error、relative link、image viewerのpane identityが破綻しない。
  - active tabを移動した場合、移動元は隣接tabまたは未選択へ復旧し、移動先では対象tabを選択できる。
  - keyboardだけでも移動操作へ到達でき、focusとaccessible name / stateが維持される。
  - `npm test`、`npm run build`、`cargo check`が成功する。

## TODO-2026-025 Tauri上下・左右split方向対応

- status: open
- workflow: new-feature
- depends_on: TODO-2026-023
- summary: Tauri版の2pane splitを左右方向だけでなく上下方向でも表示できるようにする。
- feasibility: 実現可能。現行`ViewMode`と左右幅専用policy / CSS gridをsplit orientation + axis共通size policyへ拡張し、separatorのpointer座標・keyboard・ARIA orientationを方向別に切り替える必要がある。
- scope:
  - single、左右2pane、上下2paneを切り替える。
  - pane-local TabStripとpreviewをどちらの方向でも同じ`DocumentPane`経路で描画する。
  - separator操作、狭幅・狭高さ縮退、requested ratioを方向に応じて扱う。
- non_scope:
  - 3pane以上、入れ子split tree、任意数のeditor groupは別途WBSで分解する。
- completion:
  - View操作で左右splitと上下splitを選択でき、切替後もpaneごとのtabとactive paneが維持される。
  - pointer / keyboard separator操作、focus、`aria-orientation` / valueがsplit方向と一致する。
  - Markdown / HTML / Mermaid / PlantUMLが上下・左右の利用可能領域へ追従し、不必要に再読み込みされない。
  - `npm test`、`npm run build`、`cargo check`が成功する。

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

## TODO-2026-020 Avalonia Explorer ツリーペイン UX 水平展開

- status: open
- workflow: spec-change
- depends_on: TODO-2026-019
- execution_order: TODO-2026-019のTauri先行実装とUX確認完了後に実施する。
- summary: Tauri版で確定したExplorer幅変更、横scroll、node iconのUXを、AvaloniaのGridSplitter / TreeViewの自然な責務境界に合わせて水平展開する。
- scope:
  - Avalonia版Explorer / Preview layout、TreeView表示、関連ViewModelまたはconverter、component docs。
- out_of_scope:
  - Tauri版と内部実装を共通化すること。
  - Explorer幅の再起動後永続化。Tauri評価で必要性が確認された場合は別途仕様化する。
- completion:
  - Tauri先行UXで確定した最小・最大幅と操作契約をAvalonia版へ反映し、stack差分を文書化する。
  - tree contentがExplorer幅を超えた場合だけExplorer内に水平scrollbarが表示され、長い表示名の末尾へ到達できる。
  - directory、Markdown、HTMLに識別可能なアイコンが表示され、既存のtree開閉・document選択が退行しない。
  - `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`が成功し、幅変更、境界値、横scroll、Light / Darkを手動確認する。
