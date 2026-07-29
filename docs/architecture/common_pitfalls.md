# よくある落とし穴

## 1. Mermaid再描画

- ReactでMarkdown本文が同じままReloadすると、state変更が発火せずMermaidが再実行されないことがある。
- Tauri版ではプレビュー更新番号を持ち、Reload時もDOMを再生成してMermaidを再実行する。
- 複数paneから`mermaid.initialize` / renderを並行実行するとglobal設定と生成IDが競合する。App instance所有queueで直列化し、`paneId + tabId + revision + index`を含むrender IDを使う。

## 2. ローカル画像表示

- TauriのWebViewでローカル画像を表示するには asset protocol と capability / Cargo feature の整合が必要。
- `tauri.conf.json`、`Cargo.toml`、`src-tauri/capabilities/default.json` をセットで確認する。

## 3. ファイルパス検証

- 相対リンクや画像パスを文字列連結だけで扱うと、OS差や `..` による意図しない参照を見落とす。
- Rust側では `PathBuf` と `canonicalize`、TypeScript側では専用の正規化関数へ閉じ込める。

## 4. Avalonia UIスレッド

- フォルダ走査やMarkdown変換をUIスレッドで重く実行すると画面が固まる。
- 重い処理はServiceへ分離し、必要に応じて非同期化する。

## 5. Publish生成物

- `publish/`、Tauriの `dist/`、Rustの `target/`、.NETの `bin/` / `obj/` は生成物である。
- 起動確認用にローカル作成しても、原則コミットしない。

## 6. PlantUML runtime配置

- `plantuml.jar` と `plantuml.config.json` はローカルruntimeファイルであり、コミットしない。
- Tauri devでは `markdown-viewer-tauri/src-tauri/`、Tauri bundleでは `.app/Contents/MacOS/`、Avalonia publishでは実行ファイルのdirectoryをruntime directoryとして扱う。
- Finder起動時のworking directoryは `/` になり得るため、Tauri bundleのjar探索をworking directory前提にしない。
- Theme切替だけでPlantUML CLIを再実行すると多数図の文書で体感遅延が出るため、SVG再生成はMarkdown本文またはReload更新時に限定する。

## 7. Windows固有の注意点

- Rustの`Path::canonicalize`はWindowsで`\\?\`付きのverbatim pathを返す。filesystem検証にはそのまま使い、Java processの引数やfrontendへ返す文字列では通常のdrive / UNC pathへ変換する。
- WebView2の`NavigateToString`にはHTML size上限がある。Mermaid runtimeを埋め込んだHTMLは上限を超えるため、Avalonia版は一時HTML fileへ書き出してfile URIへnavigateする。
- .NET正規表現のmultiline `$`はCRLFの`\r`より前には一致しない。fenced code blockの終了行を判定する場合は末尾の`\r?`を明示し、LF / CRLFの両方を扱う。

## 8. HTML custom protocol URL

- `convertFileSrc(path, "mvhtml")` は absolute path 全体を単一 segment に encodeするため、HTML 内の相対 resource base として使わない。
- Rust が current root からの相対 path を segment ごとに encodeし、macOS / Linux は `mvhtml://localhost/document/...`、Windows は `http://mvhtml.localhost/document/...` を生成する。
- protocol handler は URI 文字列の prefix 判定だけで許可せず、decode後segment検査、canonicalize、root boundary、regular file、extension allowlistをすべて確認する。

## 9. sandboxed iframe の load 判定

- cross-origin / opaque-origin iframe は HTTP error responseでも `load` eventを発火し得るため、`load` / `error` eventをprotocol成功判定に使わない。
- 成功HTMLにだけ注入される`ready` handshakeを正本とし、source / origin / revisionを検証する。timeoutとlistenerはrevision変更・unmount時に必ず解除する。
- HTMLを表示するためにcapability remote origin、`allow-same-origin`、external network sourceを追加して境界を緩和しない。

## 10. Split View のDOMとruntime

- 同じtabを2 paneで表示しても、Mermaid DOM、HTML iframe handshake、scroll、pending anchor、image viewerの発生元を共有しない。async結果は`paneId + tabId + revision`と現在stateを照合する。
- tab / tabpanel / paneのIDはpane prefixを含める。単一表示でもprimary prefixを使い、single専用IDとの互換経路を残さない。
- HTMLの`ready`はpaneごとのiframe sourceと照合する。片paneのready / timeoutをglobal tab stateへ書くと、同じHTML tabを表示する他paneへ状態が混線する。
- iframe上を通過するseparator dragはpointer captureで継続する。cursor表示はiframe documentへ継承されないため、実機で操作上の違和感も確認する。

## 11. pane-local tab group

- local closeでglobal tabを先に削除すると、同じdocumentを参照する反対paneの表示まで壊れる。reducer適用後の両group参照集合を調べ、最後の参照だけをglobal dataから破棄する。
- global tabsとgroupを同時に更新する時は、すべての中間状態で`group ⊆ global tabs`が成立する順序を選ぶ。openはglobal data追加を先行し、close / root resetはgroup縮小を先行する。
- group IDをglobal tabsからsilent filterするとactive / pending invariantの破損を隠す。App integration boundaryのgeneric resolverでmissing IDをthrowする。
- split off / onでsecondary groupをprimaryへ暗黙mergeしたり隣接tabを自動追加したりしない。両groupの所属・順序・選択をsession内で保持し、visible paneだけを切り替える。
- close / move / open / Reload / root reset / split toggle handlerでpane runtime statusを個別clearしない。generic stale effectとpane / tab / revision guardへ一本化する。
- move後はdestination tabへfocusする。React commit後も要素が無い場合だけdestination paneへ戻してintegration errorを記録し、消滅したsource要素へ戻さない。

## 12. TabStrip scrollとpointer drag

- pointer capture中の`event.target`はsourceへretargetされるため、drop paneは`elementFromPoint`で解決し、pointerup座標でも再判定する。preview layerには`pointer-events: none`を付ける。
- drag成立後のclick抑止はsource pane / tab identityへ限定する。Escape後はbutton releaseによるclickが発生し得るためidentityを維持し、matching clickまたはsession終了後の次のprimary pointerdownでclearする。pointercancel / source unmountを伴うunexpected lost captureだけを同期clearし、時間依存のclearやdrag中の追加pointerdownによるclear、次の無関係なclickを飲むglobal flagを使わない。
- `scrollIntoView`はTabStrip外のancestorも動かし得る。programmatic focusは`preventScroll`を使い、item外枠とstrip rectから求めたdeltaだけをTabStripへ適用する。
- app shell配下のfixed previewは`overflow: hidden`でclipされる。React root直下のsibling layerへ1つだけ置き、使用するtheme tokenをLight / Dark双方で明示供給する。
- scrollbar APIを複数併記するとWebViewの優先規則でtrack寸法が変わり得る。本実装はWebKit pseudo-elementへ一本化し、40px外寸と6px trackを対象WebViewで確認する。
- `:focus-within`はpointer click後もbutton focusが残り、native scrollbar pseudo-elementと`:hover`の組み合わせもWebViewの再描画タイミングによりthumbが残る場合がある。pointer表示はenter / leaveと領域内だけのwindow-level座標監視から明示classを管理し、keyboard表示だけを`:has(:focus-visible)`へ委ねる。
