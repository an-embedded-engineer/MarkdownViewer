# 設計分析・レビュー文書 運用ガイド

## 目的

設計/実装/レビュー文書の配置・命名・更新ルールを統一する。

## ディレクトリ構成

```
docs/design_analysis/
├── spec_change/           — 仕様変更
├── new_feature/           — 新機能追加
├── fix_issues/            — 不具合修正
├── issue_resolution/      — 課題解決
├── refactoring/           — リファクタリング
├── documentation/         — ドキュメント更新・整理
├── wbs/                   — 大規模変更の作業分解
└── research_analysis/     — 調査・分析
```

## 課題ディレクトリ命名

```
<category>/<YYYYMMDD>_<slug>/
```

例: `spec_change/20260315_update_api_contract/`

## 標準ファイル構成

core workflow topic は 4 ゲート構成を標準とする。
要求、範囲、採否理由、リスク、テスト観点は Phase 2 の `design/` 文書へ記録する。

```
<YYYYMMDD>_<slug>/
├── design/
│   └── <topic>_design.md
├── impl/
│   └── <topic>_impl.md
├── review/
│   ├── <topic>_design_review.md
│   ├── <topic>_impl_review.md
│   └── <topic>_completion_review.md  # optional
├── diff.zip  # ソース変更がある場合は必須
├── change_report.md
└── meta.md
```

`<topic>_completion_review.md` は、archive / history / merge 前確認が重い場合だけ作成する。
`report.md` は research-analysis / WBS など、workflow 固有の調査・計画レポート名として使う。

## WBS ファイル構成

```
<YYYYMMDD>_<slug>/
├── wbs.md
├── report.md
└── meta.md
```

## meta.md テンプレート

```yaml
---
title: "<課題タイトル>"
category: "<spec_change|new_feature|fix_issues|issue_resolution|refactoring|documentation|wbs|research_analysis>"
created: "<YYYY-MM-DD>"
components: []
status: "<draft|implemented|merged>"
design_status: "<draft|in_review|done>"
impl_status: "<not_started|draft|in_review|done>"
completion_status: "<not_started|in_progress|done>"
related_commits: []
---
```

## 運用ルール

1. 課題ディレクトリは日付プレフィックスで一意に識別する
2. core workflow topic では `design_status` / `impl_status` / `completion_status` を更新する
3. レビュー文書は `review/` ディレクトリに配置する
4. core workflow topic の差分・変更レポートは `change_report.md` として課題ディレクトリ直下に配置する。ソース変更を含む場合は `diff.zip` も必須とし、ドキュメント更新や調査のみなどソース以外の変更だけの場合は `diff.zip` を省略してよい
5. 調査・分析は `research_analysis/` に配置する（workflow Phase を伴わない）
6. core workflow の `related_commits` は completion Phase で主要 commit をまとめて記録する。research / 多段レビュー topic は従来通り round 単位で記録してよい
7. 大規模変更は `wbs-planning-workflow` で作業単位へ分解してから、各 work package を通常 workflow で扱う
