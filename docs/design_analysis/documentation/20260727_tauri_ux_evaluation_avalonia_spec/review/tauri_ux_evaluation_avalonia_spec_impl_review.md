# Tauri 先行 UX 評価と Avalonia 反映仕様化 実装レビュー

## 1. レビュー対象

- 対象 commit: `572771b` (`docs: specify Avalonia rollout from Tauri UX`)
- 承認済み設計: `design/tauri_ux_evaluation_avalonia_spec_design.md`
- 更新記録: `impl/tauri_ux_evaluation_avalonia_spec_impl.md`
- 恒久文書: `docs/components/avalonia_viewer/`
- 追跡文書: `docs/todo/todo.md`, `docs/todo/todo_archive_2026.md`
- WBS / history: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md`, `docs/history/`
- workflow 境界: `documentation-workflow` Phase 3

設計承認済み方針への適合、TODO / WBS の直接依存、TODO-2026-023 + 024・008 + 020・009 + 015 の統合 archive、TODO-2026-019 / 021 / 022 の source 追跡、Avalonia component docs の current / planned 分離、既存確認範囲、リンク・索引・history、docs-only 境界を重点確認した。

## 2. 総合判定

**条件付き承認**

統合後の直接依存は、TODO と WBS の双方で `008 → (009 / 018) → 010 → 011 → 012` に揃っている。TODO-2026-024 / 020 / 015 は active entry から除去され、`Status: integrated`、統合先、理由、移管 scope を持つ archive entry が追加されている。TODO-2026-019 / 021 / 022 も TODO-2026-007 の `source_todos` と WP-005 の追加資料として追跡できる。

Avalonia component docs は、既存の単一 Markdown 実装を current として維持し、新規 `tauri_ux_rollout_spec.md` を planned target contract と明記している。platform matrix、keyboard / ARIA、複数 NativeWebView、settings atomicity、image viewer 採否も未確認・deferred として分離されており、現在実装との混同はない。変更は Markdown 13 files のみで、ソース、設定、スクリプト、fixture、runtime asset、`diff.zip` の混入もない。

ただし、評価ラベルの根拠粒度に 1 件、archive / WBS の現行案内に 2 件の不整合が残る。IR-001 は「確認済み範囲を過大評価しない」という本 topic の中核要件に関わるため、解消後に承認可能とする。

## 3. 指摘事項

### IR-001: Recent Folders の `confirmed` が既存の個別確認範囲を超えている

- 重大度: Medium
- 状態: Open
- 根拠:
  - `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md:11-12` は、change report にユーザ確認または自動検証結果がある項目を `confirmed`、個別の手動 PASS を推定できない項目を `specified` と定義している。
  - 同文書 `:27` は Recent Folders を一括して `confirmed` とし、最大 10 件、重複昇格、削除、再起動復元、missing path error のすべてを「確認・確定した内容」に含めている。
  - 根拠の `docs/design_analysis/new_feature/20260708_tauri_recent_folders/change_report.md:61-66,76-78` でユーザ確認済みなのは、entry 追加、削除、entry click による reopen、既存操作である。最大 10 件、重複昇格、missing path error、再起動復元の個別 PASS は記録されていない。
  - 同 change report `:70-74` の自動確認は build / `cargo check` / diff check であり、上記の状態遷移を実行する behavioral test ではない。最大件数等は設計・実装レビュー上は確定しているが、現行の評価ラベル定義では `specified` に相当する。
- 影響:
  - Avalonia 実装担当者が、Tauri で境界シナリオまで実機または自動テスト済みと誤認する。
  - 本 topic が明示した「既存 workflow で確認された範囲だけを `confirmed` とする」方針と評価表が一致しない。
- 推奨修正:
  - Recent Folders の評価を「主要操作 `confirmed`、最大件数 / 重複昇格 / missing path / 再起動復元 `specified`」のように分割する。
  - 代替として `confirmed` を維持する場合は、各境界を実行した既存の自動テストまたはユーザ確認記録を具体的に示し、評価表から追跡可能にする。

### IR-002: TODO-2026-019 の archive follow-up が統合前の TODO-2026-020 を現行追跡先として案内している

- 重大度: Low
- 状態: Open
- 根拠:
  - `docs/todo/todo_archive_2026.md:15-25` では TODO-2026-020 を `integrated` とし、現行統合先を TODO-2026-008 と明記している。
  - 一方、同文書 `:417-418` の TODO-2026-019 follow-up は「TODO-2026-020 tracks the Avalonia Explorer UX rollout」と現在形で案内したままである。
  - TODO-2026-019 は今回 TODO-2026-008 の `source_todo` として直接追跡されているため、archive 内の入口も現行統合先へ揃える方が一意である。
- 影響:
  - TODO-2026-019 から追跡した読者が、active todo に存在しない TODO-2026-020 で探索を一度中断し、別の archive entry を経由しないと現行 TODO-2026-008 へ到達できない。
- 推奨修正:
  - TODO-2026-019 の follow-up を、TODO-2026-020 は TODO-2026-008 へ統合済みであり、現行 rollout は TODO-2026-008 が追跡する、という表現へ更新する。

### IR-003: WBS の引き継ぎ説明が追加した WP-008A / TODO-2026-018 を包含していない

- 重大度: Low
- 状態: Open
- 根拠:
  - `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md:30` で `WP-008A` を追加し、source ID を TODO-2026-018 としている。
  - 同文書 `:58` は「各 work package は TODO-2026-003 から TODO-2026-012 に対応する」としたままであり、WP-008A / TODO-2026-018 を説明できない。
- 影響:
  - WBS の追跡規則と実際の work package 表が矛盾し、後続担当者が WP-008A を例外・補助項目・正式 work package のどれとして扱うか判断しにくい。
- 推奨修正:
  - 引き継ぎ説明を、WP-001 から WP-010 は TODO-2026-003 から 012、追加した WP-008A は TODO-2026-018 に対応する、と明示する表現へ更新する。

## 4. 重点確認結果

### 4.1 設計方針と直接依存

- TODO-2026-008 は TODO-2026-007、TODO-2026-009 / 018 は TODO-2026-008、TODO-2026-010 は TODO-2026-009 / 018、TODO-2026-011 は TODO-2026-010、TODO-2026-012 は TODO-2026-011 へ直接依存している。
- WBS も WP-005 → WP-006 → (WP-007 / WP-008A) → WP-008 → WP-009 → WP-010 と同じ依存を表現している。
- TODO-2026-023 / 025 は Avalonia baseline の依存に含まれず、TODO-2026-012 で採否を再評価する非 blocking 方針が todo、WBS、rollout spec、history で一致している。

### 4.2 統合 archive

- TODO-2026-024 → 023、TODO-2026-020 → 008、TODO-2026-015 → 009 の統合先、統合日、理由、移管 scope が archive に残されている。
- active dependency に TODO-2026-024 / 020 / 015 は残っていない。active todo の `integrated_todo` は統合履歴を示す metadata であり、依存としては扱われていない。
- 過去の change report / review / history は当時点の記録として変更していない。IR-002 は現行入口として使う archive 内案内だけの補正で足りる。

### 4.3 Source 追跡

- TODO-2026-007 の `source_todos` に TODO-2026-019 / 021 / 022 が記録されている。
- WP-005 は 019 を Explorer 統合判断の source、021 / 022 を baseline dependency ではない追加評価資料と明示している。
- TODO-2026-008 は TODO-2026-019 を直接 source として持つ。設計レビュー DR-002 の対応方針を満たしている。

### 4.4 Current / planned と確認範囲

- `README.md` / `basic_design.md` は rollout を planned と明記し、`detail_design.md` / `interface_spec.md` は本文が current implementation であることを冒頭で明示している。
- `tauri_ux_rollout_spec.md` も「現在の Avalonia 実装を説明する文書ではない」とし、未解決事項を実装時確認へ残している。
- trusted HTML は macOS 主要操作のみ confirmed、他 platform は follow-up、Explorer keyboard / ARIA は specified、Tauri settings Windows 保存は follow-up、image viewer の Avalonia 採用は deferred とされており、これらは既存記録に沿っている。
- Recent Folders の一括 `confirmed` だけは IR-001 の補正が必要である。

### 4.5 リンク・索引・history・docs-only

- 変更 13 Markdown files の相対 Markdown link target はすべて存在した。
- `docs/components/avalonia_viewer/README.md`、`docs/history/README.md` に新規 rollout / history 文書への入口が追加されている。
- `git diff --check 572771b^ 572771b`: 成功。
- `git diff --name-only 572771b^ 572771b` の変更は `.md` のみ。
- topic 配下に `diff.zip` は存在しない。
- build / test / manual verification を新規実行せず、既存 workflow 記録だけを根拠にした docs-only 境界は維持されている。

## 5. 承認可否と未解決件数

- 承認可否: **条件付き承認**
- Critical: 0
- High: 0
- Medium: 1
- Low: 2
- 未解決合計: 3

IR-001 から IR-003 を修正し、評価ラベル、archive の現行追跡先、WBS の work package 対応説明を再確認した後に承認可能とする。

## 6. Follow-up レビュー

### 6.1 確認対象

- 対応 commit: `26fd262` (`docs: address rollout specification review`)
- 再確認対象:
  - `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md`
  - `docs/todo/todo_archive_2026.md`
  - `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md`
  - `impl/tauri_ux_evaluation_avalonia_spec_impl.md`
- 確認日: 2026-07-27

### 6.2 指摘対応結果

#### IR-001: Recent Folders の評価ラベル

- 解決状態: Resolved
- 確認結果:
  - Recent Folders の評価が「主要操作 `confirmed`、境界仕様 `specified`」へ分割された。
  - entry 追加・削除・再オープンだけを確認済みとし、最大 10 件、重複昇格、missing path error、再起動復元は設計・実装レビューで確定しているが個別 PASS を推定しない、と明記された。
  - 既存 change report のユーザ確認範囲と評価ラベル定義が一致し、Avalonia 担当者が境界シナリオまで実機確認済みと誤認しない表現になった。
- 判定: 推奨修正を満たしており、解決済みとする。

#### IR-002: TODO-2026-019 archive の現行追跡先

- 解決状態: Resolved
- 確認結果:
  - TODO-2026-019 の Follow-up が、旧 TODO-2026-020 は TODO-2026-008 へ統合済みであり、現行 rollout は TODO-2026-008 で追跡する、と明記された。
  - 同 archive 冒頭の TODO-2026-020 integrated entry と整合し、TODO-2026-019 から現行 active todo へ一意に追跡できる。
- 判定: 推奨修正を満たしており、解決済みとする。

#### IR-003: WBS の WP-008A / TODO-2026-018 対応説明

- 解決状態: Resolved
- 確認結果:
  - WBS の引き継ぎ説明が、WP-001 から WP-010 は TODO-2026-003 から TODO-2026-012、追加 WP-008A は TODO-2026-018 に対応すると明示する形へ更新された。
  - WP-008A は WP-007 と並行可能で、WP-008 の前提を構成することも併記され、work package 表の直接依存と一致する。
- 判定: 推奨修正を満たしており、解決済みとする。

### 6.3 新規指摘

新規指摘なし。

### 6.4 再検証結果

- `git diff --check 26fd262^ 26fd262`: 成功。
- commit `26fd262` の変更対象 5 Markdown files の相対 link target存在確認: 成功。
- 評価ラベル、TODO-2026-019 archive 案内、WP-008A / TODO-2026-018 対応説明の相互整合: 問題なし。
- ソース、設定、スクリプト、fixture、runtime asset の変更追加なし。

### 6.5 最終判定

**承認**

IR-001 から IR-003 はすべて解決した。承認済み設計への適合、TODO / WBS の直接依存、3 組の統合 archive、TODO-2026-019 / 021 / 022 の source 追跡、Avalonia component docs の current / planned 分離、確認範囲の保守的な表現、リンク・索引・history、docs-only 境界を Phase 4 へ引き継げる状態である。

### 6.6 最終未解決件数

- Critical: 0
- High: 0
- Medium: 0
- Low: 0
- 未解決合計: 0
