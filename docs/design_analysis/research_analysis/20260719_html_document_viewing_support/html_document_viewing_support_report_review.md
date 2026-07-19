# HTML形式仕様書の表示対応 調査レポートレビュー

- review kind: research report review
- review target: `report.md` / `meta.md`（review target commit `0f021b9`、Round 2は対応commit `e8441af`）
- reviewer: Claude Code（レビュー担当 Agent）
- review date: 2026-07-19（Round 1 / Round 2）

## 1. 総評

調査レポートは、両実装のソース、project docs、依存packageの実バージョンに対して高い精度で整合している。レビューで実施した以下の突き合わせは、いずれもレポートの記載と一致した。

- Avalonia: `FileTreeService`の`.md` / `.markdown`限定列挙、`FileTreeNodeViewModel.IsMarkdown`による選択制御、`OpenMarkdownAsync`のroot内・拡張子検証、`HtmlTemplateService`のtemplate生成（Mermaid runtime、`invokeCSharpAction` link handler、`<base href>`）、`MainWindow.axaml.cs`のtemp `preview.html`書き出しと`NativeWebView.Navigate(fileUri)`。
- Tauri: `FileNodeType`が`directory | markdown | image`のTS / Rust両定義、`read_text_file`のcanonicalize + root配下 + Markdown拡張子検証、`OpenDocumentTab.markdown`と`dangerouslySetInnerHTML`によるfragment挿入、`tauri.conf.json`の`csp: null`と`assetProtocol.scope: ["**"]`、`capabilities/default.json`の`core:default` / `dialog:default` / `opener:default`。
- バージョン・実測値: Tauri 2.11.2（Cargo.lock、`register_uri_scheme_protocol`系APIの存在と整合）、Avalonia.Controls.WebView 12.0.1、サンプルHTMLのsize 82,579 bytes / 121行 / SHA-256完全一致。
- docs引用: `overview.md`の一時file + file URI navigate、`code_patterns.md`のTauri `html: false`（TypeScript / React節に記載）、`common_pitfalls.md`の`NavigateToString` size制約。

推奨方針（Markdown経路維持 + 文書種別分岐、Avaloniaのfile URI直接Navigate、Tauriのroot-scoped custom URI protocol + sandboxed iframe + CSP、`http(s)`のOS標準ブラウザ委譲、trusted document信頼モデル）は、レビュー観点で挙げられた各項目に対して実現可能かつ妥当であり、次のspec-change workflowへ渡せる粒度に達している。選択肢比較（§9）と却下理由（`dangerouslySetInnerHTML`不採用、asset protocol迂回の指摘、`srcDoc`の限界）も根拠が明確である。

一方、レビューで実装・依存packageを検証した結果、レポートの前提のうち次の3点は修正または補強が必要である。

1. Avalonia側subresource制御の主手段とされる`WebResourceRequested` / `NewWindowRequested`は、Avalonia.Controls.WebView 12.0.1のcross-platform managed APIとして確認できない（指摘1）。
2. Avalonia版Markdown経路は現状でもraw HTML / scriptを素通しするため、「HTML対応が初めてのactive content受入れ」という信頼境界の前提はAvaloniaでは不正確である（指摘2）。
3. 既存`HandleWebMessageAsync`の`openExternal`はscheme検証がなく、指摘2と組み合わせると既存経路に不整合が残る（指摘3）。

いずれも推奨方針の方向性を覆すものではなく、記述の修正と未解決事項への追加で対応可能である。

## 2. 指摘一覧

### 指摘1: Avalonia `WebResourceRequested` / `NewWindowRequested` はcross-platform公開APIとして確認できない

