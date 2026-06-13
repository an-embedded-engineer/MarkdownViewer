# PlantUML Loading UX Follow-up 実装レビュー

- **対象 topic**: TODO-2026-002 PlantUML Loading UX Follow-up
- **対象ブランチ**: `feature/plantuml-loading-ux-follow-up`
- **確認開始コミット**: `efb13db`
- **レビュー種別**: Phase 2/3 統合（設計 + 実装 + 恒久 docs を一括確認）
- **レビュー日**: 2026-06-14

---

## 1. Acceptance Criteria 充足確認

| # | 条件 | 判定 | 根拠 |
| --- | --- | --- | --- |
| AC-1 | Busy-state controls で重複レンダリング / stale preview が発生しない | ✅ 充足 | Avalonia: XAML で Open Folder / Theme / Reload / TreeView に `IsEnabled="{Binding !IsBusy}"` を付与。Tauri: `openFolder` / `reload` / `loadMarkdown` 冒頭に `isBusy` guard を追加し、Toolbar buttons と TreeNode を `disabled={isBusy}` で無効化。 |
| AC-2 | PlantUML pending が final error と視覚的に区別される | ✅ 充足 | Tauri: pending placeholder を `.plantuml-error` → `.plantuml-loading` に変更。CSS で `.plantuml-loading` は `--accent-text`（青系）/ `--accent-bg`、`.plantuml-error` は `--error-text`（赤系）/ `--error-bg` と色系統を分離。light / dark 両テーマで定義済み。 |
| AC-3 | loading state 仕様が component detail design に反映されている | ✅ 充足 | Avalonia detail_design.md: `IsBusy` 説明に "Toolbar / Explorer を無効化する" を追記。UI レイアウト節に semi-transparent overlay と操作抑止を明記。Tauri detail_design.md: `isBusy` 行をステート表に追加。処理フロー Step 6・再描画方針・エラーハンドリング表を更新。 |
| AC-4 | Avalonia build / Tauri frontend build / Tauri Rust check が通過する | ✅ 充足 | impl 文書に `dotnet build` / `npm run build` / `cargo check` の成功を記録。変更は XAML binding と CSS / TSX の小局所変更のみで、build を壊す要因がない。 |

**判定: 全 Acceptance Criteria 充足。**

---

## 2. 設計妥当性（Phase 2 観点）

### 2-1. 採用案の妥当性

- 既存の `IsBusy` / `isMarkdownLoading` / `isPlantUmlRendering` を制御点として再利用し、新たな状態機械を導入しない方針は妥当。
- Avalonia で `IsBusy` の制御パスを XAML binding で完結させた点は VM の責務を広げず良い選択。
- Tauri で `isBusy` を `isMarkdownLoading || isPlantUmlRendering` のシンプルな OR で集約した点も、今回の要求（重複操作防止）に対して十分。

### 2-2. 不採用案の選択

- busy 中キャンセル・文言のみ区別・別 UI の 3 案をいずれも説明付きで不採用としており、判断根拠が追跡できる。問題なし。

### 2-3. リスク記述

- 長時間レンダリング中の待機専一化・aggregate 表示による個別進捗非表示の両リスクが設計文書に明記されており、レビュー時点で許容範囲と判断できる。

---

## 3. 実装整合性（Phase 3 観点）

### 3-1. Avalonia

- `IsEnabled="{Binding !IsBusy}"` が Open Folder / Theme / Reload / TreeView の 4 箇所すべてに付与されており、設計意図と一致。
- overlay の `Background="#00000018"` は alpha 値が非常に小さく（約 9% 不透明）、プレビュー内容が透けて見える semi-transparent 要件を満たす。
- 既存の `ProgressBar IsVisible="{Binding IsBusy}"` は変更なしで引き続き機能する。

### 3-2. Tauri ロジック

- `isBusy` は `useState` ではなく派生値 (`const isBusy = ...`) として算出されており、stale reference の懸念がない。
- `openFolder` / `reload` / `loadMarkdown` の 3 関数すべてに早期リターン guard が付いている。
- `handlePreviewClick` → `loadMarkdown` の経路も `loadMarkdown` 内の guard で保護される。
- `loadMarkdown` は `finally` で `setIsMarkdownLoading(false)` を確実に呼ぶため、例外時にも busy 状態が固着しない。
- `loadRoot` には独立した `isBusy` guard がない。現在の呼び出し元は `openFolder` だけで、そこで guard 済みのため安全。将来の呼び出し元が増える場合は追加を推奨するが、**今回のスコープでは許容範囲**。

