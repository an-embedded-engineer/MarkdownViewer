# TODO 運用ガイド

## 目的

`spec-change` / `new-feature` / `refactoring` の追跡項目を管理する。

## 正本

- `docs/todo/todo.md`

## ID 規約

- `TODO-<YYYY>-<NNN>` 形式（例: `TODO-2026-001`）
- 年をまたぐ場合は新しい年の連番を使う

## ステータス

| ステータス | 意味 |
|-----------|------|
| `open` | 未着手 |
| `in_progress` | 作業中 |
| `done` | 完了（archive 待ち） |

## 完了時

- `todo_archive_<year>.md` へ移動する
- `meta.md` のステータスを更新する
