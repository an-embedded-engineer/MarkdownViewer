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
- Avalonia 開発実行: `dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj` の working directory と、実行 assembly の base directory を探索対象にする。
- Tauri 開発実行: `markdown-viewer-tauri/src-tauri/` を明示的な runtime directory として先に探索し、その後に current working directory、Rust 実行ファイルの directory を探索する。`npm run tauri dev` の呼び出し元 working directory に依存しない。
- Tauri bundle: macOS `.app` では `<app>.app/Contents/MacOS/` を runtime directory とする。Finder 起動時の working directory は `/` になり得るため、bundle 実行では working directory を jar 探索の根拠にしない。

config file 形式:

```json
{
  "plantUmlJarPath": "/absolute/path/to/plantuml.jar"
}
```

`plantuml.config.json` と `plantuml.jar` はローカル runtime ファイルとして扱い、Phase 3 で `.gitignore` へ追加する。

`.gitignore` は root 直下用に `/plantuml.jar` と `/plantuml.config.json` を追加し、実行ディレクトリごとの配置は各実行ディレクトリ側の既存生成物除外規則または個別 `.gitignore` で扱う。Phase 3 では Tauri 開発実行用に `markdown-viewer-tauri/src-tauri/plantuml.jar` と `markdown-viewer-tauri/src-tauri/plantuml.config.json` も除外対象に含める。

## 影響範囲

Avalonia:

- `Services/` 配下に `PlantUmlRuntimeOptions` / resolver service を追加する。
- `Services/` 配下に `PlantUmlRenderService` を追加する。
- `IMarkdownRenderService` は `Task<string> RenderToHtmlFragmentAsync(string markdown, CancellationToken cancellationToken)` を公開する。既存の同期 `RenderToHtmlFragment` は project 内公開 API として残さず、新しい非同期 API に一本化する。
- `MarkdownRenderService` は Markdown fence の抽出、placeholder 管理、Mermaid / PlantUML 用 HTML 差し替えを担当する。
- `PlantUmlRenderService` は `PlantUmlRuntimeResolver` で jar を解決し、PlantUML CLI 実行、timeout、stdout / stderr / exit code の解釈だけを担当する。
- `MainWindowViewModel.OpenMarkdownAsync` で PlantUML 対応済み render path を await する。
- `HtmlTemplateService` の preview CSS に `.plantuml-diagram` と `.plantuml-error` を追加する。

Tauri:

- `src-tauri/src/lib.rs` に render request / response 用の serializable model を追加する。
- `render_plantuml_diagrams` command を追加する。Markdown 読み込み response へ統合する案は採用しない。
- ファイル読み込みと PlantUML 実行は React ではなく Rust 側に置く。
- `src/App.tsx` は Markdown 本文から PlantUML fence を抽出し、`invoke<PlantUmlRenderResponse>("render_plantuml_diagrams", ...)` で Rust 側へ渡す。返却された SVG / error HTML を placeholder へ差し替えてから Markdown HTML へ変換する。
- React は `previewRevision` と selected file path をキーに PlantUML render request を発行し、Mermaid は従来通り HTML 反映後に `mermaid.run` で描画する。PlantUML 結果の反映で preview DOM が再生成された場合も Mermaid を再描画する。
- Rust command は `Result<PlantUmlRenderResponse, String>` を返し、プロセス起動不能など command 全体の失敗は banner、図ごとの失敗は response 内の diagram result として inline 表示する。
- `src/App.css` に `.plantuml-diagram` と `.plantuml-error` を追加する。

Docs / samples:

- 共有確認用として `sample_docs/plantuml.md` をリポジトリ直下に追加する。サンプルには Mermaid と PlantUML を同居させ、Avalonia / Tauri の手動確認はいずれもリポジトリ直下または `sample_docs/` を含むフォルダを開いて同じ Markdown を使う。
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

stdout / stderr は UTF-8 として扱う。C# 側は `ProcessStartInfo.StandardOutputEncoding` / `StandardErrorEncoding` に `Encoding.UTF8` を指定し、Rust 側は `Command::output()` の byte 出力を `String::from_utf8_lossy` で UI 表示可能な文字列へ変換する。

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

