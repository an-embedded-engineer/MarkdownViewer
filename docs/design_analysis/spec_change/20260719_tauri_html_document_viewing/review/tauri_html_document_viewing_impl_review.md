# TODO-2026-017 Tauri HTML形式仕様書表示対応 実装レビュー

**レビュー日**: 2026-07-19
**対象ドキュメント**: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/impl/tauri_html_document_viewing_impl.md`
**対象設計書**: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/design/tauri_html_document_viewing_design.md`
**Phase 2 review**: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/review/tauri_html_document_viewing_design_review.md`
**対象 meta**: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/meta.md`
**レビュー対象コミット**: `05039bb Phase 3 implement Tauri HTML document viewing`
**判定**: **承認 (Approved)**。Phase 4-a (実機検証) へ進行可。指摘は Low 4 件のみで、いずれも Phase 4 進行を妨げない。

---

## 概要

TODO-2026-017 の Phase 3 実装レビュー。承認済み設計 (Phase 2 再確認 `9489c43` 反映版) に対し、commit `05039bb` の source / config / test / fixture / 恒久 docs 差分を全て読み、`DocumentStore` の root 契約、protocol path 検証、CSP / CORS / sandbox / capability 境界、bridge / handshake / message policy、Markdown 回帰分離、テスト網羅、docs 同期を検証した。検証 command (`npm run build`、`npm test -- --run`、`cargo fmt -- --check`、`cargo test`) はレビュー時に独立再実行し、実装記録 §5 の結果 (Vitest 20 件 / Rust 22 件 / fmt / build すべて PASS) と一致することを確認した。

Phase 2 の全指摘 (root-relative segment URL、ready handshake、Origin gating、simple GET 限定、sort 正本、targetOrigin 根拠) が実装へ正しく反映されており、設計と実装の乖離は検出しなかった。

---

## 1. 齟齬・不整合

なし。設計の採用案・データモデル・エラー契約・非対象と実装の間に矛盾は検出しなかった。

---

## 2. ドキュメント不足

なし。恒久 docs (README 2 種、`project_overview`、`architecture/overview` / `code_patterns` / `common_pitfalls`、`components/tauri_viewer/` 5 種、`development_workflow`、`tests/README`、MVP 設計正本) はいずれも実装と一致する内容で更新済み。`common_pitfalls.md` §8 / §9 に `convertFileSrc` 不使用と handshake 正本という本件の落とし穴が記録され、`interface_spec.md` に `open_document` / `mvhtml` protocol / message policy の契約が仕様として残っている。ADR 非起票の判断 (Tauri 固有・横断判断未成立) も運用ルールと整合する。

---

## 3. 改善提案 (Low)

### 3.1 `HtmlPreview` の `tabMatches` / `revisionMatches` が固定値 `true` で渡されている

**根拠**: `markdown-viewer-tauri/src/App.tsx` の `HtmlPreview` 内 `handleMessage` は `evaluateHtmlBridgeMessage` へ `tabMatches: true, revisionMatches: true` を渡す。実効性は、`key={tab.id}-{tab.revision}` による remount で listener が tab / revision ごとに再作成・解除され、旧 iframe からの message は `sourceMatches` (`event.source === iframe.contentWindow`) で拒否される構造により担保されている。現構成 (単一 preview pane、active tab のみ mount) では設計 §11.3 条件 5 と等価である。

**影響**: 現時点で誤動作はない。ただし将来 split view (TODO-2026-006) で複数 `HtmlPreview` が同時 mount される、または key 構成が変わると、policy 関数のこの 2 入力が実質未検証のまま残り、防御が `sourceMatches` 単独へ暗黙に縮退する。

**修正案**: listener 作成時に capture した `tabId` / `revision` と callback 時点の active 値の実比較を渡すか、少なくとも「構造的に真であることを keyed remount が保証する」旨のコメント / docs 追記を行う。TODO-2026-006 の設計時に再評価すること。

**工程**: Phase 3追補。 **status**: 対応済み（再レビュー待ち）

**対応**: `HtmlPreview`へactive tab id / revisionを明示的に渡し、listenerがcaptureした`tabId` / `revision`との実比較を`tabMatches` / `revisionMatches`へ渡すよう変更した。keyed remountだけへ暗黙依存しない契約にした。

### 3.2 protocol handler が request ごとに `thread::spawn` する

**根拠**: `lib.rs` の `register_asynchronous_uri_scheme_protocol` callback は `thread::spawn(move || responder.respond(...))` を使う。設計 §8.3 の「blocking filesystem read は async responder の blocking task へ渡す」意図は満たすが、resource が多い HTML では request 数ぶん OS thread が生成される。

