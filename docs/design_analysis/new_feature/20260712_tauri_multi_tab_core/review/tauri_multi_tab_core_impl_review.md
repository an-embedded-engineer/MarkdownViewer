# Tauri Multi-tab core 導入 実装レビュー

**レビュー日**: 2026-07-12
**対象ドキュメント**: `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/design/tauri_multi_tab_core_feature_design.md`
**対象 impl 記録**: `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/impl/tauri_multi_tab_core_feature_impl.md`
**対象 meta**: `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-005
**Phase 2 reviewer approval**: `27e7cf1`
**レビュー対象コミット**: `e26c54d Phase 3 implement Tauri multi-tab core`
**判定**: **条件付き承認 (Conditional Approval)**。指摘 1.1 を実装へ反映後、Phase 4 進行可。

---

## 概要

TODO-2026-005 (Tauri Multi-tab core 導入) の Phase 3 実装レビュー。`markdown-viewer-tauri/src/App.tsx` / `App.css` の `OpenDocumentTab[]` + `activeTabId` 実装を、承認済み設計 (`27e7cf1` で Round 2 承認)、`docs/todo/todo.md` の受け入れ条件、`docs/components/tauri_viewer/*` 恒久ドキュメント、`tabId + revision` 非同期 guard の網羅性、TabStrip の close 規則・roving tabindex・アクセシビリティ、global busy / tab busy / StatusBar `State` 優先順位、root scan 失敗時の state 維持の観点で検証した。`npm run build`（`tsc && vite build`）、`cargo check`、`git diff --check` を独立に再実行し、いずれも報告どおり成功することを確認した。

---

## 1. 齟齬・不整合

### 1.1 `rootOperationError` が、承認済み設計の「次の root 全体操作で clear」という契約に反し、あらゆる tab 単位操作（activate / open）で消える

**承認済み設計記載**: 「Root変更・Reload・失敗時動作 > エラー優先順位」(design 213 行) は次を明記する。

```text
ErrorBanner は rootOperationError ?? activeTab.errorMessage を表示する。次の root全体操作開始時に root errorをclearし、tab errorは対象tabの再読込成功時にclearする。非active tab errorはそのtabのerror indicatorで示し、activate時にbannerへ表示する。
```

「root 全体操作」とは `openFolder` / `openRecentFolder` / `reload`（いずれも `isRootLoading` を true にする root 全体操作）を指す。

**実装**: `App.tsx:231-232` の `openOrActivateTab` と `App.tsx:313-316` の `activateTab` は、いずれも関数冒頭で無条件に `setRootOperationError(null)` を呼ぶ。

```ts
function openOrActivateTab(currentRootPath: string, filePath: string, anchor?: string) {
    setRootOperationError(null);
    ...
function activateTab(tabId: string) {
    setActiveTabId(tabId);
    setRootOperationError(null);
  }
```

`openOrActivateTab` は Explorer クリックと relative link navigation の両方から呼ばれ、`activateTab` は TabStrip の activate（クリックおよび roving tabindex の矢印キー移動）から呼ばれる。つまり、root 全体操作ではない通常の tab 切替・tab open のすべてが `rootOperationError` を即座に clear する。

**再現条件**: root を開いて `scan_directory` は成功したが `record_recent_folder` が失敗する状況（例: app config directory への書き込み権限がない）を作る。`rootOperationError` に Recent Folders の失敗メッセージが設定され `ErrorBanner` に表示される。この状態で、利用者が Recent Folders の問題を意識せず、既に開いている別の tab を 1 回クリックする（または矢印キーで tab を移動する）と、`activateTab` が発火し `rootOperationError` が即座に `null` になり、`ErrorBanner` が消える。しかし Recent Folders の書き込み失敗自体は未解決のままであり、次に `Open Folder` を実行すれば再発する。設計が明記する「次の root 全体操作開始時に clear」を満たしていない。

**差異の評価**: `closeTab` (`App.tsx:318-334`) は `rootOperationError` を触らないため、close だけは設計どおり root error を保持する。一方 `openOrActivateTab` / `activateTab` はどちらも clear する。この非対称性は、Phase 3 実装が旧単一文書 state 時代の「ハンドラ冒頭で無条件に `setErrorMessage(null)`」という慣習（`loadMarkdown` などが root error と tab error を区別せず単一 `errorMessage` を持っていた頃のパターン）を、`rootOperationError` / tab `errorMessage` に分離した後も個別に再検証せずへ引き継いだことを示唆する。`impl/tauri_multi_tab_core_feature_impl.md` の「設計差分」は「設計差分なし」とだけ記載しており、この挙動が設計の明示契約と異なることには触れていない。

レビュー観点「global busyとtab busy、StatusBar State優先順位、root scan失敗時state維持が正しいか」に照らすと、`isRootLoading` / `isRecentFoldersBusy` の busy 分離や `tabs` / `activeTabId` の state 維持自体は正しく実装されている一方、root error の可視性という隣接する契約が壊れている。

**推奨対応**: 次のいずれかを実装へ反映する。

- (a) `openOrActivateTab` / `activateTab` から `setRootOperationError(null)` を削除し、root error のクリアを `openFolder` / `openRecentFolder` / `reload`（root 全体操作の開始点）だけに限定する。
- (b) 設計のほうを「tab 単位操作でも root error を clear してよい」という記載に更新し（Phase 2 レビュー担当への再確認と `design/` の一文追記を伴う）、`interface_spec.md` のエラー優先順位記載にも反映する。

(a) が承認済み設計の記載に忠実であり、実装差分も `setRootOperationError(null)` の 2 箇所削除で完結するため推奨する。

**severity**: Medium

---

## 2. ドキュメント不足

### 2.1 `detail_design.md` の「UI レイアウト」ASCII 図が、実装済みの `PreviewWorkspace` / `TabStrip` 構造を反映していない

**該当箇所**: `docs/components/tauri_viewer/detail_design.md` の「UI レイアウト」(377-396 行) は次の DOM 構造を記載する。

```text
<main.app-shell>
  <MenuBar/>           ← File: Open Folder / Recent Folders / Reload、View: Theme
  <RootPathBar/>       ← root path。未選択時は No folder selected
  <section.workspace>
    <aside.explorer-pane>
      <FileTree/>      ← 再帰 TreeNode、Markdown / Image / Directory アイコン
    </aside>
    <section.preview-pane>
      <MarkdownPreview/> dangerouslySetInnerHTML
    </section>
  </section>
  <ErrorBanner/>       ← 代表 error。エラー発生時のみ表示
  <StatusBar/>         ← File / State
</main>
```

**実装**: `App.tsx:509-551` は `section.workspace` 直下に `aside.explorer-pane` と `section.preview-workspace` を持ち、`preview-workspace` の中に `TabStrip` と `div#markdown-preview.preview-pane` が並ぶ 2 行 grid 構造（`App.css:389-394` の `.preview-workspace { grid-template-rows: auto minmax(0, 1fr); }`）になっている。これは承認済み設計の「UI設計」(design 160-168 行) が明記する

```text
workspace
├── Explorer
└── PreviewWorkspace
    ├── TabStrip (horizontal overflow)
    └── PreviewContent (single active MarkdownPreview)
```

と一致しており、実装自体は設計どおりである。

**差異**: `detail_design.md` の他の節（「状態管理」「クラス/モジュール図」「Multi-tab処理」「リンク処理」など）は今回の Phase 3 で正しく更新されているのに対し、「UI レイアウト」の ASCII 図だけが旧 `section.preview-pane` 直下に `MarkdownPreview` を置く構造のまま据え置かれ、`TabStrip` も `preview-workspace` も一切登場しない。`impl/tauri_multi_tab_core_feature_impl.md` は「恒久ドキュメント反映」に `detail_design.md` を含めているが、この図は反映漏れである。後続 `TODO-2026-006 Tauri Split view` の設計時にこの図を参照すると、TabStrip の存在自体を見落として split view のレイアウト設計を誤る可能性がある。

**推奨対応**: 「UI レイアウト」の ASCII 図を、`section.preview-workspace` (`TabStrip` + `PreviewContent`) を含む構造へ更新する。あわせて図直後の説明文にも `TabStrip` を一文加える（現状の説明文は `MenuBar` / `RootPathBar` / `ErrorBanner` / `StatusBar` には触れているが `TabStrip` には触れていない）。

**severity**: Medium

---

## 3. 改善提案

### 3.1 tab close 後の focus 対象選択ロジックが `App.closeTab` と `TabStrip.close` の 2 箇所に独立実装されている

**該当箇所**: `App.tsx:318-334` の `closeTab` は「対象削除後、closed tab が active なら右隣→左隣→null」を `next[closeIndex] ?? next[closeIndex - 1] ?? null` で計算し `activeTabId` を更新する。一方 `App.tsx:814-823` の `TabStrip.close` は、キーボード close 後にどのボタンへ focus を戻すかを `tabs[index + 1]?.id ?? tabs[index - 1]?.id ?? null` という別の配列添字（削除前配列 + `index±1`）で独立に計算している。

両者は数学的には同じ「右隣、なければ左隣」規則を指しており、現時点では挙動が一致している（削除前配列の `index+1` は削除後配列の `closeIndex` と同じ要素を指すため）。しかし選択規則そのものが `App.closeTab` 側だけに実装されており、`TabStrip.close` はそれを知らずに同じ規則を再実装している。将来 `closeTab` の選択規則が変更された場合（例: 「直前にactiveだったtabへ戻す」等）、`TabStrip.close` 側を同時に直さない限り、keyboard focus が実際の新しい active tab とは異なるボタンに残るという検出しづらい回帰が起きる。

**推奨対応**: `onClose` コールバックの戻り値として次に active になる `tabId`（または `null`）を `App` 側から返す、もしくは `activateTab` 適用後の `activeTabId` を `TabStrip` が `useEffect` で監視して focus するなど、隣接タブ選択規則を単一の実装に統合する。

**severity**: Low

### 3.2 `tabsRef` / `tabs` state 同期用の `updateTabs` ヘルパーが、3 箇所の類似処理で再利用されていない

**該当箇所**: `App.tsx:91-95` に `tabsRef.current` と `setTabs` を同時更新する `updateTabs(updater)` ヘルパーが定義されているが、次の 3 箇所は同じパターンを個別に直接記述している。

- `loadRoot` (`App.tsx:138-139`): `tabsRef.current = []; setTabs([]);`
- `openOrActivateTab` (`App.tsx:251-252`): `tabsRef.current = [...tabsRef.current, tab]; setTabs(tabsRef.current);`
- `closeTab` (`App.tsx:326-327`): `tabsRef.current = next; setTabs(next);`

いずれも `updateTabs(() => [])` / `updateTabs((current) => [...current, tab])` / `updateTabs((current) => current.filter((tab) => tab.id !== tabId))` として書き換え可能であり、`updateTabIfCurrent` はすでに `updateTabs` を経由している。`tabsRef` と `tabs` state の同期はこの実装の非同期 guard 全体の前提であるため、単一ヘルパーへ統合したほうが将来の同期漏れ（ref だけ更新して state を忘れる、あるいはその逆）を構造的に防げる。

**推奨対応**: 上記 3 箇所を `updateTabs` 経由に統一する。

**severity**: Low

### 3.3 tab の close button が roving tabindex の対象外で、Tab キーで tab 数分の stop が生まれる

**該当箇所**: `App.tsx:839-860` の `tab-activate` button は `tabIndex={isActive ? 0 : -1}` で roving tabindex に組み込まれているが、同じ tab item 内の `tab-close` button (`App.tsx:861-869`) には `tabIndex` の指定がなく、既定値（0 相当、通常のフォーカス順）のまま全 tab 分が個別に Tab キー到達可能になっている。承認済み設計 (design 173-174 行) は activate button の roving tabindex だけを明記しており、close button の扱いは未規定のため設計違反ではないが、tab 数が多い場合に TabStrip 領域だけで `1 (active activate button) + N (全 tab の close button)` 個の Tab stop が生まれ、roving tabindex 導入の目的（複合ウィジェットの Tab stop を 1 個に抑える）を部分的に損なう。一方で、非 active tab を矢印キーで選択せずに Tab キーだけで close できる利点もあり、意図的なトレードオフである可能性もある。

**推奨対応**: 意図的な選択であれば `impl/` または `interface_spec.md` に一言残す。そうでなければ、close button も `tabIndex={isActive ? 0 : -1}` とし、非 active tab の close は「矢印キーで選択 → close button へ Tab → close」または将来的な `Delete` キー割り当てに寄せることを検討する。必須修正ではなく確認事項として扱ってよい。

**severity**: Low

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 実装での対応箇所 | 結果 |
| --- | --- | --- |
| Explorer クリックで同一 path のタブがあれば activate、なければ新規タブを開く | `openOrActivateTab` (`App.tsx:231-256`)。`tabsRef.current` を同期参照するため連打時も重複 tab を作らない | ✓ 整合 |
| TabStrip で active tab を識別でき、activate / close できる。active tab close 後は右隣→左隣、最後は未選択表示 | `closeTab` (`App.tsx:318-334`)、`TabStrip` (`App.tsx:765-875`) | ✓ 整合。close後 focus の実装重複は 3.1 参照 |
| Reload は active tab のみを再読込し、theme は全タブへ共通反映する | `reload` (`App.tsx:200-229`)。`theme` は `document.documentElement.dataset.theme` へ反映され全 tab 共通 | ✓ 整合 |
| 相対 Markdown リンクは同一 path のタブを activate、なければ新規タブを開き anchor へ移動する | `handlePreviewClick` → `openOrActivateTab` (`App.tsx:336-369`)、`pendingNavigation` 消費 effect (`App.tsx:461-484`) | ✓ 整合 |
| タブは現在の `rootPath` 内に限定される | `loadRoot` が root 変更時に `tabs` を空へリセットしてから新規 tab を作る (`App.tsx:138-146`) | ✓ 整合 |
| root 変更時は旧 root の全タブを破棄し、新 root の初期 Markdown だけを開く。root open 失敗時は既存表示を維持する | `loadRoot` (`App.tsx:128-159`)。scan 失敗時は `setRootPath` 等を一切呼ばず、catch で `rootOperationError` のみ設定 | ✓ 整合 |
| タブ切替、Reload、theme切替後も Markdown、相対画像、Mermaid、PlantUML、anchor、loading/error 表示が破綻しない | `updateTabIfCurrent` による `tabId + revision` guard (`App.tsx:97-105`, `258-311`, `446-454`) | ✓ 整合。close済み・旧revision・旧rootのresponseはlookup失敗またはrevision不一致で無視されることをコードトレースで確認した |
| 多数タブ時も TabStrip の overflow により任意のタブを activate / close できる | `App.css:396-404` の `overflow-x: auto` + `flex: 0 0 auto`、`TabStrip` の `scrollIntoView` (`App.tsx:768-777`) | ✓ 整合 |

WBS (`wbs.md` WP-003) の `completion_criteria` とも齟齬なし。ただし「エラー優先順位」の root error 可視性は 1.1 の通り部分的に崩れている。

---

## 5. 検証結果確認

| 検証項目 | 報告内容 | 独立再実行結果 |
| --- | --- | --- |
| `npm run build`（`markdown-viewer-tauri/`） | 成功。既知の chunk size warning のみ | ✓ 再実行して確認。`tsc && vite build` が成功し、型エラーなし。chunk size warning のみで報告と一致 |
| `cargo check`（`markdown-viewer-tauri/src-tauri/`） | 成功 | ✓ 再実行して確認。warning なしで `Finished` |
| `git diff --check`（`27e7cf1..e26c54d`） | 成功 | ✓ 再実行して確認。whitespace error なし |
| Rust backend 変更なし | 影響範囲どおり `src-tauri/` 変更なしと明記 | ✓ `git diff --stat` で `src-tauri/` の差分ゼロを確認 |
| 旧単一文書 state (`selectedFilePath` 等のグローバル state, `plantUmlRenderState`, `previewRevision`, `isMarkdownLoading`, `pendingAnchor`) の残存 | 「設計差分なし」、旧 state は削除したと記載 | ✓ grep で `App.tsx` / 恒久ドキュメントに該当識別子の残存がないことを確認（`FileTree` / `MarkdownPreview` のローカル prop 名としての同名 `selectedFilePath` のみで、意味は別） |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 中 | 1.1 `rootOperationError` が tab 操作で意図せず clear される | 承認済み設計の明示契約（root error は次の root 全体操作まで保持）に反し、Recent Folders 書き込み失敗などの root 問題が tab 切替一つで利用者から見えなくなる |
| 中 | 2.1 `detail_design.md` の UI レイアウト図が TabStrip 未反映 | 後続 `TODO-2026-006 Tauri Split view` の設計参照時に誤った前提を与えるおそれがある |
| 低 | 3.1 close 後 focus ロジックの二重実装 | 現状は数学的に一致しているが、将来の変更で静かに乖離しうる |
| 低 | 3.2 `updateTabs` ヘルパーの再利用漏れ | 機能的な問題はないが、ref/state 同期という重要な不変条件を単一箇所に閉じ込められていない |
| 低 | 3.3 close button が roving tabindex 対象外 | 設計は close button の tabIndex を規定しておらず違反ではないが、意図的トレードオフか確認が必要 |

---

## 7. 残リスク / Phase 4 での注意点

- 1.1 は `setRootOperationError(null)` の呼び出し箇所を 2 つ削除するだけで解消できる規模であり、Phase 4 のユーザ動作確認前に対応することを推奨する。対応後は「root scan 成功 → Recent Folders 記録失敗 → 別 tab を activate → ErrorBanner が消えずに残る → 次の `Open Folder` / `Reload` で clear される」の手動確認を追加すると良い。
- 2.1 は docs 反映のみで完結する。Phase 4 の docs 最終確認、または `TODO-2026-006` の Phase 0/2 着手前に必ず解消すること。
- 3.1〜3.3 は Low であり、Phase 4 の手動確認（複数 PlantUML 文書の連続 open、多数 tab の横 overflow、`ArrowLeft` / `ArrowRight` / `Home` / `End` roving focus、close 後 focus）と合わせて確認し、必要なら follow-up todo 化してよい。
- impl.md の「既知制約」に記載済みの「多数の巨大文書の memory 上限」「PlantUML 並行数制限」は Phase 2 レビューで許容済みの risk であり、Phase 4 の手動確認（PlantUML を含む複数文書の連続 open）でそのまま踏襲する。

---

## 8. 結論

実装は TODO-2026-005 の受け入れ条件をほぼ満たしており、`OpenDocumentTab[]` + `activeTabId` という承認済み状態モデル、`tabsRef` によるスナップショット同期、`updateTabIfCurrent` の `tabId + revision` guard は、close・Reload・root 変更・旧 revision のいずれのケースでも正しく stale response を無視することをコードトレースで確認した。roving tabindex、`ArrowLeft` / `ArrowRight` / `Home` / `End`、`aria-controls="markdown-preview"` と `role="tabpanel"` の対応、close 選択規則（active は右隣→左隣、非 active は維持）、StatusBar `State` の優先順位（`isRootLoading` > `isRecentFoldersBusy` > tab loading > tab rendering > `Ready`）は、いずれも Phase 2 Round 2 で承認された内容どおりに実装されている。Rust backend / capability / 永続化形式への変更もなく、旧単一文書 state の残存も確認されなかった。

一方で、`rootOperationError` が承認済み設計の「次の root 全体操作開始時に clear」という契約に反し、`openOrActivateTab` / `activateTab` という tab 単位操作のたびに無条件で clear される (1.1, Medium)。これは build やコンパイラでは検出できない、通常操作（tab 切替）で root レベルの未解決エラーが利用者から見えなくなるという振る舞い上の齟齬であり、レビュー観点「buildだけでは検出しにくいReact state race、accessibility、失敗系」に該当する。あわせて `detail_design.md` の UI レイアウト図が新しい `TabStrip` / `PreviewWorkspace` 構造を反映していない (2.1, Medium)。いずれも記載・条件分岐の絞り込みで解消できる規模であり、状態モデルや非同期 guard という実装の骨格を変更するものではない。3.1〜3.3 は Low であり、Phase 4 と合わせて解消すればよい。

**条件付き承認**とする。Phase 4（ユーザ動作確認）着手前に 1.1（`rootOperationError` の clear 条件修正）を実装へ反映することを必須条件とし、2.1（`detail_design.md` の UI レイアウト図更新）もあわせて解消した上で Phase 4 に進めること。3.1 / 3.2 / 3.3 は Phase 4 の手動確認と合わせて解消するか、follow-up として記録すればよい。

未対応指摘: 1.1 (Medium), 2.1 (Medium), 3.1 (Low), 3.2 (Low), 3.3 (Low)。
