# TODO-2026-022 Tauri Markdown画像オーバーレイ表示 実装レビュー

**レビュー日**: 2026-07-26
**対象 TODO**: `docs/todo/todo.md` TODO-2026-022
**対象コミット**: `ad68ae4` (feat: add Tauri Markdown image viewer)、`909f8d7` (docs: complete Tauri image overlay design phase)
**対象設計**: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/design/tauri_markdown_image_overlay_design.md`
**対象実装記録**: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/impl/tauri_markdown_image_overlay_impl.md`
**Phase 2 レビュー**: `review/tauri_markdown_image_overlay_design_review.md`（承認、未解決 0 件、`7bcc92b`）
**判定**: **条件付き差し戻し (Changes Requested)**。設計との対応、security 境界、数式、lifecycle、恒久 docs はいずれも整合しており、方針転換や再設計は不要。ただし keyboard 起点の操作性に関わる **Medium 2 件**を修正してから Phase 4 へ進むこと。High 0 件。**未解決指摘 5 件（Medium 2 / Low 3）**。

---

## 概要

`ad68ae4` の差分（frontend 3 ファイル 1350 行追加、fixture 1 件、恒久 docs 5 件）を、設計文書・Phase 2 レビュー・現行実ソース・依存 library 実体と突き合わせて検証した。あわせて `npm test -- --run` / `npm run build` / `cargo check` を実行し、実装記録の結果を再現した。

### 検証コマンド（レビュー時に再実行）

| command | 実行結果 | 実装記録との一致 |
| --- | --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | Pass。3 files / 40 tests | 一致 |
| `cd markdown-viewer-tauri && npm run build` | Pass。`tsc` + Vite production build 成功。既存の chunk size warning のみ | 一致 |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | Pass（`Finished dev profile`） | 一致 |

`cargo fmt -- --check` は Rust 差分が無いため省略で妥当。追加の統合テスト不要という判断（impl §5）も、Rust command / serialization / 永続化 / protocol に一切の差分が無い（`git diff` に `src-tauri/` の変更なし）ことと整合する。

### 設計どおりに実装されていることを確認した主要点

