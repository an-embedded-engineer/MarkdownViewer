# HTML形式仕様書の表示対応 影響調査レポート

## 1. 調査目的

Markdownのみを閲覧対象としているMarkdownViewerへ、Agentや人間が作成したグラフィカルかつ動的なHTML形式仕様書を追加した場合の影響範囲と変更点を明らかにする。

特に、現在のMarkdown表示が最終的にHTMLをWebViewへ渡していることから、「HTMLは変換せずそのまま描画する経路を追加すればよい」という仮説を、Avalonia/C#版とTauri/React/Rust版それぞれの実装と、提示された実ファイルを根拠に検証する。

この調査では実装変更は行わず、次workflowで仕様と設計を確定できる粒度まで、推奨方式、セキュリティ境界、変更候補、検証観点を整理する。

## 2. 結論

### 2.1 要約

ユーザの仮説は、**レンダリングパイプライン全体を作り直す必要はない**という点では正しい。Markdown経路は維持し、文書種別を判定してHTMLだけ別経路へ分岐すればよい。

ただし、両実装とも「`.html`をファイルツリーへ追加して既存HTML表示関数へそのまま渡す」だけでは不十分である。

- Avalonia版は既にトップレベル文書を`NativeWebView.Navigate(fileUri)`で表示しているため、root配下のHTMLファイルへ直接Navigateする経路を追加できる。影響は小～中規模である。
- Tauri版はMarkdownから生成したHTML fragmentをReactの`<article>`へ`dangerouslySetInnerHTML`で挿入している。完全なHTML文書の`<head>` / `<style>` / `<script>`をこの経路へ入れる設計は不適切であり、`iframe`等の独立した文書コンテキストが必要になる。影響は中規模である。
- HTMLは能動的なJavaScriptを含められるため、Markdownの`html: false`より信頼境界が大きく変わる。対象を「信頼できる、self-containedなローカルHTML」に限定し、ホストAPI、親DOM、ローカルファイル、外部ネットワークへのアクセスを原則与えない設計が必要である。

### 2.2 推奨方針

初期対応の仕様を次に限定する。

1. 対応拡張子はまず`.html`のみとする。`.htm`は要求がないため初期対象外とする。
2. 対象は選択root配下にあるUTF-8の単一HTMLファイルとする。
3. CSS、JavaScript、データをHTML内に持つself-contained文書を正式な対応範囲とする。
4. HTML内のJavaScript実行は許可するが、ViewerのホストAPI、親画面DOM、root外のローカルファイル、外部ネットワークへのアクセスは許可しない。
5. Markdownは既存のMarkdig / markdown-it、Mermaid、PlantUML経路を維持する。HTMLにはMarkdown用テンプレート、Mermaid初期化、PlantUML変換、ViewerテーマCSSを適用しない。
6. HTML自身がテーマ機能を持つ場合はHTML側を正本とし、ViewerのLight/Dark切替でHTML本文を書き換えない。

この境界なら、提示サンプルの検索、フィルター、ツリー展開、タブ切替、Theme、参照トレース等の動的機能を保ちつつ、一般Webブラウザ機能へスコープが拡大することを避けられる。

## 3. 調査対象と非対象

### 3.1 調査対象

- Avalonia/C#版
  - `Models/FileNodeType.cs`
  - `Services/FileTreeService.cs`
  - `Services/MarkdownRenderService.cs`
  - `Services/HtmlTemplateService.cs`
  - `ViewModels/FileTreeNodeViewModel.cs`
  - `ViewModels/MainWindowViewModel.cs`
  - `Views/MainWindow.axaml`
  - `Views/MainWindow.axaml.cs`
