# コードパターン

## C# / Avalonia

- Namespace はフォルダ構造に対応させる。
- Model は `Models/`、UI状態は `ViewModels/`、処理は `Services/` に置く。
- ViewModel は `CommunityToolkit.Mvvm` の `ObservableObject` / command を使う。
- ファイルツリー、Markdown変換、PlantUML CLI実行などの処理は Service に分離し、ViewModelから呼び出す。
- PlantUMLは `MarkdownRenderService` がfence抽出とHTML差し替えを担当し、`PlantUmlRenderService` がCLI実行、`PlantUmlRuntimeResolver` がjar解決を担当する。
- XAMLコードビハインドはView初期化とフレームワーク連携に限定する。

## TypeScript / React

- UI state は `App.tsx` のReact stateで管理する。
- Markdown rendering、Mermaid描画、リンク処理、パス解決は関数として分ける。
- Tauri command 呼び出しは `invoke<T>()` の型引数で戻り値を明示する。
- Rendererが生成するHTMLは `html: false` を前提とし、Markdown内HTMLを許可しない。
- PlantUMLはReactでfence抽出とplaceholder差し替えを行い、Java process実行はRust commandへ寄せる。Theme切替だけではPlantUML commandを再実行しない。
- Mermaid / PlantUML のfence言語判定はinfo stringの先頭tokenを小文字化して行う。`mermaid`, `plantuml`, `puml` の後ろに追加情報があっても先頭tokenを言語として扱う。
- `OpenDocumentResponse` は Markdown / HTML の discriminated union とし、`sourceText` と `previewUrl` の混在や fallback を許可しない。
- HTML message / URL 判定は副作用のない `documentPolicy.ts` へ集約し、iframe DOMへ React からアクセスしない。source、opaque origin、tab revision、message shape、transient user activation、duplicate をすべて満たす場合だけ外部 URL を開く。
- document dataはglobal `OpenDocumentTab[]`へ集約し、paneごとの所属・順序・選択・pending navigationは`SplitViewState`のordered ID group、Mermaid / HTML handshakeなどDOM固有状態はpane-local runtimeへ分離する。同じdocument IDの両group参照を許可し、local close後の参照集合がemptyの場合だけglobal dataを破棄する。
- Split Viewの状態遷移と幅計算は`splitView.ts`、pane / tab / revision guardとTabStrip表示状態の合成は`paneRuntime.ts`のpure functionで検証する。
- pane間moveはsource removal / local fallbackとdestination dedupe add / selectを1つのtyped actionで更新する。group IDからdataを解決する境界ではmissing IDを黙ってfilterせず、内部不整合としてthrowする。
- pane selectionやrevision変更後のpreview status clearはhandlerへ重複実装せず、`isPanePreviewStatusCurrent`を使うgeneric effectを唯一の正本にする。
- 複数paneのMermaid描画はApp instance所有queueで直列化し、paneを含む一意なrender IDを指定する。module-global queueやpane間で共有するDOM refを作らない。

## Rust / Tauri

- フロントエンドから直接ファイルシステムを読まず、Rust command に寄せる。
- `DocumentStore` は canonical current root の正本であり、`scan_directory`、`open_document`、`mvhtml` protocol が同じ root boundary を共有する。旧 `read_text_file` command は持たない。
- custom protocol path は `/document/<segments>` を segment ごとに一度だけ decodeし、separator、dot segment、drive / UNC 注入を拒否した後に root へ join、canonicalize、boundary確認を行う。
- 返却モデルは `serde::Serialize` を使い、TypeScript側の型と対応させる。
- 除外ディレクトリや拡張子判定はRust側の小さな関数へ分離する。
- 外部プロセスはshellを介さず `Command` の引数配列で起動し、stdout / stderrはUI表示可能な文字列へ変換する。WindowsのGUI起動では`CREATE_NO_WINDOW`を指定し、子processごとのterminal window表示を抑止する。

## エラーハンドリングパターン

- AvaloniaはViewModelでエラー表示状態を持つ。
- TauriはRust commandで `Result<T, String>` を返し、React側でエラーバナー表示する。
- パス解決、ファイル読み込み、Markdown/Mermaid描画の失敗は握りつぶさない。

## テストパターン

Rust unit test と Vitest による frontend policy test を整備している。変更時は自動テスト、ビルド確認、手動UI確認を必須とする。

将来的には以下を追加する。

- C#: `FileTreeService` / `MarkdownRenderService` のユニットテスト
- Rust: PlantUML runtimeなど未網羅領域の追加ユニットテスト
- Frontend: Markdown renderer / component lifecycle の追加ユニットテスト
