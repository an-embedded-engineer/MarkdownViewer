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
  - "markdown-viewer-tauri/README.md"
  - "docs/components/tauri_viewer"
  - "docs/architecture"
  - "docs/rules/development_workflow.md"
status: "phase_1_complete"
design_status: "not_started"
impl_status: "not_started"
completion_status: "not_started"
related_commits:
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

## Phase 2で確定する事項

- macOSのpackaged app / dev実行における別プロセス起動方法と終了後の独立動作。
- 別プロセスのwindowをDock / native menuで識別・選択する方法。一覧への自動集約は未検証。
- directory identity、同名Rootのタイトル、Root未選択時の設定、新規設定の初期値、既存設定の移行。
- Recent Foldersの共通保存、同directoryを開く複数プロセスの設定更新とプロセス間排他。
- Root切替時の設定適用と非同期処理・resize保存の整合。

## Phase 状態

| Phase | 状態 |
| --- | --- |
| 0 要求整理 | 完了・2026-09-12ユーザ承認済み |
| 1 ブランチ・meta初期化 | 完了（本初期化コミット） |
| 2 設計・レビュー | 未着手 |
| 3 実装・恒久ドキュメント反映 | 未着手 |
| 4 検証・完了処理 | 未着手 |

## Phase 1確認

- originをfetchし、分岐前のmainとorigin/mainに差がないことを確認した。
- mainの`3d1848c`から専用ブランチを作成した。
- このPhaseはTODOとmetaのみを変更し、ソースコードの変更や実装検証は行わない。
- Phase 1のcommit hashは自己参照を避け、後続Phaseまたはcompletionでrelated_commitsへ追記する。
