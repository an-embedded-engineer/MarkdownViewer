# TODO

## TODO-2026-029 Tauri別プロセス起動・ディレクトリ別設定・タイトル表示

- status: Phase 2 初回レビュー18件対応済み・再レビュー待ち
- workflow: new-feature
- work_branch: new-feature/tauri-multi-instance-project-settings
- meta: [案件メタ情報](../design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/meta.md)
- phase_0_approval: 2026-09-12 ユーザ承認済み。別プロセス方式・ディレクトリ別設定を含む要求に対しPhase 1への進行指示を受領。
- phase_2_approval: 2026-09-12 Phase 2進行承認済み。macOSはメニューバーのWindow一覧・選択でよいと回答受領。Dock独自一覧は対象外に確定。
- design: [詳細設計](../design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/design/tauri_multi_instance_project_settings_feature_design.md)
- summary: macOSでアプリ操作から別プロセスを起動し、macOS / Windows共通でディレクトリ別の設定を保持し、ウィンドウ切替時にRootを識別できるようにする。
- target_users: 複数のプロジェクトや仕様書ディレクトリを並行して閲覧するTauri版利用者。
- use_cases:
  - macOSで新規ウィンドウを開き、それぞれ別のディレクトリを選択して並行閲覧する。
  - Windowsのタイトルバー・タスクバーのサムネイル見出し、macOSのメニューバーのWindow一覧からディレクトリを識別して切り替える。
- feasibility:
  - 別プロセス方式を採用する。macOSでは自身のbundleへopen -n -aで別instanceを起動し、native titleはRustから更新する。packaged appの実機確認はPhase 3以降に行う。
  - 現行DocumentStore.current_rootは1プロセス内で共有される。1プロセス1Viewer windowを維持すればRootはプロセスのメモリ境界で分離され、window別storeへの変更は不要。
  - 各プロセスでmain windowを利用するため、mvhtmlのmain制約とcapabilityを複数window向けに拡張する必要はない。
  - 現行設定はapp_config_dir()/settings.jsonにtheme、windowSize、plantUmlJarPath、recentFoldersをまとめて保存している。Mutexはプロセス内のみ有効で、atomic replaceだけではプロセス間のread-modify-write競合による更新消失を防げない。
  - macOS native WindowメニューはIPCで自アプリinstanceを列挙し、activationを譲って対象を前面表示する。cooperative activationはPhase 3冒頭にpackaged appでgo / no-goを確認する。Dock独自一覧はユーザ回答により対象外。
- proposed_scope:
  - アプリ内File > New WindowとmacOS native menu / Cmd+Shift+Nから別プロセスの空のViewerを起動し、Open Folder / Recent FoldersでRootを選択する。
  - Windowsにも同じアプリ内新規window導線を提供し、既存のショートカット起動を維持する。
  - タイトルは「ディレクトリ名 — 親path — MarkdownViewer」。未選択は「No Folder — MarkdownViewer」。Window一覧の重複labelにはinstance IDを付加する。
  - macOSのメニューバーのWindow一覧から別プロセスをRoot名で識別・選択できる。起動・Root変更・focus・Refreshで一覧を更新する。
  - ユーザー用アプリ設定領域にRootディレクトリ単位の設定ファイルを持ち、初回にそのディレクトリを正常に開いた時に生成する。対象directory内には書き込まない。
  - theme、windowSize、plantUmlJarPathをdirectory別に保存・復元する。設定identityは正規化した絶対pathを基にし、同じ末尾directory名でも別pathは別設定とする。
  - Recent FoldersとRoot未選択時のdefaultsは共通settings.jsonに保持する。新projectは最新defaultsから初期生成し、既存viewerSettingsはdefaultsへ一度だけ移行する。再起動直後はdefaults、folder open時にproject設定を復元する。
  - window close時のstate破棄と、全windowを閉じた後のmacOS Dock再起動 / 再表示を扱う。
- non_scope:
  - Avalonia版への適用、window間のtab移動、全windowのsession復元。
  - 添付VS CodeのDock上部にある最近使ったfolder一覧やfolder iconの完全再現。
  - Dock独自のNew Window・window一覧・icon集約は対象外（2026-09-12ユーザ回答）。
- completion:
  - macOSでCLIを使わず2つ以上の独立したViewerプロセスを起動し、異なるRootを同時閲覧できる。親Viewer終了後も別プロセスのViewerが利用できる。
  - 一方のRoot変更・Reload・closeが他方のtree / tabs / Markdown / HTML resourceへ影響せず、HTMLは呼出元windowのRoot外を参照できない。
  - Root選択成功時にタイトルが更新され、キャンセル・切替先準備失敗時には以前のRootとタイトルを保持する。Root commit後のOS表示適用失敗は新Rootを維持しwarning / Retryを提示する。
  - 同名directory、日本語・空白入りpath、Root未選択でもwindowを識別できる。
  - Windowsのタイトルバー・サムネイル見出し、macOSのメニューバーのWindow一覧にRoot名が表示され、対象windowを選択できることを実機確認する。OSの省略表示やCmd+Tab / Dockが複数processを単一iconへまとめない場合の制約は記録する。
  - directory初回open成功時にユーザー用設定領域へ設定が生成され、同directory再open時にtheme / size / PlantUML pathが復元される。別directoryの設定を上書きしない。
  - Root切替中のresize保存や非同期処理が切替先の設定へ混線しない。同directoryの複数プロセス利用およびRecent Foldersの同時更新で更新消失を防ぐ。
  - 追加windowでもdialog、外部link、settings、Recent Folders、size復元が機能し、設定更新で他fieldを失わない。
  - 最後のwindowを閉じた後もDockから再びViewerを開ける。
  - npm test -- --run、npm run build、cargo check、cargo testが成功し、複数windowのRoot分離と既存previewの回帰を検証する。
- success_metrics: macOSで2 directory以上を同時に開けること、Root欄を確認せずOSのwindow切替UIで対象を選択できること、window間のRoot混線が0件であること。
- affected_components: src-tauri/src/lib.rs（別プロセス起動・lifecycle・directory設定・プロセス間排他・タイトル）、src/App.tsx（File操作・Root切替時の設定反映）、必要に応じnative起動 / menu連携、frontend / Rust tests、Tauri README / component / architecture / development workflow docs。
- integration_points: 既存Open Folder / Recent Folders、Root読込成功処理、React App初期化、Rust setup、native menu、window close / reopen、HTML protocol。
- phase_2_decisions: 詳細設計に起動・title・directory identity・defaults / migration・file lock・settings context・RootSnapshot世代・native menu / activation handoffを確定。macOS activationの実機成立性はPhase 3冒頭spikeで判定し、不成立なら後続実装前に要求を再確認する。
- evidence:
  - [Apple createsNewApplicationInstance](https://developer.apple.com/documentation/appkit/nsworkspace/openconfiguration/createsnewapplicationinstance)
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
