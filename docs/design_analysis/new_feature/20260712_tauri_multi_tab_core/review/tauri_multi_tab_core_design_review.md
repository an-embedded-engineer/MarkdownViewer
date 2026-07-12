# Tauri Multi-tab core 導入 設計レビュー

**レビュー日**: 2026-07-12
**再確認日**: 2026-07-12
**対象ドキュメント**: `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/design/tauri_multi_tab_core_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-005
**対象 WBS**: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md` WP-003
**初回レビュー対象コミット**: `24c0d4a Phase 2 draft Tauri multi-tab design`
**再確認対象コミット**: `cd2fad4 Phase 2 address Tauri multi-tab design review`
**判定**: **承認 (Approved)**。Phase 3 進行可（詳細は「10. Round 2 再確認結果」参照）。

---

## 概要

TODO-2026-005 (Tauri Multi-tab core 導入) の Phase 2 設計レビュー。`OpenDocumentTab[]` + `activeTabId` という状態モデルと `tabId + revision` 非同期 guard という採用案を、`docs/todo/todo.md` / `wbs.md` の受け入れ条件トレース、既存コード (`markdown-viewer-tauri/src/App.tsx`, `src-tauri/src/lib.rs`) との整合、`docs/components/tauri_viewer/*` 恒久ドキュメントとの整合、後続 `TODO-2026-006 Tauri Split view` への拡張耐性、TabStrip のアクセシビリティ、root変更・Reload・失敗時契約の観点で検証した。

---

## 1. 齟齬・不整合

### 1.1 TabStrip の ARIA role 選択と「Arrow key roving focus は非対象」が自己矛盾している

**ドキュメント記載**: 「対象範囲と非対象 > 非対象」(design 44 行) は次を明記する。

```text
tab ごとのスクロール位置保存と Arrow key による tab roving focus。必要なら UX 評価後に follow-up とする。
```

一方「UI設計 > TabStrip」(design 166-171 行) は次を採用方針として明記する。

```text
container は `role="tablist"`, `aria-label="Open Markdown files"`。
activate button は `role="tab"`, `aria-selected`, `aria-controls="markdown-preview"` を持つ。
```

**差異**: WAI-ARIA Authoring Practices の Tabs パターンは、`role="tablist"` / `role="tab"` を採用する場合、複合ウィジェットとして roving tabindex + 矢印キーによるタブ間フォーカス移動を実装することを前提とする。この設計は同一文書内で「Arrow key roving focus」を明示的に non-scope としながら、その roving focus を要求する ARIA role をそのまま採用しており、自己矛盾している。

さらに本プロジェクトには、まさに同じ理由で role 選択を変えた既存の確定仕様がある。`docs/components/tauri_viewer/detail_design.md` (384 行) は MenuBar について「`role="menubar"` は矢印キー移動・roving tabindexと併せて導入すべき ARIA pattern であるため、今回の最小範囲では使わない」と明記し、`role="menu"` / `role="menuitem"` という矢印キー移動を必須としない role を選んでいる。TabStrip の設計はこの既存判断（同一 codebase・同一 workflow ライン上の直近の確定仕様）を踏まえずに、矢印キー移動を必須とする `role="tablist"` / `role="tab"` を採用しており、支援技術ユーザーが「タブリストなので矢印キーで移動できる」という期待を持つのに実際には移動できない、という利用時の齟齬を生む。

レビュー観点「TabStrip の close選択規則、overflow、アクセシビリティが最小提供範囲として妥当か」に照らすと、アクセシビリティの記載自体は詳細だが、role 選択と非対象記載が両立しない。

**推奨対応**: 次のいずれかを設計書に明記する。

- (a) MenuBar と同様に `role="tablist"` / `role="tab"` を採用せず、`aria-selected` を持つ通常 button 群 + `aria-label` 付き container に変更し、「非対象」の Arrow key roving focus 記載と整合させる。
- (b) `role="tablist"` / `role="tab"` を維持するなら、最小限の roving tabindex + 左右矢印キー移動を最小提供範囲へ含め、「非対象」から Arrow key roving focus の記載を削除する。

