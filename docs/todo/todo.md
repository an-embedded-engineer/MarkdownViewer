# TODO

## TODO-2026-023 Tauri pane-local tab group / pane 間移動

- status: open
- workflow: new-feature
- depends_on: TODO-2026-006
- source_todo: TODO-2026-024
- source_design: `docs/design_analysis/new_feature/20260726_tauri_split_view/`
- summary: Tauri版のprimary / secondaryでTabStripの所属・表示順を分離し、各paneで開いたtabだけを表示して、明示操作でpane間を移動できるようにする。
- integrated_todo: TODO-2026-024
- feasibility: 実現可能。現行の共有`OpenDocumentTab[]`はdocument cacheとして維持し、paneごとのordered tab ID collection、active tab、移動元 / 移動先のfallbackを1つのtyped transitionとして設計する。
- target_users:
  - Tauri版Markdown Viewerで、比較対象ごとに左右の作業文脈を分け、多数のopen documentから各paneに必要なtabだけを表示したい利用者。
  - Explorerやrelative linkで開いたdocumentを現在操作中のpaneへ追加し、必要に応じてkeyboardを含む明示操作で反対paneへ移したい利用者。
- use_cases:
  - primaryで仕様書群、secondaryで設計書群を開き、各TabStripをpane固有の表示順とactive tabで操作する。
  - ExplorerまたはMarkdown内relative linkからdocumentを開き、active paneのtab groupへ追加して表示する。
  - 同じpathを両paneのtab groupへ追加し、共有document dataを参照しながらpaneごとに独立したpreview runtimeと選択状態で確認する。
  - split表示中にtabを反対paneへ移動し、移動先で選択されたdocumentを確認しつつ、移動元は隣接tabまたは未選択へ復旧する。
  - tab close、Reload、root変更、split off / on後も、paneごとの所属・表示順・active tabが有効な状態へ復旧する。
- prerequisites:
  - TODO-2026-006で導入した左右2pane、active pane routing、pane-local selection / runtime、pane / tab / revision guardを基盤とする。
  - document本文、revision、PlantUML cacheなどの正本はglobal `OpenDocumentTab[]`に維持し、pane-local groupにはordered tab IDと選択状態だけを保持する。
  - current root内でpath一意というdocument data契約と、trusted HTMLのsandbox / CSP / root boundary / external link policyを維持する。
- scope:
  - primary / secondaryごとにtabの所属と表示順を管理する。
  - Explorerまたはlinkから開いたdocumentはactive paneのTabStripへ追加する。
  - 同じpathを両paneで開く場合のdocument data共有とpane-local runtime分離を両立する。
  - split表示中のtabをprimary / secondary間で明示操作により移動し、所属変更、移動元fallback、移動先選択、active pane更新を1つの型付き状態遷移として扱う。
  - single viewではprimary groupを表示し、secondary groupはsession内で保持してsplit再有効化時に復元する。
- non_scope:
  - drag and drop、group内tab reorder / pin、複数選択・一括移動、3pane以上、split tree。
  - tab groupやsplit layoutの再起動後永続化、Avalonia版への水平展開。
- follow_up:
  - 上下・左右split方向はTODO-2026-025で扱い、本機能のpane-local group modelを再利用できるようにする。
- integration_points:
  - `markdown-viewer-tauri/src/splitView.ts`の`SplitViewState` / typed action、tab activate / close、split on / off、root reset、pending navigationのpure transition。
  - `markdown-viewer-tauri/src/App.tsx`のglobal `OpenDocumentTab[]`、`DocumentPane` / `TabStrip`、Explorer open、relative link、Reload、active pane routing。
  - `markdown-viewer-tauri/src/paneRuntime.ts`のpane / tab / revision guardとTabStrip表示state合成。同一documentを両groupで参照してもruntimeを共有しない。
  - `markdown-viewer-tauri/src/App.css`のpane-local TabStrip、tab移動導線、focus / active / loading / error表示。
  - `markdown-viewer-tauri/src/splitView.test.ts` / `paneRuntime.test.ts`と、`docs/components/tauri_viewer/`、`docs/architecture/`、`docs/rules/development_workflow.md`の恒久仕様・検証手順。
- completion:
  - 各paneのTabStripにはそのpaneで開いたtabだけが表示され、他paneのtab追加・closeで意図せず増減しない。
  - tab activate / close、Reload、relative link、root変更、split on / offでpane-local tab collectionとactive tabが一貫して復旧する。
  - Markdown / HTML / Mermaid / PlantUMLの非同期結果とloading / error表示がpane間で混線しない。
  - 移動元は隣接tabまたは未選択へ復旧し、移動先では対象tabが選択される。
  - keyboardだけでも移動操作へ到達でき、focusとaccessible name / stateが維持される。
  - `npm test`、`npm run build`、`cargo check`が成功する。