複数の PlantUML fence が同時に失敗した場合、inline error は各 fence に表示する。banner / status には最初の代表エラー 1 件のみを表示し、詳細は inline error を正とする。

Reload や theme switch 後に古い SVG を残したり、空白のまま失敗を隠したりしない。

### セキュリティと sanitization

- Tauri の `markdown-it` path では Markdown 内 HTML を引き続き無効化する。
- PlantUML SVG は、ユーザーが選択したローカル Markdown からローカル生成される前提とする。
- ネットワーク server は呼び出さない。
- renderer は shell 展開を通さず、`java` を引数配列で直接起動する。
- `plantuml.jar` path はファイルとして解決できることを確認し、Markdown 本文からは推定しない。
- PlantUML が出力した SVG はそのまま DOM に入れる前に、少なくとも `<script>` 要素と `on*` event handler 属性を除去する。初期実装では sanitizer を Avalonia / Tauri それぞれの host-side renderer に置き、将来共通化の必要が出た時点で抽象化する。

### Theme 動作

Phase 3 では theme 対応を単純に保つ。

- PlantUML の dark-mode option は初期実装では使わない。
- SVG を `.plantuml-diagram` で包み、viewer の背景・border 変数に合わせる。
- Theme 切替時は PlantUML SVG を再生成せず、既存 SVG を保持して CSS のみ更新する。PlantUML 図の色自体は変えない。
- Avalonia は `ToggleTheme` 時に Markdown 再読み込みで PlantUML CLI を再実行しないよう、現在の Markdown 本文と PlantUML render result を再利用して HTML template だけを再構築する。
- Tauri は `theme` 変更だけでは `render_plantuml_diagrams` を再実行しない。selected file path、Markdown 本文、Reload による `previewRevision` 更新時のみ PlantUML CLI を実行する。
- PlantUML dark-mode は図の意味や色表現に影響するため、後続拡張として扱う。

## 互換性・移行方針

既存ドキュメントの migration は不要。既存 Mermaid fence は現在の Mermaid renderer path を維持する。PlantUML block を含まない文書では Java を起動せず、`plantuml.jar` も不要である。

PlantUML 表示を使うユーザーは、以下のどちらかを行う。

- runtime directory に `plantuml.jar` を置く。
- `plantuml.config.json` を作成し、`plantUmlJarPath` に jar path を記載する。

`PlantUmlRuntimeOptions` は `JarPath` と `ConfigPath` を持つ小さなデータ契約とし、resolver は jar 未検出、config 不正、Java 起動不可を区別できる error を返す。Java availability は起動時には検査せず、最初の PlantUML 描画時に `java -jar` の起動失敗として検出し、UI 表示可能な英語エラーへ変換する。

## 恒久ドキュメント更新予定先

Phase 3 で以下を更新する。

- `docs/rules/development_workflow.md`: PlantUML ローカルセットアップと確認手順。
- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/avalonia_viewer/interface_spec.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
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

- Mermaid と PlantUML が同居するサンプルを含むフォルダを Avalonia で開き、両方の図が表示されることを確認する。
- Mermaid と PlantUML が同居する同じフォルダを Tauri で開き、両方の図が表示されることを確認する。
- PlantUML SVG がインライン表示されることを確認する。
- jar 未配置時に原因が分かるメッセージが表示されることを確認する。
- PlantUML 構文エラーが該当図の近くに表示されることを確認する。
- Reload 後も Mermaid が表示されることを確認する。
- Light / Dark 切替で PlantUML 出力が重なったり見えなくなったりしないことを確認する。
- Light / Dark 切替だけでは PlantUML CLI が再実行されないこと、または体感上の遅延が増えないことを確認する。
- 動作確認に使った PlantUML jar のバージョンを `docs/rules/development_workflow.md` へ記録する。

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
- ローカル CLI で図を生成する設計判断を ADR 化するかの判定。