いずれを選んでも、「非対象」節と「UI設計 > TabStrip」節の記載を同じ結論に揃える必要がある。

**severity**: High

### 1.2 `pendingAnchor` の tab 単位保持が、design 自身の「pane 固有状態を tab へ埋め込まない」方針と整合しない

**ドキュメント記載**: 「最小提供範囲と後続拡張」(design 50 行) は次を明記する。

```text
後続split viewでは`tabs`を文書データの正本として再利用し、pane側は参照する`activeTabId`を持てる。今回の`activeTabId`は単一paneの選択として`App`に置くが、tab自体へpane固有状態を埋め込まない。
```

一方「データ設計」(design 106, 116 行) は `pendingAnchor: string | null` を `OpenDocumentTab`（複数 pane から共有される想定のタブ本体データ）のフィールドとして定義し、「`pendingAnchor`: 対象 tab activate 後、active preview の描画完了時に消費する」(116 行) と記載する。

**差異**: `pendingAnchor` の消費条件は「active preview の描画完了時」であり、これは tab のデータそのものではなく「どの pane がそのタブを表示しているか」という pane 側の描画イベントに依存する。design が明言する「tab自体へpane固有状態を埋め込まない」という方針に照らすと、`pendingAnchor` は本来 pane 側（現行 MVP では単一 pane なので `App` 直下でも表現可能）が持つべき値であり、tab 側に置くと後続 split view で同一 tab を 2 pane から参照した場合に「どちらの pane の描画完了で anchor を消費すべきか」が一意に定まらなくなる。レビュー観点「`OpenDocumentTab` と `activeTabId` の状態モデルが、後続 split view を阻害しないか」に該当する具体的な阻害要因である。

今回の MVP は単一 pane のみのため実害はないが、「後続拡張」節が split view 互換性を明示的な設計判断として謳っている以上、この矛盾は設計書内で解消しておくべきである。

**推奨対応**: 次のいずれかを明記する。

- (a) `pendingAnchor` を `OpenDocumentTab` ではなく `App` 直下（または将来の pane state）に `{ tabId, anchor }` の形で保持し、tab 型からは除外する。
- (b) `pendingAnchor` を tab に残す設計を維持するなら、「後続 split view で同一 tab を複数 pane から参照する場合、`pendingAnchor` は最初に描画した pane のみが消費し、以降は pane 側の別領域で扱う」といった具体的な移行方針を「最小提供範囲と後続拡張」または「リスクと follow-up」に追記し、「tab自体へpane固有状態を埋め込まない」という方針文と矛盾しないことを明示する。

**severity**: Medium

---

## 2. ドキュメント不足

### 2.1 StatusBar の `State` 表示が、root 全体 busy 状態とタブ単位 loading 状態の優先順位を規定していない

**該当箇所**: 「データ設計」(design 122 行) は `isRootLoading`, `isRecentFoldersBusy` を「root collection を交換する操作だけの global busy」として `App` state に追加する。一方「UI設計」(design 179 行) は StatusBar の `State` 表示を次のようにしか記載していない。

```text
StatusBarのFileはactive tab name、Stateはactive tabのLoading Markdown.../Rendering PlantUML diagrams.../Readyを表示する。将来tab count を追加可能だが、今回の最小範囲では既存2項目構成を維持する。
```

**差異**: 現行実装 (`App.tsx:77-85`) は `loadingMessage` を `isMarkdownLoading → isPlantUmlRendering → isRecentFoldersBusy → null` という明示的な優先順位チェーンで導出しており、`docs/components/tauri_viewer/interface_spec.md` (37 行) も `State` の取りうる値として `Updating recent folders...` を含む 5 パターンを列挙している。新設計はタブ単位の `loadState`（loading / rendering / ready / error）に加えて `isRootLoading` という新しい global busy を導入したにもかかわらず、StatusBar の `State` にこれらをどう合成するかを規定していない。具体的には次が未定義である。

