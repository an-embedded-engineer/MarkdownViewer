# TODO

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

## TODO-2026-019 Tauri Explorer ツリーペイン UX 改善

- status: open
- workflow: spec-change
- summary: Tauri版のExplorerを利用者が適切な幅へ変更できるようにし、長い階層・ファイル名への到達性とノード種別の識別性を改善する。
- existing_spec:
  - Explorer幅は280px固定で、利用者は変更できない。
  - Explorer pane自体は`overflow: auto`だが、tree rowとlabelがpane幅へ縮小され、長い表示名はellipsisになるため水平スクロールで全文へ到達できない。
  - Markdown / HTML / imageは文字アイコン、directoryは開閉記号だけで表示する。
- expected_spec:
  - ExplorerとPreviewの境界を操作して、Explorer幅を定義済みの最小値・最大値の範囲で変更できる。
  - 階層indent、アイコン、ファイル名を含むtree contentがExplorer幅を超える場合、Explorer内だけに水平スクロールバーを表示し、表示名を末尾まで確認できる。
  - directory、Markdown、HTMLを視覚的に区別できるアイコンを表示し、選択・開閉・disabled状態と共存させる。
- scope:
  - `markdown-viewer-tauri/src/App.tsx`のExplorer / tree UIとresize操作。
  - `markdown-viewer-tauri/src/App.css`のworkspace columns、resizer、tree overflow、icon styling。
  - Explorer幅境界とkeyboard操作を扱うfrontend policy moduleとunit test。
  - Tauri viewerのcomponent docsとUI手動確認項目。
- out_of_scope:
  - Explorer幅の再起動後永続化。
  - tree nodeのdrag and drop、rename、context menu、file system監視。
  - Rustのtree走査・document data contract変更。
  - Avalonia版の同時実装。水平展開はTODO-2026-020で追跡する。
- affected_contracts:
  - Explorer / Preview間のlayoutとpointer・keyboard操作。
  - Explorer内の縦横scroll責務、tree rowの最小content幅、長い名前の表示方法。
  - directory / Markdown / HTML / image nodeの視覚表現と既存selection / expand / open操作。
- permanent_docs:
  - `docs/components/tauri_viewer/README.md`
  - `docs/components/tauri_viewer/basic_design.md`
  - `docs/components/tauri_viewer/detail_design.md`
  - `docs/components/tauri_viewer/interface_spec.md`
  - `docs/rules/development_workflow.md`
- compatibility:
  - root選択、tree開閉、Markdown / HTML選択、tab操作、Preview表示の既存契約を維持する。
  - app shell全体にはscrollbarを出さず、scroll責務をExplorer / Preview内部に限定する既存方針を維持する。
- completion:
  - pointer操作でExplorer幅を最小値・最大値の範囲内に変更でき、Previewが残り幅へ追従する。
  - resizerがseparatorとして認識でき、keyboard操作でもExplorer幅を変更できる。
  - 深い階層または長い名前がpane幅を超えた場合だけExplorer内に水平scrollbarが表示され、tree contentの末尾へ到達できる。
  - directory、Markdown、HTMLに識別可能なアイコンが表示され、imageを含む各nodeの名前、選択、開閉、disabled状態が判別できる。
  - Explorer幅変更中と変更後にroot選択、tree開閉、Markdown / HTML選択、tab操作、Previewの縦scrollが退行しない。
  - `npm run build`、`npm test -- --run`、`cargo check`、`cargo test`が成功し、幅変更、最小・最大境界、横scroll、Light / Dark、長い名前と深い階層を手動確認する。

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
