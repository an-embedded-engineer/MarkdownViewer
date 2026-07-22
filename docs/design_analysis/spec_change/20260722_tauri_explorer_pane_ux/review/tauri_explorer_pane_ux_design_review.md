# TODO-2026-019 Tauri Explorer ツリーペイン UX 改善 設計レビュー

**レビュー日**: 2026-07-22
**再確認日**: 2026-07-22
**対象ドキュメント**: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/design/tauri_explorer_pane_ux_design.md`
**対象 meta**: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-019
**初回レビュー対象コミット**: `c1038c9` (docs: design Tauri explorer pane UX)
**Round 1 fix コミット**: `0edff56` (docs: address Tauri explorer design review)
**判定**: **承認 (Approved)**。Phase 3 進行可。初回判定は要修正 (Changes Requested) だったが、全指摘 (High 1 / Medium 1 / Low 2) の設計反映を Round 1 follow-up 再確認で解決済みと判定した。未解決指摘 0 件。

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

**initial status**: open

**対応**: design §6.1の式を`max(180, min(640, workspaceWidth - 320 - 6))`へ修正し、workspaceが506px未満でも`max >= min`を保証する契約を明記した。未計測・非有限・0以下の扱いもhard max利用として固定した。§6.4へ狭幅時のARIA同値契約、§15へ`bounds.max === bounds.min === 180`とHome / End収束のunit test、§16へ実ウィンドウを506px未満へ縮める手動確認を追加した。

**確認 (0edff56)**: design 82行の式が `dynamic max = max(180, min(640, workspaceWidth - 320 - 6))` へ修正され、外側の`max(180, ...)`により`workspaceWidth`がどれだけ小さくても戻り値が180未満にならないことを数式レベルで確認した（例: `workspaceWidth = 400` → `min(640, 74) = 74` → `max(180, 74) = 180`）。これにより`clampExplorerWidth`・`getExplorerWidthForKey("Home"/"End", ...)`の出力が常に`min <= width <= max`を満たし、TODO-2026-019完了条件「Explorer幅を最小値・最大値の範囲内に変更できる」と矛盾しなくなった。design 121行に「workspaceが506px未満の時は`aria-valuemin`と`aria-valuemax`がともに180となり、Home / Endはいずれも180pxへ収束する」という意図した同値状態が明記され、指摘時に残した「ARIA値の同値ケースをスクリーンリーダーが正しく扱えるか」という残リスクも、design 279行（手動シナリオ5）で明示的な手動確認対象になった。design 262-264行（自動テスト項目3-4）に推奨した`bounds.max === bounds.min === 180`とHome/End収束のテストケースが追加され、design §15の自動テスト一覧の欠落も解消されている。`workspace未計測または非有限・0以下の時だけhard最大幅を利用し`という追記（design 82行）は、当初の「未計測時」限定の記載より広い防御的正規化であり、既存のNaN/非有限値正規化方針（design 221行）と矛盾しない。新たな契約矛盾は確認されなかった。

**status**: 解決済み（2026-07-22 再確認、commit `0edff56`）

### 1.2 disclosure chevron / type icon / spacer / label の列構成契約が未確定で、既存 `.tree-icon` / `grid-template-columns` との置き換え関係が設計書に明記されていない

**ドキュメント記載**: 「disclosureとtype iconを別要素にし、typed inline SVGを表示する」(design 25行)。「directoryのdisclosure chevronはtype iconと分離し、file rowにも同じ幅のspacerを置いてlabel位置を揃える」(design 153行)。「`.file-tree`は`width: max-content; min-width: 100%`、`.tree-row`は`width: max-content; min-width: 100%`とする」(design 140行)。

**差異**: 現行実装 (`App.tsx:1462-1500`, `App.css:512-544`) は `.tree-row` が `grid-template-columns: 30px minmax(0, 1fr)` の2列（アイコン1個 + label）で、`.tree-icon` はテキスト文字（`v`/`>`、`MD`/`HTML`/`IMG`）向けの `font-size`/`font-weight`/`letter-spacing` で styling されている。設計は directory row に「chevron + folder icon」の2要素、file row に「spacer + type icon」の2要素を導入するとしているが、これは列数が2列から3列（またはそれ以上）へ変わることを意味する一方、design には更新後の `grid-template-columns` 値も、SVG icon 用に置き換わる `.tree-icon` 相当のクラス構成も具体的に示されていない。`.tree-row` の `width` を `max-content` に変更しつつ列内訳が未確定だと、次の2点の実装時判断がぶれる余地が残る。

1. 「短いtreeでも各rowがviewport幅を満たし、hover / selected背景がpane端まで届く」(design 140行, 299行のrisk対応) を、新しい列構成でも `min-width: 100%` が意図どおり効くか（列の一部にだけ固定幅を割り当てた場合、`minmax(0, 1fr)` を持つ label 列がどこに来るかで挙動が変わる）。
2. directory row と file row で列数・列幅が食い違うと、「file rowにも同じ幅のspacerを置いてlabel位置を揃える」(design 153行) の意図するインデント整合が崩れる。

**推奨対応**: design §6.5 または §6.6 へ、更新後の `.tree-row` の列構成（例: `<spacer/chevron> <type icon> <label>` の固定px幅と `minmax(0, 1fr)` の位置）を明示し、`.tree-icon` を置き換える新クラス名（例: `.tree-disclosure` / `.tree-type-icon`）と、directory row / file row で共通の列テンプレートを使うことを明記する。既存 `.tree-icon` の font 系プロパティ（`App.css:535-544`）を SVG サイズ指定へ置き換える方針も一言添える。

**severity**: Medium（実装時に列構成の解釈がぶれると、design が明示的にリスクとして認識している「短い行の背景がpane端まで届かない」問題 (design 297-299行) を再発させ得る）

**工程**: Phase 2（設計書修正）または Phase 3 着手前の実装方針確定

**initial status**: open

**対応**: design §6.5 / §6.6へ全row共通の`16px 18px max-content` 3列、4px gap、12px右paddingを定義した。第1列を`.tree-disclosure` / `.tree-disclosure-spacer`、第2列を`.tree-type-icon`、第3列をlabelとし、既存`.tree-icon`の文字用font stylingをSVG size / `currentColor`へ置換する方針を明記した。短いtreeと長いtreeの双方を§16の手動確認へ具体化した。

**確認 (0edff56)**: design 144行に「全rowは`grid-template-columns: 16px 18px max-content`と4pxのcolumn gapを共通利用し、第1列をdisclosureまたは同幅spacer、第2列をtype icon、第3列をlabelとする」という具体的な列テンプレートが明記され、directory row / file rowが列数・列幅を共有することが数値レベルで確定した。design 157行で、旧`.tree-icon`とその文字向け`font-size` / `font-weight` / `letter-spacing`を明示的に削除し、`.tree-disclosure` / `.tree-disclosure-spacer` / `.tree-type-icon`という新クラス名とSVG向け`16px以下のwidth / height` + `currentColor`の指定へ置き換える方針が確定しており、置き換え関係の曖昧さは解消された。design 144行末尾に「短いtreeでは`min-width: 100%`により各rowのbutton boxがviewport幅を満たし、hover / selected背景がpane端まで届く」と明記され、`min-width: 100%`と背景到達の関係も列構成確定後の文脈で再確認できる。design 279行（手動シナリオ7）が「1階層の短い名前だけを持つtreeでは...共通3列のlabel位置が揃い」を明示的に確認対象にしており、directory/file行のインデント整合という懸念点も手動確認計画に反映されている。新たな齟齬は確認されなかった。

**status**: 解決済み（2026-07-22 再確認、commit `0edff56`）

---

## 2. ドキュメント不足

なし。恒久ドキュメント更新予定 (design §14: README / basic_design / detail_design / interface_spec / development_workflow.md) は、現行 `detail_design.md`「UI レイアウト」節（sticky `pane-title`、`.explorer-pane` 単一 scroll 領域、文字アイコンの記述）や `interface_spec.md`「Explorer item click」節（resize / keyboard操作の記載なし）など、実際に更新が必要な箇所を過不足なく網羅している。ADR は「Explorer固有のsession layout判断であり、複数案件へ適用済みの横断判断ではない」(design 251行) とされ、`docs/adr/README.md` にも scroll / layout 責務境界に関する既存 ADR は見当たらず、運用ルールと矛盾しない。

---

## 3. 改善提案

### 3.1 separator の touch-action 制御が設計に明記されていない

**推奨対応**: pointer capture を正本とする設計（design 100-104行）はマウス操作では十分だが、トラックパッド/タッチ対応 WebView でタッチ操作を行った場合、既定の `touch-action` によるスクロールジェスチャが pointer 系イベントの解釈に干渉する可能性がある。design §6.3 または §6.4 へ「separator要素へ `touch-action: none` を設定し、タッチ操作でもpointer captureの解釈を安定させる」旨を一言追記すると、Phase 4 の手動確認で予期しない挙動に遭遇するリスクを下げられる。

**severity**: Low

**initial status**: open

**対応**: design §6.3へseparatorの`touch-action: none`を追加し、touch / trackpad由来のPointer Eventsもpointer capture契約で扱う方針を明記した。§16の手動確認にも利用可能なtouch / trackpad環境での確認を追加した。

**確認 (0edff56)**: design 106行に「`touch-action: none`を指定し、touch / trackpad由来のPointer EventsをWebViewの既定scroll gestureへ渡さず、pointer captureの開始・移動・終了を同じ契約で扱う」と明記され、推奨対応どおりの反映を確認した。design 279行（手動シナリオ10末尾）に「利用可能なtouch / trackpad環境ではscroll gestureへ奪われずresizeできる」という手動確認項目も追加されている。

**status**: 解決済み（2026-07-22 再確認、commit `0edff56`）

### 3.2 非drag時のseparator hoverカーソルが設計に明記されていない

**推奨対応**: design 104行は「drag中はapp shellへclassを付与してuser-select: noneとcol-resize cursorを適用する」と drag 中の cursor 制御のみ記載しており、drag 開始前に利用者へ「ここが操作可能」であることを示す静的な `cursor: col-resize`（`:hover` 等）への言及がない。design §6.3 か §6.5 へ、separator 自体の base style として `cursor: col-resize` を持つことを一言明記すると、実装判断のばらつきを防げる。

**severity**: Low

**initial status**: open

**対応**: design §6.3へ非drag時もseparator自体が`cursor: col-resize`を持つbase styleを明記した。

**確認 (0edff56)**: design 106行冒頭に「separator自体は非drag時も`cursor: col-resize`を持ち、操作可能な境界であることを示す」と明記され、drag前のhoverアフォーダンスがdrag中のapp shell側cursor制御（design 105行）と区別して定義された。推奨対応どおりの反映を確認した。

**status**: 解決済み（2026-07-22 再確認、commit `0edff56`）

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` TODO-2026-019 完了条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| pointer操作でExplorer幅を最小値・最大値の範囲内に変更でき、Previewが残り幅へ追従する | §6.1 (bounds/clamp policy, floor修正済み)、§6.2 (state)、§6.3 (pointer)、§6.5 (3列 grid) | ✓ 整合（Round 1解決）。指摘1.1の`max(180, ...)`floorにより、極端な狭幅でも`max >= min`が常に保証される |
| resizerがseparatorとして認識でき、keyboard操作でもExplorer幅を変更できる | §6.4 (role="separator", ARIA, ArrowLeft/Right/Home/End、狭幅ARIA同値契約) | ✓ 整合。ARIA属性・key処理・focus-visible方針、および506px未満での`aria-valuemin`/`aria-valuemax`同値契約が妥当 |
| 深い階層または長い名前がpane幅を超えた場合だけExplorer内に水平scrollbarが表示され、tree contentの末尾へ到達できる | §6.5 (`.explorer-scroll`分離、`max-content`/`min-width:100%`、3列grid確定) | ✓ 整合。header/scroll viewport分離とintrinsic width方式は妥当なCSS手法であり、列構成確定後も矛盾しない |
| directory、Markdown、HTMLに識別可能なアイコンが表示され、imageを含む各nodeの名前、選択、開閉、disabled状態が判別できる | §6.6 (TreeNodeIcon、`.tree-disclosure`/`.tree-type-icon`列契約確定)、§6.4 (aria-hidden iconとaccessible name分離) | ✓ 整合（Round 1解決）。指摘1.2の列テンプレート・クラス名・旧`.tree-icon`置換方針が具体化された |
| Explorer幅変更中と変更後にroot選択、tree開閉、Markdown / HTML選択、tab操作、Previewの縦scrollが退行しない | §10 (互換性)、§16 シナリオ9-10 | ✓ 整合。resize stateとroot/tab/document stateの独立、Preview overflow維持が明記されている |
| `npm run build`、`npm test -- --run`、`cargo check`、`cargo test`が成功し、幅変更・最小最大境界・横scroll・Light/Dark・長い名前と深い階層を手動確認する | §15 (自動テスト、狭幅floorテスト追加)、§16 (手動シナリオ、狭幅/touch確認追加)、§17 (検証コマンド) | ✓ 整合（Round 1解決）。狭幅境界ケースの自動テスト(§15項目3-4)と手動シナリオ(§16項目5)が追加された |

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