- root scan 中（`Open Folder` / `Recent Folders` open / `Reload` の scan フェーズ）に `State` へ何を表示するか（現行の `Updating recent folders...` 相当の root 版メッセージが存在するか）。
- `isRootLoading` と active tab の `loadState` が同時に true になり得る局面（例: Reload 中に active tab も再読込中）での優先順位。

これは Phase 2 必須観点「UI / データ / サービス / 永続化の追加点」の UI 記載として不十分であり、実装者が優先順位を独自解釈する余地を残す。

**推奨対応**: 「UI設計」または「Root変更・Reload・失敗時動作」に、`State` の導出優先順位（例: `isRootLoading` > `isRecentFoldersBusy` > `activeTab.loadState` (loading/rendering) > `Ready`）を明記し、`interface_spec.md` へ反映する具体的な文言案（root scan 中の表示文字列を含む）を追記する。

**severity**: Medium

---

## 3. 改善提案

### 3.1 busy gate 緩和により複数タブが並行して `render_plantuml_diagrams` を起動できるようになる影響が未検討

**該当箇所**: 「UI設計」(design 177 行) は次を明記する。

```text
文書loading/PlantUMLrendering中も別tabのactivateとclose、Explorerからのopen-or-activateを許可する。
```

**背景確認**: `src-tauri/src/lib.rs` を確認したところ、`render_plantuml_diagrams` は `AppConfigStore` の `Mutex` （Recent Folders 設定ファイルアクセス専用）の対象外であり、呼び出しを直列化する仕組みを持たない。各呼び出しは `tauri::async_runtime::spawn_blocking` で独立に `java -jar plantuml.jar` を起動する。

現行実装は単一文書 state のため `isBusy`（`isMarkdownLoading || isPlantUmlRendering || isRecentFoldersBusy`）が Explorer クリックそのものを抑止しており、結果として `render_plantuml_diagrams` の呼び出しは実質的に同時に 1 件しか走らなかった。新設計は「文書 loading / PlantUML rendering 中も別 tab の open-or-activate を許可する」ため、利用者が PlantUML を含む複数文書を短時間に連続して開くと、tab 数分の `render_plantuml_diagrams` 呼び出し（＝ tab 内の図の数だけ順次起動される `java` プロセス）が並行して走り得る。これは wbs のリスク「複数タブ化により `isBusy` が…曖昧になる」を正しく解消する一方で生まれる新しいリソース面の副作用であり、「リスクとfollow-up」(design 268-274 行) には大量タブのメモリ使用量への言及はあるが、Java プロセスの並行起動については触れられていない。

MVP として許容する判断もあり得るが、その場合も「意図的に許容し、実測で問題が出れば follow-up 化する」という一文が「リスクとfollow-up」にあると、Phase 4 の検証観点や将来の issue 化の判断材料になる。

**推奨対応**: 「リスクとfollow-up」に、busy gate 緩和により PlantUML レンダリングが tab 単位で並行実行され得ること、および上限や直列化を今回は導入せず実測で問題が確認された場合に follow-up化する方針であることを一文追記する。あわせて「テスト・ユーザ確認観点」に、PlantUML を含む複数文書を短時間に連続して開いた場合の挙動確認を追加すると、Phase 4 の検証で見落としにくくなる。

**severity**: Low

### 3.2 非 active タブを close した場合の隣接タブ選択の要否が明文化されていない

**該当箇所**: 「責務分割と共通化方針」(design 135 行) は `closeTab(tabId)` を「対象削除と deterministic な隣接 tab 選択」とだけ記載する。「背景・要求・完了条件」(design 12 行) は「active tab close 後は右隣、右隣がなければ左隣へ移る」と active tab を対象とした規則のみを明記しており、非 active tab を close した場合に `activeTabId` を変更しない（現在の active tab を維持する）ことは文脈上自明ではあるが明文化されていない。

