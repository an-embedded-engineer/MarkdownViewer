# Tauri document preview 横幅の可変化 設計

## 1. 背景

Tauri版のdocument previewは、MarkdownをReact DOMの`.markdown-body`、trusted HTMLをsandboxed iframeの`.html-preview-frame`で表示する。Preview workspace自体はExplorerとseparatorを除いたwindow内の残り幅へ追従するが、Markdown本文には次の固定上限がある。

```css
width: min(980px, calc(100% - 48px));
```

このためpreview paneが1028pxを超えても本文は980pxで止まり、windowを広げて得た領域を横長のtable、Mermaid、PlantUML、imageが利用できない。HTML iframeは既に`width: 100%`であり、Viewer側の固定最大幅はない。

## 2. 目的と要求

1. Markdown本文の固定980px上限を廃止する。
2. Markdown本文をpreview pane幅からresponsiveな左右marginを引いた幅へ追従させる。
3. 横長のMarkdown図表が拡張後の本文幅を利用できるようにする。
4. 狭幅時のmargin、要素ごとのoverflow / scaling、Preview内scrollを維持する。
5. trusted HTMLはiframe全幅と文書自身のlayoutを維持する。

## 3. 完了条件と設計対応

| 完了条件 | 設計対応 |
| --- | --- |
| 980px超のpaneでMarkdown本文が拡張 | `.markdown-body`から`min(980px, ...)`を除き、pane基準の`calc()`だけを正本にする。 |
| 狭幅でもpaneからはみ出さない | 通常48px、760px以下28pxの既存inline gutterを維持する。 |
| 横長要素が拡張幅を利用 | table / Mermaid / PlantUML / imageの親である`.markdown-body`だけを拡張し、子要素の既存契約は変更しない。 |
| HTML iframeがpane全幅へ追従 | `.html-preview-frame { width: 100%; }`を維持し、固定最大幅を追加しない。 |
| 操作回帰がない | Explorer resize、tab切替、Markdown / HTML切替、Preview scrollを手動確認する。 |
| build / testが成功 | frontend build / VitestとRust check / test / format checkを実行する。 |

## 4. 対象範囲

### 4.1 対象

- `markdown-viewer-tauri/src/App.css`
  - Markdown本文幅の固定上限を廃止する。
  - 通常幅と狭幅のinline gutter契約を維持する。
- `sample_docs/`
  - 横長tableとdiagramの目視確認に必要なMarkdown fixtureを追加する。
  - 既存HTML fixtureでiframe viewportと文書固有`max-width`の非上書きを確認する。
- Tauri Viewer component docs。
- `docs/rules/development_workflow.md`のUI手動確認項目。

### 4.2 非対象

- `App.tsx`のDOM、state、event handler。
- Explorerの初期幅、最小幅、dynamic最大幅、separator操作。
- table / code block / Mermaidコンテナの横scroll方式。
- image / PlantUML SVGの`max-width: 100%`による縮小方式。
- trusted HTML文書自身が指定する`width` / `max-width`。
- iframe sandbox、custom protocol、CSP、message policy。
- Avalonia版。
- preview幅またはmarginの設定化・永続化。

## 5. Before / After

| 観点 | Before | After |
| --- | --- | --- |
| 通常幅のMarkdown本文 | `min(980px, 100% - 48px)` | `100% - 48px` |
| 760px以下のMarkdown本文 | `100% - 28px` | 変更なし |
| 本文の中央配置 | `margin: 0 auto` | 変更なし |
| HTML iframe | paneの`100%`幅 | 変更なし |
| table / code block / Mermaid | 必要時に要素内横scroll | 変更なし |
| image / PlantUML SVG | 本文幅以下へ縮小 | 変更なし |
| Previewの縦scroll | `.preview-pane`が所有 | 変更なし |

## 6. 採用案

### 6.1 Markdown本文幅

`.markdown-body`の通常幅を次のとおり変更する。

```css
.markdown-body {
  width: calc(100% - 48px);
  min-height: 100%;
  margin: 0 auto;
  padding: 32px 0 56px;
}

@media (max-width: 760px) {
  .markdown-body {
    width: calc(100% - 28px);
    padding-top: 24px;
  }
}
```

`48px`は左右24px、`28px`は左右14pxに相当する。`margin: 0 auto`により残余幅を左右へ等分する。global `box-sizing: border-box`と左右padding 0を維持するため、本文border boxは常にpreview pane内へ収まる。