## 6. 対応優先度（初回レビュー時点）

| 優先度 | 項目 | 理由 | Round 1結果 |
| --- | --- | --- | --- |
| 高 | 1.1 dynamic maxが最小幅を下回り得る契約矛盾 | 到達可能な狭幅操作で完了条件の中核（幅の最小値保証）が設計のまま成立せず、実装後の境界値テストまで発覚しない可能性が高い | 解決済み |
| 中 | 1.2 icon/disclosure列構成契約の未確定 | 実装時の解釈のブレが、design自身が認識済みのrisk（短い行の背景がpane端まで届かない）を再発させ得る | 解決済み |
| 低 | 3.1 touch-action未指定 / 3.2 非drag時cursor未指定 | 実装時確定で手戻りが小さく、機能要求の充足自体は妨げない | 解決済み |

---

## 7. 残リスク / Phase 3 での注意点

Round 1で以下はすべてdesign §16の手動シナリオへ具体的な確認項目として反映済みである（新たな指摘ではなく、Phase 4実施時に観察結果を確認する項目として記録する）。

- `aria-valuemax`が極端な狭幅で`aria-valuemin`と同値になる契約（design 121行）について、design 279行（手動シナリオ5）で狭幅時のARIA値と不正な幅への非遷移を確認する計画になっている。実機でのスクリーンリーダー挙動をPhase 4で観察すること。
- `.explorer-scroll`が縦横両方の`overflow: auto`を持つため、水平scrollbarの出現がcontent高さを圧迫し縦scrollbarの要否が変化する相互作用がある。design §18のrisk行と手動シナリオ6（design 278行、水平scrollbar追加後の縦到達性）に追加済みだが、Light/Dark双方・3 platformでの見え方をPhase 4で実機確認すること。
- 指摘1.2で確定した3列テンプレート・`min-width: 100%`が、短い名前のtree（1階層、短いlabel）と長い名前のtree（深い階層、長いlabel）の両方で意図どおり動くことを、design 279行（手動シナリオ7）に沿ってPhase 4で確認すること。
- touch-action / trackpad環境でのresize操作（design 279行、手動シナリオ10）は実機がないと自動テストで検証できないため、Phase 4の利用可能な環境で確認すること。

