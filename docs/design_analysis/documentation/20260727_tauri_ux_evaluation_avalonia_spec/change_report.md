# Tauri先行UX評価・Avalonia反映仕様化 変更レポート

## 対象

- TODO: `TODO-2026-007 Tauri 先行 UX 評価と Avalonia 反映仕様化`
- Workflow: `documentation`
- Branch: `documentation/tauri-ux-evaluation-avalonia-spec`
- Base branch: `main`
- 作成日: `2026-07-27`

## 変更概要

Tauri先行実装の完了記録と恒久仕様を評価し、Avaloniaへ反映する共通UX、stack固有の適応方針、未検証事項を文書化した。あわせて、Tauri Split View follow-upとAvalonia追随todoの統合・分割・依存順序を整理した。

- Tauri UXの根拠を`confirmed` / `specified` / `follow-up`へ分類した。
- Avalonia反映を`common` / `adapted` / `tauri-only` / `deferred`へ分類した。
- Shell / Explorer、Settings / Recent Folders、trusted HTML、Multi-tab、Split View baselineのtarget contractを確定した。
- Tauri `TODO-2026-023 + 024`、Avalonia `TODO-2026-008 + 020`、`TODO-2026-009 + 015`を統合した。
- Avaloniaの直接依存を`008 → (009 / 018並行) → 010 → 011 → 012`へ揃えた。

## 更新した文書

- Avalonia component docs
  - `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md`
  - `README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md`, `issues.md`
- 追跡・計画
  - `docs/todo/todo.md`
  - `docs/todo/todo_archive_2026.md`
  - `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md`
- 履歴
  - `docs/history/tauri_ux_evaluation_avalonia_spec_2026-07-27.md`
  - `docs/history/README.md`
- workflow成果物
  - `meta.md`
  - `design/tauri_ux_evaluation_avalonia_spec_design.md`
  - `review/tauri_ux_evaluation_avalonia_spec_design_review.md`
  - `impl/tauri_ux_evaluation_avalonia_spec_impl.md`
  - `review/tauri_ux_evaluation_avalonia_spec_impl_review.md`
  - `change_report.md`

## 削除・移動・統合

- active todoからTODO-2026-024 / 020 / 015を除き、`Status: integrated`としてarchiveへ移した。
- TODO-2026-007を完了状態でarchiveへ移した。
- 物理fileの削除・移動は行っていない。
- 過去案件のdesign / review / change report / historyは当時点の記録として維持した。

## レビュー

- Phase 2 design review:
  - 直接依存の明示と追加評価sourceの追跡に関する2件を修正した。
  - follow-up reviewで承認、未解決0件となった。
- Phase 3 implementation review:
  - Recent Foldersの評価粒度、TODO-2026-019の現行案内、WP-008Aの追跡説明に関する3件を修正した。
  - follow-up reviewで承認、未解決0件となった。

## 文書確認

- ユーザが`2026-07-27`に文書とdocs-only結果を承認した。
- `git diff --check main...HEAD`: 成功。
- changed Markdownの相対link target確認: 成功。
- active dependency内の統合済みTODO-2026-015 / 020 / 024: 残存なし。
- TODO / WBS直接依存: `008 → (009 / 018並行) → 010 → 011 → 012`で一致。
- branch差分の変更file: Markdownのみ。
- source、config、script、fixture、runtime assetの変更: なし。

## docs-onlyとdiff.zip

本変更は既存記録の評価、仕様文書化、todo / WBS / archive / history整理だけを行ったdocs-only変更である。実行時挙動、ソースコード、設定、スクリプト、runtime assetを変更していないため、`diff.zip`は作成していない。

## Follow-up

- Avalonia rollout: TODO-2026-008、並行可能なTODO-2026-009 / 018、TODO-2026-010、TODO-2026-011、TODO-2026-012の順で進める。
- Tauri Split View追加UX: TODO-2026-023（pane-local tab group / pane間移動）、TODO-2026-025（上下・左右split）で継続する。
- Tauri Windows settings検証: TODO-2026-016で継続する。
