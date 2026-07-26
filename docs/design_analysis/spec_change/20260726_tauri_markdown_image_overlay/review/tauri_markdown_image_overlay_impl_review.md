# TODO-2026-022 Tauri Markdown画像オーバーレイ表示 実装レビュー

**レビュー日**: 2026-07-26
**対象 TODO**: `docs/todo/todo.md` TODO-2026-022
**対象コミット**: `ad68ae4` (feat: add Tauri Markdown image viewer)、`909f8d7` (docs: complete Tauri image overlay design phase)
**対象設計**: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/design/tauri_markdown_image_overlay_design.md`
**対象実装記録**: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/impl/tauri_markdown_image_overlay_impl.md`
**Phase 2 レビュー**: `review/tauri_markdown_image_overlay_design_review.md`（承認、未解決 0 件、`7bcc92b`）
**Round 1 fix コミット**: `80741cf` (fix: address Tauri image viewer implementation review)
**再レビュー日**: 2026-07-26
**初回判定**: 条件付き差し戻し (Changes Requested)。Medium 2 件 / Low 3 件、High 0 件。
**再レビュー判定**: 承認 (Approved)。初回指摘 5 件（Medium 2 / Low 3）はすべてクローズ、新規指摘 0 件。
**Phase 4-a 追加レビュー コミット**: `27ca57c` (fix: restore image viewer focus by activation type)
**Phase 4-a 追加レビュー日**: 2026-07-26
**Phase 4-a 追加レビュー判定**: 承認 (Approved)。ブロッキング 0 件、Low 2 件（9.3.1 / 9.3.2）。
**follow-up 確認コミット**: `c9e519b` (fix: suppress preview focus outline after image viewer)
**follow-up 確認日**: 2026-07-26
**最新判定**: **承認 (Approved)。Phase 4-a ユーザー再確認へ進行可**。全 4 ラウンドの実装レビュー指摘 **7 件（Medium 2 / Low 5）はすべてクローズ**し、High は通じて 0 件。**未解決指摘 0 件**。判定根拠は 9 章（とくに 9.6）を正とする。

> **本文書の読み方**: 1〜6 章は初回レビュー（対象 `ad68ae4`）、7 章は実装 Agent の対応記録、8 章は再レビュー（対象 `80741cf`）の記録であり、いずれも当時の内容を保存する目的で残す。9 章は Phase 4-a 追加レビュー（対象 `27ca57c`）とその follow-up であり、**最新の判定と未解決状況は 9.6 を正とする。**

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
**status**: クローズ（Round 1 再レビューで確認。8 章参照）

---

### 1.2 focus 時の pill 配置が 1 frame 遅れ、`position: fixed` 化により対象 visual への scroll 追従も失われる

**根拠**: pill の座標は CSS custom property `--image-viewer-trigger-top` / `--image-viewer-trigger-left` で与えられ（`App.css:1014-1015`）、その値は `focus` → `startTracking()` → `update()` → `requestAnimationFrame` の**次フレーム**で初めて設定される（`imageViewer.ts:293-307`）。一方 `:focus` の style は focus と同時に適用される。ここから 2 つの問題が生じる。

1. **初回 focus で必ず 1 frame の誤配置が起きる**。custom property 未定義の `top: var(--image-viewer-trigger-top)` は invalid at computed-value time となり `top` / `left` は `auto` に落ちる。`position: fixed` + auto offset は「静的位置を viewport 座標として使う」ため、scroll した文書中の button では実質任意の位置に pill が出て、次フレームで正しい位置へ飛ぶ。2 回目以降の focus でも直前の値が残っているため、別 scroll 位置では古い座標で 1 frame 描画される。Tab で viewer button を辿るたびに毎回発生する、決定的な表示不良である。
2. **sequential focus navigation の scroll-into-view が効かなくなる懸念**。通常状態の button は静的位置（画像の直後）に絶対配置された 1px 要素なので、focus 時に browser が scroll-into-view すれば画像付近まで scroll される。しかし `:focus` が適用された時点で button は `position: fixed` になり、fixed 要素は常に viewport 内と評価されるため scroll が発生しない可能性が高い。その場合、画面外の画像に対して `setTriggerPosition` の clamp（`imageViewer.ts:272-273`、preview pane 内へ丸め込む）だけが働き、**対象 visual が画面外のまま pane 端に pill が出て、pill と対象の対応が失われる**。実装側に visual を scroll させる処理はない。

