# TODO-2026-017 Tauri HTML形式仕様書表示対応 設計

## 1. 背景

Tauri版Viewerは、選択root配下のMarkdownをExplorerから開き、React DOM内の`MarkdownPreview`へ描画する。HTML形式仕様書はExplorer、read command、tab stateのいずれでも文書として扱われず、完全なHTML文書をMarkdown fragmentの表示経路へ入れると、`head`、document固有CSS、script、relative resource、Viewer shellとの分離を正しく扱えない。

本変更では、既存Markdown経路を維持したままdocument typeをMarkdown / HTMLへ一般化する。HTMLはtrusted local active contentに限定し、選択root内で完結する仕様書を独立したdocument contextへ表示する。

先行調査は`docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md`、要求の正本は`docs/todo/todo.md#todo-2026-017-tauri-html形式仕様書表示対応`とする。

## 2. 要求と完了条件

### 2.1 機能要求

1. case-insensitiveな`.html`をExplorerへMarkdownと同じpreviewable documentとして表示する。
2. UTF-8 HTMLを既存Multi-tabでopen / activate / close / Reloadできる。
3. self-contained HTMLと、HTML file位置を基準にしたroot内relative resourceを表示する。
4. inline SVG、Canvas、描画済みUML、root内同梱JavaScript runtimeによるdiagramを表示する。
5. HTML内のfragment linkはiframe内で移動し、user clickされた`http:` / `https:` linkはOS標準ブラウザで開く。
6. HTML表示中はMarkdown変換、Mermaid effect、PlantUML commandを実行しない。
7. root外local file、外部network、許可外scheme / resource、parent navigation、popup、form submit、download、Tauri IPCをHTMLへ許可しない。
8. macOS / Windows / Linuxでcustom protocol URL、sandbox opaque origin、CSP / CORS、relative resourceを検証する。
9. Markdown、相対画像、内部／外部link、Mermaid、PlantUML、Multi-tabを退行させない。

### 2.2 受け入れ条件ごとの対応

| 受け入れ条件 | 設計上の対応 |
| --- | --- |
| ExplorerからUTF-8 HTMLを開く | Rust `FileNodeType::Html`、`DocumentType::Html`、`open_document`を追加する |
| self-contained / root内resource | `mvhtml` protocolがcurrent root配下のallowlist resourceだけを配信する |
| SVG / Canvas / UML / browser runtime | iframeへ`allow-scripts`を付け、inline style / scriptとroot内JSをresponse CSPで許可する |
| `http(s)`をOS browserで開く | protocol responseへclick bridgeを注入し、React側message policy通過後だけ`openUrl`を呼ぶ |
| root外 / network /危険scheme拒否 | canonicalize + root boundary + extension allowlist + response CSP + iframe sandbox + shell CSPを重ねる |
| platform差検証 | Rust unit test、frontend policy test、macOS / Windows / Linux実機matrixを設ける |
| Markdown回帰なし | Markdown branchの既存renderer / Mermaid / PlantUML / link処理を維持し、type分岐の内側へ閉じ込める |

## 3. 対象範囲

### 3.1 対象

- Tauri版のExplorer、tab state、document open、preview、status / error UI。
- `.html`本体と、PNG、JPG / JPEG、GIF、WebP、BMP、ICO、AVIF、SVG、CSS、JS / MJS、JSON、WOFF / WOFF2。
- HTML内のinline style / script / SVG / Canvasと、画像用`data:` URL。
- root-scoped custom URI protocol、HTML response変換、MIME、CSP / CORS header。
- external link bridgeとReact側message validation。
- shell CSPとcapability境界の明文化・検証。
- Rust / frontend policy testとcross-platform手動確認fixture。

### 3.2 非対象

- `.htm`、非UTF-8 HTML、任意の第三者製HTMLなどuntrusted active content。
- root外resource、CDN、remote image / CSS / JS / font、任意external fetch。
- HTMLからrelative `.html` / `.md`をtabで開く機能。
- HTML内raw Mermaid / PlantUML sourceをViewer側pipelineで描画する機能。
- HTML editing、保存、印刷、download。
- HTML外部openにおける`mailto:` / `tel:`。既存Markdownの`mailto:`は維持する。
- Tauri全体の`assetProtocol.scope: ["**"]`縮小。HTML resourceはasset protocolを使わず、本件とは別のsecurity follow-upにする。
- Avalonia版HTML対応。

## 4. 採用案

### 4.1 全体方式

次を採用する。