固定px最大値は持たず、`.preview-pane`のcontent boxを唯一の幅基準とする。Explorer resizeやwindow resizeでPreviewが変化した場合、CSS layoutだけで同期し、React state、`ResizeObserver`、window listenerを追加しない。

### 6.2 Markdown子要素

本文幅の変更だけを行い、次を維持する。

- table: `display: block; width: 100%; overflow-x: auto`
- code block: `overflow-x: auto`
- Mermaid container: `overflow-x: auto`
- PlantUML container: `overflow-x: auto`
- image: `max-width: 100%; height: auto`
- PlantUML SVG: `max-width: 100%; height: auto`

親幅が広がることでtableとdiagramが利用可能な領域は増える。一方、親幅より長いcontentは既存どおり局所的に横scrollまたは縮小される。全Previewへ横scroll責務を移さない。

### 6.3 HTML

HTML branchは既に次の契約を満たすため、source / CSSとも変更しない。

- `.html-preview-frame`は`width: 100%; height: 100%`。
- iframe viewportは`.preview-pane`へ追従する。
- iframe内文書のCSSはViewerから上書きしない。
- Theme変更だけではiframeをreloadしない。

既存fixtureの`max-width: 900px`はHTML文書自身のlayoutであり、今回撤去しない。Viewer側viewportが広がることと、文書自身が可読幅を選ぶことを別契約として扱う。

## 7. 不採用案

| 案 | 不採用理由 |
| --- | --- |
| 最大幅を980pxから別の固定値へ増やす | 大きなdisplayで再び同じ上限へ到達し、pane追従要求を満たさない。 |
| `width: 100%`と左右paddingを本文へ付ける | 見た目は実現できるが、本文widthとcontent widthの意味が変わり、既存子要素の`width: 100%`へpadding分の契約差を持ち込む。 |
| `max-width: none`だけを追加する | 現在の`width: min(...)`自体が980pxを選ぶため解決しない。 |
| JavaScriptでpane幅を計測する | CSSの包含block計算だけで決定でき、state、observer、cleanupを追加する必要がない。 |
| HTML iframeにもMarkdownと同じmarginを付ける | HTML文書のviewportを狭める仕様変更となり、既存の全幅iframe契約とユーザー要求の広幅化に反する。 |
| HTML文書内の`max-width`を注入CSSで解除する | 文書自身のlayoutとsandbox境界を侵害する。 |
| すべての横長要素を無条件に縮小する | tableやcodeの文字可読性が低下し、既存の局所横scroll契約を変える。 |
| marginをViewer settingsへ追加する | 要求外であり、設定schema、migration、保存UIまで変更範囲が広がる。 |

## 8. コンポーネント責務と依存方向

```text
Explorer width policy
        │
        v
Preview workspace / pane (available width)
        ├─ MarkdownPreview -> .markdown-body (pane width - inline gutter)
        │                    └─ table / Mermaid / PlantUML / image
        └─ HtmlPreview -> iframe (pane width 100%)
                           └─ document-owned layout
```

- Preview paneのavailable widthは既存workspace layoutが決定する。
- Markdownのgutterは`App.css`の表示責務とする。
- HTML内layoutはdocument側の責務とする。
- backend、document contract、React stateへの依存は追加しない。

## 9. UI / API / データモデル変更

### 9.1 UI契約

- Markdown本文の通常幅から固定980px上限を取り除く。
- 通常時は左右24px、760px以下では左右14pxの余白を維持する。
- HTML iframeは全幅のままとする。

### 9.2 API / state / data

- TypeScript type、React state、Tauri command、Rust model、app configを変更しない。
- migration、default値、互換読み込みは不要。

## 10. 互換性・移行・default

- 1028px以下のpreview paneでは計算結果が従来と同じため、通常・狭幅の見た目を維持する。
- 1028px超では本文だけが追加領域へ拡張する意図した仕様変更となる。
- 旧980px経路は残さず、CSS宣言を単一のpane相対幅へ置き換える。
- persisted settingsやdocument dataに変更はなく、移行処理を追加しない。
- HTML iframe、Explorer、tab、security boundaryには互換レイヤーもfallbackも追加しない。

## 11. エラー・境界条件

- CSS layoutだけのため、新しいruntime errorやユーザー向けerrorは発生しない。
- pane幅が48pxまたは28pxより狭くなる状態は、`.app-shell`の既存最小幅とExplorer policyにより通常到達しない。到達した場合もglobal layout契約を変更せず、今回だけのfallbackは追加しない。
- 非整数device pixel ratioではCSS engineの通常のsubpixel layoutへ委ねる。
- 長い非改行文字列は既存code / table等のoverflow契約で扱い、本文全体へ新しいhorizontal scrollbarを追加しない。