設計 §6.1.1 の「visual 右上へ重ねる」という契約は 1 と 2 のいずれでも満たされない場面がある。

**推奨対応**: `startTracking()` で `setTriggerPosition(...)` を **同期的に 1 回呼んでから** rAF ベースの追従を開始する（`update()` は scroll / resize 用に残す）。これで 1 は解消する。2 については `focus` handler の先頭で `visual.scrollIntoView({ block: "nearest", inline: "nearest" })` を実行してから座標を読む（visual が既に viewport 内なら no-op）ことで、browser 依存にせず決定的にできる。あわせて設計 §18 の手動 scenario 1 へ「画面外の画像に対応する button へ Tab した時、対象画像が表示され pill がその右上に出る」を追加し、Phase 4-a で判定できるようにする。

**severity**: Medium
**対象工程**: Phase 3 実装修正（+ 設計 §18 / development workflow の手動確認項目追記）
**status**: クローズ（Round 1 再レビューで確認。8 章参照）

---

## 2. ドキュメント不足

### 2.1 `docs/tests/README.md` の Manual UI check に image viewer が未追加

**根拠**: 設計 §20 は `docs/tests/README.md` を「fixture / test catalog へ追加が必要な場合」の更新対象に挙げていた。同ファイルの「テストカテゴリ」節は Manual UI check の対象領域を「フォルダ選択、Markdown / trusted HTML 表示、relative resource、Mermaid / PlantUML、sandbox / CSP、テーマ切替、Reload」と列挙しているが、今回追加した image viewer の手動確認領域が入っていない。`docs/rules/development_workflow.md` 側には 3 行が追加済み（`development_workflow.md:183-185`）で、実務上の手順は欠けていない。テスト構成の記述は `markdown-viewer-tauri/src/*.test.ts` の wildcard なので `imageViewer.test.ts` の追記は不要。

**推奨対応**: `docs/tests/README.md` の Manual UI check 行へ「Markdown image viewer（zoom / pan / focus / layout 非退行）」を 1 語追加する。設計 §20 が条件付き記載であるため、更新しない判断を採る場合は impl 記録 §6 へその旨を残す。

**severity**: Low
**対象工程**: Phase 3 docs 修正
**status**: クローズ（Round 1 再レビューで確認。8 章参照）

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
**status**: クローズ（Round 1 再レビューで確認。8 章参照）

### 3.2 設計 §17 が列挙した自動テスト 11 項目のうち 2 項目が未実装

**根拠**: `imageViewer.test.ts` は 11 項目のうち 9 項目を満たすが、次の 2 つの分岐が無検証である。

1. **縦長画像（height 制約側）の fit**（設計 §17-1「大画像 / 小画像 / 縦長画像と 24px / 12px padding の fit scale」）。テストの 3 ケース（1600x900 / 400x300 / viewportWidth 360）はいずれも width 側が min を取るか 1 に張り付くため、`getImageViewerFitScale` の `availableHeight / intrinsicHeight` 分岐が**一度も選ばれない**。`resizeImageViewerTransform` のテストの 600x400 ケースも width 側が勝つ。height 制約の fit は縦長 Mermaid（fixture に用意済み）で実際に通る経路であり、回帰検出の穴になる。
2. **center zoom の offset**（設計 §17-4）。`zoomImageViewerTransform` を anchor 省略（viewport 中央）で呼ぶテストは scale しか assert しておらず（`imageViewer.test.ts:48-52`）、しかも起点が offset 0 の fit transform なので offset が動かないケースしか通らない。非ゼロ offset からの center zoom で `offset' = offset · ratio` になることが未検証。

**推奨対応**: (1) `intrinsicWidth: 600, intrinsicHeight: 2000` のような縦長 geometry を 1 ケース追加し、`availableHeight / intrinsicHeight` が返ることを assert する。(2) `{ scale: 1, offsetX: 100, offsetY: -60, mode: "custom" }` から `zoomImageViewerTransform(..., 1.25)` を呼び、clamp が効かない geometry で offset が 1.25 倍になることを assert する。