- **対象 visual の限定**（設計 §6.1-6.3）: `decorateAll` は active preview root 配下の `img`（`complete` かつ `naturalWidth/Height > 0`）、`.mermaid[data-processed="true"]` 直下の `svg`、`.plantuml-diagram` 直下の `svg` だけを走査する（`imageViewer.ts:406-448`）。pending PlantUML は `<pre class="plantuml-loading">`、error は `<pre class="plantuml-error">`（`App.tsx:501`、`src-tauri/src/lib.rs:1128-1136`）で `.plantuml-diagram > svg` に一致しないため、`result.ok` を再判定せずとも成功結果だけが decorate される。trusted HTML は sandboxed iframe 内にあり root 走査から原理的に到達しない。
- **linked image と SVG anchor の優先順位**（設計 §3.3 / §6.3 / §10.1）: `!(anchor && target.closest("svg"))` で「SVG 内 anchor のときだけ resolver を飛ばす」形になっており（`App.tsx:620-624`）、HTML の `<a><img></a>` は resolver 優先、SVG 内 `<a>` は既存 link 処理優先という設計と一致する。button は `anchor ?? image` の `afterend` へ挿入されるため（`imageViewer.ts:422-426, 374`）link の外側に出て nested interactive にならない。
- **selection 中の open 抑止**（設計 §10.1）: request 解決後に `window.getSelection()` が collapsed でなければ即 return する（`App.tsx:631-634`）。pointerdown が既存 selection を collapse するため、通常 click は開き、drag 選択直後の click は開かない。
- **idempotency と cleanup**（設計 §6.1）: `visual.dataset.imageViewerId` の有無で二重 decorate を防ぎ（`imageViewer.ts:354`）、cleanup は `image-viewer-cleanup` custom event で focus 追従 listener を止めてから button 除去と marker 削除を行う（`imageViewer.ts:452-474, 318`）。focus 中の要素が DOM 差替えで消える場合 `blur` が発火しない browser 挙動を、この custom event が正しく補っている。
- **async DOM 差替えとの整合**: PlantUML 非同期完了は revision を変えずに `dangerouslySetInnerHTML` を差し替えるが、effect の依存に `activeTab?.plantUmlDiagrams` があるため adapter が再生成され、detach 済み node への cleanup は no-op で安全に流れる。Mermaid は `mermaid.run().then()` へ `cancelled` guard 付きで `adapter.decorate()` を繋いでおり（`App.tsx:922-930`）、React 外 SVG 生成後に decorate される。
- **clone 正規化**（設計 §5.1、Phase 2 指摘 1.1）: `removeAttribute("width"/"height")` と `style.removeProperty("max-width"/"width"/"height")` の後に intrinsic px を設定している（`App.tsx:1200-1208`）。mermaid の `width="100%"` + inline `max-width`（`chunk-CSCIHK7Q.mjs:5076-5086`）、PlantUML の inline `width/height` の双方を CSS specificity に頼らず打ち消せている。PlantUML の inline `background` は設計どおり保持。
- **modal lifecycle**（設計 §5.3 / §10.3）: app shell の `inert` に `imageViewerRequest` を追加（`App.tsx:1021-1022`）、Escape / Close / backdrop pointerdown-up 完結、focus trap、tab / revision / documentType 不一致での自動 close、`setTimeout(0)` による `inert` 解除後の deferred focus 復帰と `isConnected` 判定（`App.tsx:1188-1201`）まで設計どおり。`MarkdownPreview` へ `tabIndex={-1}` が付いたため（`App.tsx:2126`）fallback の `previewRef.current?.focus()` と `fallbackRoot.focus()` が実際に機能する。
- **Phase 2 §9.2 の実装条件 2 件**: `.markdown-body .image-viewer-trigger:focus`（`:focus-visible` ではない）で pill を可視化（`App.css:1013`）、通常状態に `user-select: none`（`App.css:1009`）。設計 §6.1.1 / §16 / §18-6 も `909f8d7` で同内容へ更新済み。**両条件とも充足**。
- **通常時 layout の非退行**: 通常状態の trigger は `position: absolute` + 1px + `clip` + `margin: -1px` + `overflow: hidden` + `pointer-events: none`（`App.css:998-1011`）。offset 指定が無い絶対配置は静的位置に留まったまま flow から外れるため、inline 画像段落の行組みも diagram container の border / padding / `overflow-x` 内寸も変わらない。挿入は常に host の `afterend` なので `.markdown-body > :first-child { margin-top: 0 }`（`App.css:737-739`）の一致対象も変わらない。
- **著者指定 title / link の非退行**: `renderMarkdown` の image rule に差分がなく（`git diff` 上 `md.renderer.rules.image` は無変更）、alt・`title`・`loading="lazy"`・`convertFileSrc` 解決はそのまま。
- **security 境界**: `src-tauri/` に差分なし。`cloneNode` は script を実行せず、新しい network / protocol 経路も追加されていない。

### 数式の再検証