- Tauri/React/Rust版
  - `src/App.tsx`
  - `src/App.css`
  - `src-tauri/src/lib.rs`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/capabilities/default.json`
  - `src-tauri/Cargo.toml`
- 既存設計・ルール
  - `docs/architecture/*.md`
  - `docs/components/avalonia_viewer/*.md`
  - `docs/components/tauri_viewer/*.md`
  - `docs/rules/*.md`
  - `docs/tests/README.md`
- 表示対象サンプル
  - `/Users/shin/Development/VisualStudioCode/AgenticProjectTemplates/docs/architecture/user_agent_assets_v2_structure.html`
  - `/Users/shin/Development/VisualStudioCode/AgenticProjectTemplates/tests/test_user_agent_assets_v2_structure_viewer.mjs`

### 3.2 非対象

- このworkflow内でのアプリ実装。
- HTML編集、Developer Tools、履歴、一般Webブラウザ機能。
- CDN、外部API、外部画像等を必要とする一般Webサイトの完全対応。
- root外へ遷移する複数HTMLファイル構成。
- 信頼できない第三者HTMLを安全に実行する汎用サンドボックスの保証。

## 4. 根拠ソース

### 4.1 ローカル実装・文書

- `docs/architecture/overview.md`: Avaloniaは生成HTMLを一時fileへ書き、NativeWebViewでfile URIへNavigateする。Tauriはmarkdown-itでHTML化しReact DOMへ表示する。
- `docs/architecture/code_patterns.md`: TauriのMarkdown rendererは`html: false`を前提とし、Markdown内HTMLを許可しない。
- `docs/architecture/common_pitfalls.md`: Windows WebView2の`NavigateToString`のsize制約を避けるため、Avaloniaは一時HTML file方式を採用している。
- `Avalonia/MarkdownViewer.Avalonia/Services/FileTreeService.cs`: Explorerへ含める文書拡張子は`.md` / `.markdown`のみである。
- `Avalonia/MarkdownViewer.Avalonia/ViewModels/MainWindowViewModel.cs`: `OpenMarkdownAsync`は拡張子とroot内判定後、Markdown変換、HTMLテンプレート構築を行う。
- `Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml.cs`: `PreviewRequested`で受けたHTMLをtempの`preview.html`へ書き、`NativeWebView.Navigate`を呼ぶ。
- `Avalonia/MarkdownViewer.Avalonia/Services/HtmlTemplateService.cs`: Markdown用CSS、Mermaid runtime、`invokeCSharpAction`を使うリンク処理を生成HTMLへ追加する。
- `markdown-viewer-tauri/src-tauri/src/lib.rs`: `scan_directory`と`read_text_file`はMarkdown拡張子のみ受け付け、canonicalize後にroot配下を検証する。
- `markdown-viewer-tauri/src/App.tsx`: `OpenDocumentTab`は`markdown`文字列を保持し、`MarkdownPreview`は`<article>`へ`dangerouslySetInnerHTML`でfragmentを挿入する。
- `markdown-viewer-tauri/src-tauri/tauri.conf.json`: CSPは`null`で、asset protocolは`scope: ["**"]`と広い。

### 4.2 公式資料

- [Avalonia NativeWebView](https://docs.avaloniaui.net/controls/web/nativewebview): URIへの`Navigate`、HTML文字列表示、`WebMessageReceived`と`invokeCSharpAction`のホスト通信を提供する。
- [Tauri Asset protocol scope](https://v2.tauri.app/security/asset-protocol/): `convertFileSrc`で公開可能なローカルファイルは`assetProtocol.scope`により制御され、過度に広いscopeは慎重に扱う必要がある。
- [Tauri Content Security Policy](https://v2.tauri.app/security/csp/): 未信頼ファイルとリモートコンテンツは攻撃面を増やすため、CSPを可能な限り絞ることを推奨している。
- [Tauri Capabilities](https://v2.tauri.app/security/capabilities/): LinuxとAndroidでは埋め込み`iframe`からの要求とwindow自身からの要求を区別できないという注意がある。

## 5. 提示サンプルHTMLの分析

### 5.1 ファイル特性

調査時点のファイルは次の特性を持つ。

| 項目 | 結果 |
| --- | --- |
| size | 82,579 bytes |
| 行数 | 121行 |
| SHA-256 | `b1bc2166c84e3947cb29dcd3ae1c389526e71c7945564a132b0b6e6dfdf93138` |
| CSS | `<style>` 1個を文書内に内包 |
| データ | `<script type="application/json">` 1個を内包 |
| 実行コード | 通常の`<script>` 1個を内包 |
| 外部script / stylesheet / image | なし |
| `fetch` / XHR / WebSocket | なし |
| localStorage / sessionStorage | なし |
| ViewerホストAPI呼び出し | なし |

### 5.2 JavaScriptが必須である理由

HTML本体にはツリー表示先、詳細ペイン、参照トレース等の空コンテナがあり、実行scriptがJSONデータを解析してDOMを構築する。検索、Implemented / Planned filter、参照表示、展開・折りたたみ、Theme、Tree / Graph切替、キーボード操作もevent listenerで実装されている。

したがって、HTMLを静的にsanitizeしてscriptを除去する方式、またはscriptが実行されない`dangerouslySetInnerHTML`への単純挿入では、要求されるグラフィカルかつ動的な表示を満たさない。

### 5.3 動作確認

AgenticProjectTemplates側の既存ブラウザテストを次のコマンドで実行し、成功した。

```bash
node tests/test_user_agent_assets_v2_structure_viewer.mjs
```

この結果はサンプル自体が通常のブラウザ文書として成立することを示す。ただし、Avalonia NativeWebView / Tauri WebView内のplatform別動作を保証するものではないため、実装workflowでは両アプリでの手動確認が必要である。

## 6. 現状実装

### 6.1 Avalonia版

現在の流れは次の通りである。

1. `FileTreeService`が`.md` / `.markdown`と画像だけをExplorerへ追加する。
2. TreeViewは`FileTreeNodeViewModel.IsMarkdown`のnodeだけ選択処理する。
3. `MainWindowViewModel.OpenMarkdownAsync`がroot内・Markdown拡張子を検証する。
4. MarkdownをMarkdig、Mermaid、PlantUML経路でbody HTML fragmentへ変換する。
5. `HtmlTemplateService`がCSS、Mermaid script、リンクhandlerを持つ完全なHTML文書を作る。
6. Viewがtempの`preview.html`へ書き、NativeWebViewをfile URIへNavigateする。

最終段は既にHTML fileのNavigateであるため、HTML原本を変換せず直接Navigateする方式と親和性が高い。一方、ViewModelとevent契約は「生成済みHTML文字列」しか表現できないため、原本URIを渡す契約追加が必要になる。

### 6.2 Tauri版

現在の流れは次の通りである。

1. Rust `scan_directory`がMarkdownと画像だけをExplorerへ追加する。
2. TypeScript / Rust双方の`FileNodeType`は`directory | markdown | image`である。
3. `OpenDocumentTab`は`markdown`文字列、PlantUML結果、load stateを保持する。
4. Rust `read_text_file`がroot配下とMarkdown拡張子を検証し、UTF-8文字列を返す。
5. ReactがMarkdownからPlantUML sourceを抽出し、Rust commandへ渡す。
6. `renderMarkdown`がmarkdown-itでHTML fragmentを生成する。
7. `MarkdownPreview`が`<article class="markdown-body">`へfragmentを挿入する。
8. MermaidはReact effectが挿入後DOMを対象に実行する。

このDOMはViewer本体と同じdocumentである。完全なHTML仕様書を挿入すると、document-level CSSやIDがViewer shellと衝突し得る。また、HTML文字列から挿入された`<script>`は期待するトップレベル文書scriptとして扱えないため、独立文書として表示する必要がある。

## 7. 影響範囲

| 領域 | Avalonia | Tauri | 影響 |
| --- | --- | --- | --- |
| 文書種別model | `FileNodeType.Html`等を追加 | TS / Rust双方へ`html`追加 | 必須 |
| Explorer走査・sort・icon | `.html`を列挙し選択可能にする | Rust tree、React icon / disabled条件を変更 | 必須 |
| root内検証・UTF-8 read | `OpenDocumentAsync`で維持 | Rust commandをHTML対応へ拡張 | 必須 |
| tab / current document state | current typeとpreview sourceを保持 | tabへdocument typeと本文を保持 | 必須 |
| Markdown renderer | 変更不要 | 変更不要 | 回帰防止が中心 |
| HTML preview | 原本file URIへ直接Navigate | sandboxed iframe等の独立文書を追加 | 必須 |
| theme | HTML時は再template化しない | shell themeとHTML内部themeを分離 | 必須 |
| Reload | 現在の文書種別で再読込 | tab typeに応じて再読込 | 必須 |
| link / navigation | top-level navigationとhost messageを制御 | iframe sandboxで親遷移等を制限 | 必須 |
| security config | NativeWebView bridge境界を追加 | CSP、iframe、asset scopeを設計 | 重要 |
| 表示文言 | Markdown固定文言をDocumentへ一般化 | loading / empty / aria labelを一般化 | 必須 |
| docs | Avalonia component docs等 | Tauri component docs等 | 必須 |
| tests | C#自動test未整備のため追加余地あり | Rust unit + frontend test追加余地あり | 必須 |

## 8. 推奨設計

### 8.1 共通の文書契約

Markdown固有のboolや関数を個別追加し続けず、文書種別を明示する。

```text
DocumentType
- Markdown
- Html

PreviewSource
- GeneratedHtml(documentHtml, basePath)  # Markdown
- LocalHtml(path)                         # Avalonia HTML
- SandboxedHtml(sourceText, path)         # Tauri HTML
```

共通の受入規則は次とする。

- pathをcanonicalize / full path化し、選択root配下であることを先に検証する。
- 拡張子をcase-insensitiveに判定する。
- 初期自動選択は既存挙動を守り、`README.md` / `README.markdown`、最初のMarkdown、最初のHTMLの順を推奨する。
- Explorer上のsortはDirectory、Markdown、HTML、Imageを推奨する。MarkdownとHTMLを同一のDocument rankにする案も可能だが、比較実装間で統一する。
- HTML内でMermaidやPlantUMLが必要な場合はHTML自身がruntimeまたは描画済み結果を内包する。ViewerのMarkdown pipelineは適用しない。

### 8.2 Avalonia版

#### 推奨表示方式

root内検証済みのHTML原本を`NativeWebView.Navigate(fileUri)`でトップレベル文書として表示する。

原本をViewerのtemp `preview.html`へコピーする案は提示サンプルでは動くが、将来相対resourceを含むHTMLを許可した際にbase directoryがtempへ変わる。原本file URIへのNavigateなら文書本来のbase URIを維持でき、余分なコピーとsize制約も避けられる。

#### 主な変更候補

- `Models/FileNodeType.cs`
  - `Html`を追加する。
- `Services/FileTreeService.cs`
  - HTML拡張子集合、node分類、sort rankを追加する。
- `ViewModels/FileTreeNodeViewModel.cs`
  - `IsMarkdown`だけでなく`IsDocument` / `IsPreviewable`とHTML iconを追加する。
- `ViewModels/MainWindowViewModel.cs`
  - `OpenMarkdownAsync`の上位に`OpenDocumentAsync`を設け、種別で分岐する。
  - Markdown branchは既存rendererをそのまま使う。
  - HTML branchは変換せず、検証済みpathをtyped preview requestとしてViewへ渡す。
  - current document typeを保持し、Theme変更時はMarkdownだけHTML templateを再構築する。
  - Reloadもcurrent typeを維持する。
- `Views/MainWindow.axaml.cs`
  - preview requestがGeneratedHtmlなら既存temp file方式、LocalHtmlなら原本file URIへNavigateする。
  - Tree選択条件とhandlerをdocument一般へ変更する。
- `Services/HtmlTemplateService.cs`
  - Markdown専用serviceとして維持する。HTML原本をこのtemplateへ包まない。

#### Navigation / bridge境界

任意HTML文書にも`invokeCSharpAction`が見える可能性があるため、`WebMessageReceived`を常に`HandleWebMessageAsync`へ渡してはいけない。少なくともactive previewがViewer生成Markdownである場合だけhost messageを処理する。

さらに、Markdown経路の`openExternal`も受理schemeを`http` / `https`等の明示allowlistへ限定する。HTML表示時のtop-level navigation、新規window、root外file navigationはNavigation eventで拒否または既定ブラウザへ委譲する設計を次workflowで確定する。

### 8.3 Tauri版

#### 単純な`dangerouslySetInnerHTML`を採用しない理由

- 完全な`html` / `head` / `body`文書を`article`内fragmentとして扱うことになる。
- HTML側のglobal CSS、ID、event handlerがViewer shellと同一DOMへ入り、衝突する。
- 提示サンプルはscript実行で初期DOMを構築するため、静的fragment挿入では機能しない。
- HTML scriptがTauri frontendと同じwindow contextへ入る設計は、Tauri commandや親stateへの攻撃面を増やす。

#### 推奨表示方式

Rustでroot内・`.html`・UTF-8を検証して文字列を返し、ReactではMarkdownとは別の`HtmlPreview` componentを用意して、sandbox付き`iframe srcDoc`で表示する。

初期sandboxは少なくとも次を推奨する。

```html
<iframe sandbox="allow-scripts" ...>
```

- `allow-scripts`: 提示サンプルの動的機能に必要。
- `allow-same-origin`: 付けない。opaque originにして親DOMや同一origin資産への接近を抑える。
- `allow-top-navigation` / `allow-popups` / `allow-forms` / `allow-downloads`: 初期対応では付けない。

加えて、HTML preview内ではinline CSS / inline script / data / blob等、self-contained文書に必要なsourceだけを許可し、`connect-src 'none'`等で外部通信を拒否するCSPを適用する。元HTMLへCSP metaを安全に挿入する責務と方法は次workflowの設計で確定する。

`src={convertFileSrc(path)}`で原本を直接iframe表示する案もあるが、現設定の`assetProtocol.scope: ["**"]`は広く、Rust `read_text_file`のroot検証を表示経路で迂回する。self-contained限定の初期対応では、検証済み本文を`srcDoc`へ渡す方が境界を明確にできる。

#### 主な変更候補

- `src-tauri/src/lib.rs`
  - `FileNodeType::Html`、`is_html_path`、tree列挙・sortを追加する。
  - `read_text_file`をdocument一般のcommandへ置換するか、HTML専用commandを追加する。
  - 戻り値を`DocumentContent { document_type, text }`のtyped modelにする案を推奨する。
  - root配下、通常file、許可拡張子、UTF-8の検証をRust側へ集約する。
- `src/App.tsx`
  - TS `FileNodeType`と`OpenDocumentTab`へdocument typeを追加する。
  - `markdown` fieldを`sourceText`等へ一般化する。
  - HTML tabではPlantUML source抽出とMermaid effectを実行しない。
  - `MarkdownPreview` / `HtmlPreview`をtypeで切り替える。
  - Explorer icon、loading / error、empty state、ARIA labelをDocument表現へ一般化する。
  - HTML tabのTheme変更ではiframe本文をViewer CSSで再生成しない。
- `src/App.css`
  - preview pane全体を使うiframe layout、border、loading/error状態を追加する。
- `src-tauri/tauri.conf.json`
  - CSPを`null`のままにしない方針を検討する。
  - `assetProtocol.scope: ["**"]`は既存Markdown画像表示も含む横断課題として、選択root相当へ狭める方法を設計する。
- `src-tauri/capabilities/default.json`
  - HTML previewがTauri capabilityを得ないことを確認する。

#### Tauri iframeのplatform注意

Tauri公式資料は、LinuxとAndroidでは埋め込みiframeからのrequestとwindow自身からのrequestを区別できないと注意している。したがって、**信頼できないHTMLまで正式対応する場合、main window内iframeだけをセキュリティ境界とみなしてはならない**。

その場合は、次のいずれかへ要求を上げる必要がある。

- capabilityを一切持たない別WebView / windowでHTMLを表示する。
- JavaScriptを無効化し、sanitizeした静的HTMLだけを表示する。
- HTML実行自体をOSの既定ブラウザへ委譲する。

今回の「Agentが生成した信頼できるself-contained仕様書」という境界ならsandboxed iframe案を推奨できるが、信頼モデルは仕様書へ明記する必要がある。

## 9. 選択肢比較

### 9.1 HTML表示方式

| 方式 | 動的sample | 表示分離 | 相対resource | セキュリティ | 評価 |
| --- | --- | --- | --- | --- | --- |
| Markdown rendererへHTMLを通す | 不適 | 弱い | renderer依存 | Markdown設定と矛盾 | 不採用 |
| React DOMへ直接挿入 | script初期化不可 | なし | 不安定 | shellと同context | Tauriでは不採用 |
| 原本file URIへ直接Navigate | 対応 | top-level文書 | 良い | active contentがhost WebView内 | Avaloniaで推奨（trusted限定） |
| `iframe src=assetUri` | 対応 | 良い | 良い | asset scopeとcapability注意 | 外部resource対応時の候補 |
| sandboxed `iframe srcDoc` | 対応 | 良い | self-contained限定 | opaque origin + CSPを設計可能 | Tauri初期対応で推奨 |
| OS既定ブラウザ | 対応 | アプリ外 | 良い | Viewer hostから分離 | fallback候補、要求UXには弱い |

### 9.2 信頼モデル

| モデル | JavaScript | 想定入力 | 実装コスト | 評価 |
| --- | --- | --- | --- | --- |
| trusted active HTML | 許可 | 自作・Agent生成・レビュー済み | 中 | 今回の推奨 |
| untrusted static HTML | sanitize後のみ | 外部入手文書 | 中～大 | 動的sampleを満たさない |
| untrusted active HTML | 許可 | 任意第三者ファイル | 大 | 別低権限WebView等が必要、初期対象外 |

## 10. セキュリティと互換性

### 10.1 active content

MarkdownはTauriで`html: false`、AvaloniaでもViewer生成templateを使う。一方、HTML対応はscript、inline event、form、navigation、network request等を含むactive contentを許し得る。拡張子追加は入力形式追加だけでなく、実行コードの受入れである。

初回起動時の警告や「HTML内JavaScriptを許可する」設定を設けるかは未解決だが、少なくともREADMEとUI上でtrusted local HTMLのみを開く前提を示す必要がある。

### 10.2 root境界

- Explorerへ表示されたpathでも、open時に毎回canonicalize / full pathとroot配下を再検証する。
- symlink経由のroot外参照を許可しない。
- Tauriではfrontendだけの検証にせずRust commandを正本とする。
- HTML内相対linkは初期self-contained仕様では正式サポートしない。将来対応する場合も、navigation先を再度root内・許可拡張子で検証する。

### 10.3 network / local resource

提示サンプルにはnetwork依存がない。初期版ではnetworkを必要とするHTMLを「一部表示できる可能性がある」状態にせず、非対応として明示的にblockする方が仕様とセキュリティが一致する。

同様に、Tauriのasset protocol全filesystem scopeをHTMLへ継承させない。Avaloniaでもfile originからroot外resourceを読み得るplatform差があるため、self-contained契約を優先し、root外resourceは非対応とする。

### 10.4 platform差

- Avalonia NativeWebViewはplatform native engineを使うため、macOS WebKitとWindows WebView2でfile URI、CSP、navigation eventの挙動差を確認する。
- TauriもmacOS / Windows / LinuxでWebView engineが異なる。sandbox、srcDoc、CSP、Tauri IPC非公開を各platformで確認する。
- Linux上のTauri iframe capability境界には公式の注意があるため、trusted限定を解除しない。

## 11. テスト・検証観点

### 11.1 自動テスト候補

#### Avalonia

- `.html` / `.HTML`をHtml nodeとして列挙する。
- `.htm`、root外path、未対応拡張子を拒否する。
- sort順とHTML icon / previewable判定。
- MarkdownはGeneratedHtml、HTMLはLocalHtml preview requestになる。
- HTML表示中のTheme切替でMarkdown templateを適用しない。
- HTML表示中のhost messageを無視する。

#### Tauri / Rust

- `is_html_path`のcase-insensitive判定。
- treeへHTMLを含め、node typeとsortが期待通りになる。
- document read commandがroot外、directory、未対応拡張子、非UTF-8を拒否する。
- typed responseがMarkdown / HTMLを正しく返す。

#### Tauri / Frontend

- tabがdocument typeを保持し、HTMLではPlantUML commandを呼ばない。
- Markdownは既存`MarkdownPreview`、HTMLは`HtmlPreview`を選ぶ。
- iframeへ`allow-scripts`以外の不要なsandbox権限が付かない。
- HTMLのglobal CSSがViewer shellへ漏れない。
- HTML scriptから`window.parent`、Tauri API、top navigation、popup、networkへ到達できない。

### 11.2 手動UI確認

提示サンプルで両Viewer共通に次を確認する。

- ExplorerにHTMLが表示され選択できる。
- source / installed / targetのタブ切替。
- Search、Implemented / Planned、Show references。
- Expand all / Collapse all。
- 詳細ペインとforward / reverse reference trace。
- Tree / Graph切替。
- HTML内部Theme切替。
- keyboard navigationとfocus表示。
- Reload後も初期化される。
- Markdown tabとHTML tabの切替で表示・scroll・error状態が混線しない。

既存回帰として次も確認する。

- Markdown見出し、表、code、相対画像、相対Markdown link。
- MermaidとPlantUMLの単独・同居表示。
- Viewer Light / Dark、Reload、tab切替・close。
- Open Folder、Recent Folders、Settings（実装済みTauri範囲）。

悪性fixtureとして次を試験する。

- `window.parent`変更。
- `invoke` / `__TAURI_INTERNALS__`探索。
- `file://` / asset protocolでroot外file読込。
- `fetch`による外部通信。
- top navigation、popup、form submit、download。

期待結果は、HTML内部DOM操作だけ成功し、それ以外は拒否されることである。

## 12. ドキュメント変更範囲

実装workflowでは少なくとも次を同期する。

- `README.md`
- `Avalonia/MarkdownViewer.Avalonia/README.md`
- `markdown-viewer-tauri/README.md`
- `docs/architecture/overview.md`
- `docs/architecture/code_patterns.md`
- `docs/architecture/common_pitfalls.md`
- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/basic_design.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/avalonia_viewer/interface_spec.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`
- `docs/tests/README.md`

サポート対象が「Markdown Viewer」から「Markdown / HTML document viewer」へ広がるため、UI文言だけでなくプロジェクト概要の目的記述も更新対象となる。既存MVP比較設計を採用済み仕様の正本として扱う場合は、`docs/design_analysis/new_feature/markdown_viewer_mvp_comparison_initial_design/markdown_viewer_mvp_design_tauri_avalonia.md`にも対応形式と信頼境界を追記する。

## 13. リスク

| リスク | 影響 | 対応方針 |
| --- | --- | --- |
| HTMLからホストAPI / Tauri IPCを呼ばれる | local system操作・情報露出 | bridge無効化、sandbox、capability分離 |
| Tauriの広いasset scope | root外file露出 | srcDoc優先、scope縮小を設計 |
| 外部通信を許す | tracking・情報送信・remote code | self-contained契約、CSPでblock |
| CSS / ID衝突 | Viewer UI破損 | 独立iframe document |
| HTMLとViewer themeの競合 | 意図しない色・再初期化 | HTML themeを独立扱い |
| relative resourceのplatform差 | 片方だけ表示できる | 初期はself-contained限定 |
| iframe sandboxのplatform差 | security前提崩れ | macOS / Windows / Linux実機確認 |
| 文書stateのMarkdown固定名 | branch漏れ・誤処理 | typed DocumentTypeへ一般化 |
| 既存Markdown回帰 | Mermaid / PlantUML / link破損 | rendererを分岐の内側で維持し回帰試験 |

## 14. 未解決事項

次workflowのPhase 0～設計レビューで確定が必要である。

1. HTMLを「信頼できるローカル文書のみ」と明記するか、初回警告 / opt-inを設けるか。
2. `.htm`も同時対応するか。現要求に合わせるなら`.html`のみを推奨する。
3. self-containedの定義を「networkなし」だけにするか、相対local resourceも禁止するか。初期は両方禁止を推奨する。
4. HTML内の外部URL clickを完全blockするか、確認後に既定ブラウザで開くか。
5. TauriのCSPをHTML preview専用にどう適用するか。srcDocへのmeta挿入、別WebView、custom protocol response header等を比較する必要がある。
6. Tauriの`assetProtocol.scope: ["**"]`縮小を本対応に含めるか、既存画像表示を含む先行security作業へ分離するか。
7. Avaloniaのactive HTMLをtop-level NativeWebViewへ置くtrust境界を許容するか、iframe wrapper等を追加するか。
8. Tauri LinuxをHTML active content対応platformに含めるか。含める場合、iframe capability注意への実機検証とsecurity reviewを必須とする。

## 15. 次workflowへの推奨入力

本件は単なるUI追加ではなく、サポート文書形式とactive contentの信頼境界を変更するため、次は`spec-change-workflow`を推奨する。

設計時の採用案は次とする。

- 共通: `DocumentType`を導入し、Markdown / HTMLの入力・状態・表示経路を明示分岐する。
- Avalonia: root内HTML原本のfile URIへ直接Navigateし、HTML時はhost messageを処理しない。
- Tauri: Rustで検証・readしたHTMLを、CSP付きsandboxed `iframe srcDoc`へ表示する。
- 対応境界: trusted、UTF-8、self-contained、単一`.html`、network / root外resourceなし。
- 検証: 提示サンプルの全主要interaction、悪性fixture、既存Markdown / Mermaid / PlantUML回帰を両実装で確認する。

AvaloniaとTauriで実装方式は異なるが、共通の文書契約と受入条件を先に確定すれば、根本的な作り直しやMarkdown rendererの変更は不要である。