なお `getImageViewerFitScale` の 1 ケース目の期待値 `0.595555556` は実値 `952/1600 = 0.595` と一致しない（`toBeCloseTo` の既定精度 2 桁で通過しているだけ）。あわせて `0.595` へ直すか `toBe` にすると意図が明確になる。

**severity**: Low
**対象工程**: Phase 3 テスト追加
**status**: クローズ（Round 1 再レビューで確認。8 章参照）

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
| 1.1 | Medium | `<output>` の暗黙 live region で zoom 通知が二重化し debounce が無効 | Phase 3 実装 | クローズ (`80741cf`) |
| 1.2 | Medium | focus pill が 1 frame 誤配置され、`position: fixed` 化で対象 visual への scroll 追従も失われる | Phase 3 実装 / 手動確認項目 | クローズ (`80741cf`) |
| 2.1 | Low | `docs/tests/README.md` の Manual UI check に image viewer 未追加 | Phase 3 docs | クローズ (`80741cf`) |
| 3.1 | Low | dialog title が操作 label を流用し語が重複。可視 label と accessible name も不一致 | Phase 3 実装 | クローズ (`80741cf`) |
| 3.2 | Low | 設計 §17 の縦長 fit と center zoom offset のテストが未実装 | Phase 3 テスト | クローズ (`80741cf`) |

初回レビュー時点の未解決は 5 件（Medium 2 / Low 3）だった。Round 1 fix `80741cf` で全件がクローズし、**再レビュー時点の未解決は 0 件**。最新の判定と根拠は 8 章を正とする。

---

## 7. 実装Agent対応（再レビュー依頼）

2026-07-26に全5件を採用し、次のとおり修正した。判定・未解決件数の更新は再レビューに委ねる。

| ID | 対応 | status |
| --- | --- | --- |
| 1.1 | 可視`output`へ`aria-live="off"`を付与し、250ms debounceの`.image-viewer-live`だけを通知経路にした | 対応済み・再レビュー待ち |
| 1.2 | focus handlerで接続状態を確認し、`scrollIntoView({ block: "nearest", inline: "nearest" })`後にpill座標を同期設定してからrAF追従を開始した。設計§18とdevelopment workflowへ画面外visualのscenarioを追加した | 対応済み・再レビュー待ち |
| 2.1 | `docs/tests/README.md`のManual UI checkへMarkdown image viewerを追加した | 対応済み・再レビュー待ち |
| 3.1 | 操作labelと内容名をdata markerで分離した。button accessible nameを可視label `Open image viewer`で始め、dialog titleは内容名だけを組み立てるようにした | 対応済み・再レビュー待ち |
| 3.2 | 縦長geometryのheight制約fitと、非zero offsetからのcenter zoomを追加した。既存fit期待値も厳密値`0.595`へ修正した | 対応済み・再レビュー待ち |

修正後の検証結果は`npm test -- --run`が3 files / 41 tests Pass、`npm run build`がPass（既存chunk size warningのみ）、`cargo check`がPass。

---

## 8. 再レビュー（`80741cf`）と Phase 3 承認

`80741cf` の差分（frontend 3 ファイル、設計、impl 記録、`development_workflow.md`、`docs/tests/README.md`）を取得し、初回指摘 5 件それぞれについて修正内容が根本原因に対応しているかを実ソースと突き合わせて検証した。あわせて 3 つの検証コマンドを再実行した。

### 8.1 検証コマンド（再レビュー時に再実行）

| command | 実行結果 | 実装 Agent 報告との一致 |
| --- | --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | Pass。3 files / **41 tests** | 一致 |
| `cd markdown-viewer-tauri && npm run build` | Pass。既存 chunk size warning のみ | 一致 |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | Pass | 一致 |

### 8.2 指摘別のクローズ判定