1. RustとTypeScriptへ`DocumentType`を追加し、Markdown / HTMLを型で分岐する。
2. Rustの`DocumentStore`がcurrent rootを保持し、directory scan、document open、protocol requestで同じroot境界を使う。
3. HTML sourceはReactへ返さない。`open_document`はHTMLを検証し、current rootからのrelative path segmentを個別にpercent-encodeしたplatform適合`previewUrl`をRustで生成して返す。
4. `mvhtml` custom URI protocolがHTMLとallowlist resourceを配信する。
5. HTMLは`<iframe sandbox="allow-scripts">`へ表示する。`allow-same-origin`、`allow-forms`、`allow-popups`、`allow-top-navigation`、`allow-downloads`は付けない。
6. shell CSPはiframe sourceを`mvhtml:` / `http://mvhtml.localhost`に限定し、protocol response CSPはroot内resourceと必要なinline contentだけを許可する。
7. HTML responseへViewer管理のlink bridgeを注入する。bridgeはfragment以外のnavigationを捕捉し、`http(s)` clickだけを`postMessage`する。
8. Reactはactive iframeの`contentWindow`から届いたtyped messageだけを受け、URLを再parseして`http:` / `https:`だけを`openUrl`へ渡す。

### 4.2 判断理由

- iframeによりHTML documentのCSS、ID、script、scroll、themeをViewer shellから分離できる。
- custom protocol handlerをRustへ置くことで、frontend文字列判定ではなくcanonical filesystem pathをsecurity boundaryにできる。
- URL生成をRustへ集約することで、macOS / Linuxの`mvhtml://localhost/document/<segments>`とWindowsの`http://mvhtml.localhost/document/<segments>`というplatform差、segment単位のencode規則、root-relative契約をunit testで固定できる。path全体を単一segmentへencodeする`convertFileSrc`はHTML preview URLに使わない。
- Tauri 2.11.2のIPC初期化scriptはmain frame onlyであり、sandboxed iframeへ`__TAURI_INTERNALS__`を注入しない。これを単独の境界とはせず、opaque origin、parent DOM分離、capability非remote化、CSP、malicious fixtureで補強する。
- trusted HTML自身のscriptは必要なため、sanitizeしてstatic HTMLへ落とす方式は要求を満たさない。

## 5. 不採用案

| 案 | 不採用理由 |
| --- | --- |
| `dangerouslySetInnerHTML`へ完全HTMLを渡す | document contextがなく、CSS / script / DOMがViewer shellと衝突する |
| Markdown rendererへraw HTMLを許可する | Markdownの`html: false`契約を破り、HTML documentとMarkdown fragmentの責務が混ざる |
| `srcDoc`だけを使う | self-contained HTML以外のrelative resourceとbase pathを安定して扱えない |
| asset protocolでHTMLを直接表示する | 現行scopeが全filesystemで、HTMLへroot boundaryを適用できない |
| original `file:` URLへnavigateする | root外resource、CSP / MIME / response header、platform URL差をRust側で制御できない |
| 別window / WebView | capability分離は強いが、既存tab内preview UXを壊し、初期変更として過大 |
| OS既定browser | Viewer内tab表示という要求を満たさない |
| untrusted HTML sanitizer | active diagram / interaction要求を満たさず、別の信頼モデルになる |
| rootごとのasset scope動的拡張 | HTML以外の既存asset contractへ影響し、root stateとprotocol scopeの同期が複雑になる |
| HTML sourceをfrontendへ返してBlob URL化 | root内relative resourceの全requestをfrontendで安全に仲介できない |

## 6. Before / After

| 項目 | Before | After |
| --- | --- | --- |
| Explorer node | directory / markdown / image | directory / markdown / html / image |
| open可能形式 | `.md`, `.markdown` | `.md`, `.markdown`, `.html` |
| tab source | `markdown: string`固定 | `documentType`とtype別contentを持つ |
| read command | root pathを毎回frontendから渡すMarkdown read | current rootをRust stateで保持するtyped document open |
| preview | `MarkdownPreview`のみ | `MarkdownPreview` / `HtmlPreview`分岐 |
| HTML execution | 非対応 | trusted HTMLをsandboxed iframeで実行 |
| HTML resource | 非対応 | `mvhtml` protocol経由のroot内allowlist |
| HTML external link | 非対応 | active iframe messageを検証して`http(s)`だけOSへ委譲 |
| Markdown behavior | Markdown renderer / Mermaid / PlantUML | 既存経路を維持 |

## 7. データモデルとAPI

### 7.1 Rust model

```rust
#[derive(Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum FileNodeType {
    Directory,
    Markdown,
    Html,
    Image,
}

#[derive(Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum DocumentType {
    Markdown,
    Html,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenDocumentResponse {
    document_type: DocumentType,
    source_text: Option<String>,
    preview_url: Option<String>,
}
```

契約は次の排他的組合せとする。

