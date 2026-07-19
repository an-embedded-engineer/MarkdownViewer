# TODO-2026-017 Tauri HTML形式仕様書表示対応 実装記録

## 1. 実装概要

承認済み設計に従い、Tauri版Viewerのdocument modelをMarkdown / HTMLへ一般化した。HTMLは利用者が信頼するUTF-8 active documentに限定し、Rustが管理するcurrent root内のallowlist resourceだけを`mvhtml` custom protocolで配信する。ReactはHTML sourceを保持せず、sandboxed iframeとtyped message policyだけを扱う。

## 2. 設計・実装対応

| 設計項目 | 実装 |
| --- | --- |
| typed Explorer / document model | Rust `FileNodeType::Html` / `DocumentType` / `OpenDocumentResponse`、TypeScript discriminated unionを追加した。sort正本は`node_sort_rank`のDirectory→Markdown→HTML→Imageとした |
| current rootの正本 | `DocumentStore`の`RwLock<Option<PathBuf>>`へ集約した。`scan_directory`成功後だけrootをswapし、`open_document`とprotocol readが同じrootを使う |
| command置換 | `read_text_file(rootPath, path)`を削除し、`open_document(path)`へ置換した。Markdownは`sourceText`、HTMLは`previewUrl`を排他的に返す |
| preview URL | Rustがcurrent-root-relative segmentを個別percent-encodeし、macOS / Linuxの`mvhtml://localhost/document/...`またはWindowsの`http://mvhtml.localhost/document/...`を返す。HTMLでは`convertFileSrc`を使わない |
| protocol path境界 | `/document/` prefix、1回decode、empty / dot / separator / NUL / drive注入、canonicalize、root外symlink、regular file、extension allowlistを順に検証する |
| resource response | HTML / CSS / JS / MJS / JSON / image / fontの固定MIMEを正本にし、GET / HEAD、CORS `null`、nosniff、no-store、referrer policy、CORPを実装した。simple JSON GETだけを対象としOPTIONSは405とした |
| HTML変換 | HTMLだけへViewer bridgeをhead、doctype、source先頭の優先順で注入し、response CSPを付与した。resource JS / SVG等は変換しない |
| sandbox / shell CSP | `HtmlPreview`を`sandbox="allow-scripts"` iframeとして追加し、production / development shell CSPのframe sourceを`mvhtml` platform URLへ限定した。capability remote originは追加していない |
| ready判定 | bridgeの`ready` messageだけを正本とし、source / `Origin: null` / tab revision / exact shape / duplicateを検証する。5秒timeoutを設け、iframe load/error eventは判定に使わない |
| external link | bridgeはtrusted user clickを捕捉し、parentへ固定messageを送る。frontendはready済み、transient user activation、duplicate guard、absolute HTTP(S)を再検証して`openUrl`へ渡す |
| Markdown回帰分離 | HTML branchではMarkdown変換、Mermaid effect、PlantUML抽出 / commandを実行しない。Markdownのasset image、relative link、Mermaid、PlantUML経路は維持した |
| UI | `Open Document Folder`、`Document Preview`、document empty state、HTML icon、`Loading HTML...`へ更新した。README→最初のMarkdown→最初のHTMLの初期open順を維持した |

## 3. 変更ファイル

### Source / config / dependency

- `markdown-viewer-tauri/src-tauri/src/lib.rs`
- `markdown-viewer-tauri/src-tauri/Cargo.toml` / `Cargo.lock`
- `markdown-viewer-tauri/src-tauri/tauri.conf.json`
- `markdown-viewer-tauri/src-tauri/capabilities/default.json`
- `markdown-viewer-tauri/src/App.tsx`
- `markdown-viewer-tauri/src/App.css`
- `markdown-viewer-tauri/src/documentPolicy.ts`
- `markdown-viewer-tauri/src/documentPolicy.test.ts`
- `markdown-viewer-tauri/package.json` / `package-lock.json`

### Manual fixture

- `sample_docs/html_fixture/index.html`
- `sample_docs/html_fixture/malicious.html`
- `sample_docs/html_fixture/assets/`
- `sample_docs/html_shared.svg`

### 恒久ドキュメント

- `README.md`
- `markdown-viewer-tauri/README.md`
- `docs/rules/project_overview.md`
- `docs/architecture/overview.md`
- `docs/architecture/code_patterns.md`
- `docs/architecture/common_pitfalls.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/components/tauri_viewer/issues.md`
- `docs/rules/development_workflow.md`
- `docs/tests/README.md`
- `docs/design_analysis/new_feature/markdown_viewer_mvp_comparison_initial_design/markdown_viewer_mvp_design_tauri_avalonia.md`

本件の判断はTauri Viewer固有であり、現時点では複数componentが再利用する横断判断ではないためADRは追加していない。

## 4. 自動テスト

### Rust unit test

- `.html` / `.HTML`列挙、`.htm`除外、sort順。
- Markdown / HTMLの排他的open response。
- root未設定、root外、directory、unsupported、非UTF-8拒否。
- root-relative segment URL、space / Unicode、unsafe segment、symlink escape。
- MIME allowlist、GET / HEAD、400 / 403 / 404 / 405 / 409 / 500。
- Origin不在 / `null`許可、その他Origin拒否、CORS / CSP / security header。
- JSON GET / OPTIONS、bridge注入位置、root swap成功 / 失敗。

### Frontend policy test

- command responseのMarkdown / HTML排他shape。
- platform preview URLとrevision query。
- message source / origin / stale context / shape / ready duplicate。
- HTTP(S)許可、file / JavaScript / data / mailto / custom scheme拒否。
- transient user activation、external duplicate guard、5秒timeout境界。
- HTMLをMarkdown-only処理へ入れないbranch contract。

## 5. 検証結果

Phase 3レビュー依頼前の最終実行結果を以下へ記録する。

| command | result |
| --- | --- |
| `npm run build` | PASS。Vite既知の500kB超chunk warningのみ |
| `npm test -- --run` | PASS。1 file / 20 tests |
| `cargo fmt -- --check` | PASS |
| `cargo check` | PASS |
| `cargo test` | PASS。22 unit tests、0 failures |
| `npm run tauri dev` | PASS。Vite起動、Rust dev build、Tauri binary起動まで初期化errorなし。操作確認前に終了 |

## 6. 互換性

- persistent tab dataはないためmigrationは不要。
- settings / Recent Folders / window size / Theme / PlantUML jar schemaを変更していない。
- Markdownのraw HTML禁止、relative image、relative Markdown link / anchor、`mailto:` external open、Mermaid、PlantUML、tab lifecycleを維持した。
- project内commandは`open_document`へ一括置換し、旧commandやfallbackは残していない。

## 7. Phase 4へ引き渡す実機確認

- macOS / Windows / Linuxのcustom protocol URL、relative resource、opaque-origin JSON simple GET。
- no-cors subresource requestのOrigin header差。
- iframeからTauri IPC / parent DOMへ到達できないこと。
- shell / response CSP、external network / popup / form / download拒否。
- `navigator.userActivation`とexternal browser openのplatform差。
- 5秒ready timeoutが巨大HTML / 低速diskでfalse errorにならないこと。
- root swapとin-flight protocol request、Markdown regression。

Windows / Linux実機はPhase 3のローカル自動検証では確認できないため、成功と推定せずPhase 4-aのplatform matrixへ残す。