| ID | 修正 | 再確認結果 | status |
| --- | --- | --- | --- |
| 1.1 | `<output aria-label="Current zoom" aria-live="off">`（`App.tsx:1399-1401`） | **クローズ**。author 指定の `aria-live` は role から導かれる暗黙値より優先されるため、`role="status"` 由来の `aria-live="polite"` が無効化され、live 通知が 250ms debounce の `.image-viewer-live` 一本になる。可視表示と `aria-label` は残るので、focus / 参照時の読み上げは維持される。設計 §9 の意図と一致する |
| 1.2 | `startTracking` で `visual.isConnected` を確認し、`scrollIntoView({ block: "nearest", inline: "nearest" })` → `setTriggerPosition` を**同期実行**してから `update()`（rAF）と scroll / resize listener を開始（`imageViewer.ts:305-313`） | **クローズ**。(a) `focus` handler は focus 操作の一部として paint 前に同期実行されるため、`--image-viewer-trigger-top/left` が `:focus` style の初回適用と同じ frame で確定し、1 frame の `top/left: auto` 誤配置が消える。(b) `scrollIntoView` を明示したことで、`position: fixed` 化により browser の focus scroll が働かない可能性に依存しなくなった。`scroll-behavior: smooth` は CSS に無い（`App.css` に `overscroll-behavior` のみ）ため既定の instant scroll となり、直後の `getBoundingClientRect()` は scroll 後の値を返す。`block/inline: "nearest"` は CSSOM-View の nearest 規則により、対象が scrollport より大きい場合は「何もしない」か既存の整列を維持するため、横 scroll 済み Mermaid / PlantUML container の内部 scroll 位置を巻き戻さない。disconnect 時は listener を張らず button 除去と fallback focus のみ行う分岐も維持されている |
| 2.1 | `docs/tests/README.md` の Manual UI check へ「Markdown image viewer（zoom / pan / focus / layout 非退行）」を追加 | **クローズ**。impl 記録 §6 にも反映済み |
| 3.1 | 操作名と内容名を分離。`contentName` は画像 `alt \|\| "Markdown image"` / `"Mermaid diagram"` / `"PlantUML diagram"`、button は `aria-label="Open image viewer: <contentName>"` + `data-image-viewer-name`、resolver は `dataset.imageViewerName` を `accessibleName` に採る（`imageViewer.ts:288, 378-385, 435-457, 533`）。dialog h2 は `sourceLabel === accessibleName` なら種別のみ表示（`App.tsx:1170-1176, 1383-1384`） | **クローズ**。header は `Mermaid diagram` / `PlantUML diagram` / `Image: <alt>` となり語の重複が消えた。可視文言 `Open image viewer` が accessible name の先頭に含まれるため WCAG 2.5.3 Label in Name も満たす。空 alt は `Image: Markdown image` で意味の通る表示になる。`contentName` は `dataset` 経由で設定され `innerHTML` を通らないため、alt 由来文字列の注入経路も増えていない |
| 3.2 | `intrinsicWidth: 600, intrinsicHeight: 2000` の height 制約 fit（`toBe(0.326)`）と、非 zero offset からの center zoom（`toBe(125)` / `toBe(-75)`）を追加。既存期待値を厳密値 `0.595` へ修正（`imageViewer.test.ts:26-35, 70-80`） | **クローズ**。手計算で一致を確認した。height ケースは avail 952x652 に対し `min(1, 952/600, 652/2000) = 0.326` で **`availableHeight / intrinsicHeight` 分岐が初めて選択**される。center zoom は ratio 1.25、bounds が x 1399 / y 924 で clamp 非発動、`offset' = offset × 1.25` が成立する。既存ケースも `952/1600 = 0.595` の厳密一致となり、`toBeCloseTo` の緩さに依存しなくなった。設計 §17 の 11 項目がこれで全て実装された |

### 8.3 修正に伴う波及の確認