- 重大度: 中
- 対象箇所: `report.md` §8.2「Navigation / bridge境界」「推奨表示方式」、§10.3、§11.1 Avalonia自動テスト候補
- 理由: §8.2はsubresource requestの監視手段として「`WebResourceRequested`等のNativeWebView event」を挙げ、新規window拒否を「`NavigationStarted` / `NewWindowRequested`で拒否」と記述する。しかしAvalonia.Controls.WebView 12.0.1のassemblyを確認した結果、managed公開eventとして確認できるのは`NavigationStarted`（cancel可能とみられる`CancelEventArgs`系あり）、`NavigationCompleted`、`WebMessageReceived`、adapter層の`DecidePolicyNavigation`等であり、`WebResourceRequested` / `NewWindowRequested`はWindows WebView1/WebView2のCOM interop層にのみ出現し、cross-platformの公開surfaceには見当たらない。したがって「root外へ出るfile URIをrequest単位で拒否する」制御は、少なくとも現行packageの公開APIでは記述どおりに実装できない可能性が高い。また、macOS WebKitでは`loadFileURL:allowingReadAccessToURL:`のread access scope次第で、逆にroot内`../`相対resourceの読込が制限される可能性があり、「拒否」と「許可」の両方向でplatform依存になる。
- 根拠: `~/.nuget/packages/avalonia.controls.webview/12.0.1/lib/net10.0/Avalonia.Controls.WebView.dll`のevent surface調査（`add_NavigationStarted`は非suffixed managed eventとして存在、`add_WebResourceRequested_55` / `add_NewWindowRequested_44`等はinterop vtable slotのみ）。レポート自身も「platform adapter間で同じ粒度のcancel / response制御ができるかは実装設計時に確認する」とhedgeしているが、§8.2の主経路・§11.1のテスト候補（「root外を指す画像、script、CSS requestを拒否する」）は同eventの存在を前提とした書き方になっている。
- 推奨対応: subresource単位のinterceptを「利用できる場合の追加防御」へ格下げし、主たるsecurity boundaryを「trusted rootという入力契約 + top-level navigation制御（`NavigationStarted`のcancel）+ host bridge制限」として明記する。`../`相対resourceがmacOSのfile access scopeで読めない可能性も実装時確認事項へ追加し、§11.1の該当テスト候補を「platform APIで実現可能な場合」の条件付きへ修正する。未解決事項7と関連づけてもよい。

### 指摘2: Avalonia版Markdown経路は現状でもraw HTML / scriptを許可しており、信頼境界の現状記述が不正確

- 重大度: 中
- 対象箇所: `report.md` §2.1、§10.1「MarkdownはTauriで`html: false`、AvaloniaでもViewer生成templateを使う」、§4.1
- 理由: Avalonia版の`MarkdownRenderService`は`MarkdownPipelineBuilder().UseAdvancedExtensions()`のみでpipelineを構築しており、`DisableHtml()`を使っていない。Markdigのdefaultはraw HTML pass-throughのため、Markdown内に書かれた`<script>`等はfragmentへそのまま出力され、`invokeCSharpAction`が露出したWebView内で実行され得る。「HTMLの拡張子追加は実行コードの受入れである」という整理はTauri（`html: false`）では正確だが、Avaloniaでは既存Markdown経路が既にactive contentを受け入れており、「Markdownの`html: false`より信頼境界が大きく変わる」（§2.1）はAvaloniaには当てはまらない。現状把握の誤りとして残すと、spec-change設計時のリスク評価と回帰テスト範囲の判断を誤らせる。
- 根拠: `Avalonia/MarkdownViewer.Avalonia/Services/MarkdownRenderService.cs:18-20`（`UseAdvancedExtensions()`のみ）、`HtmlTemplateService.cs`（fragmentを無加工でtemplateへ埋め込み）。`docs/architecture/code_patterns.md:17`の`html: false`記述はTypeScript / React節にのみ存在する。
- 推奨対応: §10.1の現状記述を「Tauriは`html: false`でMarkdown内HTMLを拒否するが、AvaloniaのMarkdig pipelineはraw HTMLを許可している」へ修正する。そのうえで、Avalonia側のMarkdown内raw HTML許可を維持するか`DisableHtml`へ寄せるかを未解決事項へ追加する（HTML対応で導入するhost bridge制限との一貫性に直結するため）。

### 指摘3: 既存`openExternal` host messageにscheme検証がなく、推奨設計の前提と現状の差分が明示されていない

