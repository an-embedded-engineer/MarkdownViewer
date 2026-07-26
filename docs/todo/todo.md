# TODO

## TODO-2026-023 Tauri pane-local tab group / pane 間移動

- status: open
- workflow: new-feature
- depends_on: TODO-2026-006
- summary: Tauri版のprimary / secondaryでTabStripの所属・表示順を分離し、各paneで開いたtabだけを表示して、明示操作でpane間を移動できるようにする。
- integrated_todo: TODO-2026-024
- feasibility: 実現可能。現行の共有`OpenDocumentTab[]`はdocument cacheとして維持し、paneごとのordered tab ID collection、active tab、移動元 / 移動先のfallbackを1つのtyped transitionとして設計する。
- scope:
  - primary / secondaryごとにtabの所属と表示順を管理する。
  - Explorerまたはlinkから開いたdocumentはactive paneのTabStripへ追加する。
  - 同じpathを両paneで開く場合のdocument data共有とpane-local runtime分離を両立する。
  - tabをprimary / secondary間で明示操作により移動する。
- non_scope:
  - drag and drop、tab reorder / pin、3pane以上、split tree。
- completion:
  - 各paneのTabStripにはそのpaneで開いたtabだけが表示され、他paneのtab追加・closeで意図せず増減しない。
  - tab activate / close、Reload、relative link、root変更、split on / offでpane-local tab collectionとactive tabが一貫して復旧する。
  - Markdown / HTML / Mermaid / PlantUMLの非同期結果とloading / error表示がpane間で混線しない。
  - 移動元は隣接tabまたは未選択へ復旧し、移動先では対象tabが選択される。
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

- status: in_progress
- workflow: documentation
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-005
- depends_on: TODO-2026-003, TODO-2026-004, TODO-2026-005, TODO-2026-006, TODO-2026-014, TODO-2026-017
- source_todos: TODO-2026-019, TODO-2026-021, TODO-2026-022
- summary: Tauri 先行実装の UX 評価を行い、Avalonia へ適用する確定仕様を文書化する。
- completion:
  - MenuBar、StatusBar、Recent Folders、TabStrip、split view、設定確認・変更 UI と設定永続化の評価結果が文書化される。
  - Tauri版HTML形式仕様書表示の操作性、resource表示、外部link、安全性を評価し、Avaloniaへ反映する共通仕様とstack差分を確定する。
  - Explorer UX、responsive preview、image viewerを追加評価資料として整理し、Avalonia baselineへの採否を明記する。
  - Avalonia 反映時の共通仕様と stack 差分方針が明確になる。
  - Tauri Split View follow-upとAvalonia追随todoの統合・分割・直接依存がtodo / WBS / archiveで整合する。
  - 未解決 UI 調整が必要な場合は todo 化される。

## TODO-2026-018 Avalonia HTML形式仕様書表示対応

- status: open
- workflow: spec-change
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-008A
- source_report: `docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md`
- depends_on: TODO-2026-008
- execution_order: TODO-2026-008完了後、TODO-2026-009と並行して実施できる。TODO-2026-010より先に完了する。
- summary: Tauri先行UX評価で確定したHTML形式仕様書表示を、AvaloniaのWebViewと責務境界に合わせて水平展開する。
- completion:
  - 選択root配下のUTF-8 HTMLがMarkdownと同じExplorerに表示され、選択して開ける。
  - self-contained HTMLと、root内の相対画像、SVG、CSS、JavaScript、JSON、fontを利用するHTMLを表示できる。
  - inline SVG、Canvas、描画済みUML、root内runtimeによるdiagramを表示できる。
  - HTML内の`http:` / `https:` linkをViewer内で遷移させず、scheme検証後にOS標準ブラウザで開く。
  - trusted root契約、top-level navigation制御、host bridge制限を主境界とし、利用可能なplatform adapterではsubresource監視を追加防御として適用する。
  - 既存Markdown経路を含む`openExternal`へscheme allowlistを共通適用し、raw HTMLを許可し続けるか`DisableHtml()`を採用するかを確定する。
  - macOS / Windows / Linuxでroot内resource、root外拒否、外部link、既存Markdown / Mermaid / PlantUMLの回帰を確認する。

## TODO-2026-008 Avalonia shell / Explorer UX foundation

- status: open
- workflow: spec-change
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-006
- depends_on: TODO-2026-007
- source_todo: TODO-2026-019
- integrated_todo: TODO-2026-020
- summary: Avalonia版でMenuBar / StatusBarとExplorer resize / scroll / iconをまとめて導入し、後続document workspaceのshellを固定する。
- completion:
  - `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる。
  - root path、active file、loading、error が StatusBar に表示される。
  - Explorer / Preview境界をGridSplitterで変更でき、Tauri評価済みの最小・最大幅とkeyboard / accessibility outcomeをAvaloniaへ適応する。
  - tree contentがExplorer幅を超えた場合だけ横scrollでき、directory / Markdown / HTML / imageを識別できる。
  - 既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移が退行しない。

## TODO-2026-009 Avalonia app settings / Recent Folders

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-007
- depends_on: TODO-2026-008
- integrated_todo: TODO-2026-015
- summary: Avalonia版のtyped user config基盤を作り、Recent Folders、Theme、logical window size、PlantUML jar pathとSettings UIをまとめて水平展開する。
- completion:
  - root open 成功時に最近開いたディレクトリが保存される。
  - 最大件数、重複更新、存在しない path のエラー、削除 UI が機能する。
  - 再起動後も一覧が復元される。
  - MenuBarからSettings UIを開き、Theme、window size、PlantUML jar pathの現在値を確認・変更・保存できる。
  - field更新で他設定を失わず、既定値、invalid path、保存失敗、再起動復元を確認できる。

## TODO-2026-010 Avalonia Multi-tab core 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-008
- depends_on: TODO-2026-009, TODO-2026-018
- summary: Avalonia 版に複数タブの core state と TabControl を追加する。
- completion:
  - Explorer 選択で同一 path のMarkdown / HTMLタブがあれば activate、なければ新規タブを開く。
  - タブ切替、close、Reload、theme、Markdown 内リンクが仕様通り動く。
  - タブは現在の `RootPath` 内に限定される。
  - loading / error / HTML ready / timeout / Mermaid / PlantUMLの非同期結果がtab / revisionを越えて混線しない。

## TODO-2026-011 Avalonia Split view 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-009
- depends_on: TODO-2026-010
- summary: Avalonia 版に 2 ペイン split view を追加する。
- completion:
  - single / split の切替ができる。
  - global document collectionを維持し、primary / secondaryにpane-local selectionで別タブを表示できる。
  - active paneにExplorer、Reload、relative link、StatusBar / ErrorBannerをroutingできる。
  - 各 pane でMarkdown / HTML、Mermaid、PlantUML、loading / error / ready / timeout表示が破綻しない。
  - pointer / keyboard対応separator、requested ratio復元、tab close / root変更 / split offのfallbackが機能する。

## TODO-2026-012 両実装 UI/UX docs 最終同期

- status: open
- workflow: documentation
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-010
- depends_on: TODO-2026-011
- summary: 両実装の UI/UX 仕様・比較観点・残課題を最終同期する。
- completion:
  - Tauri / Avalonia の docs が実装と一致する。
  - 共通仕様、差分理由、残課題、今後の follow-up が整理される。
  - todo の完了 / 残項目が整合する。

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