### 3-3. Tauri スタイル

- `.plantuml-loading` は `border-color` のみをオーバーライドしており、親の `.markdown-body pre` から border 幅・スタイルと `border-radius` を継承する。意図通りの最小変更。
- `--accent-text` / `--accent-bg` は `.app-shell` の light セクションと `:root[data-theme="dark"] .app-shell` の両方に定義されており、テーマ切替で色変数が欠落しない。

### 3-4. `loadingMessage` の網羅性

`isMarkdownLoading && isPlantUmlRendering` が同時に `true` になる経路は、`loadMarkdown` の try ブロック内で `setSelectedMarkdown` / `setPreviewRevision` を呼んだ後（PlantUML useEffect が発火）、`finally` の `setIsMarkdownLoading(false)` が来るまでの間に存在する。この状態では "Loading Markdown and rendering PlantUML diagrams..." が表示される。ロジックとして正しく、ユーザへの情報提供としても適切。

---

## 4. 恒久 docs の反映確認

| ファイル | 更新内容 | 評価 |
| --- | --- | --- |
| `docs/components/avalonia_viewer/detail_design.md` | `IsBusy` 補足に Toolbar/Explorer 無効化を追記。UI レイアウト節に semi-transparent overlay と操作防止を明記。 | ✅ 実装と一致 |
| `docs/components/avalonia_viewer/README.md` | テーブル区切り記法統一・ディレクトリブロック言語タグを `text` に修正（整形のみ）。 | ✅ |
| `docs/components/tauri_viewer/detail_design.md` | `isBusy` 行を追加。Step 6 を `.plantuml-loading` に更新。再描画方針・エラーハンドリング表を更新。 | ✅ 実装と一致 |
| `docs/components/tauri_viewer/README.md` | `App.css` 行に `.plantuml-loading` を追記。テーブル区切り記法統一・`text` タグ修正。 | ✅ |

**軽微な指摘**: Tauri detail_design.md のステート表で `isBusy` が `useState` 項目として列挙されているが、実装上は `const isBusy = isMarkdownLoading || isPlantUmlRendering` の派生値であり、React state ではない。"補足" 列に "（derived: `isMarkdownLoading OR isPlantUmlRendering`）" 旨を追記するとより正確になる。機能正確性には影響しない軽微事項として、必須対応ではなく**推奨対応**とする。

---

## 5. 残課題・ポテンシャル問題

### 5-1. 軽微（推奨対応）

| ID | 内容 | 対象ファイル |
| --- | --- | --- |
| R-01 | `isBusy` は React state ではなく派生値のため、ステート表の "補足" 列に派生式を記載すると正確さが増す | `docs/components/tauri_viewer/detail_design.md` |

### 5-2. 情報共有（対応不要）

| ID | 内容 |
| --- | --- |
| I-01 | `loadRoot` に独立した `isBusy` guard がないが、現在の呼び出し元 `openFolder` が guard 済みのため安全。将来拡張時に留意。 |
| I-02 | Vite の chunk size warning は既存課題であり今回の変更とは無関係（impl 文書で補足済み）。 |
| I-03 | `markdownlint-cli2` の MD013 超過は今回の UX 変更とは別系統のドキュメント整形課題（impl 文書で補足済み）。 |

---

## 6. 総合評価

- **Acceptance Criteria**: 全 4 項目を充足。
- **設計妥当性**: 既存アーキテクチャを最小限の変更で改善する方針が一貫しており妥当。
- **実装整合性**: 設計文書と diff の内容が一致。ロジックの欠損・矛盾なし。
- **恒久 docs**: 両 viewer の README / detail_design が実装を正確に反映。
- **build/check**: 3 コマンドすべて成功（impl 文書記録済み）。

**必須対応の残課題なし。推奨対応 R-01 は次のドキュメント更新機会で対応を検討してください。**

**本レビューはこれをもって Phase 2/3 統合レビュー完了とします。**
