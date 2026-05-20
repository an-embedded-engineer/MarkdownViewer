# PlantUML 表示対応 機能設計

## 背景・要求・完了条件

MarkdownViewer は現在、Avalonia 版と Tauri 版の両方で Markdown と Mermaid 図を表示できる。一方、プロジェクトの設計文書には `plantuml` fenced code block が含まれることがあり、現状では通常のコードブロックとして表示されるため、ビューア上で図として確認できない。

本機能では、`plantuml.jar` をリポジトリに含めず、ローカル環境の Java と `plantuml.jar` を使って PlantUML 図を表示する。現在の開発環境では Java として `openjdk 24.0.2` が利用可能である。`plantuml.jar` はユーザーまたはローカル環境が用意する前提とする。

完了条件:

- ` ```plantuml ` fenced code block が Avalonia プレビュー内でインライン表示される。
- ` ```plantuml ` fenced code block が Tauri プレビュー内でインライン表示される。
- `plantuml.jar` をコミット対象に含めない。
- Java 未導入、jar 未配置、PlantUML 構文エラーを、空白や古い表示ではなく原因が分かるエラーとして表示する。
- 既存の Markdown、Mermaid、ローカル画像、リンク遷移、Reload、テーマ切替が維持される。
- `docs/rules/development_workflow.md` で定義された検証コマンドが完了する。

## 対象範囲と非対象

対象:

- language が `plantuml` または `puml` の Markdown fenced code block を図として表示する。
- ローカル Java とローカル `plantuml.jar` を使う。
- PlantUML CLI で SVG を生成する。
- `plantuml.jar` の決定的な解決ルールを追加する。
- セットアップ、利用方法、制約を恒久ドキュメントへ反映する。
- 手動確認用のサンプル Markdown を追加する。

非対象:

- Java runtime の同梱。
- `plantuml.jar` のリポジトリ管理。
- ネットワーク上の PlantUML server 呼び出し。
- PlantUML エディタ機能。
- SVG 以外の PlantUML 出力形式。
- 設定 UI の追加。

## 採用案

PlantUML 図はホスト側サービスで描画する。

- Avalonia: C# service が `java -jar <plantuml.jar> -tsvg -pipe` を実行する。
- Tauri: Rust command が `java -jar <plantuml.jar> -tsvg -pipe` を実行する。
- Markdown 層は `plantuml` / `puml` fence をプレースホルダへ変換する。
- ホスト側 renderer がプレースホルダを SVG HTML またはインラインエラーへ差し替えてから最終プレビューを表示する。

PlantUML 公式 CLI は SVG 出力と `-pipe` による標準入出力処理をサポートしている。これにより、一時的な図ファイルを Markdown と同じディレクトリへ生成せずに統合できる。

参照:

- https://plantuml.com/command-line
- https://plantuml.com/svg

## 不採用案

### PlantUML server を使う

ローカルドキュメントをオフラインで閲覧できることを優先するため不採用とする。設計文書の内容をネットワーク越しの別プロセスへ送る依存も増やさない。

### `plantuml.jar` をコミットする

`plantuml.jar` は第三者バイナリであり、ローカル runtime 依存として管理すべきため不採用とする。配置場所と設定方法をドキュメント化する。

### ブラウザ側で PlantUML を描画する

Mermaid と同等の PlantUML JavaScript renderer を既存 stack に持たないため不採用とする。ブラウザ側から Java を呼び出す構成は Tauri / Avalonia のセキュリティ境界も曖昧にする。

### Markdown と同じ場所へ図ファイルを事前生成する

選択したドキュメントツリーを変更し、生成物を誤ってコミットしやすくなるため不採用とする。

## Before / After

Before:

- Mermaid fence は図として表示される。
- PlantUML fence は通常のコードブロックとして表示される。
- `plantuml.jar` のセットアップ導線がない。

After:

- Mermaid fence は既存経路で引き続き表示される。
- Java と `plantuml.jar` が利用可能な場合、PlantUML fence がインライン SVG として表示される。
- PlantUML の失敗は該当図の近く、または既存の status / error 表示に出る。
- ローカル runtime セットアップはドキュメント化され、source control から除外される。

## Runtime 設定

両実装で同じ resolver 契約を使う。

1. runtime directory の `plantuml.config.json` を探す。
2. 見つかった場合は `plantUmlJarPath` を読む。
3. `plantUmlJarPath` が相対パスなら config file のディレクトリ基準で解決する。
4. config で jar path が得られない場合は、同じ runtime directory の `plantuml.jar` を探す。
5. どちらもファイルとして解決できない場合は、PlantUML runtime 未設定エラーを返す。

runtime directory:

- publish されたアプリ: 実行ファイルのディレクトリ。
- 開発実行: 現在の working directory を先に見て、その後に実行ファイルのディレクトリを見る。これにより、publish 後の配置規約を保ちながら開発時の設定も扱いやすくする。

config file 形式:

```json
{
  "plantUmlJarPath": "/absolute/path/to/plantuml.jar"
}
```

`plantuml.config.json` と `plantuml.jar` はローカル runtime ファイルとして扱い、Phase 3 で `.gitignore` へ追加する。

## 影響範囲

Avalonia:

