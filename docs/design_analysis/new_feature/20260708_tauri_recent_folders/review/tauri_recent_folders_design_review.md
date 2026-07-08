# Tauri Recent Folders 導入 設計レビュー

**レビュー日**: 2026-07-08
**再確認日**: 2026-07-08
**対象ドキュメント**: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/design/tauri_recent_folders_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-004
**対象 WBS**: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md` WP-002
**初回レビュー対象コミット**: `8b4ab06 Phase 2 draft Tauri recent folders design`
**再確認対象コミット**: `25d3082 Phase 2 address Tauri recent folders design review`
**判定**: **承認 (Approved)**。Phase 3 進行可。

---

## 概要

TODO-2026-004 (Tauri Recent Folders 導入) の Phase 2 設計レビュー。React MenuBar dropdown 化 + Rust app config JSON command という採用案を、`docs/todo/todo.md` / `wbs.md` の受け入れ条件トレース、既存コード (`markdown-viewer-tauri/src/App.tsx` / `src-tauri/src/lib.rs`) との整合、`docs/components/tauri_viewer/*` 恒久ドキュメントとの整合、最大件数・重複更新・削除・存在しない path・config 破損・再起動復元の境界条件、Phase 3 ドキュメント更新予定の観点で検証した。

---

## 1. 齟齬・不整合

### 1.1 追加 command 一覧が設計書内で自己矛盾している

**ドキュメント記載**: 「影響範囲 > Backend」(design 104-113 行) は追加 command として次を列挙する。

```text
load_recent_folders() -> Result<Vec<RecentFolderEntry>, String>
save_recent_folders(entries: Vec<RecentFolderEntry>) -> Result<(), String>
remove_recent_folder(path: String) -> Result<Vec<RecentFolderEntry>, String>
必要に応じて validate_recent_folder(path: String) -> Result<String, String>
```

一方「設計方針 > Command 境界」(design 229-243 行) は次を最終方針として明記する。

```text
load_recent_folders() -> Result<Vec<RecentFolderEntry>, String>
record_recent_folder(path: String) -> Result<Vec<RecentFolderEntry>, String>
remove_recent_folder(path: String) -> Result<Vec<RecentFolderEntry>, String>
```

同じ節でさらに「`save_recent_folders(entries)` は frontend が list 正本を持つ設計になりやすく、path canonicalization と最大件数の責務が分散するため採用しない」と明記し、`save_recent_folders` を明示的に不採用としている。`validate_recent_folder` についても Command 境界節では触れられておらず、採否が宙に浮いている。

**差異**: 同一ドキュメント内で command 一覧が二重に定義され、後段が前段を否定する構成になっている。「影響範囲」を先に読んだ実装者が `save_recent_folders` を実装してしまう、または `validate_recent_folder` の要否で作業が止まるおそれがある。レビュー観点「`record_recent_folder` / `remove_recent_folder` へ list 更新を寄せる方針が、重複実装や不要な fallback を避けているか」に照らすと、方針自体は妥当だが記載が矛盾しており、この観点を文書上で満たせていない。

**推奨対応**: 「影響範囲 > Backend」の command 一覧を「設計方針 > Command 境界」と同じ `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` に揃え、`save_recent_folders` の記載を削除する。`validate_recent_folder` は不要と判断しているなら「既存 `scan_directory` の検証を利用し、専用 command は追加しない」と明記して削除する。

**severity**: High

### 1.2 app config JSON の読み書きに対する排他制御が未設計

**ドキュメント記載**: 「永続化」(design 205-227 行) と「Command 境界」(design 229-243 行) は `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` をそれぞれ「JSON を読み込み→更新→書き込み」する独立した command として記述する。「既存機能との統合」(design 245-260 行) では `loadRoot` が `scan_directory` 成功後・`loadMarkdown` 完了後に `record_recent_folder` を呼ぶ流れが書かれているが、この呼び出し中に `isBusy` を true に保つ、または command 呼び出しを直列化する仕組みには触れていない。

**差異**: 現行実装 (`App.tsx:64` `isBusy = isMarkdownLoading || isPlantUmlRendering`、`App.tsx:139,153` の `isMarkdownLoading` は `try/finally` で `loadMarkdown` の内側だけを覆う) と設計の記述を合わせると、`loadRoot` 内の `record_recent_folder` 呼び出しは `loadMarkdown` 完了 (=`isMarkdownLoading` が false に戻った) 後に発生し得る。つまり MenuBar / Explorer が再度操作可能になった状態で `record_recent_folder` の書き込みがまだ進行中というウィンドウが生まれる。この間にユーザーが `Open Folder` を再実行して 2 件目の `record_recent_folder` が走る、または Recent Folders から `remove_recent_folder` を実行すると、Rust 側は各 command が独立に読み込み→更新→書き込みを行うため、後着の書き込みが先着の更新を上書きする典型的な read-modify-write レースが発生し得る。これは受け入れ条件「最大件数、重複更新、削除…が機能する」を損なう可能性がある実装リスクだが、設計書には `Mutex` / `tauri::State` 等でファイルアクセスを直列化する方針が一切記載されていない。

**推奨対応**: 「Command 境界」または「永続化」に、app config JSON の読み込み→更新→書き込みをアプリ内で直列化する方針 (例: `tauri::State<Mutex<()>>` または設定専用の in-memory キャッシュ + 単一書き込みロック) を明記する。最小構成として「3 command はすべて共有 `Mutex` を取得してから読み書きする」の一文でも可。

**severity**: Medium

### 1.3 `RecentFolderEntry.name` の表示上の正本が未確定

**ドキュメント記載**: データモデル (design 166-194 行) は frontend / Rust の双方に `name` / `name` フィールドを持つ。一方「既存類似ロジックとの抽象化・共通化方針」(design 278-284 行) は「path display は既存 `getFileName` を recent entry basename にも再利用する」と記載する (`getFileName` は `App.tsx:704` の既存関数)。「UI / 操作導線」(design 156 行) も「entry 表示は folder basename を主表示…basename が取れない場合は path 全体を使う」とだけ書かれ、`entry.name` (永続化された値) と `getFileName(entry.path)` (都度導出する値) のどちらを表示に使うかを明示していない。

**差異**: この 2 つは同じ値になるとは限らない。`name` は record 時点のフォルダ名のスナップショットであり、record 後にユーザーが OS 側でフォルダをリネームしても永続化済みの `name` は古いままになる。`getFileName(entry.path)` は表示のたびに再計算するため常に最新の basename (ただし現物が存在しない場合は path 文字列由来の推測値) になる。どちらを採用するかで「リネーム後の表示」という境界条件の挙動が変わるため、Phase 3 実装者が両者を無意識に混在させる (Rust 側で `name` を計算するロジックと frontend の `getFileName` が微妙に異なる分割規則を持つ) リスクがある。

**推奨対応**: 「entry 表示は `entry.name` (record 時点のスナップショット) を用いる」または「`entry.name` は表示に使わず、常に `getFileName(entry.path)` で都度導出する」のいずれかを明記する。前者を選ぶ場合はリネーム後に表示が古びる既知の挙動として「失敗時動作とデフォルト挙動」に一行追記する。

**severity**: Medium

---

## 2. ドキュメント不足

### 2.1 恒久ドキュメントの「ドロップダウンを導入しない」という既存記載への訂正方針が明記されていない

**該当箇所**: `docs/components/tauri_viewer/detail_design.md` の「UI レイアウト」(321 行) は現行仕様として「`MenuBar` は React アプリ内の常時表示ボタン群であり、`File` / `View` はグループラベルとして扱う。ドロップダウン、`role="menubar"` / `role="menuitem"`、矢印キー移動、フォーカストラップは導入しない」と明記している。これは TODO-2026-003 の Phase 2 設計レビューで確定した記述である。

**差異**: 今回の設計は `role="menu"` / `role="menuitem"` を持つドロップダウン UI を明示的に採用しており (design 158-165 行)、`detail_design.md` の上記記述と正面から矛盾する。「恒久ドキュメント更新予定先」(design 293-304 行) は `detail_design.md` に対して「MenuBar dropdown、Recent Folders state、app config JSON、失敗時動作を追記」とだけ記載しており、「追記」という表現では既存の「導入しない」という否定文が残ったまま新しい肯定文が並記され、ドキュメントが自己矛盾したままになるおそれがある。

**推奨対応**: Phase 3 の docs 更新予定に「`detail_design.md` の『ドロップダウン…導入しない』の一文を、新しい dropdown 方式の記述で置き換える (追記ではなく修正)」と明記する。同様に `README.md` / `basic_design.md` / `interface_spec.md` 内に同種の否定文が残っていないか Phase 3 冒頭で確認する。

**severity**: Low

---

## 3. 改善提案

### 3.1 Markdown ファイルが 1 つもない root を開いた場合の recent 記録有無が未記載

**該当箇所**: 「既存機能との統合」(design 245-260 行) は `record_recent_folder` を「`scan_directory` 成功後」に呼ぶと記載し、「initial markdown の読み込みに失敗した場合の扱い」(design 257-260 行) は read_text_file 失敗時も recent entry を保存対象にすると明記している。しかし `loadRoot` (`App.tsx:94-113`) には `findReadme` / `findFirstMarkdown` がともに `null` を返す (Markdown ファイルが 1 つもない) 分岐があり、この場合は `loadMarkdown` 自体が呼ばれない。この分岐で `record_recent_folder` を呼ぶかどうかが設計書に明記されていない。

**推奨対応**: 「`record_recent_folder` は `scan_directory` 成功直後に呼び、initial markdown の有無や成否に関わらず実行する」という一文を「既存機能との統合」に追記し、初期表示ファイルの有無で recent 記録の可否が変わらないことを明確にする。

**severity**: Low

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| `Recent Folders` が OS 標準 menu、またはウィンドウ top の MenuBar dropdown として `File` 配下に表示・実行できる | 「採用案」「UI / 操作導線」(design 41-72, 125-165 行) | ✓ 整合。meta.md の MenuBar Direction とも一致 |
| `Open Folder` / `Reload` / `Recent Folders` が MenuBar から利用でき、busy 中は重複操作が抑止される | 「UI / 操作導線」(design 148-156 行) | ✓ 整合。既存 `isBusy` disabled パターンを踏襲 |
| root open 成功時に最近開いたディレクトリが保存される | 「Command 境界」「既存機能との統合」(design 229-260 行) | △ 概ね整合だが、no-markdown 分岐の記載漏れ (3.1) あり |
| 最大件数、重複更新、存在しない path のエラー、削除 UI が機能する | 「データモデル」「永続化」「失敗時動作」(design 196-271 行) | △ 概ね整合だが、command 一覧の自己矛盾 (1.1) と排他制御の欠落 (1.2) が残るため、実装後にこの条件が壊れるリスクがある |
| 再起動後も一覧が復元される | 「永続化」(design 205-221 行) | ✓ 整合 |
| 既存の root path strip、Explorer、Markdown preview、Mermaid、PlantUML、ErrorBanner、StatusBar の動作が退行しない | 「既存機能との統合」「失敗時動作」(design 245-271 行) | ✓ 整合。`loadRoot` / `loadMarkdown` の既存契約を変更しない方針が明記されている |

WBS (`wbs.md` WP-002) の `completion_criteria` および `deferred_or_follow_up` (localStorage 不採用) とも齟齬なし。

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| MenuBar を OS native にせず window-top dropdown を許容する判断が meta.md の MenuBar Direction / todo.md の scope と一致する | ✓ 整合 |
| Before/After (design 73-88 行) が、TODO-2026-003 で確定済みの「MenuBar はドロップダウンを持たない常時表示ボタン群」という既存前提を明示的に置き換えていることを自覚的に記載している | ✓ 整合。ただし恒久ドキュメント側の修正方針は 2.1 の通り不足 |
| React state (表示・操作) と Rust command (永続化・path 検証) の責務分離が既存アーキテクチャ (`docs/components/tauri_viewer/basic_design.md` の依存方向) と一致する | ✓ 整合 |
| Recent Folders 永続化を app config JSON に置く判断が、WBS 論点 3 (`localStorage は不採用`) と一致する | ✓ 整合 |
| 最大件数 (`MAX_RECENT_FOLDERS = 10`) と canonicalize による重複判定・先頭移動ロジックが、フロントエンドに重複実装されず Rust command に集約されている | ✓ 整合 (design 198-203, 239 行) |
| 既存 `normalize_path` (`lib.rs:196-199`) の再利用方針が既存コードと矛盾しない | ✓ 整合。`canonicalize()` は record 対象の path が実在する前提と合致する |
| config 破損時に自動上書きしない方針が、リスク表 (design 336-340 行) にも既知制約として記録されている | ✓ 整合 |
| Phase 3 恒久ドキュメント更新予定先 (README / basic_design / detail_design / interface_spec) が明記されている | ✓ 整合 (更新方法の精度は 2.1 で指摘) |
| Phase 2 コミット (`8b4ab06`) が設計書 / meta.md のみの docs-only 差分である | ✓ 整合。実装コード変更は含まれていない |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 高 | 1.1 command 一覧の自己矛盾 | Phase 3 実装者がどちらの command 一覧に従うべきか判断できず、不要な `save_recent_folders` 実装や手戻りに直結する |
| 中 | 1.2 app config JSON の排他制御未設計 | 受け入れ条件「重複更新、削除…が機能する」を壊しうる read-modify-write レースが未対策 |
| 中 | 1.3 `name` 表示の正本未確定 | リネーム後の表示挙動という境界条件が Phase 3 の実装依存になる |
| 低 | 2.1 恒久ドキュメントの訂正方針未記載 | 「追記」のみでは既存の否定文と新方針が併存し、docs が自己矛盾したまま残る |
| 低 | 3.1 no-markdown root の recent 記録有無 | 発生頻度は低いが、受け入れ条件の網羅性に影響する |

---

## 7. 残リスク / Phase 3 での注意点

- 1.1 の command 一覧統一は文言修正のみで完了するため、Phase 3 着手前に必須で対応すること。
- 1.2 の排他制御は、`record_recent_folder` / `remove_recent_folder` を同一の `Mutex` 経由にするだけで解決できる規模だが、実装を怠ると手動確認 (「同じ folder を再度開くと重複せず先頭に移動する」「削除」) が偶発的に失敗する再現困難なバグになりやすいため、Phase 3 の実装レビューで直列化の有無を明示的に確認する。
- 1.3 は実装判断がどちらでも受け入れ条件を満たせるため、設計書に一文追記した上で Phase 3 に進めてよい。
- リスク表に記載済みの「native menu を採用しないことへの UX 差」「config JSON 破損時の手動復旧」は Phase 4 の UX 評価・手動確認でそのまま踏襲する。
- 2.1 の恒久ドキュメント修正は、Phase 3 で `detail_design.md` / `README.md` / `basic_design.md` / `interface_spec.md` を横断的に grep し、「ドロップダウン」「導入しない」等の否定文が残っていないか確認してから完了とすること。

---

## 8. 結論

設計は TODO-2026-004 の受け入れ条件を概ね反映しており、React dropdown MenuBar + Rust app config command という採用案は WBS の localStorage 不採用方針、既存 `App.tsx` / `lib.rs` の責務分離、TODO-2026-003 で確定した MenuBar 仕様からの意図的な転換のいずれとも整合する。不採用案の比較や既存類似ロジック (`normalize_path` / `getFileName`) の再利用方針も明記されており、設計全体の採用案・対象範囲・非対象を覆すような欠陥はない。

一方で、追加 command 一覧が設計書内 (「影響範囲」と「Command 境界」) で自己矛盾しており (1.1, High)、app config JSON への同時書き込みに対する排他制御が未設計 (1.2, Medium)、`RecentFolderEntry.name` の表示上の正本が未確定 (1.3, Medium) という 3 点は、いずれも受け入れ条件「重複更新、削除…が機能する」に直結しうる。これらは設計方針自体の変更ではなく記載の統一・追記で解消できる規模のため、**条件付き承認**とする。Phase 3 着手前に 1.1 (command 一覧統一) を設計書へ反映し、1.2 / 1.3 は Phase 3 detail design 内で確定させた上で実装へ進めること。2.1 / 3.1 は Phase 3 の docs 反映時に併せて解消すればよい。

初回レビューでは、Phase 3 着手前に 1.1 (command 一覧統一) を設計書へ反映することを必須条件、1.2 (排他制御) / 1.3 (`name` 表示の正本) を Phase 3 detail design 内での確定で可、2.1 (恒久ドキュメント訂正方針) / 3.1 (no-markdown root の recent 記録) を Phase 3 docs 反映時の解消で可とする**条件付き承認**とした。

### 再確認結果 (2026-07-08, commit `25d3082`)

設計書 (`design/tauri_recent_folders_feature_design.md`) と `meta.md` を再確認した。

- **1.1 command 一覧の自己矛盾**: 「影響範囲 > Backend」の command 一覧が `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` に統一され (109 行)、`save_recent_folders` の記載は削除された。`validate_recent_folder` も「専用の command は追加せず、既存 `scan_directory` の検証を利用する」(111, 250 行) と明記され、「Command 境界」節の不採用理由と整合した。✓ 反映確認。
- **1.2 app config JSON の排他制御未設計**: 「永続化」節に「排他制御」小節が新設され (228-236 行)、`tauri::State<AppConfigStore>` + `std::sync::Mutex<()>` で `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` の read-modify-write を直列化する方針、lock 範囲を config file アクセスに限定し `scan_directory` / Markdown 読み込み / PlantUML rendering は対象外とする方針が明記された。✓ 反映確認。
- **1.3 `name` 表示の正本未確定**: 「entry 表示は `RecentFolderEntry.name` を主表示…」(156 行) に修正され、データモデル節に `name` は `record_recent_folder` 実行時に Rust 側で確定するスナップショットであり、frontend は `getFileName` で再導出しないこと、record 後に folder がリネームされた場合は古い `name` が残る既知挙動であることが追記された (198 行)。「失敗時動作とデフォルト挙動」にも同旨のリネーム後挙動が追記され (277 行)、「既存類似ロジックとの抽象化・共通化方針」も `entry.name` を正本とし `getFileName` は fallback 限定と整合するよう修正された (294 行)。✓ 反映確認。
- **2.1 恒久ドキュメントの訂正方針未記載**: 「恒久ドキュメント更新予定先」の `detail_design.md` 項目に、TODO-2026-003 時点の「ドロップダウン…導入しない」という記述を追記ではなく置換する方針が明記され、Phase 3 docs 更新時に README / basic_design / detail_design / interface_spec を横断的に確認する一文も追加された (313-317 行)。✓ 反映確認。
- **3.1 no-markdown root の recent 記録有無**: 「既存機能との統合」に、`loadRoot` が initial markdown の有無や成否に関わらず `record_recent_folder` を呼ぶことが明記され (264 行)、「initial markdown の読み込みに失敗した場合の扱い」にも「Markdown file が 1 つもない root でも、`scan_directory` が成功した directory であれば recent entry は保存対象にする」という一文が追記された (270 行)。✓ 反映確認。

**判定**: **承認 (Approved)**。

- すべてのレビュー指摘 (高 1 件、中 2 件、低 2 件) に対応が記録され、未解決指摘はゼロ。
- `meta.md` の `design_status` を `done` に更新可能な状態 (現状 `in_review`)。
- Phase 3 (実装・恒久ドキュメント反映) への進行を承認する。Phase 3 着手時は、本 review で確認した統一済み command 一覧、`AppConfigStore` の Mutex による排他制御、`entry.name` を正本とする表示方針、`detail_design.md` の旧ドロップダウン否定文の置換、no-markdown root でも recent 記録する方針をそのまま実装・docs 反映へ反映すること。

未解決指摘なし。本レビューでの承認をもって Phase 2 設計レビューを完了とする。