**推奨対応**: `closeTab` の説明に「closed tab が active でない場合、`activeTabId` は変更しない」という一文を追記し、隣接タブ選択ロジックが active tab close 時にのみ発火することを明確にする。

**severity**: Low

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| Explorer クリックで同一 path のタブがあれば activate、なければ新規タブを開く | 「ユースケースと操作導線」(design 21-23 行)、「責務分割」`openOrActivateTab` (design 131 行) | ✓ 整合 |
| TabStrip で active tab を識別でき、activate / close できる。active tab close 後は隣接タブへ、最後の tab close 後は未選択表示になる | 「背景・要求・完了条件」(design 12 行)、「UI設計 > TabStrip」(design 166-173 行) | ✓ 整合。ただし非 active tab close 時の挙動明文化は 3.2 参照 |
| Reload は active tab のみを再読込し、theme は全タブへ共通反映する | 「Root変更・Reload・失敗時動作 > Reload」(design 191-196 行) | ✓ 整合 |
| 相対 Markdown リンクは同一 path のタブを activate、なければ新規タブを開き anchor へ移動する | 「ユースケースと操作導線」6. (design 26 行)、「Mermaid・PlantUML・anchor」(design 202-208 行) | ✓ 整合。ただし `pendingAnchor` の tab 配置は 1.2 参照 |
| タブは現在の `rootPath` 内に限定される | 「データ設計 > path」(design 112 行) | ✓ 整合 |
| root 変更時は旧 root の全タブを破棄し、新 root の初期 Markdown だけを開く。root open 失敗時は既存表示を維持する | 「Root変更・Reload・失敗時動作 > Root変更」(design 183-189 行) | ✓ 整合 |
| タブ切替、Reload、theme切替後も Markdown、相対画像、Mermaid、PlantUML、anchor、loading/error 表示が破綻しない | 「非同期処理と競合制御」(design 142-152 行) | ✓ 整合。`tabId + revision` guard が主要な競合パターンを網羅している |
| 多数タブ時も TabStrip の overflow により任意のタブを activate / close できる | 「UI設計 > TabStrip」横スクロール記載 (design 172-173 行) | ✓ 整合。ただしアクセシビリティの role 選択は 1.1 参照 |