| `documentType` | `sourceText` | `previewUrl` |
| --- | --- | --- |
| `markdown` | UTF-8 Markdown | `null` |
| `html` | `null` | Rustが生成した`mvhtml` platform URL |

不正な組合せは生成しない。TypeScript側はdiscriminated unionへ変換し、`any`やoptional fieldの同時fallbackを設けない。

### 7.2 TypeScript model

```ts
type DocumentType = "markdown" | "html";
type FileNodeType = "directory" | DocumentType | "image";

type OpenDocumentResponse =
  | { documentType: "markdown"; sourceText: string; previewUrl: null }
  | { documentType: "html"; sourceText: null; previewUrl: string };

type OpenDocumentTab = {
  id: string;
  path: string;
  displayName: string;
  documentType: DocumentType;
  sourceText: string | null;
  previewUrl: string | null;
  revision: number;
  loadState: TabLoadState;
  errorMessage: string | null;
  plantUmlDiagrams: PlantUmlDiagramResult[];
};
```

`markdown` fieldは`sourceText`へ一般化する。HTML sourceを格納するための名前変更ではなく、HTMLでは`null`とし、active sourceをReact memory / DOMへ重複保持しない。

### 7.3 Command契約

```text
scan_directory(rootPath) -> FileTreeNode
open_document(path) -> OpenDocumentResponse
```

- `scan_directory`はrootをcanonicalizeし、tree構築が成功した後だけ`DocumentStore.current_root`を差し替える。失敗時は既存rootを維持する。
- `open_document`はcurrent root未設定、root外、directory、unsupported extension、非UTF-8を明示的errorにする。
- HTML responseの`previewUrl`はcanonical file pathを直接公開せず、current rootからのrelative pathを`/document/<segment...>`へ変換する。各segmentを独立してpercent-encodeし、path separator構造を保持する。
- 既存`read_text_file(rootPath, path)`は`open_document(path)`へ置換し、互換wrapperを残さない。
- `render_plantuml_diagrams`はMarkdown branchだけから呼ぶ既存契約を維持する。

Tauri command macroが要求するmodule-level adapterは例外として薄く残し、path / MIME / response / state logicは`DocumentStore` methodとtyped helperへ置く。

## 8. Rust責務設計

### 8.1 `DocumentStore`

```text
DocumentStore
├── current_root: RwLock<Option<PathBuf>>
├── scan_root(root_path) -> FileTreeNode
├── open_document(path) -> OpenDocumentResponse
├── serve_protocol_request(context, request) -> Response
├── resolve_document_path(request_path) -> PathBuf
└── read_allowed_resource(path) -> ResourceBody
```

- tree構築とfilesystem readはUI / Reactへ置かない。
- protocol read中はroot read lockを保持し、root切替とresource responseが異なるrootを跨がないようにする。
- tree構築自体はlock外で行い、成功後のroot swapだけをwrite lock内で行う。
- lock poison、current root未設定、I/O failureを握りつぶさず、command errorまたはHTTP statusへ変換する。

### 8.2 Path検証

すべてのdocument / resource requestで次を順に行う。

1. request URIからqueryとfragmentを除外し、pathが`/document/` prefixを持つことを確認する。
2. `/document/`以降をseparatorで分け、各segmentを1回だけpercent-decodeする。
3. decode error、NUL、空segment、`.`、`..`、decode後に`/`または`\\`を含むsegment、Windows drive / UNC prefixを拒否する。
4. decoded segmentsをcurrent canonical rootへ`PathBuf::push`してjoinする。
5. joined pathを`canonicalize`する。
6. current canonical rootの`starts_with`を確認する。
7. symlink先がroot外なら拒否する。
8. regular fileであることを確認する。
9. extension allowlistとrequest用途を確認する。

文字列prefix、decode前の`..`除去だけ、frontend側検証はsecurity boundaryにしない。Windowsのverbatim disk / UNC pathはfilesystem検証中だけに現れ、root-relative protocol URLへdrive / UNC情報を含めない。既存`path_for_external_use`はExplorer node等の既存外部表示契約でのみ継続利用する。

### 8.3 Protocol登録

`tauri::Builder::register_asynchronous_uri_scheme_protocol("mvhtml", ...)`を使用する。handlerは`UriSchemeContext.webview_label()`が`main`であることを確認し、blocking filesystem readはasync responderのblocking taskへ渡す。

`DocumentStore::preview_url`はroot-relative segmentsから完全URLを生成する。Windowsは`http://mvhtml.localhost/document/<segments>`、macOS / Linuxは`mvhtml://localhost/document/<segments>`をcompile-time `cfg`で選ぶ。frontend独自のOS分岐や`convertFileSrc` fallbackは設けない。

