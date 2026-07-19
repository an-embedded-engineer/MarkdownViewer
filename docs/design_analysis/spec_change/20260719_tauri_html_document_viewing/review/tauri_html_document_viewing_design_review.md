# TODO-2026-017 Tauri HTML形式仕様書表示対応 設計レビュー

**レビュー日**: 2026-07-19
**再確認日**: 2026-07-19
**対象ドキュメント**: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/design/tauri_html_document_viewing_design.md`
**対象 meta**: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-017
**source report**: `docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md`
**初回レビュー対象コミット**: `88aae68 Phase 2 draft Tauri HTML document viewing design`
**再確認対象コミット**: `9489c43 Phase 2 address Tauri HTML design review findings`
**判定**: **承認 (Approved)**。Phase 3 進行可。初回判定は要修正 (Changes Requested) だったが、全指摘 (High 1 / Medium 2 / Low 3) の設計反映を再確認で解決済みと判定した。

---

## 概要

TODO-2026-017 (Tauri HTML形式仕様書表示対応) の Phase 2 設計レビュー。trusted active HTML の前提、root-scoped custom protocol / sandbox / CSP / CORS / Tauri IPC 境界、link bridge と message validation、`DocumentStore` の責務とエラー契約、typed document model、テスト・恒久 docs 更新先を、受け入れ条件トレースと現行実装 (`markdown-viewer-tauri/src/App.tsx`、`src-tauri/src/lib.rs`、`tauri.conf.json`、`capabilities/default.json`) および lock 済み依存 crate の実ソース (`~/.cargo/registry/src/.../tauri-2.11.2/`) を根拠に検証した。

セキュリティ境界の多層化 (canonicalize + root boundary + extension allowlist + response CSP + iframe sandbox + shell CSP)、trusted 前提と強制境界の区別、fallback を設けない失敗時契約は一貫して適切に設計されている。一方、相対 resource 解決という機能要求の中核に対して、採用した URL 生成手段 (`convertFileSrc`) が仕様上成立しない齟齬を検出した。

---

## 1. 齟齬・不整合

### 1.1 `convertFileSrc` は path 全体を単一 segment として encode するため、HTML からの相対 resource が解決できない

**ドキュメント記載**: 「frontend は canonical path を `convertFileSrc(path, "mvhtml")` で platform 適合 URL へ変換する」(design 68 行)、「`convertFileSrc` の protocol 引数を使うことで、macOS / Linux の `mvhtml://localhost/...` と Windows の `http://mvhtml.localhost/...` を frontend 独自分岐なしで生成できる」(design 79 行)、「HTML tab の `previewUrl` は `convertFileSrc(previewPath, "mvhtml")` へ `revision` query を付ける」(design 284 行)。path 検証は「platform URL 形式から absolute filesystem path を復元する」「relative path を拒否する」(design 216-219 行) を前提とする。

**差異**: lock 済み crate 実ソース `tauri-2.11.2/scripts/core.js:13-20` の実装は次の通りで、**path 全体を `encodeURIComponent` で単一の percent-encoded path segment に変換する** (`/` は `%2F` になる)。

```js
value: function (filePath, protocol = 'asset') {
  const path = encodeURIComponent(filePath)
  return osName === 'windows' || osName === 'android'
    ? `${protocolScheme}://${protocol}.localhost/${path}`
    : `${protocol}://localhost/${path}`
}
```

したがって HTML document の URL は `mvhtml://localhost/%2FUsers%2F...%2Fspec%2Findex.html` のように **path segment が 1 個だけ** の URL になる。WHATWG URL 解決は `%2F` を path 区切りとして扱わないため、HTML 内の相対参照 `./images/flow.png` は base の唯一の segment を差し替えて `mvhtml://localhost/images/flow.png` へ解決される。protocol handler が受け取る path は `/images/flow.png` であり、percent-decode しても「HTML file 位置を基準にした absolute path」を復元できず、design 219 行の relative path 拒否または root 外判定により 400 / 403 になる。

これにより、機能要求 3「HTML file 位置を基準にした root 内 relative resource を表示する」(design 17 行)、受け入れ条件「self-contained / root 内 resource」(design 30-31 行)、`connect-src` 経由の root 内 JSON `fetch` (design 316 行)、手動 fixture 2 (design 510 行) が **設計のまま実装すると全滅する**。self-contained HTML と top-level document の表示だけは成立するため、実装着手後の手動確認まで発覚しない可能性が高い。