- **設計文の同期**: §6.1 / §6.2 / §6.3 の button label 記述、§6.1.1 の同期配置と `scrollIntoView`、§18-1 の画面外 visual scenario が `80741cf` で更新済み。実装と設計文に乖離はない。
- **手動確認手順**: `development_workflow.md:184` に「画面外の画像に対応する viewer button へ Tab 移動した時、対象画像が表示領域へ入り、pill がその右上へずれずに表示されること」が追加され、1.2 の修正を Phase 4-a で判定できる。
- **impl 記録**: §2 に対応概要、§4 にテスト 2 項目、§5 に 41 tests、§6 に `docs/tests/README.md` が反映済みで、実装・設計・レビューと一致する。
- **回帰**: 修正は viewer 固有の 3 ファイルに閉じており、`src-tauri/`、Markdown image rule、link 処理、CSS の通常時 trigger 規則には差分がない。security 境界と通常時 layout の非退行は初回レビューの結論のまま維持される。

### 8.4 Phase 3 承認判定（この時点の判定。最新は 9 章）

- 初回指摘 5 件（Medium 2 / Low 3）: **すべてクローズ**
- 再レビュー追加指摘: **0 件**
- **未解決 0 件。Phase 3 承認 (Approved)。Phase 4 進行可。**

承認に伴い `meta.md` の `impl_status` を `done`、Phase Status の Phase 3 行を `Done` へ更新すること。Phase 4-a のユーザ動作確認では、設計 §18 の 12 scenario に加えて、本レビューで実機確認へ委ねた次の 3 点を重点的に判定すること。

1. 画面外画像に対応する button への Tab 移動で、対象画像が表示領域へ入り pill がその右上へ出ること（1.2 の実機確認）。
2. 横 scroll 済み Mermaid / PlantUML の viewer button へ focus した時、container 内部の横 scroll 位置が巻き戻らないこと（1.2 の副作用確認）。
3. screen reader で zoom した際、倍率通知が入力停止後に 1 回だけ行われること（1.1 の実機確認）。

---

## 9. Phase 4-a 追加レビュー（`27ca57c`）

Phase 4-a のユーザー実機確認（`verification/phase4a_user_verification.md`）で「pointer 起点で開いて閉じた後にも keyboard 用 pill が表示される」が NG となり、Phase 3 相当へ差し戻して修正された。その修正コミット `27ca57c` の差分（frontend 3 ファイル、設計、component docs 2 件、`development_workflow.md`、impl 記録、meta、検証記録）を検証した。

### 9.1 検証コマンド（追加レビュー時に再実行）

| command | 実行結果 | 実装 Agent 報告との一致 |
| --- | --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | Pass。3 files / **42 tests** | 一致 |
| `cd markdown-viewer-tauri && npm run build` | Pass。既存 chunk size warning のみ | 一致 |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | Pass | 一致 |

### 9.2 指定観点の検証結果

| 観点 | 検証結果 |
| --- | --- |
| UIEvent `detail` による activation 判定 | **妥当**。`getImageViewerActivation(clickDetail)` は `detail === 0` を keyboard、正値を pointer とする（`imageViewer.ts:41-43`）。`UIEvent.detail` は click 回数であり、native `<button>` の Enter / Space による合成 click は全主要 engine で `detail = 0`、実 pointer click は 1 以上になる。判定を DOM 非依存の pure function として切り出し、`resolveImageViewerSource` は値を受け取るだけ（`imageViewer.ts:502`）という責務分離も、`imageViewer.ts` の既存 pure policy 慣行と一致する。React の `SyntheticMouseEvent` は `UIEvent` 由来の `detail` を素通しするため、`event.detail` の参照（`App.tsx:645`）も正しい |
| modal close 後の focus 管理 | **妥当**。`closeImageViewer` は activation で復帰先を分け（`App.tsx:617-624`）、`imageViewerFocusReturnRef` を `HTMLElement \| null` へ一般化している。復帰は従来どおり 0ms defer 後に `isConnected` を確認し、不成立なら `previewRef.current?.focus()` へ落ちる（`App.tsx:970-985`）。Phase 2 指摘 1.3 で確定した「`inert` 解除後に defer して復帰する」契約は維持されている |
| screen reader / keyboard 経路の維持 | **維持**。Tab → Enter / Space は `detail = 0` で keyboard 判定となり、従来どおり `focusOrigin` へ復帰して pill が可視化される。支援技術が生成する activation も一般に `detail = 0` の合成 click となるため、AT 利用時の復帰 focus も従来どおり残る。仮に `detail` を 1 以上で合成する AT があっても、復帰先が active preview になるだけで focus が失われる経路は無く、劣化は緩やかである |
| pointer 経路で pill を出さないこと | **成立**。pointer click は `detail >= 1` で pointer 判定となり、復帰先が `.markdown-body` になるため button は focus されず `:focus` が成立しない。pill の可視化条件は `.markdown-body .image-viewer-trigger:focus`（`App.css:1019`）だけであり、他に表示経路は無い。開く側でも、通常状態の button は `pointer-events: none` かつ `<img>` は focusable でないため、click 時に button へ focus が移ることもない |
| tab / revision 変更時の fallback | **妥当**。不一致 effect からの `closeImageViewer` も同じ経路を通る。keyboard 起点では `focusOrigin.isConnected` が false になり `previewRef.current` へ、pointer 起点では close 時点の `previewRef.current`（再 render 後なので新 tab の article）へ復帰する。新 tab が HTML / 未 load で `MarkdownPreview` が unmount している場合は ref が null となり復帰処理自体が skip されるが、focus 可能な Markdown preview が存在しない状況であり、動作として妥当 |
| 文書整合 | **概ね一致**。設計 §3.2 / §5.3 / §6.4（`activation` field）/ §18-6、`detail_design.md:286`、`interface_spec.md:74`、`development_workflow.md:186`、impl §8、`meta.md`（`verification_status: in_progress`、Phase 4 行）、`verification/phase4a_user_verification.md` がいずれも修正後の挙動と一致する。残る不足は 9.3.2 のみ |