対応methodは`GET`と`HEAD`だけとする。その他は`405 Method Not Allowed`、未設定rootは`409 Conflict`、decode / extension不正は`400 Bad Request`、root外は`403 Forbidden`、missingは`404 Not Found`、read failureは`500 Internal Server Error`を返す。error bodyはplain textとし、filesystem absolute pathを必要以上に露出しない。

`Cargo.toml`にはURL decode用の直接依存だけを追加する。MIMEはallowlistと同じmatchで明示し、汎用MIME推測によって未知拡張子を配信しない。

### 8.4 Resource allowlist / MIME

| extension | MIME |
| --- | --- |
| `.html` | `text/html; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.js`, `.mjs` | `text/javascript; charset=utf-8` |
| `.json` | `application/json; charset=utf-8` |
| `.svg` | `image/svg+xml` |
| `.png` | `image/png` |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.bmp` | `image/bmp` |
| `.ico` | `image/x-icon` |
| `.avif` | `image/avif` |
| `.woff` | `font/woff` |
| `.woff2` | `font/woff2` |

HTML / CSS / JS / JSONはUTF-8として読めることを要求する。binary image / fontはbytesのまま返す。unknown extension、directory、socket等は拒否する。

全success responseへ少なくとも次を付ける。

- `Content-Type`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-store`
- `Referrer-Policy: no-referrer`
- `Cross-Origin-Resource-Policy: cross-origin`

JSON `fetch`用にsandbox opaque originへ`Access-Control-Allow-Origin: null`を全success responseで返し、credentialは許可しない。requestの`Origin` headerが不在なら画像、CSS、JS、font等のno-cors subresourceとして許可する。`Origin` headerが存在する場合は値が厳密に`null`のrequestだけを許可し、それ以外を拒否する。request種別を`Sec-Fetch-*`だけで推定しない。platform engineが異なるOriginを送る場合は実機結果を根拠に設計レビューへ戻し、`*`への緩和は行わない。

root内JSON `fetch`の対応範囲はpreflight不要のsimple `GET`に限定する。custom request header、credential、`OPTIONS` preflightは対応せず、`OPTIONS`は他の未対応methodと同じく`405 Method Not Allowed`を返す。

## 9. HTML response変換

### 9.1 Link bridge注入

top-level `.html` responseだけにViewer管理scriptを注入する。resource JSやSVGは書き換えない。

注入位置はcase-insensitiveに`<head ...>`の開始tag終端直後を優先する。headがないvalid HTMLではdoctype直後、いずれも見つからない場合はsource先頭へ注入する。これにより文書内`meta http-equiv="Content-Security-Policy"`より先にbridgeを初期化する。HTMLはUTF-8に限定し、注入helperをheadあり / 大文字tag / doctypeのみ / fragment / malformed inputでunit testする。

bridgeの責務は次に限定する。

1. bridge初期化直後に固定typeの`ready` handshakeをparentへ送る。
2. capture phaseで`event.isTrusted`を満たすclickから最寄り`a[href]`を得る。synthetic clickは拒否する。
3. same-document fragmentはbrowser既定動作へ渡す。
4. `http:` / `https:`は`preventDefault()`し、固定message typeとabsolute URLを`parent.postMessage(..., "*")`で送る。
5. relative document link、`file:`、`javascript:`、`data:`、`mailto:`、`tel:`、unknown schemeは`preventDefault()`する。
6. `submit`、`auxclick`、drag/drop navigationを抑止する。

bridgeはTauri APIを呼ばず、parent DOMへ直接accessしない。target originを`"*"`とするのは、shell originがplatformにより`tauri://localhost` / `http://tauri.localhost`等へ変わり、message内容が非機密なURLと固定typeだけで、受信側が全面的に再検証するためである。HTML scriptは同じmessageを偽装できるため、message自体をuntrusted inputとして親側で再検証する。本件はtrusted document契約であり、bridgeをarbitrary malicious HTMLに対する認証境界とはみなさない。

### 9.2 Reload

HTML tabの`previewUrl`はRust responseのURLへfrontendが`revision` queryだけを付ける。Reloadでrevisionを増加させiframeを再mountし、document scriptとscrollを初期状態から再実行する。protocol handlerはqueryをfilesystem pathへ含めない。Theme変更だけではURL / keyを変えず、HTMLを再読込しない。

## 10. CSP / sandbox / IPC境界

### 10.1 iframe

```html
<iframe
  class="html-preview-frame"
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  title="HTML document preview"
/>
```

`allow-same-origin`を付けないためiframeはopaque originとなる。`allow-forms`、`allow-popups`、`allow-popups-to-escape-sandbox`、`allow-top-navigation`、`allow-top-navigation-by-user-activation`、`allow-downloads`は付けない。

### 10.2 HTML response CSP

