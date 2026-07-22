# TODO-2026-019 Tauri Explorer ツリーペイン UX 改善 実装レビュー (Phase 3)

**レビュー日**: 2026-07-22
**対象TODO**: `docs/todo/todo.md` TODO-2026-019
**対象設計**: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/design/tauri_explorer_pane_ux_design.md`（Phase 2 承認済み、未解決指摘0件）
**対象実装記録**: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/impl/tauri_explorer_pane_ux_impl.md`
**レビュー対象コミット**: `6310f88` (feat: improve Tauri explorer pane UX)
**判定**: **要修正 (Changes Requested)**。未解決指摘 1 件（Medium）。改善提案 2 件（Low、非ブロッキング）。

---

## 概要

TODO-2026-019 の Phase 3 実装レビュー。承認済み設計 (`bf93e00`/`f1da27b` で Approved) と実装コミット `6310f88` (`markdown-viewer-tauri/src/App.tsx`、`App.css`、新規 `explorerPane.ts` / `explorerPane.test.ts`、`docs/components/tauri_viewer/*`、`docs/rules/development_workflow.md`) を突き合わせ、受け入れ条件トレース、pointer capture / cancel / lost capture、ResizeObserver、狭幅時の min/max 同値契約、keyboard / ARIA 契約、tree の水平 scroll と 3 列 layout、icon の accessible name、既存経路への回帰、pure policy の責務分離と境界値テスト、実装記録・恒久ドキュメントとコードの一致を検証した。検証は差分読解に加え、`npm test -- --run`、`npm run build`、`cargo check`、`cargo test`、`cargo fmt -- --check` をレビュー担当自身が再実行して行った。

Explorer 幅 policy (`explorerPane.ts`)、pointer capture / cancel / lost-capture 処理、keyboard / ARIA 契約、tree の水平 scroll 分離と 3 列 layout、icon の accessible name 処理はいずれも承認済み設計と数値・契約レベルで一致し、Phase 2 Round 1 で確定した狭幅時の `max >= min` floor もテストで裏付けられている。一方、directory 行に承認済み設計が要求していない `disabled` 状態が追加されており、TODO の互換性要件「既存の tree 開閉…契約を維持する」と、恒久ドキュメントの `isGlobalBusy` 記載に対して未整理の齟齬を検出した。

---

## 1. 齟齬・不整合

### 1.1 directory 行への `disabled` 追加が、承認済み設計・TODO 互換性要件・恒久ドキュメントのいずれにも反映されないまま導入されている

**ドキュメント記載**: 設計書は directory button について「既存button semanticsに加えて`aria-expanded`を設定する」(design 123行) とだけ記載し、`disabled` の追加は要求していない。TODO-2026-019 は互換性要件として「root選択、tree開閉、Markdown / HTML選択、tab操作、Preview表示の既存契約を維持する」(todo.md 170行)、完了条件として「Explorer幅変更中と変更後に...tree開閉...が退行しない」(todo.md 177行) を明記する。

**差異**: 現行実装 (`App.tsx:1616-1636` の `TreeNode` directory 分岐) は `disabled={disabled}` を directory row の `<button>` へ新規追加した。`disabled` は `isGlobalBusy`（`isRootLoading || isAppConfigBusy`）に連動するため、root scan 中や Settings / Recent Folders 保存中など `isGlobalBusy` が true の間、native `<button disabled>` の挙動により**表示済みディレクトリの開閉クリックが一切反応しなくなる**。変更前 (`c1038c9` 時点および実装前の `App.tsx`) は directory row に `disabled` 属性が一度も存在せず、busy 状態でも開閉は常に機能していた。

実装記録 (`impl/tauri_explorer_pane_ux_impl.md:24`) はこれを「設計で要求したdisabled状態の一貫性を確保した」と記述しているが、設計書のどの節にもこの要求は存在しない（design 123行は`aria-expanded`のみ）。TODO の互換性要件が「既存のtree開閉契約を維持する」と明記している以上、この新しい抑止は本来「維持」の対象からの逸脱であり、少なくとも設計書・TODO・恒久ドキュメントのいずれかで再承認・記録される必要がある。