---

## 8. 結論

設計は Explorer 幅の pointer/keyboard resize、tree の水平 scroll 分離、icon 導入、既存操作への回帰観点、Avalonia 後続 TODO との責務境界を丁寧に整理しており、pointer capture の設計、`max-content`/`min-width: 100%` による scroll 分離の CSS 手法、`explorerPane.ts` の pure policy 分離度（過剰抽象化にも重複実装にも該当しない）、恒久ドキュメント更新先の網羅性はいずれも高品質である。

初回レビューでは、Explorer 幅の dynamic max 計算式 (design 82行) が、`tauri.conf.json` に window の実サイズを強制する制約がないために実際に到達可能な極端な狭幅 window で、design 自身が定義した最小幅 180px を下回る値を返し得るという契約矛盾（指摘1.1, High）を検出した。これは TODO-2026-019 の完了条件「Explorer幅を最小値・最大値の範囲内に変更できる」の中核部分であり、設計記載のままでは実装可能な形で成立しなかった。あわせて、disclosure/type icon/spacer の列構成契約が未確定であるためdesign自身が認識済みのriskを再発させ得る指摘（1.2, Medium）を検出し、**要修正 (Changes Requested)** とした。

### 再確認結果 (2026-07-22, commit `0edff56`)

実装担当による指摘1.1〜1.2および改善提案3.1〜3.2の設計書反映を、commit `0edff56` の差分 (`git show 0edff56`) と更新後設計書の全体整合で再確認した。