- success_metrics:
  - frontend policy testでpane別の追加・activate・close、同一documentの両group参照、pane間移動、split off / on、root reset、stale async result拒否を検証できる。
  - 手動確認でExplorer / relative linkからactive paneへtabが追加され、左右のTabStripが独立して増減・選択されることを確認できる。
  - 手動確認でpointerとkeyboardの双方からtabを反対paneへ移動でき、移動元fallback、移動先選択、focus、StatusBar / ErrorBannerのroutingが一致する。
  - 手動確認で同じMarkdown / HTML documentを両paneに開き、Mermaid / PlantUML / HTML ready・timeoutを含む表示状態が混線しない。
  - `npm test -- --run`、`npm run build`、`cargo check`が成功し、既存single / split viewとHTML security boundaryの回帰がない。

## TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善

- status: open
- workflow: new-feature
- depends_on: TODO-2026-023
- source_feedback: TODO-2026-023 Phase 4-a
- summary: Tauri版TabStripをcompactな1行表示へ整理し、上端indicatorによる状態表現、必要時だけのhorizontal scrollbar、選択tab全体の自動scroll、pane間drag and drop移動を追加する。
- feasibility: 実現可能。既存のtyped `move-tab` transitionは再利用できる。visual stateは`resolvePaneTabPresentationState`を入力にCSS class / pseudo-elementで表現し、dragはHTML Drag and DropまたはPointer EventsをWebView別に評価する。tab activate buttonだけでなくtab item全体をscroll targetにする必要がある。
- target_users:
  - 多数のtabを左右paneで扱い、状態を判別しつつpreview領域を広く保ちたい利用者。
  - pointerでtabを直接反対paneへ移動したい一方、keyboardや支援技術でも同じ操作へ到達したい利用者。
- scope:
  - active / error / rendering状態をtab上端のindicatorへ統一し、Error / Renderingのvisible textを廃止する。
  - Errorは赤い上端線、Renderingは別色または左から伸びるindeterminate animationで表現する。実progress値が無いため進捗率とは扱わない。
  - visible text廃止後も状態をaccessible name / description、`aria-busy`等の適切なARIAで通知する。
  - 1行tabに合わせてTabStrip固定高をcompact化し、通常 / error / rendering / empty / overflowで高さを変えない。
  - horizontal scrollbarはpointer hoverまたはkeyboard focus時だけ視認可能にし、表示切替でTabStripやpreviewがlayout shiftしないようにする。
  - overflow中のtabをactivateまたはfocusした時、titleだけでなくmove / close buttonを含むtab item全体が表示範囲へ入るようscroll位置を調整する。
  - split表示中、tabを反対paneへdrag and dropして既存`move-tab` transitionを実行する。drop target / drag feedback / cancelを明示する。
  - 既存の矢印move buttonをkeyboard / assistive technology向けの代替導線として維持する。
- non_scope:
  - 同一pane内reorder、pin、複数選択、一括move / close。
  - 実数のrender progress表示。現行runtimeに進捗率が無いためindeterminate表現までとする。
  - dragだけを唯一の移動導線にすること、または矢印move buttonの廃止。
- integration_points:
  - `markdown-viewer-tauri/src/App.tsx`の`TabStrip`、tab item refs、focus / scroll調停、drag event wiring。
  - `markdown-viewer-tauri/src/App.css`のactive / error / rendering indicator、compact height、scrollbar visibility、drag / drop feedback、reduced motion。
  - `markdown-viewer-tauri/src/splitView.ts`の既存atomic `move-tab` action。drag専用の重複state transitionは追加しない。
  - `markdown-viewer-tauri/src/paneRuntime.ts`のpresentation state合成とARIA state導出。
- completion:
  - Error / Renderingのvisible textが無くても、通常・active・error・renderingを上端indicatorとaccessible stateで識別できる。
  - Error indicatorはtab上端に赤で表示され、Rendering indicatorはError / activeと混同しない。animationを使う場合は`prefers-reduced-motion`へ対応する。
  - TabStripがcompactな固定高を維持し、左右pane、empty、overflow、状態遷移でpreview上端に段差や高さ変動が生じない。
  - horizontal scrollbarはhover / focus時だけ視認可能で、表示切替によるlayout shiftがない。
  - overflow中に右端を含む任意tabをactivate / focusすると、title、move、close controlを含むtab item全体が自動的に表示範囲へ入る。
  - pointer dragでprimary / secondary間を移動でき、source fallback、destination selection、focus、runtime guardが矢印moveと一致する。cancel時はstateを変更しない。
  - keyboardだけでも既存move buttonから同じ移動を実行でき、drag state / drop targetが支援技術を妨げない。
  - Light / Dark、single / split、narrow window、horizontal overflow、HTML / Mermaid / PlantUML表示で回帰がない。
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