WBS (`wbs.md` WP-003) の `completion_criteria` とも齟齬なし。`deferred_or_follow_up`（工数超過時は link/overflow を follow-up 化してよい）は今回発動されておらず、設計は link navigation と overflow の双方を最小提供範囲に含めている。この判断自体は設計裁量の範囲内であり問題ない。

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| `tabId + revision` guard が、closed tab の response 無視・root 変更で破棄された tab の response 無視・Reload による stale response 無視をいずれも同じ「lookup 失敗 = 無視」ルールでカバーしている | ✓ 整合。`nextTabIdRef` による ID 単調増加で、close→再 open 時の ID 再利用も発生しない |
| 旧単一文書 state (`selectedFilePath` / `selectedMarkdown` / global `plantUmlRenderState`) を残さず、tab state への一括移行を明記している | ✓ 整合。checkpoint「要求されていない後方互換レイヤーや旧経路を残していないか」を満たす |
| `openOrActivateTab` を Explorer 選択とリンク遷移の双方から共有し、重複実装を避けている | ✓ 整合。checkpoint「類似ロジックがある場合に…抽象化・共通化が優先されているか」を満たす |
| PlantUML 結果を tab 単位でキャッシュし、tab 切替だけでは `read_text_file` / `render_plantuml_diagrams` を再実行しない方針 | ✓ 整合。`docs/architecture/common_pitfalls.md` の「Theme切替だけでPlantUML CLIを再実行すると…」の既存知見と一致 |
| Close button を activate button にネストしない独立要素とする方針 | ✓ 整合。button-in-button のアクセシビリティ・アンチパターンを回避している |
| busy gate を `isRootLoading` / `isRecentFoldersBusy`（root全体操作限定）へ縮小し、tab単位操作をブロックしない方針 | ✓ 整合。wbs のリスク「`isBusy` がアプリ全体 busy かタブ単位 busy か曖昧になる」への対応方針と一致（副作用は 3.1 参照） |
| Rust command（`scan_directory` / `read_text_file` / `render_plantuml_diagrams`）の契約を変更しない方針 | ✓ 整合。「影響範囲」に Rust backend 変更なしと明記され、`wbs.md` WP-003 の `main_targets` とも一致 |
| 恒久ドキュメント更新予定先（README / basic_design / detail_design / interface_spec / `markdown-viewer-tauri/README.md`）が todo.md の integration_points と一致している | ✓ 整合 |
| 責務配置（新 handler を `App` 内に置き、reducer 抽出は複雑化時に再評価）が既存コードパターン（`App.tsx` が UI + 状態管理を一体で持つ既存構成）と矛盾しない | ✓ 整合 |
| Phase 2 コミット (`24c0d4a`) が設計書 / meta.md のみの docs-only 差分である | ✓ 整合。実装コード変更は含まれていない |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 高 | 1.1 TabStrip の ARIA role と Arrow key roving focus 非対象の自己矛盾 | 設計書内の記載が両立せず、実装者がどちらに従うべきか判断できない。既存 MenuBar 仕様の確定判断とも整合しない |
| 中 | 1.2 `pendingAnchor` の tab 配置が「pane固有状態を埋め込まない」方針と整合しない | 後続 split view (`TODO-2026-006`) 着手時に手戻りとなり得る、split view 拡張耐性に関する明示的なレビュー観点 |
| 中 | 2.1 StatusBar `State` の優先順位未規定 | root busy とタブ busy の合成ルールが未定義のまま実装が進み、`interface_spec.md` の既存記載（5 パターン列挙）を更新しきれないリスクがある |
| 低 | 3.1 PlantUML 並行レンダリングの影響未検討 | busy gate 緩和という設計判断自体は妥当だが、副作用の記載漏れ |
| 低 | 3.2 非 active tab close 時の挙動明文化不足 | 実装上は自明だが、明文化しておくと Phase 3 実装レビューの確認観点になる |

---

## 7. 残リスク / Phase 3 での注意点

- 1.1 は role 選択の方針決定のみで文言修正が完了する規模だが、(a) 案と (b) 案でアクセシビリティ実装工数が変わるため、Phase 3 着手前に必ずどちらを採るか設計書へ確定させること。
- 1.2 は現行 MVP（単一 pane）の動作には影響しないため、Phase 3 実装自体は現行記載のまま進めてよいが、`TODO-2026-006` の設計 Phase 開始前に本指摘を再確認し、`pendingAnchor` の所在を確定させること。
- 2.1 は `interface_spec.md` の `State` 値一覧更新と直結するため、Phase 3 の docs 反映時に本レビューで確定した優先順位をそのまま記載すること。
- 3.1 は今回 MVP としては許容可能な判断だが、Phase 4 の手動確認で PlantUML 複数文書同時オープン時の体感（CPU/メモリ）を軽く確認し、問題があれば follow-up todo 化すること。
- リスク表に記載済みの「大量タブのメモリ使用量」「reducer 抽出の再評価基準」は Phase 3 実装レビューでそのまま踏襲する。

---

## 8. 結論

設計は TODO-2026-005 の受け入れ条件を概ね反映しており、`OpenDocumentTab[]` + `activeTabId` という状態モデル、`tabId + revision` による非同期 guard、旧単一文書 state を残さず tab state へ一括移行する方針は、`docs/todo/todo.md` / `wbs.md` の受け入れ条件、既存 `App.tsx` の責務分離、`docs/architecture/common_pitfalls.md` の PlantUML 再描画知見のいずれとも整合する。close button の独立要素化や busy gate の縮小など、既存 wbs リスクを正しく踏まえた判断も複数確認できた。