**pointer 復帰先の妥当性**（追加確認）: `.markdown-body` は `tabIndex={-1}` を持つため `focus()` が実際に成立する（`App.tsx:2126` 相当）。`min-height: 100%`（`App.css:885-892`）で常に scrollport 以上の高さがあり、CSSOM-View の focus scroll は「要素が scrollport より大きく両端が外側」のとき何もしないため、復帰時に preview の scroll 位置が飛ぶこともない。

### 9.3 追加レビューで検出した指摘

#### 9.3.1 pointer 起点 + keyboard close で `.markdown-body` 全体に focus ring が出る可能性

**根拠**: pointer 起点の復帰先は `.markdown-body` だが、この要素には focus 表示を抑止する CSS が無い（`App.css` の `:focus` 系規則は `.image-viewer-dialog button` / `.image-viewer-viewport` / `.explorer-separator` / `.tab-activate` / `.tab-close` / `.image-viewer-trigger` のみで、`.markdown-body` は対象外）。`:focus-visible` は scripted focus であっても「直前のユーザー操作が keyboard だった」場合に一致するため、次の経路で UA 既定の focus ring が **本文 article 全体（幅いっぱい・文書高さ）** に描かれ得る。

- 画像を **click で開く**（activation = pointer）→ **Escape で閉じる**（直前操作は keyboard）→ `.markdown-body` へ programmatic focus → `:focus-visible` 一致 → 全体 outline

Close button の click や backdrop click で閉じた場合は直前操作が pointer なので一致せず、この経路だけが露出する。従来はこの focus 先が「復帰先が detach 済み」の稀な fallback だったが、今回の修正で **pointer 経路の常用パス**になったため露出が上がった。engine 差（WKWebView / WebView2 / WebKitGTK）があるため必ず出るとは断定できないが、出た場合は「マウス操作後に用途不明の大きな UI が出る」という今回の NG と同種の見え方になる。

**推奨対応**: `.markdown-body:focus { outline: none }` を追加する。`.markdown-body` は `tabindex="-1"` で Tab 順に入らず、programmatic focus 専用の受け皿であるため、outline 抑止による keyboard 操作性の損失は無い。あわせて `development_workflow.md` の手動確認へ「pointer で開いて Escape で閉じた場合も、本文全体に outline が出ないこと」を追加し、Phase 4-a 再確認で判定できるようにする。

**severity**: Low（機能影響なし。engine 依存の表示のみ。ただし再確認で NG になれば往復が 1 回増えるため、再確認前の適用を推奨する）
**対象工程**: Phase 3 相当の追加修正（CSS 1 規則）+ Phase 4-a 観察項目
**status**: クローズ（`c9e519b`。9.6 参照）

