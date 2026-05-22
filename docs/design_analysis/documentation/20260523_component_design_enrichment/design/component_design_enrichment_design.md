# Avalonia / Tauri Viewer component design docs enrichment 設計

## 背景と目的

`docs/components/avalonia_viewer/` と `docs/components/tauri_viewer/` 配下の設計ドキュメントは、責務とサービス境界をテキストで述べるに留まっていた。
新規参入者やレビュア向けに、両実装の技術スタック・ディレクトリ構成・ソースコードとの対応関係・主要ふるまいを視覚的に把握できる形に拡充する。

## 対象文書と非対象

### 対象

- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/basic_design.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`

### 非対象

- `interface_spec.md` / `issues.md`（インターフェース仕様と既知課題は別途運用ルールで管理する）
- ソースコード、テンプレート、CI、ビルド構成
- `docs/architecture/` / `docs/adr/`

## 読者と利用場面

- 新規参入者: 技術スタックとディレクトリ構成、エントリーポイントを最短で把握する。
- 設計レビュア: 主要な状態管理・処理フロー・依存関係を視覚的に確認する。
- 既存メンバー: 機能追加・リファクタ時にソースコード対応表から該当箇所を引く。

## 更新方針

1. README.md には以下を追加する。
   - 技術スタック（Framework / Language / UI / Markdown / 図表 / OS連携）の一覧。
   - 主要ディレクトリ構成のツリー。
   - 主要要素の役割と対応するソースファイルのリンク。
2. basic_design.md には以下を追加する。
   - レイヤー構成図（PlantUML `component` 図）。
   - 依存方向図（PlantUML `package` 図または `component` 図）。
   - 状態モデル（PlantUML `state` 図、必要に応じて）。
3. detail_design.md には以下を追加する。
   - フォルダ選択〜Markdown表示までの主要シーケンス図（PlantUML `sequence` 図）。
   - PlantUML レンダリングのシーケンス図。
   - クラス図またはモジュール図（PlantUML `class` 図）。

PlantUML は `inline` で fenced code block `plantuml` として埋め込む。これは本プロジェクトの Markdown Viewer 自体が PlantUML プレビューに対応しているため、追加の図ファイルや画像書き出しを必要としない。

## 削除・統合・移動・archive の判断

- 既存記述は削除しない。**追記中心** とし、既存の責務記述・処理フロー記述は文意を保ったまま整理する。
- 構成変更や archive、文書統合は行わない。

## リンク、索引、重複、用語、履歴の確認観点

- `docs/components/<viewer>/README.md` から `basic_design.md` / `detail_design.md` / `interface_spec.md` / `issues.md` への既存リンクは維持する。
- 同一情報を複数文書に重複させない（例: 詳細フローは detail_design.md、概観は README.md、レイヤー責務は basic_design.md）。
- 用語は既存ドキュメント（`MainWindowViewModel` / `App.tsx` / `render_plantuml_diagrams` など）と一致させる。
- ソースコードに直接リンクする際は、本プロジェクトの Markdown Viewer 実装（Avalonia `HtmlTemplateService` の `<base href>`、Tauri `resolveSiblingPath`）と整合する「表示中 Markdown ファイルのディレクトリ基準」の相対リンクで記述する。VSCode 上の rendering とも齟齬しない。
- `docs/history/README.md` への記載は、テンプレート利用者へ影響しない docs-only 変更のため不要と判断する。

## レビュー方針

- 構成変更や archive を伴わない、既存文書への追記中心の更新であり、design / impl review は省略する。
- 省略理由は本 design および後続の `impl/<topic>_impl.md` に明記する。
- 用語整合・リンク検証・PlantUML fence の妥当性（プレビューを壊さない形式）は、impl Phase 中の自己検証で担保する。

## PlantUML 図の方針

- ファイルは `inline` に埋め込み、別ファイル化しない。
- 図の種別と配置:
  - `basic_design.md`: layer / dependency 図。
  - `detail_design.md`: sequence 図 (主操作 / PlantUML レンダリング) と class/module 図。
- スタイル指針:
  - `skinparam shadowing false` を共通設定とし、過度な装飾は避ける。
  - 図中のクラス・ファイル名は実体に一致させる（`MainWindowViewModel`、`App.tsx`、`lib.rs` など）。
  - 過度に大きい全体図は避け、責務単位で 1 図に分割する。