**推奨対応**: `convertFileSrc` を HTML preview URL の生成手段としないことを設計書へ明記し、URL 契約を次のいずれかで再設計する。

- 案 A (推奨): `open_document` の response で Rust 側が preview URL を生成して返す。path segment ごとに percent-encode して `/` 構造を保持し、Windows は compile-time `cfg` で `http://mvhtml.localhost/<segments>` 形式、macOS / Linux は `mvhtml://localhost/<segments>` 形式とする。`previewPath` を返して frontend で組み立てる現行案より、platform 分岐と encode 規則を Rust unit test で固定できる。
- 案 B: URL path を「current root からの相対 path segments」とする。絶対 path を WebView へ露出せず、design 217 行の「absolute filesystem path の復元」も「root join + canonicalize」へ単純化できる。root swap 時の stale URL は revision / tab 破棄契約 (design 429 行) で既に整合する。

いずれの場合も、§8.2 の検証手順へ「query (`revision`) / fragment を除去してから path segment を decode する」ことを明記し、§17.1 へ URL 往復 (encode → resolve → decode) の unit test を space / Unicode / `%2F` 埋め込み / Windows drive / UNC で追加する。§4.2 の判断理由と §19 の「custom protocol URL 差」行も合わせて更新する。

**severity**: High（受け入れ条件の中核が設計のまま成立しない。Phase 3 開始前に修正必須）

**工程**: Phase 2（設計書修正・再レビュー）

**status**: 解決済み（2026-07-19 再確認、commit `9489c43`）

**対応**: 案Aと案Bを組み合わせ、`open_document`がcurrent-root-relative path segmentsを個別encodeした完全`previewUrl`をRustで生成する契約へ変更した。HTML URLでは`convertFileSrc`を使わない。protocol pathは`/document/<segments>`とし、query / fragment除外、segment単位decode、decode後separator / dot segment / drive / UNC拒否、root join後canonicalizeを明記した。URL往復と攻撃segmentのRust test、risk / referenceも同期した。

### 1.2 top-level HTML の「iframe load error で error 遷移」は cross-origin iframe では検出できない

**ドキュメント記載**: 「iframe load で `ready`、iframe error / protocol error で `error` へ遷移する」(design 354 行)、「iframe top-level load error | active tab を error 表示にする」(design 415 行)。

**差異**: iframe 要素は HTTP error response (403 / 404 / 500 の plain text body) でも `load` event を発火し、`error` event は発火しない。さらに sandbox による opaque origin のため、React から response status や document 内容を読んで失敗を判別することもできない。したがって「protocol error で `error` へ遷移」は記載どおりには実装できず、open 成功後に file が削除された等の race では error body の text がそのまま iframe に表示され、tab は `ready` になる。

**推奨対応**: tab の `error` 遷移の正本は `open_document` の事前検証 (root / regular file / UTF-8) とし、protocol 段階の top-level 失敗は「iframe 内に error body が表示され、tab state は ready のまま」となることを §11.1 / §13 へ明記して契約を実装可能な形に修正する。より厳密な検出が必要なら、bridge は成功 HTML response にのみ注入される性質を利用し、bridge が初期化時に固定 type の `ready` handshake message を post し、一定時間 handshake が来ない load を error とみなす方式を選択肢として記載する（handshake も §11.3 と同じ検証を通す）。

**severity**: Medium

**工程**: Phase 2（設計書修正）

**status**: 解決済み（2026-07-19 再確認、commit `9489c43`）

**対応**: success HTMLへbridge初期化直後の`ready` handshakeを追加し、frontendはsource / origin / tab revisionを検証したhandshakeだけをreadyの正本とする方式へ変更した。mount後5秒timeout、revision / unmount時clear、iframe load / error eventをprotocol判定へ使わない契約とtestを追記した。

### 1.3 `Origin` header による gating を全 request へ適用すると no-cors subresource が読めなくなる

**ドキュメント記載**: 「JSON `fetch` 用に sandbox opaque origin へ `Access-Control-Allow-Origin: null` を返し、credential は許可しない。`Origin` が `null` 以外の fetch は許可しない」(design 262 行)。