一方で、TabStrip の ARIA role 選択が同一設計書内の「Arrow key roving focus は非対象」という記載と自己矛盾しており (1.1, High)、かつ既存 MenuBar 仕様で確定済みの同種判断（`role="menubar"` を意図的に避けた理由）を踏まえていない。この 1 点は受け入れ条件トレースの「アクセシビリティが最小提供範囲として妥当か」という明示レビュー観点に直接抵触するため、Phase 3 着手前に解消が必要である。

`pendingAnchor` の tab 配置 (1.2) と StatusBar `State` の優先順位未規定 (2.1) は Medium だが、いずれも記載の追記・確定で解消できる規模であり、設計方針自体（採用案・対象範囲・非対象・データモデルの骨格）を変更するものではない。3.1 / 3.2 は Low であり、Phase 3 の docs 反映時に解消すればよい。

**条件付き承認**とする。Phase 3 着手前に 1.1（TabStrip の role 選択と非対象記載の整合）を設計書へ反映することを必須条件とし、1.2 / 2.1 も可能な限り設計書側で確定させた上で Phase 3 に進めること。3.1 / 3.2 は Phase 3 の実装・docs 反映と合わせて解消してよい。

未対応指摘: 1.1 (High), 1.2 (Medium), 2.1 (Medium), 3.1 (Low), 3.2 (Low)。

---

## 9. Round 1 指摘対応

対応工程: `design`

| 指摘 | 重大度 | 対応 | ステータス |
| --- | --- | --- | --- |
| 1.1 TabStrip ARIA role と roving focus | High | 案(b)を採用。`role="tablist"` / `role="tab"` を維持し、roving tabindex、ArrowLeft / ArrowRight / Home / End、close後focusを最小提供範囲へ追加した。Arrow key navigationをnon-scopeから削除し、手動確認へ追加した。 | 対応済み・再確認待ち |
| 1.2 `pendingAnchor` の配置 | Medium | `OpenDocumentTab` から削除し、App / pane-levelの `pendingNavigation: { tabId, anchor } | null` へ移した。後続split viewではpaneごとに保持する移行方針を明記した。 | 対応済み・再確認待ち |
| 2.1 StatusBar `State` 優先順位 | Medium | `isRootLoading`、`isRecentFoldersBusy`、active tab loading、active tab rendering、Readyの順序と表示文言を確定した。Reload時の状態遷移も明記した。 | 対応済み・再確認待ち |
| 3.1 PlantUML並行render | Low | Java processがtab単位で並行し得ること、今回は上限・queueを設けない判断、Phase 4の連続open確認と問題発生時のfollow-up方針を追記した。 | 対応済み・再確認待ち |
| 3.2 非active tab close | Low | 非active tab closeでは`activeTabId`を変更せず、隣接選択はactive tab close時だけ行うと明記した。 | 対応済み・再確認待ち |

未解決事項: なし。Claude reviewerのfollow-up承認待ち。

---

## 10. Round 2 再確認結果 (2026-07-12, commit `cd2fad4`)

設計書 (`design/tauri_multi_tab_core_feature_design.md`) と `meta.md` の `dcf409f`→`cd2fad4` 差分を確認した。

