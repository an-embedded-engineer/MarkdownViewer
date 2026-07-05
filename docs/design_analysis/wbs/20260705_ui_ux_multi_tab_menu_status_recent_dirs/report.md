# UI/UX改善 WBS レポート

## 背景

`docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md` で、複数タブ、並べて表示、メニューバー、ステータスバー、最近開いたディレクトリの実現方法を調査した。調査結果では、現状の Avalonia / Tauri 両実装が単一ファイル表示を前提としており、UI 状態モデルとレイアウト変更が広範囲に及ぶことが確認された。

## 目的

大規模な UI/UX 改善を、通常 workflow 1 回で完了できる work package へ分解し、依存順序、完了条件、検証観点、docs 更新先を明確にする。

## 完了条件

- `wbs.md` に `WP-001` から `WP-010` までの work package が定義されている。
- 各 work package に推奨 workflow、依存、目的、完了条件、変更対象、docs 更新先、検証観点がある。
- `docs/todo/todo.md` に各 work package 対応の TODO が追加されている。
- Avalonia 版と Tauri 版を同時に実装しない方針と、その理由が明記されている。

## 非対象

- この WBS workflow 内での UI 実装。
- 各 work package の詳細設計。
- ビルド / UI 動作検証。

## 分解結果の要約

Tauri 版を先行実装し、UX 評価後に Avalonia 版へ適用する 10 work package に分解した。

- `WP-001` から `WP-004`: Tauri 版で MenuBar / StatusBar、Recent Folders、Multi-tab、Split view を段階実装する。
- `WP-005`: Tauri 先行実装の UX 評価を行い、Avalonia 反映仕様を確定する。
- `WP-006` から `WP-009`: Avalonia 版へ確定仕様を段階反映する。
- `WP-010`: 両実装の docs / todo / 残課題を最終同期する。

## Avalonia / Tauri を分ける判断

同時実装は推奨しない。Tauri 版を先行する。

理由:

- React / CSS の方が見た目と使い勝手を短いサイクルで調整しやすい。
- Avalonia 版は `NativeWebView` の扱い、XAML、ViewModel 状態管理の変更が大きく、UX 方針の揺れによる手戻りが大きい。
- Tauri で UX を評価した後に Avalonia へ適用すれば、比較実装として「共通仕様」と「stack 差分」を分けて記録しやすい。

## 最初に着手すべき work package

`WP-001: Tauri 版 MenuBar / StatusBar 導入`。

理由:

- 複数タブや split view の前に、操作領域と状態表示を分離できる。
- 既存の単一ファイル表示を維持したまま変更でき、後続の Recent Folders / TabStrip の配置先を作れる。
- 失敗時の影響範囲が Tauri frontend の UI 構造に限定される。

## ADR 候補

- OS native menu ではなくアプリ内 MenuBar を初期採用する判断。
- 複数タブを現在の root directory 内に限定する判断。
- Tauri 先行実装後に Avalonia へ反映する段階導入方針。
- 最近開いたディレクトリを app config JSON に保存する判断。

## 残リスク

- Tauri 先行 UX が Avalonia の `NativeWebView` 制約にそのまま適用できない可能性がある。
- split view の pane ごとの Mermaid / PlantUML 再描画は、Tauri と Avalonia で実装制約が大きく異なる。
- タブ overflow、Markdown 内リンクのタブ挙動、Recent Folders の削除 UI は各 package の設計時に最終確定が必要である。
- 各 package で docs 更新を怠ると、両実装の比較前提が崩れる。

## Todo 連携

`docs/todo/todo.md` に `TODO-2026-001` から `TODO-2026-010` を追加した。各 TODO は `wbs.md` の work package ID に対応する。
