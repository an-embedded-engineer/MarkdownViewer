---
title: "TODO-2026-029 Tauri別プロセス起動・ディレクトリ別設定・タイトル表示"
created_date: "2026-09-12"
category: "new_feature"
todo_id: "TODO-2026-029"
work_branch: "new-feature/tauri-multi-instance-project-settings"
base_branch: "main"
base_commit: "3d1848c"
components:
  - "markdown-viewer-tauri/src-tauri/src/lib.rs"
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src-tauri/Cargo.toml"
  - "markdown-viewer-tauri/src-tauri/src/project_settings.rs"
  - "markdown-viewer-tauri/src-tauri/src/viewer_session.rs"
  - "markdown-viewer-tauri/src-tauri/src/instance_launcher.rs"
  - "markdown-viewer-tauri/src-tauri/src/window_identity.rs"
  - "markdown-viewer-tauri/src-tauri/src/macos_instances.rs"
  - "markdown-viewer-tauri/src/projectSettings.ts"
  - "markdown-viewer-tauri/README.md"
  - "docs/components/tauri_viewer"
  - "docs/architecture"
  - "docs/rules/development_workflow.md"
  - "docs/setup/README.md"
  - "docs/tests/README.md"
status: "phase_2_review_followup"
design_status: "in_review"
impl_status: "not_started"
completion_status: "not_started"
related_commits:
  - "4814fbf : Phase 2 初回18件の設計指摘対応"
  - "f5fafe3 : Phase 2 再レビュー承認・追加non-blocking 2件"
  - "85fb535 : Phase 2 詳細設計初稿"
  - "e2a846d : Phase 2 初回設計レビュー18件"
  - "fc2d085 : Phase 1 専用ブランチとmeta初期化"
  - "bb6ea91 : Phase 0 複数ウィンドウとタイトル表示の要求整理"
  - "3d1848c : Phase 0 別プロセス方式・ディレクトリ別設定へ要求更新"
---

## 要求の正本

- [TODO-2026-029](../../../todo/todo.md#todo-2026-029-tauri別プロセス起動ディレクトリ別設定タイトル表示)
- 2026-09-12にユーザから「OKです。Phase1へ進めてください」と承認を受領。

## 承認済み方針

- 1プロセス1Viewer windowを維持し、macOSでアプリ操作から別プロセスを起動する。
- macOS / WindowsでRoot名をタイトルに表示し、OSのwindow切替時に識別できるようにする。
- ユーザー用アプリ設定領域にdirectory単位のtheme / window size / PlantUML pathを保持し、directory初回open成功時に設定を生成する。
- 同一プロセス内で複数windowを管理する構成への変更は行わない。

## Phase 2設計判断

- [詳細設計](design/tauri_multi_instance_project_settings_feature_design.md)に起動・設定・command / event・native menuの契約を記録。
- 2026-09-12追加回答によりmacOSはメニューバーのWindow一覧でよい。Dock独自一覧は対象外。
- 別instanceへのcooperative activationはPhase 3冒頭のpackaged app spikeでgo / no-goを判定する。現時点では実機未検証。
- 初回18件は解決確認済み・設計承認済み。追加2件も設計へ対応し最終確認待ち。

## Phase 状態

| Phase | 状態 |
| --- | --- |
| 0 要求整理 | 完了・2026-09-12ユーザ承認済み |
| 1 ブランチ・meta初期化 | 完了（本初期化コミット） |
| 2 設計・レビュー | 初回18件解決・承認済み、追加2件対応の最終確認待ち |
| 3 実装・恒久ドキュメント反映 | 未着手 |
| 4 検証・完了処理 | 未着手 |

## Phase 1確認

- originをfetchし、分岐前のmainとorigin/mainに差がないことを確認した。
- mainの`3d1848c`から専用ブランチを作成した。
- このPhaseはTODOとmetaのみを変更し、ソースコードの変更や実装検証は行わない。
- Phase 1のcommit hashは自己参照を避け、後続Phaseまたはcompletionでrelated_commitsへ追記する。