- **1.1 TabStrip の ARIA role と Arrow key roving focus の自己矛盾 (High)**: 推奨対応 (b) が採用された。「対象範囲と非対象」(design 44 行) から「Arrow key による tab roving focus」が削除され、`role="tablist"` / `role="tab"` の記載 (design 173 行) に「active tab だけを `tabIndex=0`、他を `tabIndex=-1` とする roving tabindex を採用する」が追記された。さらに `ArrowLeft` / `ArrowRight`（端で先頭/末尾へ循環）、`Home` / `End`、close 後の focus 移動先 (design 174 行) が明記され、WAI-ARIA Tabs パターンが要求する複合ウィジェット挙動と `role="tablist"` / `role="tab"` の採用が整合した。「テスト・ユーザ確認観点」10. (design 278 行) にも roving focus / selection の手動確認が追加されている。✓ 反映確認、自己矛盾は解消。
- **1.2 `pendingAnchor` の tab 配置が split view 方針と不整合 (Medium)**: 推奨対応 (a) が採用された。`pendingAnchor` は `OpenDocumentTab` 型から削除され (design 103-108 行)、新設された `PendingNavigation = { tabId: string; anchor: string }` 型として `App` 直下の `pendingNavigation` state (design 120, 124 行) へ移動した。「Mermaid・PlantUML・anchor」(design 220 行) も `pendingNavigation` を参照するよう更新され、「target tab の active preview 描画後に scroll し、同じ `tabId + revision` を guard してclearする。対象 tab がcloseされた場合はclearする」という close 時の扱いも新規に追記されている。「後続 split view では各 pane state が同じ形の navigation を持つ」(design 120 行) と split view への移行方針も明記された。設計書全体を検索したが `pendingAnchor` の残存記載はない。✓ 反映確認、「tab自体へpane固有状態を埋め込まない」方針との矛盾は解消。
- **2.1 StatusBar `State` の優先順位未規定 (Medium)**: 「UI設計」(design 184-192 行) に `isRootLoading` > `isRecentFoldersBusy` > active tab `loading` > active tab `rendering` > `Ready` の優先順位と表示文言（`Loading folder...` / `Updating recent folders...` / `Loading Markdown...` / `Rendering PlantUML diagrams...` / `Ready`）が明記された。Reload 時に `Loading folder...` → `Loading Markdown...` へ遷移する旨、root operation と tab load を意図的に並行開始しない旨も追記されている。✓ 反映確認。`interface_spec.md` への反映は Phase 3 docs 反映で行う。
- **3.1 PlantUML 並行レンダリングの影響未検討 (Low)**: 「リスクとfollow-up」(design 288 行) に、busy gate 緩和により複数 tab の `render_plantuml_diagrams` と Java process が並行実行され得ること、今回は上限・直列 queue を実測根拠がないため導入しないこと、Phase 4 で複数 PlantUML 文書の連続 open を確認し問題があれば follow-up 化する方針が追記された。「テスト・ユーザ確認観点」8. (design 276 行) にも該当確認手順が追加されている。✓ 反映確認。
- **3.2 非 active tab close 時の挙動明文化不足 (Low)**: 「責務分割と共通化方針」`closeTab` (design 139 行) が「closed tab が active の場合だけ右隣、なければ左隣を選び、非 active tab を閉じた場合は `activeTabId` を変更しない」と明文化された。✓ 反映確認。

再確認の過程で新たな齟齬・記載漏れは見つからなかった。`meta.md` は `design_status: in_review` (dcf409f, conditional approval) に更新済みで、Phase Status 表にも反映されている。

**判定**: **承認 (Approved)**。

- Round 1 の指摘（高 1 件、中 2 件、低 2 件）すべてに対応が確認され、未解決指摘はゼロ。
- `meta.md` の `design_status` を `done` へ更新可能な状態（現状 `in_review`）。実装 Agent が Phase 3 着手時に `done` へ更新し、コミットすること。
- Phase 3（実装・恒久ドキュメント反映）への進行を承認する。Phase 3 着手時は、本 Round 2 で確認した roving tabindex + 矢印キー仕様、`pendingNavigation` の App/pane-level 配置、StatusBar `State` 優先順位、PlantUML 並行実行のリスク許容方針、非 active tab close の挙動を、実装および `docs/components/tauri_viewer/*` の恒久ドキュメント反映へそのまま引き継ぐこと。特に `interface_spec.md` の `State` 値一覧（現行 5 パターン）は、新しい優先順位・文言に合わせて更新すること。

未解決指摘なし。本レビューでの承認をもって Phase 2 設計レビューを完了とする。
