---
title: "TODO-2026-007 Tauri 先行 UX 評価と Avalonia 反映仕様化"
created: "2026-07-27"
category: documentation
components:
  - docs/todo
  - docs/components/tauri_viewer
  - docs/components/avalonia_viewer
  - docs/design_analysis/wbs
status: draft
design_status: done
impl_status: not_started
completion_status: not_started
related_commits: []
---

# 対象整理

## 目的

Tauri 先行実装で確定した UX と既存のユーザ確認結果を評価し、Avalonia へ反映する共通仕様と stack 固有差分を文書化する。あわせて、Tauri 先行・Avalonia 追随として登録済みの todo work item を、実装責務と依存順序に基づいて統合・分割・並べ替える。

## 対象文書

- `docs/todo/todo.md`
- `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md`
- `docs/components/tauri_viewer/` と `docs/components/avalonia_viewer/` の関連文書
- 本 topic の design / impl / change report
- 必要な索引・履歴文書

## 想定読者と利用場面

- Avalonia 反映 work item の設計・実装担当者
- Tauri と Avalonia の UX 差分を評価する保守担当者
- todo の依存順序と workflow 境界を判断する担当者

## 非対象

- Tauri / Avalonia のソースコード、設定、スクリプト、runtime asset の変更
- アプリ起動を伴う新規 UX テスト
- Avalonia 各 work item の詳細実装設計
- Tauri Split View follow-up (`TODO-2026-023` から `TODO-2026-025`) の実装

## docs-only 判定

本 workflow では既存の設計、実装記録、ユーザ確認記録を根拠に文書と追跡項目だけを更新する。ソース変更や実行時挙動変更は含めない。文書整理中に実装変更が必要と判明した場合は、該当内容を別 todo として切り出し、この workflow では実装しない。