- **transform 合成**: `translate(-50%,-50%) translate(ox,oy) scale(s)` と `transform-origin: center`、`.image-viewer-content { position: absolute; top: 50%; left: 50% }`（`App.css:1220-1227` 相当）を合成すると、点 p は `s·(p - o) + (ox, oy)`（o は要素中心）へ写る。すなわち content の中心が viewport 中心 + offset に来る。**scale 非依存で正しく中心基準**であり、offset は画面 px なので §8 の bounds 式と単位が一致する。
- **pointer anchor zoom**: `offset' = a - (a - offset)·(s'/s)`（`imageViewer.ts:177-178`）は、anchor 直下の image 座標 `u = (a - offset)/s` を `offset' + s'·u = a` に保つ解と厳密に一致する。anchor は viewport 中心を原点とする座標で渡されており（`App.tsx:1268-1271`）、bounds の座標系と一致する。
- **wheel 正規化**: `unit = deltaMode===1 ? 16 : deltaMode===2 ? viewportHeight : 1`、`clamp(deltaY*unit, ±100)`、`exp(-normalized*0.002)`（`imageViewer.ts:223-225`）。設計 §7.3 の pixel=1 / line=16 / page=viewport height、`[-100,100]` clamp、指数 factor と一致し、1 event の倍率は 0.8187〜1.2214 に収まる。
- **clamp / bounds / resize**: `min(8, max(fitScale, scale))`、`maxOffset = max(0, (intrinsic·s - available)/2)`、fit mode は再 fit・custom mode は scale 維持で offset だけ再 clamp（`imageViewer.ts:140-154, 205-212`）。すべて設計 §7.3 / §8 / §10.4 と一致し、`fitScale <= 1` の制約下で 100% reset が範囲外になることもない。

---

## 1. 齟齬・不整合

### 1.1 倍率 `<output>` が暗黙の live region となり、設計 §9 の debounce が無効化されている

**根拠**: 設計 §9 は「倍率の visible `output` は各 event で更新するが、screen reader 用 `aria-live="polite"` text は zoom 入力停止 250ms 後に debounce 更新し、wheel 中の過剰通知を避ける」と定める。実装は debounce 用の `.image-viewer-live` span を別途用意している（`App.tsx:1441-1443`）が、可視側を `<output aria-label="Current zoom">{percentage}%</output>`（`App.tsx:1387`）で描画している。HTML の `<output>` は ARIA 上 `role="status"` にマップされ、`status` は暗黙で `aria-live="polite"` / `aria-atomic="true"` を持つ。したがって **可視 output 自体が live region となり、wheel zoom 中の毎 event ごとに読み上げが発生する**。`aria-label` が付いているため「Current zoom 143%」のような通知が連続する。結果として debounce 用 span を足した意図が打ち消され、AC-3 の「支援技術へ現在倍率を伝える」が過剰通知として実現される。

**差異の影響範囲**: screen reader 利用時の zoom 操作全般（wheel / trackpad が最も顕著、button 連打も同様）。視覚表示と機能には影響しない。

**推奨対応**: `<output>` に `aria-live="off"` を付与する（`role="status"` の暗黙 live を無効化する最小変更）。あるいは可視表示を `<span aria-hidden="true">` に変え、通知を `.image-viewer-live` 一本へ寄せる。後者にする場合は toolbar の `aria-label="Current zoom"` も span 側から外す。

**severity**: Medium
**対象工程**: Phase 3 実装修正
**status**: 未対応

---

### 1.2 focus 時の pill 配置が 1 frame 遅れ、`position: fixed` 化により対象 visual への scroll 追従も失われる

**根拠**: pill の座標は CSS custom property `--image-viewer-trigger-top` / `--image-viewer-trigger-left` で与えられ（`App.css:1014-1015`）、その値は `focus` → `startTracking()` → `update()` → `requestAnimationFrame` の**次フレーム**で初めて設定される（`imageViewer.ts:293-307`）。一方 `:focus` の style は focus と同時に適用される。ここから 2 つの問題が生じる。