response headerは以下の意味を持つpolicyを組み立てる。custom protocolのplatform別originを明示し、remote `http(s)` sourceは含めない。

```text
default-src 'none';
base-uri 'none';
object-src 'none';
frame-src 'none';
child-src 'none';
form-action 'none';
script-src 'unsafe-inline' mvhtml: http://mvhtml.localhost;
style-src 'unsafe-inline' mvhtml: http://mvhtml.localhost;
img-src mvhtml: http://mvhtml.localhost data:;
font-src mvhtml: http://mvhtml.localhost data:;
connect-src mvhtml: http://mvhtml.localhost;
media-src mvhtml: http://mvhtml.localhost data:;
worker-src 'none';
```

- trusted local active HTML要件のためinline script / styleを許可する。
- `unsafe-eval`は許可しない。eval必須runtimeは初期対象外とする。
- `data:`はimage / font / media sourceだけに限定し、navigationやscriptには許可しない。
- nested iframe、object / embed、worker、external networkは許可しない。

### 10.3 Viewer shell CSP

`tauri.conf.json`の`csp: null`を廃止する。production shellはbundled self、Tauri IPC、既存Markdown image用asset protocol、HTML iframe用`mvhtml`だけを必要directiveへ追加する。`frame-src`へremote `http(s)`を含めないことで、iframe自身がscriptでremote URLへ遷移する経路もbrowser policyで拒否する。

developmentはVite dev server / HMRに必要なsourceだけを`devCsp`へ追加する。production CSPを緩和してdevを通さない。CSP文字列は実装時に生成されたbundle、Mermaid、existing asset image、Tauri IPC、`npm run tauri dev`を確認して最小化する。

### 10.4 Tauri IPC

- `withGlobalTauri`は有効化しない。
- Tauri 2.11.2の`__TAURI_INTERNALS__` / invoke initializationはmain frame onlyであることをlock済みcrate sourceで確認済みである。
- HTML protocol originをcapabilityの`remote.urls`へ追加しない。
- iframeはopaque originでparent DOMを読めない。
- LinuxではTauriがiframe requestとwindow requestを区別できない旨が公式に明記されているため、capabilityだけを境界とみなさない。macOS / Windows / Linuxのmalicious fixtureで`window.__TAURI_INTERNALS__`、`window.isTauri`、known command invokeが利用不能であることを確認する。
- 上記がいずれかのplatformで成立しない場合、active HTML対応をそのplatformで有効化せず、別低権限WebViewをfollow-upとして設計する。権限を広げるfallbackは設けない。

## 11. Frontend設計

### 11.1 Load branch

`loadTab`は`open_document` responseの`documentType`で一度だけ分岐する。

- Markdown:
  - `sourceText`をtabへ保存する。
  - PlantUML source抽出、pending、Rust render commandを既存どおり実行する。
  - Mermaid effectを既存どおり実行する。
- HTML:
  - Rust responseの`previewUrl`をtabへ保持し、revision queryだけを付けてiframeへ渡す。
  - `sourceText`とPlantUML resultsを保持しない。
  - bridgeの`ready` handshakeを受信した時だけ`ready`へ遷移する。iframeの`load` / `error` eventをprotocol成功判定の正本にしない。
  - mountから5秒以内にhandshakeが届かない場合は、protocol errorまたはbridge初期化失敗として`error`へ遷移する。error response本文はiframe内にも表示され得る。tab revision変更またはunmount時はtimeoutを解除する。
  - Mermaid / PlantUML処理を呼ばない。

旧Markdown pathとの二重read、HTML失敗時のMarkdown fallback、asset protocol fallbackは設けない。

### 11.2 Preview branch

```text
PreviewPane
├── documentType == markdown -> MarkdownPreview
└── documentType == html     -> HtmlPreview
```

`MarkdownPreview`は現行`dangerouslySetInnerHTML`、click handler、previewRefを維持する。`HtmlPreview`はiframeだけを所有し、Reactからiframe DOMへaccessしない。

### 11.3 Message policy

`HtmlPreview`はmount中に`message` listenerを登録し、unmount時に必ず解除する。次をすべて満たす場合だけ外部open callbackを呼ぶ。

1. active HTML iframeが存在する。
2. `event.source === iframe.contentWindow`。
3. `event.origin === "null"`。platform差が確認された場合もexact allowlistとし、任意originを許可しない。
4. dataがplain objectで、`ready`または`openExternal`の固定message unionに一致する。
5. active tab id / revisionがlistener作成時の値と一致する。
6. `ready`はhrefを持たず、未ready状態から1回だけ受理する。
7. `openExternal`はstring `href`を持ち、`new URL(href).protocol`が`http:`または`https:`。
8. `openExternal`では`navigator.userActivation.isActive`が`true`であり、iframe内clickから伝播したtransient user activationが残っている。
9. 外部openが進行中でない。短時間の重複messageは無視する。