- 重大度: 中
- 対象箇所: `report.md` §8.2「Navigation / bridge境界」、§10.5、§13
- 理由: §8.2は「HTML表示中はscheme検証済み`openExternal`のみ受理」と設計するが、現行の`MainWindowViewModel.HandleWebMessageAsync`は`openExternal`で任意の絶対URIを受け取り、schemeを検証せず`Process.Start(UseShellExecute = true)`へ渡す。`HtmlTemplateService`の生成scriptは`http:` / `https:`しか送らないが、指摘2のとおりMarkdown内raw HTMLから任意messageを送信できるため、`file:`等のURIをOS shellで開かせる経路が既に存在する。レポートはHTML経路の新設計としてscheme検証を正しく要求しているが、「既存Markdown経路にも同じ検証を遡及適用する」ことが変更候補・テスト候補に明示されていないため、HTML側だけ検証を実装してMarkdown側が残る取りこぼしが起こり得る。
- 根拠: `Avalonia/MarkdownViewer.Avalonia/ViewModels/MainWindowViewModel.cs:170-174, 184-190`。
- 推奨対応: §8.2または§7の変更候補へ「既存`HandleWebMessageAsync`の`openExternal`にもscheme allowlist（`http` / `https`）を適用する」を追加し、§11.1のテスト候補（`file:` / `javascript:`の外部open拒否）をMarkdown経路にも適用する旨を明記する。

### 指摘4: §4.1の`scan_directory`に関する記述が不正確

- 重大度: 小
- 対象箇所: `report.md` §4.1「`scan_directory`と`read_text_file`はMarkdown拡張子のみ受け付け」
- 理由: `scan_directory`（`build_tree`）はMarkdownに加えて画像拡張子（`is_image_path`: PNG / JPG / JPEG / GIF / WebP / SVG / BMP / ICO / AVIF）もtreeへ含める。§6.2では「Markdownと画像だけをExplorerへ追加する」と正しく記述されており、§4.1の要約だけが不正確。
- 根拠: `markdown-viewer-tauri/src-tauri/src/lib.rs:597`（`is_markdown_path(&child_path) || is_image_path(&child_path)`）。
- 推奨対応: §4.1を「`scan_directory`はMarkdownと画像のみ列挙し、`read_text_file`はMarkdown拡張子のみ受け付ける」へ修正する。

### 指摘5: `mailto:`の扱いが既存Tauri Markdown経路の現状と揃っていない

- 重大度: 小
- 対象箇所: `report.md` §10.5、§8.3「外部URL click bridge」、未解決事項4
- 理由: レポートはHTML経路の外部open allowlistを`http:` / `https:`に限定し`mailto:`を初期対象外とするが、既存TauriのMarkdown link処理は`mailto:`を既に`openUrl`へ委譲している。このままではMarkdown文書とHTML文書で同じ`mailto:` linkの挙動が異なる。方針自体（HTMLは狭く始める）は妥当だが、既存挙動との差分が文書化されていないため、仕様確定時に「HTMLだけ開かない」ことが意図か漏れか判別できない。
- 根拠: `markdown-viewer-tauri/src/App.tsx:480-483`（`externalUrlPattern.test(href) || href.startsWith("mailto:")` → `openUrl(href)`）。
- 推奨対応: §10.5の表または未解決事項4へ「既存TauriのMarkdown経路は`mailto:`を委譲済みであり、HTML経路と挙動差が生じる。統一方針をspec-changeで確定する」と追記する。

### 指摘6: Tauri custom protocol + sandboxed iframeのplatform別URL / CORSは検証観点をもう一段具体化できる

- 重大度: 小（改善提案）
- 対象箇所: `report.md` §8.3、§11.1「custom protocolのplatform別URLから相対resourceを解決できる」、未解決事項5
- 理由: Tauri 2のcustom protocolはWindowsでは`http://<scheme>.localhost/`形式、macOS / Linuxでは`<scheme>://localhost/`形式で配信され、originとschemeの扱いがplatformで異なる。さらに`sandbox="allow-scripts"`のみ（`allow-same-origin`なし）のiframeはopaque originとなるため、root内JSONの`fetch`許可はCSPの`connect-src`だけでなくCORS response header（opaque originからのrequestは`Origin: null`）に依存する。レポートは§8.3と未解決事項5でこの領域をhedge済みだが、テスト候補として「opaque originからのfetchが3 platformで成功／意図通り拒否されること」を明示すると、spec-change側の受入条件に直結する。
- 根拠: Tauri 2 custom protocolのplatform別URL仕様（公式docs）、HTML sandbox仕様（opaque origin）。
- 推奨対応: §11.1のTauri / Frontendテスト候補へ「sandboxed iframe（opaque origin）からのroot内resource取得・JSON fetchのplatform別挙動」を1項目追加する。必須ではなく推奨。