1. **初回 focus で必ず 1 frame の誤配置が起きる**。custom property 未定義の `top: var(--image-viewer-trigger-top)` は invalid at computed-value time となり `top` / `left` は `auto` に落ちる。`position: fixed` + auto offset は「静的位置を viewport 座標として使う」ため、scroll した文書中の button では実質任意の位置に pill が出て、次フレームで正しい位置へ飛ぶ。2 回目以降の focus でも直前の値が残っているため、別 scroll 位置では古い座標で 1 frame 描画される。Tab で viewer button を辿るたびに毎回発生する、決定的な表示不良である。
2. **sequential focus navigation の scroll-into-view が効かなくなる懸念**。通常状態の button は静的位置（画像の直後）に絶対配置された 1px 要素なので、focus 時に browser が scroll-into-view すれば画像付近まで scroll される。しかし `:focus` が適用された時点で button は `position: fixed` になり、fixed 要素は常に viewport 内と評価されるため scroll が発生しない可能性が高い。その場合、画面外の画像に対して `setTriggerPosition` の clamp（`imageViewer.ts:272-273`、preview pane 内へ丸め込む）だけが働き、**対象 visual が画面外のまま pane 端に pill が出て、pill と対象の対応が失われる**。実装側に visual を scroll させる処理はない。

設計 §6.1.1 の「visual 右上へ重ねる」という契約は 1 と 2 のいずれでも満たされない場面がある。

**推奨対応**: `startTracking()` で `setTriggerPosition(...)` を **同期的に 1 回呼んでから** rAF ベースの追従を開始する（`update()` は scroll / resize 用に残す）。これで 1 は解消する。2 については `focus` handler の先頭で `visual.scrollIntoView({ block: "nearest", inline: "nearest" })` を実行してから座標を読む（visual が既に viewport 内なら no-op）ことで、browser 依存にせず決定的にできる。あわせて設計 §18 の手動 scenario 1 へ「画面外の画像に対応する button へ Tab した時、対象画像が表示され pill がその右上に出る」を追加し、Phase 4-a で判定できるようにする。

**severity**: Medium
**対象工程**: Phase 3 実装修正（+ 設計 §18 / development workflow の手動確認項目追記）
**status**: 未対応

---

## 2. ドキュメント不足

### 2.1 `docs/tests/README.md` の Manual UI check に image viewer が未追加

**根拠**: 設計 §20 は `docs/tests/README.md` を「fixture / test catalog へ追加が必要な場合」の更新対象に挙げていた。同ファイルの「テストカテゴリ」節は Manual UI check の対象領域を「フォルダ選択、Markdown / trusted HTML 表示、relative resource、Mermaid / PlantUML、sandbox / CSP、テーマ切替、Reload」と列挙しているが、今回追加した image viewer の手動確認領域が入っていない。`docs/rules/development_workflow.md` 側には 3 行が追加済み（`development_workflow.md:183-185`）で、実務上の手順は欠けていない。テスト構成の記述は `markdown-viewer-tauri/src/*.test.ts` の wildcard なので `imageViewer.test.ts` の追記は不要。

**推奨対応**: `docs/tests/README.md` の Manual UI check 行へ「Markdown image viewer（zoom / pan / focus / layout 非退行）」を 1 語追加する。設計 §20 が条件付き記載であるため、更新しない判断を採る場合は impl 記録 §6 へその旨を残す。

**severity**: Low
**対象工程**: Phase 3 docs 修正
**status**: 未対応

---

## 3. 改善提案

### 3.1 dialog title と button の可視 label / accessible name が噛み合っていない

**根拠**: `accessibleName` は `focusOrigin.getAttribute("aria-label")` をそのまま採用している（`imageViewer.ts:520`）。button の `aria-label` は操作を表す文言（`Open Mermaid diagram in image viewer` 等、`imageViewer.ts:432,444`）なので、dialog header は次のように描画される（`App.tsx:1362-1364`）。

- Mermaid: `Mermaid diagram: Open Mermaid diagram in image viewer`
- PlantUML: `PlantUML diagram: Open PlantUML diagram in image viewer`
- 画像（alt あり）: `Image: Open image in image viewer: Avalonia MarkdownViewer architecture`

`aria-labelledby="image-viewer-title"` なので dialog の accessible name も同文になる。設計 §5.3 の「source 種別と accessible name を含む title」という意図は満たすが、**内容名ではなく操作名を流用しているため、可視 header・読み上げの双方で語が重複する**。viewer を開くたびに必ず目に入る文字列である。