さらに、`docs/components/tauri_viewer/detail_design.md:23` の既存 state 表は `isGlobalBusy` を「root競合操作だけを抑止。tab activate / closeは許可」と説明しており、この記載は今回の変更でも更新されていない。ディレクトリ展開/折りたたみはルート走査と競合するI/Oを伴わない純粋なクライアント側トグルであり、「root競合操作」という説明の範囲に本来含まれない操作まで抑止対象が広がったにもかかわらず、恒久ドキュメントはその拡大を反映していない。

**推奨対応**: 次のいずれかを選択する。
- (a) directory row の `disabled={disabled}` を削除し、承認済み設計・TODO 互換性要件どおり directory 開閉を busy 状態でも常に機能させる（file row の `disabled` は image 選択不可の既存契約のみを維持する）。
- (b) 意図した仕様変更として採用する場合は、TODO-2026-019 の compatibility / completion 記載および設計書 §6.4 へ「directory開閉もisGlobalBusy中は抑止する」ことを明記し、`detail_design.md:23` の `isGlobalBusy` 説明を新しい抑止範囲に合わせて更新する。

**severity**: Medium（機能的な回帰ではあるが影響時間は短く、データ整合性には影響しない一方、TODOの明示的な互換性要件からの未承認の逸脱であり、恒久ドキュメントの記載とコードが不一致になっている）

**工程**: Phase 3（実装またはドキュメント修正）

**対応**: 推奨対応(a)を採用し、directory rowから`disabled={disabled}`を削除した。これによりglobal busy中も既存のclient-side tree開閉を維持し、file rowのdisabled契約だけを従来どおり保持する。実装記録にあった誤った設計差分の説明も訂正した。

**status**: addressed; follow-up review pending

---

## 2. 改善提案

### 2.1 separator の `pointerdown` での `event.preventDefault()` が、drag後にseparator自身へfocusを残すかどうか未確認

**推奨対応**: `handleExplorerPointerDown` (`App.tsx`) は `event.preventDefault()` を呼ぶ。多くのブラウザ/WebViewエンジンでは、focus可能な要素 (`tabIndex={0}` を持つ `div`) はmousedown/pointerdownでdefaultのfocus-follows-click挙動を持つが、`preventDefault()`はこの自動focusを抑止し得る。ArrowLeft/ArrowRight/Home/Endの直後操作を、pointer dragの直後にfocusなしで行えるかはWebViewエンジン間で差が出る可能性があるため、design §16の手動シナリオ4（focusとARIA値の対応確認）実施時に、pointer dragを終えた直後の`document.activeElement`がseparatorになっているかをPhase 4-aで確認するとよい。挙動が意図と異なる場合は、`onPointerUp`/`finishExplorerResize`内で明示的に`event.currentTarget.focus()`を呼ぶ対応を検討する。

**severity**: Low

**対応**: `pointerdown`でseparator自身へ明示的に`focus()`してからpointer captureを開始するよう変更した。`preventDefault()`のWebView差異に依存せず、drag直後にkeyboard操作へ継続できる契約とした。Phase 4-aの手動確認項目にも追加した。

**status**: addressed; follow-up review pending

### 2.2 drag中のcursor強制がsandboxed HTML iframeの内部文書には及ばない

**推奨対応**: `.explorer-resizing, .explorer-resizing * { cursor: col-resize !important; }` はapp shell側DOMの子孫要素へcursorを強制するが、`HtmlPreview`のiframeは別文書(`sandbox="allow-scripts"`)であるため、親のCSSはiframe内部のcursor表示には反映されない。pointer captureにより resize自体は機能し続けるため実害はないが、HTML tabをactiveにした状態でdragすると、iframe領域上でcursorが一時的に既定表示へ戻る可能性がある。design §18のrisk表（iframe上のdrag継続）と合わせて、Phase 4-aのHTML tab手動確認でcursorの見え方に違和感がないか確認するとよい。修正が必要な場合も、機能的なdrag継続には影響しないため優先度は低い。