- **1.1 (High) — 解決済み**: dynamic maxの式が`max(180, min(640, workspaceWidth - 320 - 6))`へ修正され、外側の`max(180, ...)`により戻り値が常に最小幅180px以上になることを数式レベルで確認した。狭幅時（workspaceWidth < 506px）の`aria-valuemin`/`aria-valuemax`同値契約（design 121行）、`bounds.max === bounds.min === 180`とHome/End収束の自動テスト（design §15項目3-4）、実ウィンドウを506px未満へ縮める手動シナリオ（design §16項目5）がいずれも整合して追加されており、TODO-2026-019完了条件「Explorer幅を最小値・最大値の範囲内に変更できる」が設計記載のまま成立するようになった。
- **1.2 (Medium) — 解決済み**: 全rowで共有する`grid-template-columns: 16px 18px max-content`・4px gap・12px右paddingの3列テンプレートが確定し（design 144行）、`.tree-disclosure`/`.tree-disclosure-spacer`/`.tree-type-icon`という新クラス名と、旧`.tree-icon`の文字向けfont stylingを削除してSVG size/`currentColor`へ置き換える方針が明記された（design 157行）。directory/file行が同じ列テンプレートとlabel開始位置を共有する契約により、実装時の列構成解釈のブレは解消された。
- **3.1 (Low) — 解決済み**: separatorへの`touch-action: none`指定と、touch/trackpad由来のPointer Eventsをpointer capture契約で扱う方針がdesign 106行へ追加され、design §16項目10末尾へ利用可能なtouch/trackpad環境での手動確認も追加された。
- **3.2 (Low) — 解決済み**: 非drag時もseparator自体が`cursor: col-resize`を持つbase styleがdesign 106行冒頭へ明記され、drag中のapp shell側cursor制御（design 105行）と区別して定義された。