**差異**: `<img>` / `<link rel="stylesheet">` / `<script src>` / `@font-face` 等の no-cors mode の subresource request は、一般に `Origin` header 自体を送らない。「`Origin` が `null` 以外は許可しない」を「`Origin: null` header が付いた request だけ許可する」と読んで実装すると、画像・CSS・JS・font の配信が全滅する。逆に fetch に限る条件だとしても、handler が「fetch であること」を判別する手段 (`Sec-Fetch-*` header) は WebView engine 間で保証されない。現在の記載はどちらの実装も許す曖昧さがある。

**推奨対応**: §8.4 を「`Origin` header 不在の request は許可する。`Origin` header が存在し、かつ値が `null` 以外の場合だけ拒否する。`Access-Control-Allow-Origin: null` は request 種別を判別せず常に付与する（credential 非許可のため害はない）」へ明確化する。§17.5 の platform matrix へ「subresource request に `Origin` を付ける engine の有無」を確認観点として追加する。

**severity**: Medium

**工程**: Phase 2（設計書修正）

**status**: 解決済み（2026-07-19 再確認、commit `9489c43`）

**対応**: `Origin`不在requestはno-cors subresourceとして許可し、headerが存在する場合だけ厳密な`null`を要求する契約へ修正した。request種別を`Sec-Fetch-*`で推定せず、全success responseへ`Access-Control-Allow-Origin: null`を付与する。unit testと3 platform matrixへOrigin header有無を追加した。

### 1.4 GET / HEAD 限定 (405) により CORS preflight を要する fetch は失敗する

**ドキュメント記載**: 「対応 method は `GET` と `HEAD` だけとする。その他は `405 Method Not Allowed`」(design 229 行)。

**差異**: custom header 等を付けた non-simple fetch は preflight `OPTIONS` を送り、405 で fetch 全体が失敗する。要求されている root 内 JSON `fetch` は simple GET で成立するため機能要求への影響はないが、「trusted HTML が行う fetch は preflight 不要な simple GET に限る」という制約が仕様として明文化されておらず、fixture 作成者・HTML 生成側が知る手段がない。

**推奨対応**: §8.3 または §8.4 へ「preflight (`OPTIONS`) は対応せず、root 内 fetch は simple GET のみを対応範囲とする」ことを仕様として明記し、§13 のエラー表へも該当行を追加する。

**severity**: Low

**工程**: Phase 2（設計書修正）

**status**: 解決済み（2026-07-19 再確認、commit `9489c43`）

**対応**: root内JSONはpreflight不要のsimple GETだけを対応範囲とし、custom header、credential、OPTIONS preflightは非対応、OPTIONSは405と明記した。エラー表とRust testを同期した。

### 1.5 sort 順の正本が derive `Ord` と既存 `node_sort_rank` の 2 箇所になり得る

**ドキュメント記載**: §7.1 の Rust model は `FileNodeType` へ `PartialOrd, Ord` を derive し (design 117 行)、§17.1 は「sort は Directory -> Markdown -> Html -> Image」(design 474 行) とする。

**差異**: 現行実装には `node_sort_rank` (lib.rs:634) による rank 関数が既に存在する。derive `Ord` を追加すると variant 宣言順と rank 関数の 2 つの順序定義が併存し、§12 の「1 つの typed table / match を正本にする」方針 (design 403 行) と整合しない。

**推奨対応**: derive `Ord` を採用して `node_sort_rank` を削除するか、rank 関数を維持して derive から `PartialOrd, Ord` を外すかを設計書で確定する。前者の場合「variant 宣言順が sort 仕様である」ことを §7.1 へ明記する。

**severity**: Low

**工程**: Phase 3（実装時確定で可）

**status**: 解決済み（2026-07-19 再確認、commit `9489c43`）

**対応**: existing `node_sort_rank`をsort順の唯一の正本として維持し、`FileNodeType`から`PartialOrd` / `Ord` deriveを外した。rankをDirectory=0、Markdown=1、Html=2、Image=3と設計へ明記した。

---

## 2. ドキュメント不足

なし。恒久ドキュメント更新予定 (design §16) は source report §12 の Tauri 側対象を網羅し、`docs/rules/project_overview.md` の目的記述更新も含む。ADR は「複数案件で再利用される横断判断になった場合だけ Phase 3 完了時に別途要約する」(design 466 行) とされ、ADR 運用ルールと整合する。

---

## 3. 改善提案

### 3.1 bridge の `parent.postMessage(..., "*")` は許容範囲だが根拠を設計書に一言残すとよい