あわせて、button の可視文言は `Open image viewer`（`imageViewer.ts:291`）で、accessible name（`Open image in image viewer: ...`）に可視文言がそのままの並びで含まれない。WCAG 2.5.3 Label in Name（レベル A）は accessible name が可視 label を含むことを求めており、音声入力で「Open image viewer」と発話しても一致しない可能性がある。

**推奨対応**: decorate 時に「内容名」と「操作名」を分けて持つ（例: button へ `data-image-viewer-name` として画像は alt、diagram は `Mermaid diagram` / `PlantUML diagram` を格納し、`accessibleName` はそちらから読む）。alt が空の場合は kind 名だけを title に使う。button 側は可視文言と accessible name の先頭を揃える（例: 可視 `Open image viewer` / name `Open image viewer: <alt>`）ことで 2.5.3 も満たせる。

**severity**: Low
**対象工程**: Phase 3 実装修正
**status**: 未対応

### 3.2 設計 §17 が列挙した自動テスト 11 項目のうち 2 項目が未実装

**根拠**: `imageViewer.test.ts` は 11 項目のうち 9 項目を満たすが、次の 2 つの分岐が無検証である。

1. **縦長画像（height 制約側）の fit**（設計 §17-1「大画像 / 小画像 / 縦長画像と 24px / 12px padding の fit scale」）。テストの 3 ケース（1600x900 / 400x300 / viewportWidth 360）はいずれも width 側が min を取るか 1 に張り付くため、`getImageViewerFitScale` の `availableHeight / intrinsicHeight` 分岐が**一度も選ばれない**。`resizeImageViewerTransform` のテストの 600x400 ケースも width 側が勝つ。height 制約の fit は縦長 Mermaid（fixture に用意済み）で実際に通る経路であり、回帰検出の穴になる。
2. **center zoom の offset**（設計 §17-4）。`zoomImageViewerTransform` を anchor 省略（viewport 中央）で呼ぶテストは scale しか assert しておらず（`imageViewer.test.ts:48-52`）、しかも起点が offset 0 の fit transform なので offset が動かないケースしか通らない。非ゼロ offset からの center zoom で `offset' = offset · ratio` になることが未検証。

**推奨対応**: (1) `intrinsicWidth: 600, intrinsicHeight: 2000` のような縦長 geometry を 1 ケース追加し、`availableHeight / intrinsicHeight` が返ることを assert する。(2) `{ scale: 1, offsetX: 100, offsetY: -60, mode: "custom" }` から `zoomImageViewerTransform(..., 1.25)` を呼び、clamp が効かない geometry で offset が 1.25 倍になることを assert する。

なお `getImageViewerFitScale` の 1 ケース目の期待値 `0.595555556` は実値 `952/1600 = 0.595` と一致しない（`toBeCloseTo` の既定精度 2 桁で通過しているだけ）。あわせて `0.595` へ直すか `toBe` にすると意図が明確になる。

**severity**: Low
**対象工程**: Phase 3 テスト追加
**status**: 未対応

---

## 4. 設計・受け入れ条件との対応

