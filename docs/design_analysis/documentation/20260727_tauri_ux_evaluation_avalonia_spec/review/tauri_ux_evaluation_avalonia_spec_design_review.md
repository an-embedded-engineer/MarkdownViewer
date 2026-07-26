# Tauri 先行 UX 評価と Avalonia 反映仕様化 設計レビュー

## 1. レビュー対象

- 設計文書: `docs/design_analysis/documentation/20260727_tauri_ux_evaluation_avalonia_spec/design/tauri_ux_evaluation_avalonia_spec_design.md`
- 追跡文書: `docs/todo/todo.md`, `docs/todo/todo_archive_2026.md`
- WBS: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md`
- component docs: `docs/components/tauri_viewer/`, `docs/components/avalonia_viewer/`
- workflow 境界: `documentation-workflow` Phase 2

レビューでは、TODO の統合判断、Avalonia 実装の依存順、Tauri Split View follow-up の非 blocking 性、既存参照と archive の維持、docs-only 境界を重点確認した。

## 2. 総合判定

**条件付き承認**

TODO-2026-023 / 024、TODO-2026-008 / 020、TODO-2026-009 / 015 の統合は、変更する状態・UI・永続化境界が重なるため妥当である。TODO-2026-018 を Multi-tab より先行させ、TODO-2026-010 と TODO-2026-011 を分離する判断も、typed document model と複数 NativeWebView lifecycle の手戻りを抑える順序として妥当である。

Tauri TODO-2026-023 / 025 を Avalonia の左右 2 pane baseline の完了条件に含めず、TODO-2026-012 で採否または follow-up 状態を再評価する方針も、現行 TODO-2026-006 の完了記録と整合する。docs-only 境界、未実施 matrix を成功扱いしない根拠レベル、planned contract と現行仕様を区別する方針にも blocking な問題はない。

ただし、Phase 3 で todo / WBS を機械的に一意に更新できるよう、次の 2 件を設計へ反映する必要がある。

## 3. 指摘事項

### DR-001: 更新後の直接依存関係が一意に定義されていない

- 重大度: Medium
- 状態: Open
- 根拠:
  - 設計 6.4 は TODO-2026-018 を TODO-2026-008 後、TODO-2026-010 前とし、TODO-2026-010 を TODO-2026-018 に依存させるとしている。
  - 設計 7 は TODO-2026-009 と TODO-2026-018 を並行可能とし、その後に TODO-2026-010 を置いている。
  - 現行 `docs/todo/todo.md` では TODO-2026-010 が TODO-2026-008 / 009 / 015 に依存し、TODO-2026-015 は TODO-2026-009 へ統合予定である。
  - このため、統合済み ID を除去した後の TODO-2026-010 が `TODO-2026-009, TODO-2026-018` の両方へ直接依存するのか、TODO-2026-018 だけへ依存するのかを、設計本文だけから一意に決められない。WBS の WP-008 も同じ曖昧さを持つ。
- 影響:
  - TODO と WBS の一方だけが設定基盤の完了を待つ、または HTML typed model の完了を待たない依存グラフになる可能性がある。
  - `TODO-2026-018 → 010 → 011` の意図は満たしていても、統合した TODO-2026-009 の完了条件が Multi-tab の前提から脱落し得る。
- 推奨修正:
  - 設計へ「更新後の直接依存」表を追加し、少なくとも次を明記する。
    - TODO-2026-008: TODO-2026-007
    - TODO-2026-009: TODO-2026-008
    - TODO-2026-018: TODO-2026-008
    - TODO-2026-010: TODO-2026-009, TODO-2026-018
    - TODO-2026-011: TODO-2026-010
    - TODO-2026-012: TODO-2026-011
  - TODO と WBS の両方をこの直接依存へ同期し、TODO-2026-015 / 020 / 024 を active dependency に残さないことを完了条件へ含める。

### DR-002: 拡張した UX 評価対象と完了案件の追跡関係が不足している

- 重大度: Low
- 状態: Open
- 根拠:
  - 設計 5 は Explorer UX、Responsive preview、Image viewer を評価対象とし、それぞれ TODO-2026-019 / 021 / 022 の完了記録を根拠にする方針である。
  - 特に TODO-2026-020 を TODO-2026-008 へ統合する判断は、完了済み TODO-2026-019 の Tauri 先行 UX を直接引き継ぐ。
  - 一方、現行 TODO-2026-007 の `depends_on` と WBS WP-005 の `depends_on` / completion scope は TODO-2026-019 / 021 / 022 を含まず、設計 10 も統合済み ID の参照確認は定義しているが、評価対象へ追加した完了案件の追跡更新を明示していない。
- 影響:
  - 後から TODO-2026-007 / WP-005 だけを参照した担当者が、Explorer / responsive preview / image viewer の評価根拠と、この workflow で採否判断した範囲を復元しにくい。
- 推奨修正:
  - TODO-2026-007 と WBS WP-005 の source / dependency / completion のいずれか一貫した欄で、TODO-2026-019 / 021 / 022 が追加評価根拠であることを明示する。
  - 最低限、統合判断へ直結する TODO-2026-019 は明示的に追跡する。
  - TODO-2026-021 / 022 を dependency としない場合は、baseline の gate ではなく追加の評価資料であるため source reference に留める、と設計に理由を記録する。

## 4. 重点確認結果

### 4.1 統合・分割判断

- TODO-2026-023 + 024: 妥当。pane-local ownership と pane 間移動は ordered tab IDs、active fallback、focus、pane runtime identity を同じ transition 境界で変更する。明示操作と keyboard 到達性を統合後 scope に残している。
- TODO-2026-008 + 020: 妥当。Window shell grid、Explorer / Preview 境界、StatusBar と後続 workspace の土台を同時に固定できる。TODO-2026-020 の完了条件と TODO-2026-019 の source reference を統合先へ移す方針も適切である。
- TODO-2026-009 + 015: 妥当。Recent Folders と Viewer settings は user config schema、load/save、migration、lost-update 防止、Settings UI 配線を共有するため、単一 workflow の方が整合を保ちやすい。
- TODO-2026-010 と 011 の分離維持: 妥当。document collection と複数 WebView host / pane-local runtime はリスク境界が異なる。
- TODO-2026-025 の分離維持: 妥当。orientation と axis size policy は tab ownership と別の検証単位である。

### 4.2 依存順

TODO-2026-018 で Explorer / open document を Markdown / HTML の typed model へ一般化してから TODO-2026-010 の tab collection を導入し、TODO-2026-011 で複数 host と pane runtime を追加する `018 → 010 → 011` は妥当である。DR-001 の直接依存表を追加すれば、TODO と WBS の同期方針も十分になる。

### 4.3 Tauri follow-up の非 blocking 性

妥当。TODO-2026-006 の change report では single / 左右 2 pane、pane-local selection / runtime、active pane routing が完了し、TODO-2026-023 / 024 / 025 は追加 UX として明確に分離されている。Avalonia TODO-2026-011 はこの baseline を反映でき、pane-local tab ownership や上下 split を待つ技術的必然性はない。

### 4.4 既存参照・archive 運用

元 ID を再利用せず、統合済み entry を archive に残し、active dependency からのみ除去する方針は妥当である。Phase 3 では archive entry を実装完了と誤認させないため、`Status: integrated`、統合先 ID、統合日、移管 scope / completion、元の source / WBS 情報を残すことが望ましい。過去の change report、review、history は当時点の記録として書き換えず、必要な現行入口から archive または統合先へ案内する。

### 4.5 docs-only 境界

妥当。設計はソース、設定、スクリプト、fixture、runtime asset、アプリ起動、新規 platform matrix、各 TODO の詳細実装設計を対象外としている。Avalonia component docs へ追加する内容も `planned / common / adapted / deferred` として現在実装から分離する。Phase 3 でソース変更が必要になった場合は documentation-workflow を中止し、各 active TODO の core workflow へ引き継ぐ必要がある。

## 5. 未解決件数と承認条件

- Critical: 0
- High: 0
- Medium: 1
- Low: 1
- 未解決合計: 2

DR-001 と DR-002 を設計へ反映し、レビュー担当が対応内容を確認した後に承認可能とする。