対応による新たな齟齬・実装不能な契約は検出しなかった。受け入れ条件トレース（第4節）は全行 ✓ へ更新済みである。以上より本設計を**承認 (Approved)** とし、Phase 3（実装）への進行を可とする。Phase 3では第7節の残リスク（狭幅時ARIA値の実機スクリーンリーダー挙動、水平/縦scrollbar相互作用のLight/Dark・3 platform確認、短い/長いtreeでの3列レイアウト確認、touch/trackpad環境でのresize確認）に留意すること。

---

## 9. 指摘対応 Round 1

| 指摘 | severity | 対応 | 状態 |
| --- | --- | --- | --- |
| 1.1 dynamic maxと最小幅の契約矛盾 | High | max floor、狭幅ARIA契約、自動・手動境界テストを設計へ追加 | 解決済み（再確認済み、`0edff56`） |
| 1.2 tree 3列契約の不足 | Medium | 列幅、gap、class、旧style置換、短／長tree確認を確定 | 解決済み（再確認済み、`0edff56`） |
| 3.1 touch-action不足 | Low | `touch-action: none`とmanual確認を追加 | 解決済み（再確認済み、`0edff56`） |
| 3.2 resting cursor不足 | Low | separator base styleへ`cursor: col-resize`を追加 | 解決済み（再確認済み、`0edff56`） |

Round 1の全指摘について、設計書 (`0edff56`) への反映内容が推奨対応と整合し、新たな齟齬を生じさせていないことを確認した。未解決指摘は0件であり、総合判定は**承認 (Approved)**。Phase 3（実装）へ進行してよい。