message拒否をerror bannerへ出してtrusted document閲覧を妨げないが、development consoleで理由を確認できるようにする。`openUrl` failureは既存error UIへ表示する。transient user activationが対象WebViewで利用できない場合に自動openへfallbackせず、当該platformのHTML external linkを未対応として設計へ戻す。

### 11.4 UI文言

- `Open Markdown Folder` -> `Open Document Folder`
- `Open a folder to browse Markdown files.` -> `Open a folder to browse documents.`
- `Markdown Preview` -> `Document Preview`
- `No Markdown file selected.` -> `No document selected.`
- `Open Markdown files` -> `Open documents`
- loadingはMarkdownなら`Loading Markdown...`、HTMLなら`Loading HTML...`
- Explorer iconはMarkdown=`MD`、HTML=`HTML`、image=`IMG`

初期open順は既存互換のため`README.md`、最初のMarkdown、最初のHTMLの順とする。HTML追加だけでMarkdown rootの初期文書が変わらないようにする。

## 12. 類似ロジックの共通化と配置

- `normalize_path`、`extension`、`path_for_external_use`は既存Rust helperを`DocumentStore`から再利用し、HTML用duplicateを作らない。
- Markdown / HTML共通のtab lifecycle、revision、stale response排除、close / activateは`OpenDocumentTab`で共有する。
- renderer固有処理は`MarkdownPreview` / `HtmlPreview`へ分離し、共通化のためにnullable callbackを増やさない。
- scheme / message validationは専用`documentPolicy.ts` moduleへ置き、App component内へ散らさない。これは副作用を持たないpolicy contractであり、class instance化よりpure functionの方が入力 / 出力とunit testを明確にできるため、module-level functionの限定例外とする。
- RustのTauri command / protocol callbackはframework要求によるmodule-level adapterとし、実処理を`DocumentStore` methodへ委譲する。
- MIME mappingとextension allowlistは1つのtyped table / matchを正本にし、列挙・open・protocol配信の判定が不一致にならないようにする。
- Explorer sort順の正本は既存`node_sort_rank`に維持し、`FileNodeType`へ`PartialOrd` / `Ord`をderiveしない。rankはDirectory=0、Markdown=1、Html=2、Image=3とする。

## 13. エラーハンドリング

| 失敗 | 動作 |
| --- | --- |
| root未設定 | `open_document` error / protocol 409 |
| root外 / symlink escape | tab error / protocol 403 |
| unsupported extension | tab error / protocol 400 |
| HTML非UTF-8 | tab error。iframeへ渡さない |
| resource missing | protocol 404。iframe内resource error。Viewer shellは維持 |
| CSP / sandbox block | HTML内だけ失敗。manual fixtureとWebView consoleで原因確認 |
| iframe top-level load / protocol error | `ready` handshake timeoutでactive tabをerror表示にする。iframe eventやresponse DOM読取へ依存しない |
| preflight付きJSON fetch | `OPTIONS`を405として拒否する。simple GETだけが対応範囲 |
| external URL invalid / unsupported | openせずHTML表示を維持する |
| `openUrl` failure | active tab / error stripへ英語messageを表示する |
| lock poison |明示error。旧rootやasset fallbackへ逃がさない |

HTML script errorをhost errorへ自動転送するbridgeは追加しない。document内部errorとViewer infrastructure errorを混同しない。

## 14. 互換性・移行方針

- persistent tab dataは存在しないためdata migrationは不要。
- existing settings schema、Recent Folders、window size、theme、PlantUML jar pathを変更しない。
- Markdownのraw HTML禁止、`mailto:` external open、relative Markdown link、anchor、asset image、Mermaid、PlantUML contractを維持する。
- `read_text_file`はproject内だけのcommandであり、frontendと同時に`open_document`へ置換して旧commandを削除する。
- HTML Themeはdocument自身の責務とし、Viewer themeを注入しない。
- root変更成功時に既存tabを破棄する現在のcontractを維持する。protocol rootも同じ成功境界で切り替える。
- root open失敗時は旧tree / tab / protocol rootを維持する。

## 15. 影響コンポーネント

| コンポーネント | 変更 |
| --- | --- |
| `src/App.tsx` | typed document state、load / preview分岐、HTML message、UI文言 |
| `src/App.css` | iframe full-size layout、load / error / focus |
| `src/documentPolicy.ts` | HTML URL / message validation、preview URL helper |
| frontend test | document policy、type branch、message rejection |
| `src-tauri/src/lib.rs` | `DocumentStore`、HTML node、open command、protocol handler、tests |
| `src-tauri/Cargo.toml` / lock | URL decode用direct dependency |
| `tauri.conf.json` | shell CSP / devCSP、custom protocol source |
| `capabilities/default.json` | remote originを追加しない契約の確認・description更新。不要permissionは増やさない |
| sample / test fixture | self-contained、relative resource、malicious HTML |
| docs | project / architecture / Tauri component / development / testsを同期 |