**影響**: local viewer の規模では実害は小さい。大量 resource fixture で thread 生成 overhead が生じ得る。

**修正案**: `tauri::async_runtime::spawn_blocking` の共有 pool へ寄せる。既存 PlantUML 経路と同じ手段に揃うため §12 の共通化方針とも整合する。

**工程**: Phase 3追補。 **status**: 対応済み（再レビュー待ち）

**対応**: protocol callbackのper-request `thread::spawn`を`tauri::async_runtime::spawn_blocking`へ変更し、Tauri共有blocking poolへ統合した。

### 3.3 Rust test の header / 非変換 assert に微小な抜けがある

**根拠**: 設計 §17.1 は「resource body 非変換」「CSP、CORS、nosniff、no-store、referrer policy header を検証する」を挙げるが、実装された test は (a) 非 HTML text resource (JS / JSON) へ bridge が注入されず body が非変換であることの直接 assert、(b) success response の `Cache-Control: no-store` / `Referrer-Policy: no-referrer` / `Cross-Origin-Resource-Policy` の assert を含まない (ACAO / nosniff / CSP 有無は検証済み)。

**影響**: 実装は正しい (レビューで目視確認済み) が、将来の response 組み立て変更でこれらの header / 非変換契約が退行しても test が検出しない。

**修正案**: `protocol_serves_get_and_head_with_security_headers_and_cors_policy` へ JSON GET body の等価 assert と残り 3 header の assert を追加する。

**工程**: Phase 3追補。 **status**: 対応済み（再レビュー待ち）

**対応**: success responseの`Cache-Control`、`Referrer-Policy`、`Cross-Origin-Resource-Policy`を直接assertし、JSON GET bodyの完全一致、bridge非注入、resource responseへHTML CSPが付かないことをtestへ追加した。

### 3.4 malicious fixture が設計 §17.4 fixture 5 の一部項目を含まない

**根拠**: `sample_docs/html_fixture/malicious.html` は parent DOM、`__TAURI_INTERNALS__` / `isTauri` 探索、popup、external image、form submit、`file:` link、root 外 `../` link を検査するが、設計 §17.4 fixture 5 の external `fetch` / WebSocket、asset protocol / 未知 custom protocol の読込、top / self navigation、download、`openExternal` message の直接送信 / burst を含まない。

**影響**: Phase 4-a の platform matrix で当該項目を fixture なしの手動操作 / DevTools 依存で確認することになり、3 platform 間の再現一貫性が下がる。

**修正案**: malicious.html へ上記 probe を追記して結果を `#results` へ記録するか、Phase 4-a 手順書に手動確認手順として明記する。

**工程**: Phase 3追補。 **status**: 対応済み（再レビュー待ち）

**対応**: malicious fixtureへexternal fetch / WebSocket、asset / unknown protocol、top / self navigation、download、forged `openExternal` / burst probeを追加した。navigation probeは明示button操作に限定し、その他は結果を`#results`へ記録する。

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 実装 / test / docs | 結果 |
| --- | --- | --- |
| 選択 root 配下の UTF-8 HTML を Explorer から開ける | `FileNodeType::Html` (case-insensitive `.html`、`.htm` 除外)、`open_document`、Explorer HTML icon / disabled 解除、初期 open 順 README → Markdown → HTML。Rust tree / open test、`interface_spec.md` | ✓ 整合 |
| self-contained HTML と root 内相対 resource を表示できる | root-relative `/document/<segments>` URL を Rust `preview_url` が segment 個別 encode で生成 (space / Unicode encode を test で固定)。protocol が sibling / child / root 内 `../` を URL 正規化経由で解決。fixture `index.html` が CSS / JS / MJS / JSON fetch / 子 SVG / 親 directory SVG を参照 | ✓ 整合。`convertFileSrc` 不使用・absolute path 非露出を grep で確認 |
| inline SVG / Canvas / 描画済み UML / root 内 runtime diagram | response CSP が inline script / style と `data:` image を許可。fixture に inline SVG / Canvas / runtime.js / module.mjs | ✓ 整合 |
| user-clicked `http(s)` だけを OS 標準ブラウザで開く | bridge (`isTrusted`、fragment 素通し、非 http(s) preventDefault) + `documentPolicy.evaluateHtmlBridgeMessage` (source / origin `"null"` / shape / ready 前拒否 / user activation / duplicate 750ms / scheme 再 parse) + `openUrl`。Vitest で許可・拒否系を網羅 | ✓ 整合 |
| root 外 / 外部 network / `file:` / `javascript:` / 許可外 protocol 拒否 | segment 検査 (`.` / `..` / 空 / NUL / separator / drive) → root join → canonicalize → `starts_with` → regular file → allowlist。response / shell CSP に remote source なし。sandbox `allow-scripts` のみ。Rust injection / symlink test | ✓ 整合 |
| sandbox / custom protocol / CSP / opaque origin の 3 platform 検証 | 実装記録 §7 が Windows / Linux を「成功と推定せず」Phase 4-a へ引き渡し。`issues.md` にも userActivation / timeout の platform 差を既知課題として記録 | ✓ 整合 (Phase 4-a 継続) |
| 既存 Markdown / 相対画像 / link / Mermaid / PlantUML / Multi-tab 退行なし | Mermaid effect / pendingNavigation / PlantUML 抽出はすべて `documentType === "markdown"` guard の内側。`renderMarkdown` / asset image / `mailto:` 経路は無変更。tab lifecycle / revision guard は共通のまま。`npm run build` / 全 test PASS | ✓ 整合 (表示回帰の最終確認は Phase 4-a 手動確認) |

