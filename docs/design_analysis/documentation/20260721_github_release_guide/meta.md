---
title: "GitHub Release 配布手順書の追加"
created: "2026-07-21"
category: documentation
components:
  - release_documentation
  - root_readme
status: draft
design_status: draft
impl_status: not_started
completion_status: not_started
related_commits: []
---

# GitHub Release 配布手順書の追加

publish 済みの Avalonia 版と Tauri 版を GitHub Release からダウンロード可能にするための、リポジトリ固有の手順書を追加する。

## 対象

- `docs/release/README.md`
- ルート `README.md` のドキュメント索引
- documentation workflow の設計、実施記録、変更レポート

## 非対象

- publish スクリプト、GitHub Actions、アプリケーションコード、設定の変更
- コード署名、notarization、インストーラ生成処理の実装
- GitHub Release の実作成