## 16. 恒久ドキュメント更新予定

Phase 3でsource差分と同時に次を更新する。

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
- 採用済みMVP仕様の正本として扱う場合は`docs/design_analysis/new_feature/markdown_viewer_mvp_comparison_initial_design/markdown_viewer_mvp_design_tauri_avalonia.md`

本件のtrusted active document、root-scoped protocol、sandbox / CSPはTauri固有かつ案件起点の判断である。Phase 3完了時に複数案件で再利用される横断判断になったかを評価し、ADR起票条件を満たす場合だけ別途ADRへ要約する。

## 17. テスト設計

### 17.1 Rust unit test

- `.html` / `.HTML`をHtml nodeとして列挙し、`.htm`を除外する。
- sortはDirectory -> Markdown -> Html -> Image、同種case-insensitive name順とする。
- `open_document`がMarkdown / HTMLの排他的responseを返す。
- current root未設定、root外、directory、unsupported extension、非UTF-8を拒否する。
- root-relative URLをsegment単位でencodeし、space / Unicodeを含むpathのencode -> relative resource resolve -> decode / root joinが往復することを検証する。
- encoded `%2F` / `%5C`、`.` / `..`、empty segment、absolute path、Windows drive / UNCをsegment注入として拒否する。
- MIME allowlistの全extensionとunknown extensionを検証する。
- protocolのGET / HEAD、400 / 403 / 404 / 405 / 409 / 500を検証する。
- `Origin`不在を許可し、`Origin: null`を許可し、その他originを拒否する。全success responseが`Access-Control-Allow-Origin: null`を持つことを検証する。
- simple JSON GETが成功し、`OPTIONS` preflightが405になることを検証する。
- HTML bridge injection位置と、resource body非変換を検証する。
- CSP、CORS、nosniff、no-store、referrer policy headerを検証する。
- root切替成功 / 失敗時のstore状態を検証する。

### 17.2 Frontend policy test

既存frontend test runnerがないため、Vitestを最小導入してpure policyを直接検証する。DOM/WebView固有securityをjsdomだけで証明したとは扱わない。

- Markdown / HTML responseのdiscriminated union mapping。
- HTML preview URLのprotocol / revision。
- message source不一致、origin不一致、shape不正、stale revisionを拒否する。
- `http:` / `https:`を許可し、`file:` / `javascript:` / `data:` / `mailto:` / custom schemeを拒否する。
- `ready` handshakeのsource / origin / stale revision / duplicateを検証し、timeout時にerrorへ遷移する。
- transient user activationなしのexternal-open messageとduplicate openを拒否する。
- HTML branchでPlantUML sourceを抽出しないことを、branch helperまたはcomponent境界で確認する。

### 17.3 必須command

```bash
cd markdown-viewer-tauri
npm run build
npm test -- --run

cd src-tauri
cargo fmt -- --check
cargo check
cargo test
```

### 17.4 手動fixture

1. self-contained HTML: inline style / script / SVG / Canvas。
2. relative resource HTML: sibling / child / root内`../`の画像、SVG、CSS、JS、MJS、JSON fetch、WOFF / WOFF2。
3. interaction sample: tab、search、filter、tree / graph、theme、detail pane。
4. external link: `http:`, `https:`, `target=_blank`, fragment。
5. malicious fixture:
   - `window.parent` DOM access。
   - `window.__TAURI_INTERNALS__` / `window.isTauri` / known invoke探索。
   - root外`../`、symlink、`file:`、asset protocol、unknown custom protocol。
   - external image / script / CSS / fetch / WebSocket。
   - top navigation、self navigation、popup、form submit、download。
   - external-open message直接送信 / burst。
6. Markdown regression: heading、table、code、relative image、relative Markdown link / anchor、Mermaid、PlantUML、同居、Reload、theme、tab close / activate。

### 17.5 Platform matrix

macOS / Windows / Linuxで少なくとも次を記録する。

| 観点 | macOS | Windows | Linux |
| --- | --- | --- | --- |
| protocol URL / relative resource | Required | Required | Required |
| sandbox `Origin: null` / JSON simple GET | Required | Required | Required |
| no-cors subresourceの`Origin` header有無 | Required | Required | Required |
| iframe IPC非公開 | Required | Required | Required |
| shell / response CSP | Required | Required | Required |
| external link / popup拒否 | Required | Required | Required |
| root外 / symlink拒否 | Required | Required | Required |