success_metrics の必須 command はレビュー時に独立再実行してすべて PASS を確認した。

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| Phase 2 指摘 1.1 (URL 契約) の反映 | ✓ `preview_url` が root-relative segments を `NON_ALPHANUMERIC` で個別 encode し、`#[cfg(windows)]` で host 形式を切替。frontend は `withPreviewRevision` で revision query のみ付与し、URL を組み立てない |
| Phase 2 指摘 1.2 (ready handshake) の反映 | ✓ bridge が初期化直後に `ready` を post。frontend は handshake のみを ready 正本とし、iframe `load` / `error` event を使わない。5 秒 timeout は unmount / remount 時に解除。timeout / duplicate / 順序は Vitest で検証済み |
| Phase 2 指摘 1.3 (Origin gating) の反映 | ✓ Origin header 不在は許可、存在時は厳密 `null` のみ許可 (非 null は 403)。全 success response へ `Access-Control-Allow-Origin: null`。`Sec-Fetch-*` 推定なし。test あり |
| Phase 2 指摘 1.4 (simple GET / OPTIONS 405) の反映 | ✓ GET / HEAD のみ許可、OPTIONS を含む他 method は 405。test あり |
| Phase 2 指摘 1.5 (sort 正本) の反映 | ✓ `FileNodeType` から `PartialOrd` / `Ord` を外し、`node_sort_rank` (Directory=0 / Markdown=1 / Html=2 / Image=3) が唯一の正本 |
| `DocumentStore` root swap / lock (設計 §8.1) | ✓ tree 構築は lock 外、成功後の swap のみ write lock。protocol read は read guard を response 構築まで保持。scan 失敗時の旧 root 維持と root 切替を test で検証。lock poison は command error / protocol 500 で顕在化 (poison test あり) |
| HTTP status 契約 (設計 §8.3 / §13) | ✓ 405 / 403 (origin・root 外) / 409 (root 未設定) / 400 (decode・注入・非 file・許可外拡張子・非 UTF-8 text) / 404 (missing) / 500 (read・lock 失敗)。error body は plain text で absolute path を含まない |
| bridge 注入位置 (設計 §9.1) | ✓ case-insensitive `<head` (境界文字判定で `<header>` を誤検出しない) → doctype 直後 → source 先頭。head あり / 大文字 / doctype のみ / malformed を test で検証。charset は response header が優先されるため注入位置の影響なし |
| bridge 責務限定 (設計 §9.1) | ✓ Tauri API 呼び出しなし、parent DOM access なし。fragment 素通し、http(s) のみ postMessage、他 scheme / relative document link は preventDefault、submit / auxclick / dragstart / drop 抑止。targetOrigin `"*"` の根拠は設計へ記載済みで受信側が全面再検証 |
| shell CSP (設計 §10.3) | ✓ production は `frame-src mvhtml: http://mvhtml.localhost` のみで remote http(s) なし。`img-src` は既存 Markdown asset image (asset: / asset.localhost / data: / blob:)、`connect-src` は Tauri IPC のみ。devCsp だけに Vite HMR (`localhost:1420` / ws) を追加し production を緩和していない |
| Tauri capability / IPC (設計 §10.4) | ✓ `capabilities/default.json` は permission 追加なし・remote origin なし (description のみ更新)。`withGlobalTauri` 有効化なし。protocol handler は `webview_label() == "main"` を確認 |
| HTML source 非保持 (設計 §4.1 / §11.1) | ✓ `open_document` HTML branch は UTF-8 検証のみで source を返さず、tab state も `sourceText: null`。React から iframe DOM への access なし |
| 型契約 (設計 §7) | ✓ Rust / TS とも排他的 discriminated union。`parseOpenDocumentResponse` が混在 shape・非 `mvhtml` URL を実行時拒否。`any` / 同時 fallback なし |
| 類似ロジック共通化 (設計 §12) | ✓ MIME / allowlist / bridge 注入判定は `resource_descriptor` の単一 match が正本。policy は `documentPolicy.ts` の pure function に集約。`normalize_path` / `extension` / `path_for_external_use` を再利用し duplicate なし |
| 不要な互換 wrapper / fallback / 権限緩和なし (観点 8) | ✓ `read_text_file` は invoke_handler からも削除され wrapper なし。HTML 失敗時の Markdown / asset fallback なし。assetProtocol scope は不変 (縮小は既存の別 TODO 契約どおり) |
| `build_tree` の root 外 symlink 除外 | ✓ 新規に canonical 子 path の root 境界確認を追加。従来「列挙されるが open で失敗する」だった root 外 symlink が列挙段階で除外される。設計の root boundary 契約と整合する安全方向の変更 |
| UI 文言 / a11y (設計 §11.4) | ✓ 全置換を実装で確認。`aria-controls` は `document-preview` へ、TabStrip label は `Open documents` へ更新。HTML error は既存 error strip (`role="alert"`) と `Document preview failed.` 表示に接続 |
| Reload / Theme 契約 (設計 §9.2 / §14) | ✓ Reload は revision 増加 + `open_document` 再検証 + iframe remount。Markdown preview key は theme を含み、HTML key は `id-revision` のみで theme 変更による再 load なし |
| tab 切替時の HTML remount | ✓ 単一 preview pane 方式のため tab 切替で iframe が remount され scroll / script が初期化される。既存 Markdown preview (keyed remount) と同等の挙動で状態混線はない。設計シナリオ §18.7 の観察対象として Phase 4-a で確認 |
| 実装記録との一致 | ✓ 変更ファイル一覧・test 項目・検証結果は commit 差分および独立再実行結果と一致 |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 低 | 3.1 message policy の固定値入力 | 現構成では構造的に安全。split view 導入時の再評価条件を残すことが目的 |
| 低 | 3.2 protocol の per-request thread | 実害は小さく、pool 化は任意の品質改善 |
| 低 | 3.3 test の header / 非変換 assert | 実装は正しく、退行検出力の補強のみ |
| 低 | 3.4 malicious fixture の probe 不足 | Phase 4-a の 3 platform 確認の再現性向上のため開始前対応を推奨 |

