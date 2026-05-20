# Issue 運用ガイド

## 目的

`bugfix` / `issue-resolution` の追跡項目を管理する。

## 配置ルール

- `docs/issues/` 配下に issue ファイルを配置する
- ファイル名: `issues.md` または機能カテゴリ別に分割

## ID 規約

- `C-<YYYY>-<NNN>` 形式（例: `C-2026-010`）
- 年をまたぐ場合は新しい年の連番を使う

## ステータス

| ステータス | 意味 |
|-----------|------|
| `open` | 未着手 |
| `in_progress` | 作業中 |
| `resolved` | 解決済み |

## 完了時

- issue のステータスを `resolved` に更新する
- `meta.md` に達成根拠を記録する
- archive 方針に従って整理する