確認不能platformを「成功」と推定しない。Phase 4-aで実機証跡が得られない場合はcompletion blockerまたはplatform対応範囲の仕様再承認として扱う。

2026-07-19のPhase 4-b進行時に、ユーザーはWindows / Linuxおよび未実施のplatform固有security matrixを後日確認へ移し、問題が判明した場合は`docs/issues/`で対応する方針を再承認した。したがって未確認項目は成功とは推定しないまま、現時点のPhase 4 completion blockerから外す。

## 18. ユーザ確認シナリオ

1. Open Folder後、README Markdownが従来どおり初期表示される。
2. ExplorerのHTML iconから仕様書を開き、tab activate / close / Reloadできる。
3. sampleの主要interaction、inline diagram、root内resource、JSON fetchが動く。
4. Viewer theme切替でHTML documentが再load / restyleされない。
5. fragmentはiframe内移動し、`http(s)`はOS browserで1回だけ開き、Viewerは同じHTMLを維持する。
6. unsupported link、root外resource、external network、popup等が拒否される。
7. HTML / Markdown tab切替後もscroll、loading、error、diagram stateが混線しない。
8. existing Markdown / Mermaid / PlantUML / relative linkを確認する。

## 19. リスクとfollow-up

| リスク | 対応 | follow-up条件 |
| --- | --- | --- |
| Linux iframeとwindow requestを区別できない | main-frame-only IPC init、opaque origin、remote capabilityなし、fixture | IPCが利用できたらLinux HTMLを無効化し別WebView設計 |
| authored scriptがbridge messageを偽装 | trusted contract、`isTrusted`、transient user activation、active source、duplicate guard | untrusted対応時はconfirmation UI / separate WebView |
| authored meta CSPがdocument resourceを制限 | bridgeをhead先頭へ注入し、document CSPはさらに厳しくする方向だけ許容 | 表示error UXが必要なら別TODO |
| custom protocol URL差 | Rustのroot-relative segment URL生成、platform test | engine固有bugはadapter設計 |
| opaque origin JSON fetch差 | exact `null` CORS、credentialなし、platform test | `*`へ緩和せずresource contractを再設計 |
| large image / font read | async protocol、allowlist | range / streamingが必要な実fixtureで別対応 |
| shell CSPで既存機能回帰 | production / dev CSP分離、Markdown回帰 | 最小source追加を設計レビューへ戻す |
| asset scopeが広い | HTMLからasset protocolを使わない | 既存Markdown画像のscope縮小は別security TODO |
| active HTML trust説明不足 | README / component docs / UI文言でtrusted限定を明記 | warning / opt-inはUX評価TODO |

## 20. 実装順序

1. Rust typed model、`DocumentStore`、tree / open tests。
2. custom protocol path / MIME / response / bridge testsとhandler登録。
3. TypeScript typed tab model、document load branch、policy tests。
4. `HtmlPreview`、message policy、CSS、UI文言。
5. shell CSP / capability確認。
6. fixturesとautomated regression。
7. 恒久docs同期。
8. build / test / macOS確認後、Windows / Linux実機確認項目をPhase 4へ引き渡す。

## 21. 参照資料

- Tauri custom protocol / `register_uri_scheme_protocol`: <https://docs.rs/tauri/2.11.2/tauri/struct.Builder.html#method.register_uri_scheme_protocol>
- Tauri `convertFileSrc`（HTML URLでは不採用としたAPI契約）: <https://v2.tauri.app/reference/javascript/api/namespacecore/#convertfilesrc>
- Tauri Capabilities（Linux / Android iframe注意を含む）: <https://v2.tauri.app/security/capabilities/>
- Tauri CSP: <https://v2.tauri.app/security/csp/>
- Tauri asset protocol scope: <https://v2.tauri.app/security/asset-protocol/>
- Tauri HTTP headers: <https://v2.tauri.app/security/http-headers/>

## 22. Phase 2レビュー観点

- trusted HTMLという前提と、拒否を強制するsecurity boundaryが混同されていないか。
- shell CSPの`frame-src`でiframe self-navigationを含むremote navigationを拒否できるか。
- sandboxed opaque originからroot内JSON fetchを3 platformで成立させられるか。
- Tauri 2.11.2 main-frame-only initializationとLinux注意を踏まえ、IPC非公開の説明が過大でないか。
- link bridge注入位置、message validation、duplicate guardで要求と脅威が釣り合うか。
- `DocumentStore`のroot swap / lock / stale iframe requestが一貫しているか。
- path decode、Windows path、symlink、MIME allowlistに抜けがないか。
- existing Markdown behaviorと初期open順を維持できるか。
- test / docs更新先が受け入れ条件を追跡できるか。
