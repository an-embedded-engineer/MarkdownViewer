# TODO

## TODO-2026-005 Tauri Multi-tab core 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- source_report: `docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md`
- work_package_id: WP-003
- depends_on: TODO-2026-003, TODO-2026-004
- summary: Tauri 版に複数タブの core state と TabStrip を追加する。
- target_users:
  - Tauri 版 Markdown Viewer で同一フォルダ内の複数 Markdown を行き来しながら参照する利用者。
  - Mermaid / PlantUML を含む複数文書を、再選択や再描画の待ち時間を抑えて比較したい利用者。
- use_cases:
  - Explorer から Markdown を選択し、未オープンなら新しいタブで開き、既に開いていればそのタブへ移動する。
  - TabStrip から文書を切り替え、不要なタブを閉じる。
  - active tab を Reload し、表示中の Markdown、Mermaid、PlantUML を更新する。
  - Markdown 内の相対リンクから同じ root 内の別 Markdown へ移動し、リンク先の既存タブを再利用するか新しいタブを開く。
  - `Open Folder` / `Recent Folders` で root を変更し、旧 root のタブを残さず新しい root の文書表示へ移る。
- scope:
  - `selectedFilePath` / `selectedMarkdown` を、型付きの tab collection と active tab identifier を正本とする状態モデルへ移行する。
  - 各タブに path、Markdown 本文、preview 更新情報、PlantUML 描画結果と loading / error 状態を保持し、非 active tab の非同期完了が active tab を上書きしないようにする。
  - Explorer 選択、TabStrip の activate / close、active tab の Reload、Markdown 内リンク、theme 切替を tab state に統合する。
  - タブは現在の `rootPath` 配下の Markdown に限定し、root 変更時は既存タブを破棄する。
  - 多数タブ時にも TabStrip から各タブへ到達できる最小の overflow 操作を設ける。
- non_scope:
  - split view、複数 pane、タブの pane 間移動は TODO-2026-006 で扱う。
  - タブの永続化、再起動後の復元、pin、並べ替え、drag and drop、編集・未保存状態は含めない。
  - Avalonia 版の multi-tab は TODO-2026-010 で扱う。
  - root 外の Markdown をタブとして開く機能は含めない。
- integration_points:
  - `markdown-viewer-tauri/src/App.tsx` の単一文書 state、Explorer 選択、Markdown 読み込み、Reload、相対リンク処理、Mermaid / PlantUML 描画、MenuBar / StatusBar。
  - `markdown-viewer-tauri/src/App.css` の workspace、TabStrip、active / close / overflow 表示、Light / Dark theme。
  - 既存 Rust command `read_text_file` / `render_plantuml_diagrams`。command 契約は維持し、tab ごとの呼び分けを React 側で管理する。
  - `docs/components/tauri_viewer/README.md`、`basic_design.md`、`detail_design.md`、`interface_spec.md` の恒久仕様。
- completion:
  - Explorer クリックで同一 path のタブがあれば activate、なければ新規タブを開く。
  - TabStrip で active tab を識別でき、タブ切替と close ができる。active tab を閉じた場合は隣接タブへ移り、最後のタブを閉じた場合は未選択表示になる。
  - Reload は active tab だけを再読み込みし、theme 切替は全タブで一貫して反映される。
  - Markdown 内の相対 Markdown リンクは、同一 path のタブがあれば activate、なければ新規タブを開き、anchor へ移動する。
  - タブは現在の `rootPath` 内に限定される。
  - root 変更時は旧 root の全タブを破棄し、新しい root の初期 Markdown だけを開く。root open に失敗した場合は従来の表示状態を維持する。
  - タブ切替、Reload、theme 切替後も Markdown、相対画像、Mermaid、PlantUML、anchor、loading / error 表示が破綻しない。
  - 多数タブ時も TabStrip の overflow により任意のタブを activate / close できる。
- success_metrics:
  - `npm run build` in `markdown-viewer-tauri/` が成功する。
  - `cargo check` in `markdown-viewer-tauri/src-tauri/` が成功する。
  - 手動確認で複数 Markdown open、同一 path 再選択、activate、active / inactive tab close、最後の tab close、active tab Reload、theme、Markdown 内リンクと anchor、Mermaid / PlantUML 再描画を確認できる。
  - 手動確認で root 変更、root open 失敗、多数タブ overflow、非 active tab の描画完了時に active preview が上書きされないことを確認できる。

## TODO-2026-006 Tauri Split view 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-004
- depends_on: TODO-2026-005
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
- depends_on: TODO-2026-003, TODO-2026-004, TODO-2026-005, TODO-2026-006
- summary: Tauri 先行実装の UX 評価を行い、Avalonia へ適用する確定仕様を文書化する。
- completion:
  - MenuBar、StatusBar、Recent Folders、TabStrip、split view の評価結果が文書化される。
  - Avalonia 反映時の共通仕様と stack 差分方針が明確になる。
  - 未解決 UI 調整が必要な場合は todo 化される。

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
- depends_on: TODO-2026-008, TODO-2026-009
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