**severity**: Low

**対応**: sandboxed iframeの内部文書へ親CSSを適用する変更は行わず、pointer captureによる機能継続を維持する。HTML表示中のiframe上でdrag継続とcursorの見え方を確認する項目を`docs/rules/development_workflow.md`と実装記録へ追加し、Phase 4-aへ明示的に引き継いだ。

**status**: addressed by Phase 4-a verification handoff; follow-up review pending

---

## 3. 受け入れ条件トレース確認

| `docs/todo/todo.md` TODO-2026-019 完了条件 | 実装での対応箇所 | 結果 |
| --- | --- | --- |
| pointer操作でExplorer幅を最小値・最大値の範囲内に変更でき、Previewが残り幅へ追従する | `explorerPane.ts`(`getExplorerWidthBounds`/`clampExplorerWidth`)、`App.tsx`(`handleExplorerPointerDown/Move`、3列grid) | ✓ 整合。狭幅floorも`getExplorerWidthBounds(400)`が`{min:180,max:180}`を返すテストで確認済み |
| resizerがseparatorとして認識でき、keyboard操作でもExplorer幅を変更できる | `App.tsx`の`explorer-separator`div（role/aria/tabIndex/onKeyDown）、`getExplorerWidthForKey` | ✓ 整合。ArrowLeft/Right/Home/Endとunsupported keyの契約がtestと一致 |
| 深い階層または長い名前がpane幅を超えた場合だけExplorer内に水平scrollbarが表示され、tree contentの末尾へ到達できる | `App.css`の`.explorer-scroll`/`.file-tree`/`.tree-row`（`max-content`+`min-width:100%`） | ✓ 整合（CSS契約はレビューで確認。実際の見え方はPhase 4-a手動確認対象） |
| directory、Markdown、HTMLに識別可能なアイコンが表示され、imageを含む各nodeの名前、選択、開閉、disabled状態が判別できる | `TreeDisclosure`/`TreeNodeIcon`（4種類のnodeType網羅、aria-hidden） | △ icon表示自体は整合するが、directory開閉のdisabled状態が指摘1.1のとおり新規追加されており、この完了条件が意図する「開閉」との関係が未整理 |
| Explorer幅変更中と変更後にroot選択、tree開閉、Markdown / HTML選択、tab操作、Previewの縦scrollが退行しない | `App.tsx`のresize state分離、`.preview-pane`の`overflow:auto`維持 | △ 指摘1.1により、busy中のtree開閉が新たに退行し得る。root選択、Markdown/HTML選択、tab操作、Preview縦scrollには回帰なし |
| `npm run build`、`npm test -- --run`、`cargo check`、`cargo test`が成功し、幅変更・最小最大境界・横scroll・Light/Dark・長い名前と深い階層を手動確認する | `impl.md`§6の自動検証結果 | ✓ 整合。レビュー担当が`npm test -- --run`(29 passed)、`npm run build`(成功)、`cargo check`(成功)、`cargo test`(22 passed)、`cargo fmt -- --check`(差分なし)を再実行し、impl.mdの報告と一致することを確認した。手動確認はPhase 4-aへ正しく委譲されている |

---