**推奨対応**: targetOrigin `"*"` は message 内容が非機密 (URL のみ) で、受信側 §11.3 が全面的に再検証するため許容できる。ただし shell 側 origin が platform で異なる (`tauri://localhost` / `http://tauri.localhost`) ことが `"*"` を選ぶ実質的理由であるため、その旨を §9.1 へ 1 行追記すると Phase 3 での「exact origin にすべきでは」という再検討を防げる。

**severity**: Low

**status**: 解決済み（2026-07-19 再確認、commit `9489c43`）

**対応**: shell originがplatformで異なり、messageが非機密の固定type / URLだけで、受信側が全面再検証するためtarget origin `"*"`を選ぶことをlink bridge設計へ明記した。

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| 選択 root 配下の UTF-8 HTML を Explorer から開ける | §2.2 表 1 行目、§7 (typed model / `open_document`)、§11.4 (icon / 初期 open 順) | ✓ 整合。初期 open 順「README、最初の Markdown、最初の HTML」は現行 `findReadme(tree) ?? findFirstMarkdown(tree)` (`App.tsx:183`) と互換 |
| self-contained HTML と root 内相対 resource を表示できる | §4.1、§8、§9 | ✓ 指摘1.1対応でRust生成のroot-relative segment URLへ変更。relative resourceのURL構造を保持する |
| inline SVG / Canvas / 描画済み UML / root 内 runtime diagram | §2.2 表 3 行目、§10.2 (inline script / style 許可、`data:` image)、§17.4 fixture 1-3 | ✓ 整合 |
| `http(s)` link を Viewer 内遷移させず OS 標準ブラウザで開く | §9.1 (bridge)、§11.3 (message policy)、§10.3 (`frame-src` で remote 拒否) | ✓ 整合。`event.isTrusted` + transient user activation + active source + duplicate guard は trusted 契約と釣り合う |
| root 外 / 外部 network / `file:` / `javascript:` / 許可外 protocol 拒否 | §8.2 (path 検証)、§8.4 (allowlist)、§10.1-10.3 (sandbox / CSP)、§17.4 fixture 5 | ✓ 整合。多層防御であり、frontend 判定を境界にしない |
| sandbox / custom protocol / CSP / opaque origin の 3 platform 検証 | §17.5 matrix、§10.4 (Linux 注意と無効化 fallback) | ✓ 整合。「確認不能 platform を成功と推定しない」と明記 |
| 既存 Markdown / 相対画像 / link / Mermaid / PlantUML / Multi-tab 退行なし | §2.2 表 7 行目、§11.1-11.2、§14、§17.4 fixture 6 | ✓ 整合。分岐は type の内側に閉じ、`render_plantuml_diagrams` 契約を維持 |