- `Services/` 配下に `PlantUmlRuntimeOptions` / resolver service を追加する。
- `Services/` 配下に `PlantUmlRenderService` を追加する。
- `MarkdownRenderService` を非同期化し、`plantuml` placeholder に対応する。
- `MainWindowViewModel.OpenMarkdownAsync` で PlantUML 対応済み render path を await する。
- `HtmlTemplateService` の preview CSS に `.plantuml-diagram` と `.plantuml-error` を追加する。

Tauri:

- `src-tauri/src/lib.rs` に render request / response 用の serializable model を追加する。
- `render_plantuml_diagrams` command を追加する、または Markdown 読み込み response に図描画結果を統合する。
- ファイル読み込みと PlantUML 実行は React ではなく Rust 側に置く。
- `src/App.tsx` で PlantUML fence を renderer 結果へ差し替えてから Markdown HTML へ変換する。
- `src/App.css` に `.plantuml-diagram` と `.plantuml-error` を追加する。

Docs / samples:

- 既存 sample docs 領域、または必要に応じて共有 sample 領域へ PlantUML サンプル Markdown を追加する。
- component docs と development workflow のセットアップ説明を更新する。

## 設計方針

### 描画形式

本機能の viewer 出力は SVG のみにする。SVG は既存の WebView / browser preview と相性がよく、base64 PNG 管理が不要で、拡大時の視認性も保ちやすい。

### PlantUML source wrapping

renderer は fenced block の本文を受け取る。本文に `@start...` / `@end...` が含まれない場合は、実行前に `@startuml` と `@enduml` で包む。明示的な start / end directive が含まれる場合はそのまま渡す。

### プロセス実行

renderer は以下を実行する。

```bash
java -jar <plantuml.jar> -tsvg -pipe
```

図の source は stdin へ書き込む。SVG は stdout から読み取る。stderr と exit code はエラー表示用に取得する。

timeout:

- 1 図あたり 10 秒で timeout する。
- timeout 時はプロセスを終了し、PlantUML timeout エラーを表示する。

concurrency:

- 初期実装では 1 回の preview load 内で PlantUML block を順次描画する。
- 複数 Java process の同時起動を避け、エラーと対象図の対応を単純に保つ。

### エラー動作

図ごとのエラーは以下の形で表示する。

```html
<pre class="plantuml-error">PlantUML render failed: ...</pre>
```

resolver 全体のエラーは、各 PlantUML fence に同じインラインエラーとして表示し、既存の status / error banner が使える画面ではそこにも反映する。

Reload や theme switch 後に古い SVG を残したり、空白のまま失敗を隠したりしない。

### セキュリティと sanitization

- Tauri の `markdown-it` path では Markdown 内 HTML を引き続き無効化する。
- PlantUML SVG は、ユーザーが選択したローカル Markdown からローカル生成される前提とする。
- ネットワーク server は呼び出さない。
- renderer は shell 展開を通さず、`java` を引数配列で直接起動する。
- `plantuml.jar` path はファイルとして解決できることを確認し、Markdown 本文からは推定しない。

### Theme 動作

Phase 3 では theme 対応を単純に保つ。

- PlantUML の dark-mode option は初期実装では使わない。
- SVG を `.plantuml-diagram` で包み、viewer の背景・border 変数に合わせる。
- PlantUML dark-mode は図の意味や色表現に影響するため、後続拡張として扱う。

## 互換性・移行方針

既存ドキュメントの migration は不要。既存 Mermaid fence は現在の Mermaid renderer path を維持する。PlantUML block を含まない文書では Java を起動せず、`plantuml.jar` も不要である。

PlantUML 表示を使うユーザーは、以下のどちらかを行う。

- runtime directory に `plantuml.jar` を置く。
- `plantuml.config.json` を作成し、`plantUmlJarPath` に jar path を記載する。

## 恒久ドキュメント更新予定先

Phase 3 で以下を更新する。

- `docs/rules/development_workflow.md`: PlantUML ローカルセットアップと確認手順。
- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/architecture/overview.md`
- `docs/architecture/code_patterns.md`
- `docs/architecture/common_pitfalls.md`

## テスト・ユーザ確認観点

自動 / command 確認:

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`
- `markdown-viewer-tauri/` で `npm run build`
- `markdown-viewer-tauri/src-tauri/` で `cargo check`
- Rust code を変更した場合は `markdown-viewer-tauri/src-tauri/` で `cargo fmt -- --check`

手動確認:

- Mermaid と PlantUML のサンプルを含むフォルダを Avalonia で開く。
- 同じフォルダを Tauri で開く。
- PlantUML SVG がインライン表示されることを確認する。
- jar 未配置時に原因が分かるメッセージが表示されることを確認する。
- PlantUML 構文エラーが該当図の近くに表示されることを確認する。
- Reload 後も Mermaid が表示されることを確認する。
- Light / Dark 切替で PlantUML 出力が重なったり見えなくなったりしないことを確認する。

## リスクと follow-up

リスク:

- Java process の起動コストにより、多数の図を含む文書で表示が遅くなる可能性がある。
- PlantUML 構文や Graphviz 依存の図は、ローカル PlantUML の機能や環境により失敗する可能性がある。
- PlantUML が出力する SVG の色が viewer の dark theme と完全には一致しない可能性がある。
- 開発実行と publish 後の起動 context が異なるため、runtime directory の説明が曖昧だと設定ミスにつながる。

follow-up 候補:

- source hash、jar path、theme を key にした diagram cache。
- PlantUML dark-mode option。
- `plantuml.jar` path の設定 UI。
- Java / PlantUML version を表示する確認 command。