---

## 7. 残リスク / Phase 4-a での注意点

- Windows / Linux の実機確認 (protocol URL / relative resource / `Origin` header 有無 / IPC 非公開 / CSP / external link / root 外拒否) は未実施であり、実装記録 §7 のとおり成功と推定しない。platform matrix への記録を必須とする。
- production shell CSP 下での Mermaid / PlantUML / asset image / IPC の実動作は `npm run tauri dev` の起動確認までしか検証されていない。Phase 4-a の Markdown regression 確認を CSP 起因の失敗観察を含めて行う。
- `navigator.userActivation` 非対応 WebView では external link が常に拒否される (設計どおりの縮退)。Linux WebKitGTK での可否を matrix に記録し、非対応なら当該 platform の external link を未対応として扱う。
- 5 秒 ready timeout の false error 有無を巨大 HTML / 低速 disk fixture で観察する (`issues.md` に既知課題として記録済み)。
- root swap と in-flight protocol request の競合は read lock と tab 破棄契約で防御されているが、Phase 4-a の root 切替シナリオで実機観察する。

---

## 8. 結論

実装は承認済み設計を忠実に反映しており、Phase 2 レビューの全指摘 (High 1 / Medium 2 / Low 3) が実装・test・恒久 docs まで一貫して反映されている。root-relative segment URL による相対 resource 解決、ready handshake による実装可能な load 判定、Origin gating の明確化はいずれも設計どおりで、`convertFileSrc` fallback・absolute path 露出・互換 wrapper・権限緩和は存在しない。Rust 22 件 / Vitest 20 件の自動 test は成功系・境界値・拒否系を設計 §17 にほぼ対応する粒度で検証しており、レビュー時の独立再実行でも全 PASS を確認した。恒久 docs は source と一致する。

指摘は Low 4 件 (3.1〜3.4) のみで、いずれも現時点の動作・安全性に影響せず、Phase 4-a 進行の blocker ではない。3.4 (malicious fixture の probe 追加) は Phase 4-a 開始前の対応を推奨する。以上より Phase 3 実装を**承認 (Approved)** とし、**Phase 4-a (macOS / Windows / Linux 実機検証) へ進行可能**であることを明示する。