success_metrics の必須 command は §17.3 が網羅する (`npm test -- --run` は Vitest 最小導入 §17.2 と対応)。

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| trusted active HTML の「前提」と「強制する境界」の区別 (§22 観点 1) | ✓ 整合。§9.1「bridge を arbitrary malicious HTML に対する認証境界とみなさない」、§19 で untrusted 対応を明示的に別 TODO 化 |
| Tauri IPC main-frame-only initialization の主張 (§10.4) | ✓ 過大評価なし。`tauri-2.11.2/src/webview/mod.rs:826` (`initialization_script` は main frame のみ、all frames は別 API) を確認。Linux の iframe / window request 非区別も公式注意どおり記載し、成立しない platform では HTML を無効化する縮退方針で権限拡大 fallback がない |
| shell CSP `frame-src` による iframe self-navigation 拒否 (§22 観点 2) | ✓ 妥当。`frame-src` は nested browsing context の後続 navigation にも適用され、remote `http(s)` を含めない方針で成立する |
| `DocumentStore` root swap / lock 契約 (§8.1) | ✓ 整合。tree 構築 lock 外・swap のみ write lock・protocol read 中 read lock 保持で、root 切替と response の root 跨ぎを防ぐ。lock poison を明示 error とし fallback なし |
| path 検証手順 (§8.2) と既存 helper 再利用 | ✓ 整合。`normalize_path` (canonicalize, lib.rs:642)、`path_for_external_use` (Windows verbatim / UNC 復元, lib.rs:670) は実在し、責務配置も §12 の方針と一致 |
| `read_text_file` の非互換置換 (§7.3, §14) | ✓ 整合。呼び出し元は `App.tsx:388` の 1 箇所のみで、互換 wrapper を残さない方針は checkpoint (不要な後方互換レイヤー禁止) と一致 |
| typed model の排他契約 (§7.1-7.2) | ✓ 整合。discriminated union で optional field の同時 fallback を排除。`markdown` field の `sourceText` 一般化は現行 tab 構造 (`App.tsx:35-43`) から無理なく到達できる |
| UI 文言変更 (§11.4) | ✓ 整合。置換元文言はすべて現行 `App.tsx` (118, 159, 801, 805, 828, 1310 行) に実在する |
| capability 境界 (§10.4, §15) | ✓ 整合。現行 `capabilities/default.json` は `core:default` / `dialog` / `opener` のみで、remote origin を追加しない契約と矛盾しない |
| 現行 `csp: null` / `assetProtocol.scope: ["**"]` の扱い | ✓ 整合。shell CSP 導入は本件対象、asset scope 縮小は別 security TODO へ分離 (todo.md non_scope と一致) |
| Markdown `mailto:` と HTML 外部 open の非対称 | ✓ 整合。source report 未解決事項 4 への回答として §3.2 で明示決定され、todo.md non_scope と一致 |
| meta CSP より先の bridge 注入 (§9.1) | ✓ 妥当。meta 経由 CSP は parse 到達後にのみ適用されるため、head 先頭注入で bridge 実行を確保できる。charset は response header の `charset=utf-8` が優先されるため注入による 1024 byte 問題もない |
| 不採用案の網羅 (§5) | ✓ 整合。source report §9.1 の比較表と一致し、`srcDoc` / asset protocol / Blob URL の不採用理由も report の分析と矛盾しない |
| Phase 2 コミット (`88aae68`) が docs-only 差分である | ✓ 整合。design 新規 + meta 更新のみで実装コード変更なし |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 高 | 1.1 `convertFileSrc` の単一 segment encode | 相対 resource・JSON fetch という受け入れ条件の中核が設計のまま成立せず、実装後の手動確認まで発覚しない |
| 中 | 1.2 top-level load error 検出契約 | 記載どおりには実装不能な契約であり、Phase 3 で実装者の独自解釈か権限追加を誘発する |
| 中 | 1.3 `Origin` gating の曖昧さ | 字義どおりの実装で subresource 配信が全滅し得る。platform 差確認観点にも影響 |
| 低 | 1.4 preflight 非対応の明文化 | 機能要求は simple GET で満たせるため、制約の明文化のみ |
| 低 | 1.5 sort 正本の一本化 / 3.1 targetOrigin 根拠 | 実装時確定で手戻りが小さい |

---

## 7. 残リスク / Phase 3 での注意点

- `navigator.userActivation` (§11.3 条件 8) は WebKitGTK の版次第で利用できない可能性がある。設計は「利用不能なら当該 platform の external link を未対応として設計へ戻す」と縮退方針を明記済みだが、Phase 4-a の platform matrix に external link 行として確実に記録する。
- shell CSP 導入 (§10.3) は Mermaid の inline style、PlantUML inline SVG、asset protocol 画像、Tauri IPC script の全てに影響するため、§10.3 記載どおり実 bundle を確認して最小化し、Markdown 回帰 fixture (§17.4 fixture 6) を CSP 導入コミットと同時に確認する。
- `ready` handshake の 5 秒 timeout (§11.1) は、bridge が head 先頭で parse 早期に実行されるため通常は十分だが、低速 disk や巨大 HTML で false error になっていないかを Phase 4-a の実機確認で観察する。閾値変更が必要なら設計書の値を更新する。
- root-relative URL 化 (指摘 1.1 対応) により、root swap 直後に stale iframe request が新 root に対して解決される理論上の窓がある。両 root とも user 選択の trusted root で、swap 成功時に tab / iframe は破棄され (§14)、protocol read は read lock で root と原子的に整合する (§8.1) ため、境界違反にはならないことを再確認で確認済み。Phase 3 で root swap と in-flight request の test (§17.1 root 切替) に含める。

---

## 8. 結論

設計は TODO-2026-017 の要求・非対象・受け入れ条件を丁寧に追跡しており、trusted 前提と強制境界の区別、多層防御の構成、fallback を作らない失敗時契約、既存 Markdown 経路の維持はいずれも高品質である。恒久 docs・テスト計画・platform matrix も受け入れ条件を追跡できる粒度で具体的である。

