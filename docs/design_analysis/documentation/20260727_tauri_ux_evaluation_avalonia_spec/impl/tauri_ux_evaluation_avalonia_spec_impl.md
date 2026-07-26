# Tauri先行UX評価・Avalonia反映仕様化 更新記録

## 更新した文書

- `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md`
  - Tauri先行UXを根拠レベル別に評価し、共通仕様、Avalonia適応、Tauri固有方式、deferred事項を分離した。
  - Shell / Explorer、Settings / Recent Folders、typed document / Multi-tab、Split View baseline、trusted HTML security outcomeをAvalonia target contractとして定義した。
- `docs/components/avalonia_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md`, `issues.md`
  - 現在実装とplanned contractを混在させず、反映仕様への入口と実装時の検証課題を追加した。
- `docs/todo/todo.md`
  - TODO-2026-023へ024、TODO-2026-008へ020、TODO-2026-009へ015を統合した。
  - TODO-2026-018を008後 / 010前へ移し、010を009と018の両方へ依存させた。
  - TODO-2026-012をTODO-2026-011だけへの直接依存へ整理した。
  - TODO-2026-019 / 021 / 022をTODO-2026-007の追加評価根拠として記録した。
- `docs/todo/todo_archive_2026.md`
  - TODO-2026-024 / 020 / 015を`integrated`として統合先、理由、移管scopeとともに記録した。
- UI/UX WBS
  - WP-005の評価範囲、WP-006 / 007の統合scope、trusted HTMLのWP-008A、WP-008→009→010の依存を同期した。
- history
  - todo再編とAvalonia rollout判断を履歴へ追加し、索引を更新した。

## 移動・削除・統合

- 物理fileの移動・削除は行っていない。
- active todoからTODO-2026-024 / 020 / 015を除き、archiveの統合記録へ移した。
- 過去のchange report、design、review、historyは当時点の記録として変更していない。

## 整合確認

- active dependencyから統合済みTODO-2026-024 / 020 / 015を除去した。
- TODOとWBSの直接依存を、008 → (009 / 018並行) → 010 → 011 → 012へ揃えた。
- TODO-2026-019 / 021 / 022をbaseline dependencyにせず、追加評価資料として追跡した。
- Avalonia component docsでは現在実装とplanned contractを明示的に分離した。
- 新規ADRは追加していない。本件は現時点では比較実装固有のrollout planであり、複数案件で再利用される採用済み横断判断には達していない。

## 文書検証コマンド

実施結果はPhase 3レビュー反映後に追記する。

## docs-only確認

変更対象はMarkdown文書だけであり、ソースコード、設定、スクリプト、fixture、runtime assetを変更していない。アプリbuild / test / manual verificationは新規実行せず、既存workflowの記録だけを評価根拠とした。