| TODO-2026-022 completion | 実装 | 判定 |
| --- | --- | --- |
| 3 種を pointer click と keyboard から overlay で開ける | `decorateAll` / `resolveImageViewerSource` / native button | 充足。keyboard 経路の可視 feedback に 1.2 |
| 初期 fit から拡大縮小 pan fit/reset、四隅と中央へ到達 | `imageViewer.ts` の fit / zoom / pan / bounds | 充足。数式再検証済み |
| 安全な下限上限、button / wheel / keyboard の一貫性、倍率表示 | fit 下限・8.0 上限・境界 disabled・非 passive wheel | 充足。読み上げの過剰通知に 1.1 |
| Escape / close / backdrop、背景 scroll・操作抑止、起点へ focus 復帰 | `inert` / focus trap / deferred focus / `overscroll-behavior` | 充足 |
| Light/Dark・resize・tab 切替・Reload で混線せず、通常表示と link が非退行 | theme 別 CSS / ResizeObserver / tab-revision effect / non-reflow trigger | 充足（GUI 確認は Phase 4-a） |
| trusted HTML iframe / Rust backend に変更がない | `src-tauri/` 差分なし、iframe 非走査 | 充足 |
| `npm test -- --run` / `npm run build` / `cargo check` と手動確認記録 | 3 コマンド Pass を再現。手動は Phase 4-a | 充足（自動分）。テスト網羅に 3.2 |

Phase 2 レビュー §9.2 の実装条件 2 件（`:focus` 可視化、`user-select: none`）はコードと設計文の双方で充足を確認した。

## 5. レビュー checkpoint 対応

| checkpoint | 結果 |
| --- | --- |
| 1. 仕様整合 | 1.1（設計 §9 の debounce 意図が実装で打ち消される）、1.2（§6.1.1 の「visual 右上へ重ねる」が満たされない場面） |
| 2. 設計品質 | 問題なし。pure policy / DOM adapter / resolver / dialog の責務分離が設計どおりで、`imageViewer.ts` は既存 `documentPolicy.ts` / `explorerPane.ts` と同じ export 関数 + 専用 Vitest の形。Settings dialog の focus trap を共通化しない判断も維持されている |
| 3. 安全性・保守性 | 問題なし。invalid geometry は `RangeError`、無効 visual は decorate せず `console.warn` を 1 回、silent fallback なし。cleanup が listener / rAF / marker / button を漏れなく解放する |
| 4. パフォーマンス | 問題なし。zoom / pan は CSS transform のみ、Rust invoke なし、clone は open 中 1 個。`readSvgIntrinsicSize` が `getBoundingClientRect()` を常に評価する点は diagram 数に比例する軽微な forced layout に留まる |
| 5. 互換性・回帰 | 問題なし。image rule 無変更、link / anchor 経路維持、trigger が flow・hit test・copy text へ非干渉、`src-tauri/` 差分なし |
| 6. テスト | 3.2（設計 §17 の 2 項目未実装） |
| 7. ドキュメント | 2.1。README / basic_design / detail_design / interface_spec / development_workflow と impl 記録は設計・実装と一致 |

---

## 6. 未解決指摘一覧

| ID | severity | 概要 | 対象工程 | status |
| --- | --- | --- | --- | --- |
| 1.1 | Medium | `<output>` の暗黙 live region で zoom 通知が二重化し debounce が無効 | Phase 3 実装 | 未対応 |
| 1.2 | Medium | focus pill が 1 frame 誤配置され、`position: fixed` 化で対象 visual への scroll 追従も失われる | Phase 3 実装 / 手動確認項目 | 未対応 |
| 2.1 | Low | `docs/tests/README.md` の Manual UI check に image viewer 未追加 | Phase 3 docs | 未対応 |
| 3.1 | Low | dialog title が操作 label を流用し語が重複。可視 label と accessible name も不一致 | Phase 3 実装 | 未対応 |
| 3.2 | Low | 設計 §17 の縦長 fit と center zoom offset のテストが未実装 | Phase 3 テスト | 未対応 |

**未解決 5 件（Medium 2 / Low 3）。Phase 3 は未承認。** Medium 2 件を修正し、Low 3 件へ対応または採否理由を記録したうえで再レビューすること。Medium 2 件はいずれも局所修正（`aria-live="off"` の付与、`startTracking` での同期配置と `scrollIntoView`）で、設計変更を伴わない。修正後は `npm test -- --run` / `npm run build` を再実行し、impl 記録 §5 の結果と 1.2 に対応する手動確認項目を更新すること。
