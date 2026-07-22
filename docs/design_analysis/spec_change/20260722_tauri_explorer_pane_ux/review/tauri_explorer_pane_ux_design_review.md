# TODO-2026-019 Tauri Explorer ツリーペイン UX 改善 設計レビュー

**レビュー日**: 2026-07-22
**対象ドキュメント**: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/design/tauri_explorer_pane_ux_design.md`
**対象 meta**: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-019
**レビュー対象コミット**: `c1038c9` (docs: design Tauri explorer pane UX)
**判定**: **要修正 (Changes Requested)**。未解決指摘 4 件（High 1 / Medium 1 / Low 2）。High 指摘は完了条件の中核（Explorer 幅の最小値保証）が設計記載どおりでは成立しない契約矛盾であり、Phase 3 着手前に設計書修正が必要。

---

## 概要

TODO-2026-019 (Tauri Explorer ツリーペイン UX 改善) の Phase 2 設計レビュー。Explorer 幅の pointer / keyboard resize 契約、`explorerPane.ts` の pure policy 分離、tree content の水平 scroll 分離、directory / Markdown / HTML / image アイコンの視覚表現、既存 app shell・Preview・HTML iframe・tab・root 操作との回帰観点、Avalonia 後続 TODO (`TODO-2026-020`) との責務境界を、現行 Tauri frontend 実ソース (`markdown-viewer-tauri/src/App.tsx`、`App.css`、`documentPolicy.ts`)、恒久ドキュメント (`docs/components/tauri_viewer/*`)、Tauri window 設定 (`tauri.conf.json`) を根拠に検証した。

pointer capture / pointer cancel の設計、tree の `max-content` + `min-width: 100%` による「必要時だけ水平 scroll」の CSS 手法、`explorerPane.ts` の pure policy 分離度、既存操作への回帰観点、Avalonia 側 TODO との責務境界と非対象判断はいずれも一貫して妥当に設計されている。一方、Explorer 幅の dynamic max 計算式が、実際に到達可能な極端な狭幅 window で自ら定義した最小幅 (180px) を下回る値を返し得る契約矛盾を検出した。

---

## 1. 齟齬・不整合

### 1.1 極端な狭幅 workspace で dynamic max が最小幅 180px を下回り、`clampExplorerWidth` の出力が自らの最小値契約に違反する

**ドキュメント記載**: 「最小幅 180px」「hard最大幅 640px」「Preview予約幅 320px」(design 73-80行)。「dynamic maxは`min(640, workspaceWidth - 320 - 6)`とし、最小幅を下回るworkspaceでは180pxを優先してPreviewを残り幅へ縮小する」(design 82行)。「workspaceが最小Explorer + Preview予約幅 + separator幅より狭い場合、Explorer最小幅を優先し、Previewは残り幅へ縮む」(design 218行)。

**差異**: `workspaceWidth < 180 + 320 + 6 = 506px` のとき、記載の式どおりに計算すると `dynamicMax = min(640, workspaceWidth - 326)` は 180 を下回る（例: `workspaceWidth = 400` なら `dynamicMax = 74`）。一般的な `clamp(width, min, max) = Math.min(Math.max(width, min), max)` の実装では、`max < min` の場合の戻り値は常に `max` になり、これは `min` (180px) を下回る。つまり「180pxを優先する」という設計意図と、直前に定義された計算式そのものが矛盾しており、`getExplorerWidthBounds` が「`max` を `min` 未満に決して落とさない」という floor 処理を明示的に持つのか、design 82行の式をそのまま実装するのかが一意に定まらない。後者のまま実装されると、`clampExplorerWidth` の出力・`getExplorerWidthForKey("Home", ...)` の到達値・`aria-valuemin`/`aria-valuemax` の関係が最小幅契約を破り、TODO-2026-019 の完了条件「pointer操作でExplorer幅を最小値・最大値の範囲内に変更でき」(todo.md 173行) に反する。

この狭幅は理論上の境界ではない。`tauri.conf.json` に `minWidth`/`minHeight` の指定はなく、`ViewerSettings.windowSize` の 640..10000 という範囲は `save_window_size` / `load_viewer_settings` の**永続化時のデータ検証**であって、OS ネイティブウィンドウの実サイズを強制する制約ではない（`src-tauri/src/lib.rs` にも window 自体への min size 設定は見当たらない）。したがって利用者が OS のウィンドウ端をドラッグして 506px 未満まで狭めることは実際に可能であり、この矛盾は到達可能な操作で発生する。

**推奨対応**: `getExplorerWidthBounds(workspaceWidth)` の契約を「`max = Math.max(minWidth, Math.min(hardMax, workspaceWidth - previewReserve - separatorWidth))` とし、常に `max >= min` を保証する」ことを design 6.1 節へ明記する。あわせて design §15 の自動テスト一覧（現状 7 項目、design 255-264行）へ「`workspaceWidth` が `min + previewReserve + separatorWidth` を下回る場合に `bounds.max === bounds.min` であること」を検証するテストケースを追加する。Home / End キー操作がこの狭幅で最小幅へ収束すること（design 117行の記載と矛盾しないこと）も同テストで確認する。

**severity**: High（完了条件の中核である最小幅保証が、設計記載の式のままでは実装可能な形で成立しない）

**工程**: Phase 2（設計書修正・再レビュー）

**status**: open

### 1.2 disclosure chevron / type icon / spacer / label の列構成契約が未確定で、既存 `.tree-icon` / `grid-template-columns` との置き換え関係が設計書に明記されていない

**ドキュメント記載**: 「disclosureとtype iconを別要素にし、typed inline SVGを表示する」(design 25行)。「directoryのdisclosure chevronはtype iconと分離し、file rowにも同じ幅のspacerを置いてlabel位置を揃える」(design 153行)。「`.file-tree`は`width: max-content; min-width: 100%`、`.tree-row`は`width: max-content; min-width: 100%`とする」(design 140行)。

**差異**: 現行実装 (`App.tsx:1462-1500`, `App.css:512-544`) は `.tree-row` が `grid-template-columns: 30px minmax(0, 1fr)` の2列（アイコン1個 + label）で、`.tree-icon` はテキスト文字（`v`/`>`、`MD`/`HTML`/`IMG`）向けの `font-size`/`font-weight`/`letter-spacing` で styling されている。設計は directory row に「chevron + folder icon」の2要素、file row に「spacer + type icon」の2要素を導入するとしているが、これは列数が2列から3列（またはそれ以上）へ変わることを意味する一方、design には更新後の `grid-template-columns` 値も、SVG icon 用に置き換わる `.tree-icon` 相当のクラス構成も具体的に示されていない。`.tree-row` の `width` を `max-content` に変更しつつ列内訳が未確定だと、次の2点の実装時判断がぶれる余地が残る。

1. 「短いtreeでも各rowがviewport幅を満たし、hover / selected背景がpane端まで届く」(design 140行, 299行のrisk対応) を、新しい列構成でも `min-width: 100%` が意図どおり効くか（列の一部にだけ固定幅を割り当てた場合、`minmax(0, 1fr)` を持つ label 列がどこに来るかで挙動が変わる）。
2. directory row と file row で列数・列幅が食い違うと、「file rowにも同じ幅のspacerを置いてlabel位置を揃える」(design 153行) の意図するインデント整合が崩れる。

**推奨対応**: design §6.5 または §6.6 へ、更新後の `.tree-row` の列構成（例: `<spacer/chevron> <type icon> <label>` の固定px幅と `minmax(0, 1fr)` の位置）を明示し、`.tree-icon` を置き換える新クラス名（例: `.tree-disclosure` / `.tree-type-icon`）と、directory row / file row で共通の列テンプレートを使うことを明記する。既存 `.tree-icon` の font 系プロパティ（`App.css:535-544`）を SVG サイズ指定へ置き換える方針も一言添える。

**severity**: Medium（実装時に列構成の解釈がぶれると、design が明示的にリスクとして認識している「短い行の背景がpane端まで届かない」問題 (design 297-299行) を再発させ得る）

**工程**: Phase 2（設計書修正）または Phase 3 着手前の実装方針確定

**status**: open

---

## 2. ドキュメント不足

なし。恒久ドキュメント更新予定 (design §14: README / basic_design / detail_design / interface_spec / development_workflow.md) は、現行 `detail_design.md`「UI レイアウト」節（sticky `pane-title`、`.explorer-pane` 単一 scroll 領域、文字アイコンの記述）や `interface_spec.md`「Explorer item click」節（resize / keyboard操作の記載なし）など、実際に更新が必要な箇所を過不足なく網羅している。ADR は「Explorer固有のsession layout判断であり、複数案件へ適用済みの横断判断ではない」(design 251行) とされ、`docs/adr/README.md` にも scroll / layout 責務境界に関する既存 ADR は見当たらず、運用ルールと矛盾しない。

---

## 3. 改善提案

### 3.1 separator の touch-action 制御が設計に明記されていない

**推奨対応**: pointer capture を正本とする設計（design 100-104行）はマウス操作では十分だが、トラックパッド/タッチ対応 WebView でタッチ操作を行った場合、既定の `touch-action` によるスクロールジェスチャが pointer 系イベントの解釈に干渉する可能性がある。design §6.3 または §6.4 へ「separator要素へ `touch-action: none` を設定し、タッチ操作でもpointer captureの解釈を安定させる」旨を一言追記すると、Phase 4 の手動確認で予期しない挙動に遭遇するリスクを下げられる。

**severity**: Low

**status**: open

### 3.2 非drag時のseparator hoverカーソルが設計に明記されていない

**推奨対応**: design 104行は「drag中はapp shellへclassを付与してuser-select: noneとcol-resize cursorを適用する」と drag 中の cursor 制御のみ記載しており、drag 開始前に利用者へ「ここが操作可能」であることを示す静的な `cursor: col-resize`（`:hover` 等）への言及がない。design §6.3 か §6.5 へ、separator 自体の base style として `cursor: col-resize` を持つことを一言明記すると、実装判断のばらつきを防げる。

**severity**: Low

**status**: open

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` TODO-2026-019 完了条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| pointer操作でExplorer幅を最小値・最大値の範囲内に変更でき、Previewが残り幅へ追従する | §6.1 (bounds/clamp policy)、§6.2 (state)、§6.3 (pointer)、§6.5 (3列 grid) | △ 指摘1.1により、極端な狭幅では「最小値・最大値の範囲内」という契約自体が式のままでは保証されない |
| resizerがseparatorとして認識でき、keyboard操作でもExplorer幅を変更できる | §6.4 (role="separator", ARIA, ArrowLeft/Right/Home/End) | ✓ 整合。ARIA属性・key処理・focus-visible方針は妥当 |
| 深い階層または長い名前がpane幅を超えた場合だけExplorer内に水平scrollbarが表示され、tree contentの末尾へ到達できる | §6.5 (`.explorer-scroll`分離、`max-content`/`min-width:100%`) | ✓ 整合。header/scroll viewport分離とintrinsic width方式は妥当なCSS手法である |
| directory、Markdown、HTMLに識別可能なアイコンが表示され、imageを含む各nodeの名前、選択、開閉、disabled状態が判別できる | §6.6 (TreeNodeIcon)、§6.4 (aria-hidden iconとaccessible name分離) | △ 指摘1.2により、列構成・既存`.tree-icon`置き換えの契約が未確定 |
| Explorer幅変更中と変更後にroot選択、tree開閉、Markdown / HTML選択、tab操作、Previewの縦scrollが退行しない | §10 (互換性)、§16 シナリオ9-10 | ✓ 整合。resize stateとroot/tab/document stateの独立、Preview overflow維持が明記されている |
| `npm run build`、`npm test -- --run`、`cargo check`、`cargo test`が成功し、幅変更・最小最大境界・横scroll・Light/Dark・長い名前と深い階層を手動確認する | §15 (自動テスト)、§16 (手動シナリオ)、§17 (検証コマンド) | △ 指摘1.1の狭幅境界ケースが自動テスト一覧(§15)に含まれていない |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| pointer capture / pointer cancel の設計 (§6.3) | ✓ 整合。`setPointerCapture`を正本とし、window listenerや透明overlayを重複追加しない方針はHTML iframe越しのdrag継続（design 301行のrisk）に対して妥当。pointer ID不一致・non-primary buttonの無視も明記されている |
| ResizeObserver のmount/cleanup (§6.2) | ✓ 整合。mount時observe、cleanupでdisconnectのみで、I/OやTauri commandを伴わない |
| treeの`max-content` / `min-width: 100%`によるscroll分離 (§6.5) | ✓ 整合。`.file-tree`が`width: max-content`で最も深く長い行の実寸に応じて自身を伸縮し、中間の入れ子`<div>`（directoryのchildren wrapper）が明示的な`width`指定を持たなくても、CSSのintrinsic sizing計算は子孫の内在幅を再帰的に伝播するため、深い階層でも水平scrollが必要時だけ働く。pane-titleをscroll viewportの外（別grid行）に出した点も、旧来のsticky titleがhorizontal scroll時に文脈を失う問題（design 166行の不採用理由）を正しく解消している |
| keyboard separatorとARIA値 (§6.4) | ✓ 整合。`role="separator"`、`aria-orientation`、`aria-valuemin/max/now`、処理したkeyだけ`preventDefault()`する方針はWAI-ARIA separator patternと矛盾しない |
| directory/Markdown/HTML/imageの4種類とdisclosure分離 (§6.6) | ✓ 整合。`FileNodeType`の4値（directory/markdown/html/image）を過不足なく網羅し、iconをaria-hiddenにしてnode名をaccessible nameの正本とする方針はデコラティブiconの標準的な扱いと一致する。disabled行の`color: var(--muted)`が`currentColor`のSVGへ自然に継承される点も既存CSSとの整合が良い |
| `explorerPane.ts`のpure policy分離度 (§6.1, §12) | ✓ 整合。汎用SplitPane抽象化を明示的に見送り（design 169行）、既存window resize queueやTabStrip overflow CSSとの共通化も責務・頻度の違いを理由に見送っている（design 225-227行）。既存`documentPolicy.ts`と同じ「DOM非依存のpure functionをpolicy moduleへ集約」というプロジェクト内既存パターンにも一致し、過剰抽象化・重複実装のいずれにも該当しない |
| 既存app shell / Preview / HTML iframe / tab / root操作への回帰観点 (§10) | ✓ 整合。resize stateがroot/tab/document stateと独立し、root変更・Reload・tab切替で幅がresetされない設計、Preview `overflow: auto`を変更しない明記、手動シナリオ9-10でroot/tab/Preview縦scrollとdrag中のpointer遷移を確認する計画は十分 |
| Avalonia後続TODOとの責務境界と非対象判断の追跡可能性 (§18, todo.md) | ✓ 整合。TODO-2026-020のdepends_on/execution_order、design §18の「幅永続化が必要になった場合は独立spec-changeとして起票する」という追跡先の明記により、非対象判断の理由と再検討条件がtodoとdesignの双方から追跡できる |
| ADR要否判断 (§14末尾) | ✓ 整合。`docs/adr/README.md`にscroll/layout責務境界を扱う既存ADRはなく、横断判断でないという判断根拠と矛盾しない |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 高 | 1.1 dynamic maxが最小幅を下回り得る契約矛盾 | 到達可能な狭幅操作で完了条件の中核（幅の最小値保証）が設計のまま成立せず、実装後の境界値テストまで発覚しない可能性が高い |
| 中 | 1.2 icon/disclosure列構成契約の未確定 | 実装時の解釈のブレが、design自身が認識済みのrisk（短い行の背景がpane端まで届かない）を再発させ得る |
| 低 | 3.1 touch-action未指定 / 3.2 非drag時cursor未指定 | 実装時確定で手戻りが小さく、機能要求の充足自体は妨げない |

---

## 7. 残リスク / Phase 3 での注意点

- 指摘1.1の修正方針次第で、`aria-valuemax`が極端な狭幅で`aria-valuemin`と同値になる。ARIA値の同値ケースをスクリーンリーダーが正しく扱えるかは、design §16の手動シナリオへ狭幅ケースを追加して確認すること。
- `.explorer-scroll`が縦横両方の`overflow: auto`を持つため、水平scrollbarの出現がcontent高さを圧迫し縦scrollbarの要否が変化する相互作用がある。OS/WebView別のscrollbar表示設定差はdesign §18で既にriskとして認識されているが、Phase 4の手動確認でLight/Dark双方・3 platformでの見え方を実機確認すること。
- 指摘1.2の列構成が確定した後、`min-width: 100%`が新しい列テンプレートでも維持されることを、短い名前のtree（1階層、短いlabel）と長い名前のtree（深い階層、長いlabel）の両方でPhase 4手動シナリオに含めること。

---

## 8. 結論

設計は Explorer 幅の pointer/keyboard resize、tree の水平 scroll 分離、icon 導入、既存操作への回帰観点、Avalonia 後続 TODO との責務境界を丁寧に整理しており、pointer capture の設計、`max-content`/`min-width: 100%` による scroll 分離の CSS 手法、`explorerPane.ts` の pure policy 分離度（過剰抽象化にも重複実装にも該当しない）、恒久ドキュメント更新先の網羅性はいずれも高品質である。

一方、Explorer 幅の dynamic max 計算式 (design 82行) が、`tauri.conf.json` に window の実サイズを強制する制約がないために実際に到達可能な極端な狭幅 window で、design 自身が定義した最小幅 180px を下回る値を返し得るという契約矛盾（指摘1.1, High）を検出した。これは TODO-2026-019 の完了条件「Explorer幅を最小値・最大値の範囲内に変更できる」の中核部分であり、設計記載のままでは実装可能な形で成立しない。あわせて、disclosure/type icon/spacer の列構成契約が未確定であるためdesign自身が認識済みのriskを再発させ得る指摘（1.2, Medium）を検出した。

以上より、本設計を**要修正 (Changes Requested)** と判定する。指摘1.1の`getExplorerWidthBounds`契約（`max >= min`の保証）と対応する自動テストケースの追記、指摘1.2の列構成契約の明記を設計書へ反映した上で、再レビューを経てPhase 3（実装）へ進行すること。
