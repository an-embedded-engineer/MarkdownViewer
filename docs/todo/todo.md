# TODO

## TODO-2026-029 Tauri複数ウィンドウとディレクトリ名表示

- status: Phase 0 要求整理済み・ユーザ承認待ち
- workflow: new-feature
- summary: macOSでアプリ操作から複数ウィンドウを開き、macOS / Windowsのウィンドウ切替時にRootディレクトリを識別できるようにする。
- target_users: 複数のプロジェクトや仕様書ディレクトリを並行して閲覧するTauri版利用者。
- use_cases:
  - macOSで新規ウィンドウを開き、それぞれ別のディレクトリを選択して並行閲覧する。
  - Windowsのタイトルバー・タスクバーのサムネイル見出し、macOSのWindowメニュー・Dockの開いているウィンドウ一覧からディレクトリを識別して切り替える。
- feasibility:
  - 実現可能。lockfileのTauri 2.11.2およびローカル依存ソースでWebviewWindowBuilder、set_title、set_as_windows_menu_for_nsappを確認した。OS表示の最終判定にはpackaged appの実機検証が必要。
  - 現行DocumentStore.current_rootはアプリ全体で1つ。単純にwindowを増やすと別windowのRootが上書きされるため、commandの呼出元windowとprotocolのwebview_labelを使ったwindow別管理が必須。
  - mvhtml handlerはmain以外を拒否し、capabilityもmain限定。新規Viewer windowを明示的に認可し、HTML preview originのIPC禁止とroot boundaryを維持する必要がある。
  - ReactのRoot / tabs / split / runtimeは各App instanceで分離可能。設定とRecent Foldersは共有storeのため、保存競合・他windowでの更新反映方針を設計する。
- proposed_scope:
  - アプリ内File > New WindowとmacOS native menu / Cmd+Shift+Nから空のViewer windowを生成し、Open Folder / Recent FoldersでRootを選択する。
  - Windowsにも同じアプリ内新規window導線を提供し、既存のショートカット起動を維持する。
  - タイトル案は「ディレクトリ名 — MarkdownViewer」。未選択は「MarkdownViewer」。同名directoryは親path等で区別できる表記にする。
  - macOSのnative WindowメニューとDockの開いているwindow一覧でRoot名を表示し、選択で対応windowへ移動する。
  - window close時のstate破棄と、全windowを閉じた後のmacOS Dock再起動 / 再表示を扱う。
- non_scope:
  - Avalonia版への適用、window間のtab移動、全windowのsession復元。
  - 添付VS CodeのDock上部にある最近使ったfolder一覧やfolder iconの完全再現。
  - Dock独自のNew Window項目は初期必須範囲に含めない。メニューバーの新規作成と異なりAppKit連携の追加調査が必要であり、必要性をPhase 2で整理する。
- completion:
  - macOSでCLIを使わず2つ以上のwindowを開き、異なるRootを同時閲覧できる。
  - 一方のRoot変更・Reload・closeが他方のtree / tabs / Markdown / HTML resourceへ影響せず、HTMLは呼出元windowのRoot外を参照できない。
  - Root選択成功時にタイトルが更新され、キャンセル・失敗時には以前のRootとタイトルを保持する。
  - 同名directory、日本語・空白入りpath、Root未選択でもwindowを識別できる。
  - Windowsのタイトルバー・サムネイル見出し、macOSのWindowメニュー・Dock一覧にRoot名が表示され、対象windowを選択できることを実機確認する。OSの省略表示やサムネイル設定による差異は記録する。
  - 追加windowでもdialog、外部link、settings、Recent Folders、size復元が機能し、設定更新で他fieldを失わない。
  - 最後のwindowを閉じた後もDockから再びViewerを開ける。
  - npm test -- --run、npm run build、cargo check、cargo testが成功し、複数windowのRoot分離と既存previewの回帰を検証する。
- success_metrics: macOSで2 directory以上を同時に開けること、Root欄を確認せずOSのwindow切替UIで対象を選択できること、window間のRoot混線が0件であること。
- affected_components: src-tauri/src/lib.rs（window生成・lifecycle・DocumentStore・protocol・config）、src/App.tsx（File操作・タイトル・設定反映）、tauri.conf.json、capabilities/default.json、frontend / Rust tests、Tauri README / component / architecture / development workflow docs。
- integration_points: 既存Open Folder / Recent Folders、Root読込成功処理、React App初期化、Rust setup、native menu、window close / reopen、HTML protocol。
- phase_2_decisions: native menuとReact File menuの操作共有、同名Rootの表示規則、共有設定の更新反映とwindow size保存方針、macOS全window close後のlifecycle、Dock標準一覧の実機挙動と追加AppKit対応の要否。
- evidence:
  - [Tauri WebviewWindowBuilder](https://docs.rs/tauri/2.11.2/tauri/webview/struct.WebviewWindowBuilder.html)
  - [Tauri WebviewWindow / set_title](https://docs.rs/tauri/2.11.2/tauri/webview/struct.WebviewWindow.html#method.set_title)
  - [Tauri Submenu / native Window menu](https://docs.rs/tauri/2.11.2/tauri/menu/struct.Submenu.html#method.set_as_windows_menu_for_nsapp)
  - [Tauri UriSchemeContext](https://docs.rs/tauri/2.11.2/tauri/struct.UriSchemeContext.html)
  - [Apple Dock menus](https://developer.apple.com/design/human-interface-guidelines/dock-menus)
  - [Apple applicationDockMenu](https://developer.apple.com/documentation/AppKit/NSApplicationDelegate/applicationDockMenu(_:))

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