#### 9.3.2 `imageViewer.ts` の責務記述に activation policy が未反映

**根拠**: `getImageViewerActivation` は `imageViewer.ts` の 6 つ目の pure policy export だが、責務を列挙している恒久 docs 2 箇所が「fit / zoom / pan / wheel / intrinsic size」のままである。

- `docs/components/tauri_viewer/README.md:71`: 「image viewer の fit / zoom / pan / wheel / intrinsic size policy と、Markdown DOM 内の 3 種 visual だけを扱う decoration / resolver を提供する」
- `docs/components/tauri_viewer/basic_design.md:14`: 「image viewer の fit / zoom / pan / wheel / intrinsic size 計算を pure function へ集約し…」

`detail_design.md` / `interface_spec.md` は activation 分岐を反映済みで、挙動仕様としての欠落はない。module の責務一覧だけが実体より狭い。

**推奨対応**: 上記 2 行の列挙へ activation を加える（例: 「fit / zoom / pan / wheel / intrinsic size / activation policy」）。`basic_design.md:71` の依存図行は「transform policy / Markdown DOM source resolver」のままでも齟齬は無いが、揃えるなら同時に更新する。

**severity**: Low
**対象工程**: Phase 3 相当の docs 修正
**status**: クローズ（`c9e519b`。9.6 参照）

### 9.4 判定（`27ca57c` 時点。最新は 9.6）

- Phase 4-a フィードバック対応の修正内容: **承認**。指定された 6 観点すべてで期待どおりの実装を確認した。activation を pure policy として切り出した設計も既存の module 慣行と整合し、keyboard / AT 経路の復帰 focus を保ったまま pointer 経路の余計な UI を消せている。
- **ブロッキング指摘 0 件（High 0 / Medium 0）。未解決指摘 2 件（Low 2）。**
- **Phase 4-a ユーザー再確認へ進行可。** ただし 9.3.1 は再確認で同種の NG を再発させ得るため、**再確認の前に CSS 1 規則を適用してから実施することを推奨する**（適用しない場合は観察項目として扱い、結果を検証記録へ残すこと）。9.3.2 は挙動に影響しないため、再確認と並行して修正してよい。

再確認では `development_workflow.md:186` に追加された 2 経路（pointer 起点で pill が出ないこと / Tab 起点の button へ focus が戻ること）に加えて、次を観察対象に含めること。

1. pointer で開き **Escape** で閉じた場合に、本文全体へ outline が出ないこと（9.3.1）。
2. Tab で button へ移動して Enter / Space で開き、Escape と Close button の双方で閉じた場合に、いずれも同じ button へ focus が戻り pill が可視になること（keyboard 経路の close 手段差の確認）。

### 9.5 実装Agent対応（追加レビューfollow-up）

| ID | 対応 | status |
| --- | --- | --- |
| 9.3.1 | programmatic focus専用の`.markdown-body`へ`:focus { outline: none }`を追加した。設計§18、development workflow、Phase 4-a検証記録へpointer + Escapeの観察項目を反映した | 対応済み・再レビュー待ち |
| 9.3.2 | `docs/components/tauri_viewer/README.md`と`basic_design.md`の`imageViewer.ts`責務へactivation policyを追記した | 対応済み・再レビュー待ち |

---

### 9.6 follow-up 確認（`c9e519b`）と最終判定

`c9e519b` の差分（`App.css` 1 規則、恒久 docs 2 件、設計 §18-6、`development_workflow.md`、impl 記録、Phase 4-a 検証記録）を検証し、3 つの検証コマンドを再実行した。

#### 9.6.1 検証コマンド

| command | 実行結果 | 実装 Agent 報告との一致 |
| --- | --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | Pass。3 files / 42 tests（増減なし） | 一致 |
| `cd markdown-viewer-tauri && npm run build` | Pass。既存 chunk size warning のみ | 一致 |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | Pass | 一致 |