## 12. 類似ロジックと抽象化方針

- Explorer幅はuser操作とdynamic boundsを持つstateful policyだが、Markdown gutterはCSS包含blockに対する静的layoutであり、共通化しない。
- narrow breakpointは既存`@media (max-width: 760px)`を正本として再利用し、新しいbreakpointや重複selectorを追加しない。
- HTML iframe widthは既存selectorをそのまま再利用し、document type共通のJavaScript width policyを作らない。
- 新規関数、module、global utilityは追加しない。

## 13. 影響範囲

| component | 変更 |
| --- | --- |
| `src/App.css` | `.markdown-body`の通常widthから980px上限を削除する。 |
| `sample_docs/` | 横長Markdownの手動確認fixtureを追加する。 |
| `docs/components/tauri_viewer/README.md` | `App.css`とPreview責務へ可変幅契約を追記する。 |
| `docs/components/tauri_viewer/basic_design.md` | Markdown / HTMLのpane幅追従方針を追記する。 |
| `docs/components/tauri_viewer/detail_design.md` | UI layoutと子要素overflow / scaling責務を追記する。 |
| `docs/components/tauri_viewer/interface_spec.md` | Document Preview表示契約を追加する。 |
| `docs/rules/development_workflow.md` | 広幅・狭幅・Explorer resizeの手動確認項目を追加する。 |
| `App.tsx` / Rust / Tauri config | 変更なし。回帰検証のみ。 |

## 14. 恒久ドキュメント更新予定

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`
- 完了時に`docs/history/`へ実装履歴を追加する。

ADRは追加しない。Tauri Viewerの局所的なCSS layout契約であり、複数案件へ再利用される採用済み横断判断ではない。

## 15. 自動テスト

変更点はCSS layoutであり、現在のVitestはDOM / computed styleを提供しない。CSS source文字列へ結合したテストは実装詳細に強く依存し、ユーザーに見える幅を検証しないため追加しない。

次を全件実行する。

```bash
cd markdown-viewer-tauri
npm run build
npm test -- --run

cd src-tauri
cargo check
cargo test
cargo fmt -- --check
```

`npm run build`でCSS parseとfrontend compileを検証し、既存Vitestでdocument / Explorer policyを回帰確認する。Rust source変更はないが、Tauri application全体の回帰としてcheck / test / format checkを行う。

## 16. ユーザ確認シナリオ

1. 横長fixtureを開き、preview paneが1028px以下では従来相当のmarginと表示になる。
2. windowを広げてpreview paneを1028px超にし、Markdown本文が980pxで止まらず左右24pxを残して拡張する。
3. 横長table、Mermaid、PlantUML、imageが拡張された本文幅を利用する。
4. 親幅を超えるtable、code、diagramでは既存の局所横scrollまたは縮小が機能する。
5. windowを760px以下へ狭め、本文が左右14pxを残してpane内へ収まる。
6. Explorer separatorを最小・最大へ動かし、Markdown本文とHTML iframeが残りのpreview pane幅へ追従する。
7. Markdown / HTML tabを切り替え、HTML iframeがpane全幅を使い、既存fixture内の文書固有`max-width`は維持される。
8. Previewの縦scroll、tab切替、Reload、Light / Dark、Mermaid / PlantUML再描画に退行がない。

## 17. リスクとfollow-up

| リスク | 対応 |
| --- | --- |
| 広幅で本文1行が長くなり文章の可読性が下がる | 今回は横長図表の閲覧性を優先する明示要求である。可読幅切替が必要なら独立した設定仕様として扱う。 |
| 横長contentが本文幅を超える | 既存の要素単位overflow / scalingを維持し、fixtureで確認する。 |
| HTMLも固定上限の影響を受けていると誤認する | Viewer iframeと文書自身のlayoutを設計・恒久docsで分離して記載する。 |
| CSSだけの変更をunit testで直接検出できない | buildによるCSS処理確認と、複数幅・Explorer resizeを含む手動確認を完了条件にする。 |
| 将来split viewでpaneが複数になる | pane相対CSSのため各paneの包含blockへ自然に追従する。split view固有のminimum widthはTODO-2026-006で扱う。 |

追加follow-upは現時点で起票しない。Avalonia版へ同様の仕様を反映するかは、既存のTauri先行UX評価とAvalonia水平展開の流れで別途判断する。
