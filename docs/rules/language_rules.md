# 言語ルール

## 基本方針

- 内部思考: 英語
- チャット応答: 日本語
- `docs/` 配下ドキュメント: 日本語
- UI / ログ / エラー文字列: 英語
- ソースコードコメント: 原則日本語。ただし既存ファイルが英語コメント中心の場合は局所一貫性を優先する。

## C# / Avalonia

- Nullable reference types を有効にし、`null` を許す境界を明示する。
- View / ViewModel / Service / Model の責務を分離し、UI イベント処理を ViewModel または Service へ寄せる。
- XAML はレイアウトとバインディングに集中させ、処理ロジックを埋め込まない。
- 非同期処理は `Task` / `async` / `await` を使い、UI スレッドをブロックしない。
- `record` / `class` / enum でデータ契約を明示し、`Dictionary<string, object>` は I/O 境界以外で使わない。
- public API には日本語 XML Doc コメントを付ける。private 実装コメントは複雑な処理の意図説明に限定する。

## TypeScript / React / Tauri Frontend

- React コンポーネントは表示責務、状態管理、Tauri API 呼び出しの境界を明確にする。
- TypeScript の型でアプリ状態と Tauri command の戻り値を表現し、`any` は使わない。
- `dangerouslySetInnerHTML` を使う箇所は Markdown renderer に閉じ込め、HTML 許可範囲を明示する。
- UI 文字列、エラー文言、ボタンラベルは英語で統一する。
- Mermaid など DOM 変換を伴う処理は、React の再描画条件と同期条件を明示する。
- Node / Vite の生成物である `node_modules/` と `dist/` はコミットしない。

## Rust / Tauri Backend

- Tauri command はファイルシステムやOS連携の境界として扱い、戻り値は `Result<T, String>` でUI表示可能なエラーへ変換する。
- ファイルパスは `Path` / `PathBuf` と `canonicalize` を使い、文字列結合による検証を避ける。
- フロントエンドへ返す構造体は `serde::Serialize` と明示的な enum で表現する。
- `unwrap` / `expect` は初期化失敗などプロセス停止が妥当な箇所に限定し、通常の入出力失敗は `Result` で返す。
- Tauri capability と plugin 追加時は `Cargo.toml`、`tauri.conf.json`、`src-tauri/capabilities/*.json` の整合を確認する。
- Rust生成物である `src-tauri/target/` はコミットしない。

## 目的

- 技術的推論を一貫させる。
- C# と Tauri の比較実装で、責務境界と検証コマンドの粒度を揃える。
- UI/ログを英語で統一し、将来の国際化コストを下げる。
