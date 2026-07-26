# TODO-2026-022 Tauri Markdown画像オーバーレイ表示 設計レビュー

**レビュー日**: 2026-07-26
**対象ドキュメント**: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/design/tauri_markdown_image_overlay_design.md`
**対象 meta**: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-022
**初回レビュー対象コミット**: `e0b7fe3` (docs: design Tauri Markdown image overlay)
**判定**: **条件付き差し戻し (Changes Requested)**。設計の骨格（clone 方式、中央基準 transform model、modal 契約、非対象境界）は妥当で方針転換は不要だが、Phase 3 で実装不能または既存挙動を退行させる **Medium 7 件**を設計へ反映してから実装へ進むこと。High 0 件。**未解決指摘 14 件（Medium 7 / Low 7）**。
**Round 1対応**: 14件を設計・TODO・metaへ反映済み。Claude再確認待ち。

---

## 概要

TODO-2026-022 (Tauri Markdown 画像オーバーレイ表示) の Phase 2 設計レビュー。設計が前提とする現行契約を、実ソース (`markdown-viewer-tauri/src/App.tsx`、`App.css`、`src-tauri/src/lib.rs`)、依存 library 実体 (`node_modules/mermaid`、`node_modules/react-dom`)、既存 fixture (`sample_docs/`)、恒久ドキュメント (`docs/components/tauri_viewer/*`、`docs/rules/*`) と突き合わせて検証した。

### 事実確認できた前提（設計と実ソースが一致）

- `.markdown-body img { max-width: 100%; height: auto }`（`App.css:835-838`）、`.markdown-body .plantuml-diagram svg { max-width: 100% }`（`App.css:858-861`）、`.mermaid` / `.plantuml-diagram` の `overflow-x: auto`（`App.css:840-856`）は design §3.1 の Before 記述と一致する。
- Mermaid は `mermaid.run({ nodes })` が React 外で `.mermaid` container 内を SVG へ置換する（`App.tsx:852-885`）。outer container は残るため、design §6.2 の「container へ trigger 属性を付け、生成済み inner SVG だけを clone する」判断は成立する。
- PlantUML 成功 HTML は Rust 側が `<div class="plantuml-diagram">{sanitized svg}</div>` を返す（`src-tauri/src/lib.rs:1126-1131`）。`sanitize_svg` が `<script>` と `on*` 属性を除去済み（`lib.rs:1401-1403`）であり、design §6.3 の `.plantuml-diagram > svg` selector と §5.1 の「script 実行経路を増やさない」主張は正しい。`cloneNode` は script を実行しないため、clone 方式が `dangerouslySetInnerHTML` 再注入（§12.4 不採用）より安全という判断は妥当。
- `handlePreviewClick` は anchor だけを event delegation で処理し、`href` が無ければ即 return する（`App.tsx:597-604`）。design §10.1 の「resolver を先に問い合わせ、null なら既存 anchor 処理へ落とす」は既存構造へ素直に接続できる。
- `main.app-shell` は Settings 表示中に `inert` を受ける既存実装がある（`App.tsx:925-929`）。design §5.3 の `inert` 方針は既存パターンの踏襲であり、React 19 で属性が機能することも実装済みコードで確認できる。
- Vitest に jsdom / happy-dom 依存はなく（`package.json` devDependencies、`vite.config.ts` に test 設定なし）、design §17 の「DOM event / focus / clone は新規 test dependency を増やさず手動確認」という前提は事実と一致する。
- design §19 の検証コマンド（`npm test -- --run` / `npm run build` / `cargo check` / `cargo fmt -- --check`）は `docs/rules/development_workflow.md:156-161,207` と一致する。
- 背景 scroll については `html, body, #root { overflow: hidden }`（`App.css:22-28`）と fixed backdrop により、wheel の scroll chain が `.preview-pane` へ届かない。追加実装なしで TODO 完了条件の「背景 scroll 抑止」は成立する（ただし設計へ根拠が未記載。3.2 参照）。

### 数式の検証

- fit: `min(1, availW/W, availH/H)`（§7.1）と最小倍率 = `fitScale`（§7.3）は整合し、`fitScale <= 1` が常に成り立つため §7.2 の `scale = 1` が範囲外になることはない。
- transform 適用順 `translate(offset) scale(scale)`（§5.2）は element へ scale → 画面 px で translate の順に効くため、offset が画面 px である §8 の `maxOffset` 式と単位が一致する。
- `maxOffsetX = max(0, (W*s - availW)/2)` は content 端を available box 端へ一致させる境界であり、viewport 端から `padding` px の余白が残る。§8 の「端へ padding を残した状態まで移動できる」と一致し、四隅は到達可能で到達不能領域はない。
- resize 時の custom mode clamp（§10.4）は、`fitScale` が上昇して現 scale を上回る場合だけ scale を押し上げる。`fitScale <= 1` の制約下で不整合は生じない。

### 総評

矛盾のある数式や到達不能な状態遷移は検出しなかった。検出した Medium 7 件は、いずれも「設計文の抽象度では正しいが、この codebase / 依存 library の具体制約に当てると Phase 3 でそのまま実装できない、または既存挙動を静かに変える」種類の欠落である。

---

## 1. 齟齬・不整合

### 1.1 clone した SVG の size 制御を viewer 側 CSS selector だけでは行えない

**ドキュメント記載**: 「cloneされた`img` / `svg`: intrinsic pixel sizeを明示し、Markdown側`max-width: 100%`の影響を受けないviewer固有selectorを使う」(design §16)。

**差異**: Markdown 側 `max-width` を打ち消せば足りる、という前提が生成済み SVG に対して成立しない。制約の実体は stylesheet ではなく **generator が付けた inline style / 属性**である。

- Mermaid は `calculateSvgSizeAttrs` で `width="100%"` 属性と `style="max-width: {width}px;"` **inline style** を SVG 要素へ直接設定する（`node_modules/mermaid/dist/chunks/mermaid.core/chunk-CSCIHK7Q.mjs:5076-5086`）。
- PlantUML の `-tsvg` 出力も `width="Npx" height="Npx"` 属性と `style="width:...;height:...;background:#FFFFFF"` を SVG 要素へ持つ。Rust 側 `sanitize_svg`（`lib.rs:1401-1403`）は `<script>` と `on*` しか落とさないため、これらは clone へそのまま複製される。

inline style は selector の specificity では上書きできない。`.image-viewer-content svg { max-width: none }` のような viewer 固有 selector を書いても、clone の `style="max-width: 640px"` が勝ち続ける。`!important` で潰すか、clone 生成後に JS で `style.maxWidth` / `style.width` / `style.height` と `width` / `height` 属性を正規化するかを設計で決めておかないと、Phase 3 で「CSS を書いたが効かない」状態から場当たり対応が始まる。あわせて PlantUML SVG の `background:#FFFFFF` inline 指定が Dark theme の viewer 背景と衝突する点（手動 scenario 9 の判定基準）も設計上の既知事項として扱うべきである。

**推奨対応**: §5.1 または §16 へ「clone 直後に generator 由来の size 指定（`width` / `height` 属性、inline `max-width` / `width` / `height`）を viewer 用の intrinsic pixel size で上書きする」ことを明記し、CSS selector ではなく `ImageViewerDialog` の clone 前処理の責務として配置する。PlantUML SVG の inline `background` を Dark theme でどう扱うか（そのまま許容 / viewer canvas を白に固定）も一文で決めておく。

**severity**: Medium
**対象工程**: Phase 2 設計修正 → Phase 3 実装
**status**: 未対応

---

### 1.2 wheel zoom が React の `onWheel` では実装できない（passive listener 固定）

**ドキュメント記載**: 「wheel / trackpad: `deltaY`の方向を共通zoom factorへ正規化し、1 eventごとに急激なjumpを起こさない」(design §7.3)。「DOM eventやReact state更新は`App.tsx`」(design §5.2)。「viewportは`touch-action: none`」(design §8)。

**差異**: 3 点が未解決のまま残る。

1. **passive 固定**: React DOM は root container への `wheel` listener を `passive: true` で登録する（`node_modules/react-dom/cjs/react-dom-client.production.js:12390-12406`。`touchstart` / `touchmove` / `wheel` のみ passive フラグを立てる分岐）。したがって React の `onWheel` handler 内の `event.preventDefault()` は無効で、console warning が出るだけになる。viewer viewport の wheel は `ref` + `useEffect` から `addEventListener("wheel", handler, { passive: false })` で自前登録する必要がある。`touch-action: none` は pointer / touch には効くが wheel の既定動作には効かない。
2. **ctrl / meta + wheel**: macOS trackpad の pinch は `ctrlKey: true` の wheel event として届く。preventDefault しなければ WebView 全体の browser zoom が発動し、overlay ごと拡大される。pinch を image zoom へ写すのか無効化するのかが未定義。
3. **delta 正規化**: 「`deltaY` の方向を共通 zoom factor へ正規化」は 1 event = 固定倍率を意味する。trackpad は 1 回の 2 本指 swipe で数十 event を出すため、固定倍率だと fit から 800% まで一瞬で飛ぶ。逆に `deltaMode`（pixel / line / page）を見ないと、mouse wheel（`deltaY` 100 前後）と trackpad（数 px）で体感が桁違いになる。AC-3 の「一貫した複数入力」を満たすには delta の**大きさ**も factor へ反映する必要がある。

**推奨対応**: §7.3 / §5.2 へ次を追記する。(a) wheel は React 合成 event ではなく viewport ref への非 passive listener で扱う。(b) `ctrlKey || metaKey` の wheel は preventDefault のうえ image zoom として扱う（または明示的に無視する）。(c) zoom factor を `deltaMode` 正規化後の delta 量から算出する式（例: `factor = exp(-normalizedDelta * k)`）と、1 event あたりの上限倍率を定義する。§17 のテスト項目へ「wheel delta → zoom factor の正規化」を pure policy として追加する。

**severity**: Medium
**対象工程**: Phase 2 設計修正 → Phase 3 実装
**status**: 未対応

---

### 1.3 close 時の focus 復帰と `inert` 解除の順序が未定義

**ドキュメント記載**: 「初期focusはviewportへ置き、close後はrequestが保持するtriggerへ戻す」(design §5.3)。「overlay close時に元triggerへfocusを戻す」(design §3.2)。

**差異**: `inert` subtree 内の要素へ `focus()` を呼んでも focus は入らない。close の実処理は「`ImageViewerRequest` を null にする → React が再 render して `main.app-shell` の `inert` を外す」であるため、close handler 内で同期的に `trigger.focus()` を呼ぶと **app shell がまだ inert のままで focus 復帰が黙って失敗し、focus が `<body>` へ落ちる**。React の unmount cleanup も同一 commit の mutation phase で走るため、`inert` 属性削除との前後関係は保証されない。

これは仮説ではなく既存実装が既に踏んでいる問題で、`closeSettings` は `window.setTimeout(() => fileMenuButtonRef.current?.focus(), 0)` で回避している（`App.tsx:372-376`）。設計がこの制約に触れていないため、素直に実装すると AC-4 と TODO 完了条件「close後に起点へfocusが戻る」が満たされない。

**推奨対応**: §5.3 / §10.2 へ「focus 復帰は request が null へ遷移した後の passive effect（または既存 `closeSettings` と同様の 0ms defer）で実行し、`inert` 解除後に `trigger.isConnected` を確認してから `focus()` する」ことを明記する。fallback（trigger が unmount 済みなら active preview）も同じ経路に置く。

**severity**: Medium
**対象工程**: Phase 2 設計修正 → Phase 3 実装
**status**: 未対応

---

### 1.4 既存 Markdown title を持つ画像で `title` 補足が既存表示を上書きする

**ドキュメント記載**: 「altを維持し、viewerを開けることを`title`とaccessible labelへ補足する」(design §6.1)。

**差異**: Markdown の画像は `![alt](src "title")` で著者が `title` を指定でき、既存 fixture `sample_docs/image_link.md` が実際に `"Avalonia MarkdownViewer architecture"` を指定している。markdown-it は これを `title` 属性として出力するため、image rule で無条件に `token.attrSet("title", ...)` すると**著者指定の tooltip が消える**。design §13 は「通常時の preview 表示を維持する」と宣言しており、この上書きはその宣言と矛盾する。

なお `<img>` の accessible name は alt が優先されるため、`title` の追加は空 alt 画像の名前補完にしかならない。`role="button"` を付けた場合も名前は alt → title の順で解決されるので、「viewer を開けること」を伝えたいなら `title` ではなく `aria-description` / 可視 instruction のほうが適する。

**推奨対応**: §6.1 へ「既存 `title` 属性がある場合は保持し、上書き・追記しない」旨と、`title` 未指定時の既定文言、空 alt 時の accessible name 補完手段を明記する。手動 scenario へ `sample_docs/image_link.md` の tooltip 非退行を追加する。

**severity**: Medium
**対象工程**: Phase 2 設計修正 → Phase 3 実装
**status**: 未対応

---

### 1.5 描画前 `.mermaid` が操作不能な `role="button"` tab stop になり、trigger の accessible name が未定義

**ドキュメント記載**: 「fence ruleが生成する`.mermaid` containerへtrigger属性を付ける」「resolverはcontainer内の直近`svg`だけを採用し、source textの状態では開かない」(design §6.2)。§6.1 は通常画像の accessible label にだけ触れる。

**差異**: fence rule は静的 HTML を出す（`App.tsx:1810-1812`）ため、trigger 属性は **`mermaid.run` の前から** DOM に存在する。この間、container は `role="button"` / `tabindex="0"` / `cursor: zoom-in` を持ちながら activate しても resolver が null を返して何も起きない dead end となる。PlantUML render 待ちや Mermaid 初期化前は現実に発生する状態で、Tab 順にも入る。

あわせて Mermaid / PlantUML trigger の accessible name が未定義である。`role="button"` の name は contents から算出されるため、描画前は Mermaid source 全文、描画後は SVG 内の全 text node が読み上げ名になる。§6.4 の `accessibleName` は dialog title 用であって trigger 側の名前ではない。PlantUML SVG が `[[url]]` 由来の `<a>` を含む場合、`role="button"` 内に interactive 要素が入る nested-interactive 違反にもなる。

**推奨対応**: §6.2 / §6.3 へ次を追記する。(a) trigger の interactive 属性は描画完了状態でのみ有効にする（Mermaid は `mermaid.run` が付与する `data-processed="true"`、PlantUML は `result.ok === true` の wrapper のみ）。CSS も `[data-processed="true"]` を条件に `cursor: zoom-in` を出し、`tabindex` は描画前に付けない設計とする。(b) 3 種すべての trigger へ内容非依存の `aria-label`（例: `Open Mermaid diagram in image viewer`）を定義する。(c) SVG 内 `<a>` を含む場合の扱い（wrapper を `role="button"` にせず別の activate 経路にする等）を明記する。

**severity**: Medium
**対象工程**: Phase 2 設計修正 → Phase 3 実装
**status**: 未対応

---

### 1.6 intrinsic size 解決（§6.4）に自動テストが計画されていない

**ドキュメント記載**: 「SVG intrinsic sizeは正の`viewBox.width / height`、次に明示width / height、最後に正のrendered bounding boxの順で決める」(design §6.4)。§17 のテスト 9 項目はすべて `ImageViewerTransformPolicy` の transform 計算に対するもの。

**差異**: fit / clamp / pan の全計算は `intrinsicWidth` / `intrinsicHeight` を入力とするため、size 解決が誤ると下流のテストが全部通っても表示が壊れる。にもかかわらず、優先順位の分岐と「正の値でなければ拒否」という validation は自動テスト対象外に置かれている。DOM 依存で jsdom がないのは事実だが、**優先順位と検証は候補値の組から選ぶ純粋関数**であり、DOM から候補を読み出す薄い層と分離すれば Vitest で全分岐を検証できる。§14 が掲げる「invalid transform input は `RangeError` で顕在化させ silent default を使わない」方針も、入口の size 解決が未検証では担保しきれない。

**推奨対応**: §6.4 / §11 / §17 へ、size 解決を「DOM から候補を収集する薄い adapter」と「候補列から intrinsic size を決める pure 関数」に分け、後者を `imageViewer.ts` 側へ置いてテストする方針を追記する。テスト項目へ「viewBox 優先」「viewBox 不正時の width/height fallback」「両方不正時の bounding box」「全候補不正で null」を追加する。

**severity**: Medium
**対象工程**: Phase 2 設計修正 → Phase 3 実装 / テスト
**status**: 未対応

---

### 1.7 linked image の click 契約変更が `todo.md` / `meta.md` の互換記述と矛盾する

**ドキュメント記載**: 「画像がMarkdown linkの子である場合、画像自身のclick / Enter / Spaceはviewer openを優先し、eventを`preventDefault`してlink navigationを同時実行しない。…1入力でoverlayとnavigationを同時発火させないための意図した仕様差分である」(design §3.3)。

**差異**: 現行は linked image を click すると `handlePreviewClick` が anchor を解決して external URL を開く / Markdown tab を開く（`App.tsx:597-630`）。変更後はこの経路が消える。設計はこれを意図的な仕様差分として明記しており、判断自体は妥当（1 入力 2 動作を避ける、`<a>` 自体は依然 focus 可能で Enter navigation が残る）。

問題は追跡文書側である。`docs/todo/todo.md` TODO-2026-022 の compatibility は「既存のMarkdown link / anchor / tab / Explorer / Reload / Theme操作を退行させない」、`meta.md` Compatibility も同文を掲げており、いずれも例外を記していない。Phase 4 の完了判定はこの完了条件で行われるため、承認済みの仕様差分が設計文書だけに埋もれていると、検証時に「退行」と判定されるか、逆に無検証で通過する。

**推奨対応**: Phase 2 の設計修正時に `docs/todo/todo.md` と `meta.md` の compatibility へ「linked image の画像領域 click は viewer open を優先し link navigation を行わない（`<a>` への keyboard navigation は維持）」という例外を追記する。恒久ドキュメント (`docs/components/tauri_viewer/interface_spec.md` のユーザー操作節) にも同じ契約を記載対象として §20 へ加える。

**severity**: Medium
**対象工程**: Phase 2 設計修正（todo / meta 同期）→ Phase 3 恒久 docs
**status**: 未対応

---

## 2. ドキュメント不足

### 2.1 ADR 要否の判断が未記載

design §20 は恒久ドキュメント更新予定を列挙するが、ADR を起票しない判断とその根拠に触れていない。`docs/adr/` には現在 `README.md` と `_template.md` しかなく、今回の判断（clone による既存 DOM 再利用、trusted HTML iframe を非対象に据え置く security 境界）は Tauri Viewer 局所か横断判断かの線引きを一言残す価値がある。直近の TODO-2026-021 設計レビューでは同種の判断が設計文へ明記されており、運用上の一貫性も欠く。

**推奨対応**: §20 末尾へ「本変更は Tauri Viewer 局所の frontend interaction 契約であり、既存 security 境界（iframe sandbox / custom protocol / bridge）を変更しないため ADR は起票しない」旨を追記する。

**severity**: Low / **対象工程**: Phase 2 設計修正 / **status**: 未対応

### 2.2 背景 scroll 抑止の根拠が設計に無い

TODO 完了条件は「背景scroll / 操作が抑止され」と明記するが、design §5.3 は focus / activation 抑止までしか述べていない。実際には `html, body, #root { overflow: hidden }`（`App.css:22-28`）と fixed backdrop により scroll chain が `.preview-pane` へ届かないため**追加実装は不要**だが、根拠が設計に無いと Phase 3 で不要な body scroll lock が足されたり、Phase 4 で未確認のまま通過したりする。

**推奨対応**: §5.3 または §16 へ上記の成立根拠を一文で記載し、backdrop へ `overscroll-behavior: contain` を明示する。手動 scenario 7 へ「overlay 表示中に wheel を回しても背後の preview が scroll しない」を観察項目として追加する。

**severity**: Low / **対象工程**: Phase 2 設計修正 / **status**: 未対応

---

## 3. 改善提案

### 3.1 policy / resolver の配置形式を既存 frontend module 慣行と揃える

**ドキュメント記載**: 「module直下の新規global計算関数は追加せず、policy / resolver classのstatic methodへ置く」(design §11)。

`review_checkpoints.md` の「モジュール直下のグローバル関数を原則増やさず、責務に応じたクラス/メソッドへ収まっているか」に沿った判断であり、方針として誤りではない。一方、同一 directory の既存 pure policy module である `documentPolicy.ts`（`parseOpenDocumentResponse` / `evaluateHtmlBridgeMessage` など export 関数）と `explorerPane.ts`（`clampExplorerWidth` / `getExplorerWidthBounds` など export 関数）は、どちらも「責務名を持つ module + export された純粋関数 + 専用 Vitest」という形をとっており、両者ともテスト済みである。`imageViewer.ts` だけ static method only class にすると、**同じ責務クラスに 2 つの慣行が並ぶ**。`docs/rules/coding_rules.md` の TypeScript 節は class 形式を要求していない（要求しているのは型付き契約と責務分離）。

**推奨対応**: `imageViewer.ts` を既存 2 module と同じ「専用 module + export 関数」に揃えるか、逆に既存 2 module も将来揃える前提で class 化するかを §11 で明示的に選び、選んだ理由を記録する。前者を推奨する（既存テスト資産と import 形が変わらず、tree-shaking と test の書き味も揃う）。

**severity**: Low / **対象工程**: Phase 2 設計修正 / **status**: 未対応

### 3.2 Space キーの既定動作と keyup の扱いを明記する

§9 の key table と §10.1 は Enter / Space で viewer を開くと定めるが、`preventDefault` に触れているのは §3.3 の linked image 文脈だけである。`tabindex="0"` の要素で Space を押すと既定で `.preview-pane` が scroll するため、trigger 由来の Space は常に `preventDefault` が必要。あわせて、click 経路と keydown 経路の二重発火（`role="button"` に対する browser の合成 click は発生しないが、Enter が anchor 祖先へ伝播するケース）を防ぐため、keydown で処理した際の `stopPropagation` 有無も定義しておくと実装差異が出ない。

**severity**: Low / **対象工程**: Phase 2 設計修正 / **status**: 未対応

### 3.3 clone された Mermaid SVG の重複 `id` を「許容する」と明記する

Mermaid の生成 SVG は `id` 付き root、`<defs>` 内の marker、`#<svgId>` で scope された `<style>` を含む。clone すると document 内に同一 id が 2 組できる。実害は小さい（CSS の `#id` は重複でも両方に一致し、clone 内の `url(#…)` は clone 自身の defs でも original の defs でも同一内容に解決される）が、**実装者が良かれと思って clone 側の id を rewrite すると、内部 `<style>` の scope が外れて図の見た目が壊れる**。設計で先に打ち消しておく価値がある。

**推奨対応**: §5.1 へ「clone の `id` は書き換えない。重複 id は viewer 表示中のみの一時状態として許容する」を追記する。

**severity**: Low / **対象工程**: Phase 2 設計修正 / **status**: 未対応

### 3.4 resolver が拒否したときの観測可能な挙動を定義する

§14 は「resolver対象外、pending、broken image、SVG dimension不明: viewerを開かず既存event処理へ戻す」とする。allowlist 外 target では正しい挙動だが、**trigger と分かっている要素を click したのに何も起きない**（lazy load 未完了の画像、PlantUML render 待ち）は利用者から見て故障と区別できない。§14 が掲げる「silent fallback で隠さない」方針とも緊張する。1.5 の「描画前は trigger を interactive にしない」で pending 系は大半が解消するが、`loading="lazy"` の画像が decode 前の瞬間は残る。

**推奨対応**: trigger だが未解決の場合の扱い（StatusBar へ 1 行出す / `img.complete` を待って開く / 明示的に何もしないと決める）を §14 で 1 つ選ぶ。

**severity**: Low / **対象工程**: Phase 2 設計修正 / **status**: 未対応

### 3.5 テスト項目・UI 細部の補足（まとめ）

いずれも単独では設計修正を要さないが、Phase 3 で判断がぶれる箇所。可能なら §7 / §9 / §17 へ数値・条件を補う。

- §7.1 / §8 の `padding` に具体値がない。テスト 1 / 6 / 7 は固定値がないと期待値を書けない。
- §17 テスト 5「pointer anchor zoom で同じ image 座標が維持される」は、pan clamp が働くと不変条件が崩れる。clamp 非発動の geometry を前提とする旨をテスト条件に含める。
- fitScale と 800% の境界で `Zoom out` / `Zoom in` を `disabled` にするか否かが未定義（§9 の toolbar 契約）。
- 倍率 `output` の `aria-live="polite"` は wheel zoom 中に毎 event 読み上げが発生する。§9 は pan の過剰通知にしか触れていない。zoom 完了後 debounce する等の方針を足す。
- Mermaid / PlantUML container 内のテキストを drag 選択して離すと click が発火し overlay が開く。選択が非 collapsed な場合や pointer 移動量が閾値超の場合は open を抑止する条件を検討する。
- §4.1 は `sample_docs/image_viewer.md` のみを挙げ、fixture 画像資産の追加有無に触れていない。既存 `sample_docs/images/avalonia-markdown-viewer-architecture.png` は 1672x941 で raster 800% と四隅到達の scenario を満たせるため、「新規 binary 資産は追加せず既存 PNG を再利用する」と明記すればよい。
- §10.3 の破棄条件に theme 変更が無い一方 AC-5 は theme 境界を挙げる。実際は overlay 中 `inert` により theme 変更が到達不能なので矛盾ではないが、その根拠を一文で記載しておくと Phase 4 の判定が揺れない。
- PlantUML の非同期完了は revision を変えずに `plantUmlDiagrams` だけを更新するため（`App.tsx:520-525`）、overlay 表示中に `MarkdownPreview` の `dangerouslySetInnerHTML` が差し替わり trigger が detach する。clone は独立しているので viewer は継続動作し、focus は §5.3 の fallback で preview へ戻る。§10.3 が「tab / revision 不一致で閉じる」としか書いていないため、**revision が変わらない DOM 差し替え**が想定内であることを明記しておくとよい。

**severity**: Low / **対象工程**: Phase 2 設計修正 / **status**: 未対応

### 3.6 Round 1 指摘対応

| ID | 工程分類 | 対応 | status |
| --- | --- | --- | --- |
| 1.1 | design | clone直後にgenerator由来size属性・inline sizeをDOMで正規化し、intrinsic pxを明示する責務へ変更。PlantUML backgroundは生成結果として保持し、Mermaid重複IDは一時的に許容する。 | 対応済み・再確認待ち |
| 1.2 | design / test | native non-passive wheel listener、ctrl / meta pinch、deltaMode換算、`[-100,100]` clamp、指数factorとpure policy testを定義した。 | 対応済み・再確認待ち |
| 1.3 | design | request null化後のpassive effect / 0ms deferでinert解除を待ち、`isConnected`確認後にfocus復帰する契約を追加した。 | 対応済み・再確認待ち |
| 1.4 | design / compatibility | Markdown alt / titleを変更せず、viewer操作説明は描画後の隣接buttonへ分離した。既存fixture tooltip回帰確認も追加した。 | 対応済み・再確認待ち |
| 1.5 | design / accessibility | 描画前visualへinteractive属性を付けず、描画成功後だけpointer markerとSVG外のkeyboard buttonをDOM adapterが追加する。SVG anchorはlink処理を優先する。 | 対応済み・再確認待ち |
| 1.6 | design / test | DOM候補読取adapterと`resolveIntrinsicSize` pure policyを分け、viewBox / explicit size / bounds / invalidのtestを追加した。 | 対応済み・再確認待ち |
| 1.7 | plan / design | linked imageの意図した仕様差分を`todo.md` / `meta.md`へ同期し、恒久interface specと手動scenarioの更新対象にした。 | 対応済み・再確認待ち |
| 2.1 | design / docs | Tauri Viewer局所契約で既存security判断を変えないためADR非起票と明記した。 | 対応済み・再確認待ち |
| 2.2 | design / verification | 既存root overflow hidden + fixed backdrop + overscroll containを背景scroll抑止根拠とし、手動確認を追加した。 | 対応済み・再確認待ち |
| 3.1 | design | 既存frontend policy慣行に合わせ、専用module + 型付きexport関数 + Vitestを採用する例外理由を記録した。 | 対応済み・再確認待ち |
| 3.2 | design | keyboard triggerをnative buttonへ変更し、Space / Enterの既定activationを利用してcustom keydown重複を除いた。 | 対応済み・再確認待ち |
| 3.3 | design | Mermaid cloneのIDはrewriteせず、viewer open中の一時重複として許容すると明記した。 | 対応済み・再確認待ち |
| 3.4 | design / error | valid visualだけをdecorateし、lazy load成功後に再decorate、失敗時はdocument / kind付きconsole warningを1回記録する契約にした。 | 対応済み・再確認待ち |
| 3.5 | design / test / verification | padding数値、非clamp anchor test、境界button disabled、aria-live 250ms debounce、selection中open抑止、既存PNG再利用、Theme到達不能根拠、revision不変DOM差替えを追記した。 | 対応済み・再確認待ち |

---

## 4. 受け入れ条件の追跡性

| TODO-2026-022 completion | 設計対応 | 判定 |
| --- | --- | --- |
| 3 種を pointer click / keyboard から overlay で開ける | §6.1-6.4、§10.1、AC-1 | 追跡可。ただし描画前 trigger の扱い（1.5）と Space の既定動作（3.2）が未定義 |
| 初期 fit から拡大縮小 pan fit/reset、四隅と中央へ到達 | §7.1-7.4、§8、AC-2 | 追跡可。数式検証済み、到達不能領域なし |
| 安全な下限上限、button / wheel / keyboard の一貫性、倍率表示 | §7.3、§9、AC-3 | **部分的**。wheel 経路が実装不能（1.2） |
| Escape / close / backdrop で閉じ、背景 scroll・操作抑止、起点へ focus 復帰 | §5.3、§10.3、AC-4 | **部分的**。focus 復帰順序が未定義（1.3）、背景 scroll の根拠が未記載（2.2） |
| Light/Dark・resize・tab 切替・Reload で state 混線せず、通常表示と link が非退行 | §10.3、§10.4、§13、AC-5 / AC-6 | **部分的**。linked image click の仕様差分が todo / meta と不整合（1.7）、title 上書き（1.4） |
| trusted HTML iframe / Rust backend に変更がない | §4.2、§12.6、§13、AC-7 | 追跡可。resolver allowlist を Markdown preview DOM に限定する方針は既存 security 契約と整合 |
| `npm test -- --run` / `npm run build` / `cargo check` と手動確認記録 | §17-§19、AC-8 | **部分的**。size 解決に自動テストが無い（1.6） |

## 5. レビュー checkpoint 対応

| checkpoint | 結果 |
| --- | --- |
| 1. 仕様整合 | 1.4 / 1.7 で既存仕様との差分が文書化不足 |
| 2. 設計品質 | 責務分離（policy / resolver / dialog / App）は妥当。Settings modal を共通化しない判断も、保存中 close 抑止と初期 focus 差を根拠としており妥当。配置形式のみ 3.1 |
| 3. 安全性・保守性 | clone 方式・allowlist・`RangeError` 方針は妥当。resolver 拒否時の観測性のみ 3.4 |
| 4. パフォーマンス | §15 は妥当。zoom / pan が CSS transform のみで Rust invoke を伴わない点、計測前に rAF coalescing を入れない判断も適切 |
| 5. 互換性・回帰 | 1.4 / 1.7。それ以外（Mermaid effect 依存条件、stable `dangerouslySetInnerHTML` object、PlantUML 成功 HTML 内側不変）は現行実装と整合 |
| 6. テスト | 1.6、3.5。transform 9 項目自体は境界・失敗系を含み妥当 |
| 7. ドキュメント | 2.1 / 2.2 / 1.7。恒久 docs 更新予定（§20）は TODO の permanent_docs を網羅 |

---

## 6. Round 1対応状況

| ID | severity | 概要 | status |
| --- | --- | --- | --- |
| 1.1 | Medium | clone SVG の inline size 指定を CSS では上書きできない | 対応済み・再確認待ち |
| 1.2 | Medium | React `onWheel` は passive 固定で wheel zoom を実装できない | 対応済み・再確認待ち |
| 1.3 | Medium | focus 復帰と `inert` 解除の順序が未定義 | 対応済み・再確認待ち |
| 1.4 | Medium | 既存 Markdown title の上書き | 対応済み・再確認待ち |
| 1.5 | Medium | 描画前 trigger の dead end と accessible name 未定義 | 対応済み・再確認待ち |
| 1.6 | Medium | intrinsic size 解決の自動テスト欠如 | 対応済み・再確認待ち |
| 1.7 | Medium | linked image 仕様差分が todo / meta と不整合 | 対応済み・再確認待ち |
| 2.1 | Low | ADR 要否の判断が未記載 | 対応済み・再確認待ち |
| 2.2 | Low | 背景 scroll 抑止の根拠が未記載 | 対応済み・再確認待ち |
| 3.1 | Low | policy / resolver の配置形式が既存 module 慣行と不一致 | 対応済み・再確認待ち |
| 3.2 | Low | Space の既定動作抑止が未定義 | 対応済み・再確認待ち |
| 3.3 | Low | clone 重複 id の扱い明記 | 対応済み・再確認待ち |
| 3.4 | Low | resolver 拒否時の観測可能な挙動が未定義 | 対応済み・再確認待ち |
| 3.5 | Low | テスト項目・UI 細部の補足（7 項目） | 対応済み・再確認待ち |

Medium 7件とLow 7件をRound 1で反映した。Claude再確認で未解決0件または追加指摘を確定する。