## 3. 未解決事項

レポート§14の未解決事項10件は妥当であり、いずれも次workflowで判断可能な粒度になっている。本レビューから以下の追加を推奨する。

1. （指摘2より）AvaloniaのMarkdig pipelineでMarkdown内raw HTMLを許可し続けるか、`DisableHtml`へ変更するか。HTML対応で定義するhost bridge境界との一貫性を含めて確定する。
2. （指摘3より）既存`openExternal` host messageへのscheme allowlist遡及適用を本対応に含めるか。
3. （指摘1より）Avalonia subresource制御が公開APIで実現できない場合に、trusted root契約 + navigation制御のみで初期リリース可とするか。

## 4. 承認可否

**条件付き承認**。

調査の網羅性、実装との整合性、推奨方式の実現可能性、spec-change workflowへ渡す粒度はいずれも要求水準を満たしている。ただし、指摘1～3は次workflowの設計判断（security boundaryの実現手段、既存経路の遡及修正範囲）に直接影響するため、report.mdへの反映を承認条件とする。指摘4～6は軽微であり、同時反映を推奨するが承認条件とはしない。

## 5. Round 2 確認結果（対応commit `e8441af`）

対応commit `e8441af`のreport.md差分を全件確認し、現行実装・依存packageとの再突き合わせを行った。結果、**指摘1～6はすべて解消**と判定する。

| 指摘 | 判定 | 確認内容 |
| --- | --- | --- |
| 指摘1 | 解消 | §8.2でsubresource監視をadapter固有APIが使えるplatform限定の追加防御へ格下げし、主境界を「trusted project root契約 + `NavigationStarted`によるtop-level navigation制御 + host bridge制限」へ変更。`NewWindowRequested`前提の記述は削除され、新規window制御はinjected click bridgeの`preventDefault`を主経路とする記述へ置換。macOS WebKitのfile read access scopeによりroot内`../` resourceが読めない可能性（許可・拒否の両方向確認）も§8.2・§11.1へ追加。§10.2 / §10.3 / §13 / §15および未解決事項12も整合して更新済み。 |
| 指摘2 | 解消 | §2.1と§10.1を「Tauriは`html: false`で新規受入れ、AvaloniaのMarkdig pipelineは`DisableHtml()`未設定でraw HTML / scriptを既に通す」へ修正。§4.1へ`MarkdownRenderService.cs`の根拠を追加し、`DisableHtml()`採否を未解決事項11として追加。実装（`MarkdownRenderService.cs:18-20`）と整合。 |
| 指摘3 | 解消 | §8.2変更候補へ「既存Markdownと新規HTMLの両経路で`HandleWebMessageAsync`の`openExternal`を`http:` / `https:` allowlistへ制限」を追加。§11.1テスト候補を「Markdown / HTMLの両経路で拒否」へ拡張し、§13リスク表と§15採用案（共通host handler）にも反映済み。 |
| 指摘4 | 解消 | §4.1を「`scan_directory`はMarkdownと画像を列挙し、`read_text_file`はMarkdown拡張子のみ受け付ける」へ修正。`lib.rs`の実装と一致。 |
| 指摘5 | 解消 | §8.3と§10.5表へ、現行Tauri Markdownが`mailto:`を`openUrl`へ委譲済みで挙動差が生じる旨を追記し、未解決事項4を「HTMLも許可するか、全経路を`http(s)`へ統一するか」の決定事項へ更新。 |
| 指摘6 | 解消 | §11.1 Tauri / Frontendテスト候補へ「sandboxed iframeのopaque origin（`Origin: null`）からのroot内resource / JSON `fetch`をmacOS / Windows / Linuxで確認」を追加。 |

旧記述の残存も確認した。`WebResourceRequested`は「共通利用できることを確認できなかった」という否定形の記述にのみ残り、`NewWindowRequested`への依存は消えている。Round 1指摘に対する対応漏れ・新規の不整合はない。

### Round 2承認

**承認**。承認条件とした指摘1～3を含む全指摘が解消されており、report.mdは次のspec-change workflowへの入力として承認する。