## 4. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| `explorerPane.ts`の定数とpublic API | ✓ 整合。`initialExplorerWidth`(280)、`minimumExplorerWidth`(180)、`maximumExplorerWidth`(640)、`previewReservedWidth`(320)、`explorerSeparatorWidth`(6)、`explorerKeyboardStep`(16)が設計の値表と一致し、`getExplorerWidthBounds`/`clampExplorerWidth`/`getExplorerWidthForKey`の3関数のみが公開され、汎用抽象化や重複実装は見られない |
| 狭幅floor契約 | ✓ 整合。`getExplorerWidthBounds`が`Math.max(minimumExplorerWidth, Math.min(maximumExplorerWidth, workspaceWidth - previewReservedWidth - explorerSeparatorWidth))`を実装し、Phase 2 Round 1で確定した`max >= min`floorが数式・テスト双方で保証されている |
| 境界値テストの網羅性 | ✓ 整合。`explorerPane.test.ts`の9 testが設計§15の9項目（未計測時のhard bounds、800px相当のdynamic max、狭幅floor、狭幅Home/End収束、範囲内外clamp、非有限値正規化、keyboard step境界、通常時Home/End、unsupported key）と1対1で対応し、全件passした |
| pointer capture / cancel / lost capture | ✓ 整合。`handleExplorerPointerDown`がprimary button/pointerのみを受理し、二重engageを`explorerResizeRef.current`チェックで防止する。`onPointerMove`はpointerId一致のみ処理し、`finishExplorerResize`がpointerup/pointercancelの両方でcapture解放とstate clearを行う。design未記載だった`onLostPointerCapture`もbrowserが任意タイミングでcaptureを失う場合の保険として追加されており、`finishExplorerResize`が先にrefをclearするため`releasePointerCapture`起因の`lostpointercapture`と二重処理にならない |
| ResizeObserver mount/cleanup | ✓ 整合。`isStartupConfigLoading`完了後にのみworkspaceRefをobserveし、cleanupで`disconnect()`と`explorerResizeRef.current = null`を行う。I/Oを伴わない |
| requested widthの保持 | ✓ 整合。`ResizeObserver`のcallbackは`workspaceWidth`のみを更新し`requestedExplorerWidth`には触れないため、window縮小によるclampは表示上の`explorerWidth`だけに影響し、要求値は再拡大時に復元される。pointer/keyboard入力時だけ`setRequestedExplorerWidth`が呼ばれ、その場のboundsへclampされた値が新しい要求値になる設計方針と一致する |
| keyboard / ARIA契約 | ✓ 整合。`role="separator"`、`aria-orientation="vertical"`、`aria-label`、`aria-controls="explorer-pane document-preview"`（両IDとも実在確認済み）、`aria-valuemin/max/now`、`tabIndex={0}`が実装され、処理したkeyのみ`preventDefault()`する |
| tree水平scrollと3列layout | ✓ 整合。`.explorer-pane`が2行grid（`pane-title`固定 + `explorer-scroll`）に分離され、`.file-tree`/`.tree-row`の`width:max-content; min-width:100%`と`grid-template-columns: 16px 18px max-content`がPhase 2 Round 1で確定した契約と一致する。`.explorer-scroll`に`min-height:0`が設定されており、grid内でoverflowが機能しないという典型的な不具合を回避している |
| 短い行の背景到達 | ✓ 整合。背景色は`<button className="tree-row">`要素自体（grid containerかつ`min-width:100%`で伸長済み）に適用されるため、内部grid trackが`max-content`で伸びなくても、rowの背景とクリック領域はpane幅全体に届く |
| icon / accessible name | ✓ 整合。`TreeDisclosure`/`TreeNodeIcon`が4種類の`FileNodeType`(directory/markdown/html/image)を過不足なく描画し、いずれも`aria-hidden="true"`。directory/file行とも可視の`tree-label`だけが子要素として残るため、button の accessible name は node名のままである |
| 旧`.tree-icon`・狭幅media query・ellipsisの除去 | ✓ 整合。`grep`で`.tree-icon`セレクタと`grid-template-columns: 220px ...`の残存がないことを確認した |
| touch-action / resting cursor | ✓ 整合。`.explorer-separator`に`touch-action: none`と`cursor: col-resize`のbase styleが実装され、Phase 2 Round 1の指摘3.1/3.2と一致する |
| 既存app shell / Preview / HTML iframe / tab / root操作への回帰 | ✓ 整合（指摘1.1を除く）。`TabStrip`、`MarkdownPreview`、`HtmlPreview`、root読み込み・Reload処理には変更がなく、`.preview-pane`の`overflow:auto`も維持されている |
| 依存追加の有無 | ✓ 整合。`package.json`、`Cargo.toml`に差分はなく、新規iconはinline SVGのみで外部packageを追加していない |
| Rust / data contract / Avalonia境界 | ✓ 整合。`src-tauri/`配下に変更はなく、`FileTreeNode`/`FileNodeType`/command契約は変更されていない。`TODO-2026-020`の対象範囲に影響しない |
| 自動検証コマンドの再現性 | ✓ 整合。レビュー担当が独立して`npm test -- --run`(2 files/29 tests)、`npm run build`、`cargo check`、`cargo test`(22 tests)、`cargo fmt -- --check`を再実行し、`impl.md`§6の報告と完全に一致した |
| 恒久ドキュメント反映 | △ 指摘1.1を除き整合。README.md/basic_design.md/detail_design.md/interface_spec.md/development_workflow.mdはExplorer resize policy、pointer/keyboard操作、幅境界、ARIA、tree scroll、icon契約を実装と一致する粒度で反映している |
| Phase 4以降の未解決事項の記録 | ✓ 整合。`impl.md`§7が手動確認項目をPhase 4-aへ明示的に委譲しており、Phase 3時点の実装未解決事項はないと記録している |