初回レビューでは、相対 resource解決という本変更の中核要求に対し、採用手段である`convertFileSrc`がpath全体を単一percent-encoded segmentとして生成するため相対URL解決が成立しない齟齬（指摘1.1, High）を確認し、**要修正 (Changes Requested)** とした。

### 再確認結果 (2026-07-19, commit `9489c43`)

実装担当による指摘 1.1〜1.5 および改善提案 3.1 の設計書反映を、commit `9489c43` の差分と更新後設計書の全体整合で再確認した。

- **1.1 (High) — 解決済み**: URL 契約が「Rust が current-root-relative path segments を個別 percent-encode した `/document/<segments>` 形式の完全 `previewUrl` を生成して返す」方式 (推奨案 A + B の複合) へ変更された (§4.1.3, §4.2, §7.1-7.3, §8.2-8.3, §9.2, §11.1)。segment 構造が保持されるため、`./images/flow.png` は `mvhtml://localhost/document/<dir>/images/flow.png` へ自然に解決され、handler は prefix 確認 → segment 単位 decode → 攻撃 segment (`.` / `..` / 空 / decode 後 separator / drive / UNC) 拒否 → root join → canonicalize → `starts_with` の順で検証できる。root 内 `../` は WebView 側の URL 正規化で `/document/` 配下に収まり、root 逸脱は prefix / canonicalize で拒否される。query (`revision`) / fragment の除外も §8.2 手順 1 と §9.2 に明記された。§17.1 の URL 往復 test (space / Unicode / `%2F` / `%5C` / drive / UNC)、§19 risk 行、§21 参照注記まで同期されており、旧 `convertFileSrc` 前提の残存記述はない (grep で「不採用」文脈の 3 箇所のみ確認)。副次効果として absolute path が WebView へ露出しなくなる点も妥当。
- **1.2 (Medium) — 解決済み**: bridge 初期化直後の固定 type `ready` handshake を ready 判定の唯一の正本とし、iframe `load` / `error` event を protocol 成功判定に使わない契約へ変更された (§9.1 責務 1, §11.1, §13)。mount 後 5 秒 timeout、revision 変更 / unmount 時の timeout 解除、error body が iframe 内に表示され得る旨も明記され、handshake は §11.3 の message union (source / origin / stale revision / duplicate 検証、`ready` は未 ready 状態から 1 回だけ受理) と §17.2 test へ一貫して反映された。user activation 条件 (§11.3 条件 8) が `openExternal` のみに正しくスコープされていることも確認した。
- **1.3 (Medium) — 解決済み**: 「`Origin` header 不在の request は no-cors subresource として許可、存在時は厳密に `null` のみ許可、`Access-Control-Allow-Origin: null` は全 success response へ常時付与、`Sec-Fetch-*` による request 種別推定はしない」へ明確化された (§8.4)。§17.1 の unit test と §17.5 platform matrix (「no-cors subresource の `Origin` header 有無」行) も追加済み。
- **1.4 (Low) — 解決済み**: root 内 JSON fetch を preflight 不要の simple GET に限定し、custom header / credential / `OPTIONS` preflight 非対応、`OPTIONS` は 405 と §8.4 / §13 / §17.1 へ明記された。
- **1.5 (Low) — 解決済み**: `FileNodeType` から `PartialOrd` / `Ord` derive を外し、既存 `node_sort_rank` を sort 順の唯一の正本として rank 値 (Directory=0, Markdown=1, Html=2, Image=3) を §12 へ明記した。§17.1 の sort test 記載とも整合する。
- **3.1 (Low) — 解決済み**: targetOrigin `"*"` の根拠 (platform により shell origin が異なる、message は非機密の固定 type / URL のみ、受信側が全面再検証) が §9.1 へ追記された。

対応による新たな齟齬・セキュリティ上の欠落・実装不能な契約は検出しなかった。受け入れ条件トレース (第 4 節) の相対 resource 行は本再確認で ✓ へ更新済みである。以上より本設計を**承認 (Approved)** とし、Phase 3 (実装) への進行を可とする。Phase 3 では第 7 節の残リスク 4 点 (user activation の platform 差、shell CSP 回帰、handshake timeout の実機観察、root swap と in-flight request の test) に留意すること。
