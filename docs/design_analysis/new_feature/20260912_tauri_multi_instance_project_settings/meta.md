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
status: "phase_3_review_followup"
design_status: "done"
impl_status: "in_review"
completion_status: "not_started"
related_commits:
  - "ff84654 : 初回実装レビュー8件への対応"
  - "2f292ac : Round 1 全8件解決確認・追加Low 1件"
  - "75a7ac7 : Phase 2 完了記録"
  - "78039cd : Phase 3 実装・テスト・恒久docs初稿"
  - "dc34e0b : Phase 3 初回実装レビュー8件"
  - "8034327 : Phase 2 追加2件の設計指摘対応"
  - "c4bf9c7 : Phase 2 最終レビュー承認・全20件解決"
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
- 初回18件・追加2件の全20件を解決し、c4bf9c7で最終設計レビュー承認。未解決0件。
- [レビュー結果](review/tauri_multi_instance_project_settings_design_review.md)を参照。Phase 3の進行はユーザ承認待ち。

## Phase 状態

| Phase | 状態 |
| --- | --- |
| 0 要求整理 | 完了・2026-09-12ユーザ承認済み |
| 1 ブランチ・meta初期化 | 完了（本初期化コミット） |
| 2 設計・レビュー | 完了・最終レビュー承認、未解決0件 |
| 3 実装・恒久ドキュメント反映 | 2026-09-13進行承認済み・実装draft、検証・レビュー準備中 |
| 4 検証・完了処理 | 未着手 |

## Phase 1確認

- originをfetchし、分岐前のmainとorigin/mainに差がないことを確認した。
- mainの`3d1848c`から専用ブランチを作成した。
- このPhaseはTODOとmetaのみを変更し、ソースコードの変更や実装検証は行わない。
- Phase 1のcommit hashは自己参照を避け、後続Phaseまたはcompletionでrelated_commitsへ追記する。

## Phase 2確認とPhase 3への引継ぎ

- 設計・レビュー前後の更新をコミットし、git diff --checkとローカルリンク参照先を確認した。
- 変更はドキュメントのみ。npm / cargoの実装build・testとUI動作確認は未実施。
- Phase 3最初の作業はmacOS packaged activation spike。通常 / 最小化 / 別Space fullscreenでkey・activeをdeadline内に観測する。失敗時は後続実装前に要件を再確認する。
- 実装レビューではopen_documentのcontext照合がI/Oと同じRootSnapshotを使うこと、presentationの共通nullable型、起動時サイズ適用の見え方、恒久docs更新を確認する。
- Claude review sessionはPhase 3レビューでも再利用する。

## Phase 3進捗

- ユーザーからPhase 3進行承認を受領。
- macOS 26.6.2のpackaged Tauri spikeでyieldだけの経路は失敗。requesterのactivateFromApplicationを追加した経路で通常68ms・最小化647ms・別Space fullscreen401ms、すべてkey / active / onActiveSpaceを確認してgoとした。
- [実装記録](impl/tauri_multi_instance_project_settings_impl.md)に設計差分・検証・未確認項目を記録する。