---

## 5. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 中 | 1.1 directory行への`disabled`追加が未承認・未文書化 | TODOの明示的な互換性要件からの逸脱であり、恒久ドキュメントの`isGlobalBusy`説明ともコードが不一致。実装を戻すか、設計・TODO・恒久ドキュメントへ明示的に反映するかの決定が必要 |
| 低 | 2.1 pointerdown後のfocus保持未確認 / 2.2 iframe内cursor不整合 | 機能的なresizeやARIA契約には影響せず、Phase 4-a手動確認で観察すれば足りる |

---

## 6. 結論

実装は承認済み設計 (`f1da27b`で確定) と数値・契約レベルで高い精度で一致しており、Phase 2 Round 1で確定した狭幅floor、3列tree layout、touch-action、resting cursorのいずれも設計どおりに反映されている。`explorerPane.ts`の境界値テストは設計§15の9項目と1対1で対応し全件成功、`npm run build` / `npm test -- --run` / `cargo check` / `cargo test` / `cargo fmt -- --check`をレビュー担当が独立して再実行し、`impl.md`の報告と完全に一致することを確認した。pointer capture / cancel / lost capture、ResizeObserver、requested widthの保持、ARIA契約、tree水平scrollの分離もいずれも既存操作への回帰なく実装されている。

一方、directory行へ承認済み設計にない`disabled`状態が追加されており(`App.tsx`の`TreeNode`)、これはTODO-2026-019の互換性要件「既存のtree開閉…契約を維持する」(todo.md 170行)からの未承認の逸脱である。`impl.md`は透明にこれを設計差分として開示しているが、実際には設計書にこの要求は存在せず(design 123行はaria-expandedのみ)、恒久ドキュメントの`isGlobalBusy`記載(`detail_design.md:23`)も新しい抑止範囲を反映していない(指摘1.1, Medium)。

以上より、本実装を**要修正 (Changes Requested)** と判定する。指摘1.1について、directory行の`disabled`を承認済み設計どおりに削除するか、意図した変更として設計・TODO・恒久ドキュメントへ明示的に反映するかを確定した上で、再レビューを経てPhase 4(検証・完了)へ進行すること。改善提案2.1/2.2はPhase 4-aの手動確認時に併せて観察すれば足り、Phase 4進行のブロッカーではない。