CSS は `App.tsx` から import され build 対象に含まれるため、`npm run build` の Pass をもって構文・取り込みの妥当性も確認できている。TypeScript / Rust に差分がないため test 件数が据え置きなのも想定どおりで、「局所 CSS・docs 修正で既存検証結果に影響しない」という実装 Agent の判断は妥当である。

#### 9.6.2 指摘別のクローズ判定

| ID | 修正 | 再確認結果 | status |
| --- | --- | --- | --- |
| 9.3.1 | `.markdown-body:focus { outline: none }`（`App.css:997-999`） | **クローズ**。(a) `:focus-visible` ではなく `:focus` を使っているため、UA 側が `:focus` / `:focus-visible` のどちらで既定 outline を描く engine でも抑止でき、指摘した engine 差の不確実性ごと解消している。(b) author origin の宣言は UA origin より常に優先されるため、specificity に依存せず確実に効く。(c) `.markdown-body` は `tabIndex={-1}` で Tab 順に入らず programmatic focus 専用の受け皿であるため、WCAG 2.4.7 が求める「keyboard operable な UI component の focus 可視化」には該当せず、keyboard 操作性の損失はない（skip link / route change container と同じ確立されたパターン）。(d) セレクタは article 自身のみで子孫へ継承されないため、`.markdown-body .image-viewer-trigger:focus` の pill 可視化（`App.css:1023`）や本文内 link の focus 表示には影響しない。設計 §18-6、`development_workflow.md:186`、Phase 4-a 検証記録の観察項目も pointer + Close / Escape の両手段を含む形へ更新済み |
| 9.3.2 | `README.md:71` を「fit / zoom / pan / wheel / intrinsic size / activation policy」、`basic_design.md:14` を「…/ intrinsic size / activation 判定」へ更新 | **クローズ**。`imageViewer.ts` の pure policy export 6 種が責務記述に揃った。`basic_design.md:71` の依存図行（`transform policy / Markdown DOM source resolver`）は指摘時に「齟齬は無いが揃えるなら同時に」とした任意項目であり、未更新でも記述の正しさは保たれている |

**補足（指摘ではない）**: 設計 §16「CSS 方針」は viewer 固有要素の CSS 契約を列挙する節で、今回追加した `.markdown-body:focus` は preview container 側の規則にあたる。挙動としては §3.2 / §5.3 の focus 復帰契約と §18-6 の観察項目でカバーされており、文書上の欠落はない。将来 §16 を触る機会があれば 1 行添えてもよい程度の任意事項として記録しておく。

#### 9.6.3 最終判定

- 初回レビュー指摘 5 件（Medium 2 / Low 3）: すべてクローズ（`80741cf`）
- Phase 4-a 追加レビュー指摘 2 件（Low 2）: すべてクローズ（`c9e519b`）
- follow-up 確認での新規指摘: **0 件**
- **未解決指摘 0 件。High / Medium 0 件。Phase 3 相当の実装レビューは全ラウンド承認。**
- **Phase 4-a ユーザー再確認へ進行可。**

再確認では `development_workflow.md:183-188` の image viewer 項目と設計 §18 の 12 scenario を実施し、とくに次を判定して `verification/phase4a_user_verification.md` へ結果を追記すること。

1. pointer で開き、**Close button と Escape の双方**で閉じた場合に、`Open image viewer` pill も Markdown 本文全体の outline も表示されないこと（9.3.1 の実機確認。Escape 経路が本命）。
2. Tab で button へ移動して Enter / Space で開き、Close button と Escape の双方で閉じた場合に、いずれも同じ button へ focus が戻り pill が可視になること。
3. 画面外の画像に対応する button へ Tab 移動した時、対象画像が表示領域へ入り pill がその右上へ出ること（8 章 1.2 の実機確認）。
4. 横 scroll 済み Mermaid / PlantUML の button へ focus した時、container 内部の横 scroll 位置が巻き戻らないこと。
5. screen reader で zoom した際、倍率通知が入力停止後に 1 回だけ行われること（8 章 1.1 の実機確認）。

再確認が PASS した場合は `meta.md` の `verification_status` を `done`、Phase 4 行を完了状態へ更新して Phase 4-b（完了処理）へ進める。
