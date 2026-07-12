# クロスプラットフォーム環境構築・README 整備 実装レビュー

**レビュー日**: 2026-07-13
**再確認日**: 2026-07-13
**対象文書**: `README.md`、`docs/setup/{README,windows,macos,linux}.md`、`Avalonia/MarkdownViewer.Avalonia/README.md`、`markdown-viewer-tauri/README.md`、`docs/rules/development_workflow.md`、`docs/rules/project_overview.md`
**対象 impl**: `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/impl/cross_platform_setup_readmes_impl.md`
**対象 meta**: `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/meta.md`
**対象 design**: `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/design/cross_platform_setup_readmes_design.md`（承認済み、`review/cross_platform_setup_readmes_design_review.md` で Approved）
**対象 TODO**: `docs/todo/todo.md` TODO-2026-013
**初回レビュー対象コミット**: `f3b38a1 docs: add cross-platform setup and readme navigation`
**再確認対象コミット**: `4d0baa3 docs: address cross-platform setup implementation review`
**判定**: **承認 (Approved)**。Phase 4 進行可。

---

## 概要

TODO-2026-013 (クロスプラットフォーム環境構築・README 整備) の Phase 3 実装レビュー。新設のルート README / `docs/setup/{README,windows,macos,linux}.md` と、Avalonia/Tauri 各実装 README・`docs/rules/development_workflow.md`・`docs/rules/project_overview.md` の更新内容を、承認済み design、既存 project/manifest/`scripts/publish_apps_with_plantuml.sh`、Avalonia/Tauri のソース実装（`RecentFolderEntry`、`PlantUmlRenderService` 等）、`.gitignore` と突き合わせて検証した。全 Markdown 相対リンクの実在確認をスクリプトで行い、`git show --stat` で変更対象が `.md` のみであることを確認した。

---

## 1. 齟齬・不整合

### 1.1 ルート README と `docs/setup/README.md` の「すべてリポジトリルートで実行」が直後のコマンドと矛盾する

**該当箇所**: `README.md` の「はじめに」節は次の通り記載する。

```text
セットアップ後の最小確認コマンドは次のとおりです。すべてリポジトリルートで実行します。

# Avalonia
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri（先に markdown-viewer-tauri で npm ci を実行）
cd markdown-viewer-tauri
npm run build
npm run tauri dev
```

「すべてリポジトリルートで実行します」と明言した直後に `cd markdown-viewer-tauri` でリポジトリルートを離れるコマンドが続く。`docs/setup/README.md` の「共通の依存復元」節も同様に「次のコマンドは clone したリポジトリのルートで実行します」と述べた直後、`cd markdown-viewer-tauri` を含むブロックを示している。

一方、同じコミットで整備された `docs/setup/windows.md` / `macos.md` / `linux.md` は冒頭で「コマンドは明記がない限りリポジトリルートで実行します」という、例外を許容する表現を一貫して使い、実際に `cd` / `Set-Location` を明示してディレクトリ移動を都度示している。

**差異**: ルート README と `docs/setup/README.md` の 2 箇所は「すべて」「ルートで実行します」という無条件の主張と、直後の `cd` コマンドが文字どおり矛盾している。設計レビューで確認した design 54 行の確認観点「コマンドがリポジトリルート基準か、各サブディレクトリ基準か明示されていること」を、まさにこの 2 箇所が満たせていない。実害は「`npm run build` がリポジトリルートで `package.json` を見つけられず失敗する」程度に留まり、利用者はエラーで気づける範囲だが、プロジェクトの最初の入口文書でこの矛盾が起きている。

**推奨対応**: ルート README と `docs/setup/README.md` の該当文を、OS 別文書と同じ「明記がない限りリポジトリルートで実行します」という表現に統一するか、「Avalonia のコマンドはリポジトリルート、Tauri のコマンドは `cd markdown-viewer-tauri` 後に実行します」のように、コマンドごとの基準を明示する文へ修正する。

**severity**: Medium

---

## 2. ドキュメント不足

### 2.1 承認済み design が定めた OS 別文書の統一構成から「PlantUML」節が欠落し、参照方法も 3 文書間で不揃い

**該当箇所**: 承認済み design の更新方針 3 は「OS 別文書は『前提 → clone → バージョン確認 → 依存復元 → build → 実行 → PlantUML → publish → troubleshooting』の順で統一する」と明記しており、PlantUML を各 OS 文書内の独立した節として扱う前提になっている。

実際の `docs/setup/windows.md` / `macos.md` / `linux.md` はいずれも「前提ツール → clone と依存復元 → build → 実行 → publish/bundle → トラブルシューティング」の 6 節構成で、独立した PlantUML 節を持たない。共通の PlantUML 手順は `docs/setup/README.md` に集約されており、それ自体は重複排除として妥当だが、各 OS 文書からの参照が揃っていない。

- `windows.md`: トラブルシューティング内の 1 項目としてのみ `README.md#plantuml任意` にリンクする。
- `macos.md`: PlantUML への言及・リンクが本文中に一切ない。
- `linux.md`: PlantUML への言及・リンクが本文中に一切ない。

**差異**: `impl/cross_platform_setup_readmes_impl.md` の「更新した文書」節にはこの構成変更（PlantUML を独立節にせず共通文書へ集約する）についての記載がなく、design からの逸脱を明示的に判断した記録が残っていない。加えて、macOS/Linux 利用者は `docs/setup/README.md` を別途開かない限り PlantUML 手順に辿り着けず、Windows 利用者だけがトラブルシューティング経由でリンクを得られるという非対称な導線になっている。

**推奨対応**: 次のいずれかを行う。
1. 各 OS 文書に「PlantUML（任意）」という共通の短い節を追加し、`docs/setup/README.md#plantuml任意` への参照を 3 文書で揃える。
2. 集約する判断を維持するなら、`impl/cross_platform_setup_readmes_impl.md` に「PlantUML 手順は OS 間で差が無いため `docs/setup/README.md` へ集約し、各 OS 文書は独立節を持たない」という設計逸脱の判断根拠を明記する。

**severity**: Medium

### 2.2 `impl/cross_platform_setup_readmes_impl.md` の「文書検証コマンド」に実行不能な行が混在している

**該当箇所**: 「文書検証コマンド」節のコードブロックに次の行が含まれる。

```text
ruby による変更対象 Markdown の相対リンク存在確認
```

これは日本語の説明文であり、シェルコマンドとして実行すると失敗する（`ruby` 自体は実行可能でも、後続の日本語トークンが不正な引数になる）。他の行はすべて実際に実行可能な `rg` / `git diff` コマンドである中、この 1 行だけが「実行したコマンド」ではなく「行った作業の説明」になっている。

**差異**: `documentation-workflow` の Phase 3 完了条件は「実行した文書検証コマンドを記録する」ことであり、この行は実行記録として成立しない。実際の相対リンク確認（本レビューで独自に実施し、全リンクの実在を確認済み）が行われたこと自体は疑っていないが、記録の体裁が監査可能な形になっていない。

**推奨対応**: 該当行を、実際に使ったコマンド（例: 簡易 Python/Ruby スクリプトの実体、またはリンク検証に使った具体的なワンライナー）に置き換えるか、コマンドではなく作業内容の説明であることが分かるよう、コードブロック外の説明文として記載し直す。

**severity**: Low

---

## 3. 改善提案

### 3.1 Windows/macOS の PlantUML 節が「リポジトリルート」を Tauri dev 実行にも有効であるかのように読める

**該当箇所**: 再確認対象コミットで追加された `windows.md` / `macos.md` の「PlantUML（任意）」節は「開発時はリポジトリルートまたは各実装の runtime directory に `plantuml.jar` を配置します」と記載する。Avalonia は `dotnet run` をリポジトリルートで実行するため `Directory.GetCurrentDirectory()`（`Avalonia/MarkdownViewer.Avalonia/Services/PlantUmlRuntimeResolver.cs` の `GetRuntimeDirectories`）がリポジトリルートに一致し、この記載は正しい。一方 Tauri 側の探索順（`markdown-viewer-tauri/src-tauri/lib.rs` の `plantuml_runtime_directories`）は `CARGO_MANIFEST_DIR`（debug ビルド時、`src-tauri` 固定）、`std::env::current_dir()`、実行ファイル directory のみであり、各文書が指示する `cd markdown-viewer-tauri && npm run tauri dev` の実行時 cwd はリポジトリルートにならないため、リポジトリルートへの配置は Tauri 側では拾われない可能性が高い。`linux.md` の同節は「`markdown-viewer-tauri/src-tauri/`、current working directory、または Rust 実行ファイルの directory」とだけ記載しており、この点は正確に書き分けられている。

**差異**: Windows/macOS の記載は Avalonia と Tauri を区別せず「リポジトリルート」を共通の有効な配置先として提示しており、Tauri のみを使う利用者がリポジトリルートに jar を置いて動作しないケースを生みうる。ただし、この表現は今回の修正で新規に追加されたものというより、既に Approved 済みの `docs/setup/README.md` の PlantUML 節が持っていた同種の表現（「リポジトリルートに `plantuml.jar` を置く」という選択肢）を踏襲したものであり、実行時の cwd 挙動（特に `npm run tauri dev` 経由で起動する Rust プロセスの実際の cwd）は静的なコード確認だけでは断定できない部分もある。

**推奨対応**: `windows.md` / `macos.md` の PlantUML 節を、`linux.md` と同様に Avalonia 実行時のリポジトリルートと Tauri 実行時の runtime directory を書き分けるか、実際に `npm run tauri dev` 実行時の cwd を一度手動確認した上で表現を確定する。

**severity**: Low（ブロッキングではない。実行時 cwd の挙動確認が必要なため、次回の docs 更新または手動確認のタイミングでの見直しを推奨する）

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 実装での対応箇所 | 結果 |
| --- | --- | --- |
| Windows/macOS/Linux の前提ツール、clone、restore/install、build、実行手順が文書化される | `docs/setup/windows.md` / `macos.md` / `linux.md` の 1-4 節 | ✓ 整合。ただし PlantUML 手順への導線は 2.1 の通り不揃い |
| Avalonia/Tauri の publish 手順と OS・実装ごとの制約が文書化される | 各 OS 文書の 5 節、`docs/setup/README.md` 対応状況表、Avalonia README の Linux 非対応記載 | ✓ 整合。Linux での Avalonia publish を意図的に対象外としている点も、restore/build と実行の混同を避ける design 方針と一致する |
| ルート README から各実装と環境構築へ、各実装 README から環境構築・実行・publish へ遷移できる | `README.md`、両実装 README のリンク一式 | ✓ 整合。全相対リンクの実在をスクリプトで確認済み |
| リンクと既存の開発コマンドとの整合が確認される | `docs/rules/development_workflow.md` の `npm ci` 統一、`scripts/publish_apps_with_plantuml.sh` の個別 publish コマンドと `macos.md` の記載一致 | △ 概ね整合だが、1.1 のルート実行基準の矛盾が「コマンドとの整合」を部分的に損なっている |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| `docs/rules/development_workflow.md` の Tauri セットアップが `npm ci` に統一され、`npm install` は依存更新時限定という説明が追加されたことが、`docs/setup/README.md` / `windows.md` / `macos.md` / `linux.md` 全ての `npm ci` 記載と一致する（Phase 2 レビュー指摘 1.1 の反映） | ✓ 整合 |
| Avalonia README の Linux 要件が「WPE WebKit runtime libraries が必要」から「現構成の `NativeWebView` は非対応。restore/build は可能でもアプリ実行はサポート対象外」に置き換わり、`linux.md` の記載と矛盾しない（Phase 2 レビュー指摘 1.2 の反映） | ✓ 整合 |
| `scripts/publish_apps_with_plantuml.sh` が `ditto`（macOS 専用）を無条件に要求する実態と、`macos.md` が「このスクリプトは macOS 専用です」と明記し、`linux.md` が「macOS 専用の `scripts/publish_apps_with_plantuml.sh` は Linux では使用しません」と明記している内容が一致する | ✓ 整合 |
| `macos.md` の `--runtime osx-x64` 等のスクリプトオプション例が、`scripts/publish_apps_with_plantuml.sh` の実装（`--runtime` フラグ、既定値 `osx-arm64`）と一致する | ✓ 整合 |
| Markdown 相対リンク（ルート README、各実装 README、`docs/setup/*`、`docs/rules/project_overview.md`）が、見出しアンカーを含めすべて実在するファイル・見出しを指す | ✓ 整合（独自スクリプトで全リンクの実在を確認済み） |
| Tauri README に追記された「複数タブ、active tab の Reload、recent folders」「Mermaid / PlantUML fenced code block の描画」という機能記載が、実装（`RecentFolderEntry` / `record_recent_folder` in `lib.rs` と `App.tsx`、`PlantUmlRenderService` in Avalonia 側）に裏付けられている | ✓ 整合 |
| `git show --stat f3b38a1` の変更対象がすべて `.md` ファイルであり、ソースコード・project/manifest・スクリプトの変更を含まない（docs-only） | ✓ 整合 |
| `publish/` が `.gitignore` に既に登録されており、Windows 用の新しい出力パス `publish/avalonia/win-x64` を追加してもコミット対象外の運用が崩れない | ✓ 整合 |
| Windows 文書は PowerShell 記法（`Set-Location`、バッククォート行継続）、macOS/Linux 文書は bash 記法に統一されており、シェル記法の混在がない | ✓ 整合 |
| README 間の用語（Avalonia 版、Tauri 版、publish、bundle）が一貫している | ✓ 整合 |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 中 | 1.1 ルート README/setup README の「すべてルートで実行」矛盾 | 最も目立つ入口文書での自己矛盾であり、初回 clone 直後の利用者が最初に読む記述に影響する |
| 中 | 2.1 PlantUML 節の欠落と OS 文書間の参照不揃い | 承認済み design の統一構成から逸脱しており、逸脱の判断根拠も記録されていない |
| 低 | 2.2 impl.md の実行不能な検証コマンド行 | 監査証跡の体裁の問題であり、実際の確認内容自体は本レビューで裏付け済み |

---

## 7. 残リスク / Phase 4 での注意点

- 1.1 は文言修正のみで完結する規模であり、Phase 4 の文書最終確認前に対応すること。
- 2.1 は「各 OS 文書に PlantUML 節を追加する」か「集約判断を impl.md に明記する」のどちらでも解決できる。macOS/Linux 利用者が PlantUML 手順に到達できない現状のギャップは、対応方針を問わず解消すること。
- 2.2 は Phase 4 完了処理（`change_report.md` 作成）までに記録を整えれば問題ない。
- 本レビューでは相対リンクの実在確認、`npm ci`/Linux 非対応記載の Phase 2 指摘反映確認、publish スクリプトとの整合確認、docs-only 確認を実施済みであり、Phase 4 では TODO archive とルート README/各実装 README の索引反映（`docs/rules/project_overview.md` の「利用者向け入口」）が完了条件どおり機能していることを再確認すればよい。

---

## 8. 結論

実装は Phase 2 設計レビューの指摘 4 件（`npm ci`/`development_workflow.md` の同期、Avalonia README の Linux 記載訂正、`meta.md` の `setup_docs` コンポーネント追加、README 日本語化方針の明記）をすべて正しく反映しており、`scripts/publish_apps_with_plantuml.sh` の macOS 専用性、Avalonia の Linux 非対応と restore/build 可否の区別、Tauri の recent folders/複数タブ機能の記載も実装・実態と整合する。相対リンクはすべて実在するファイルと見出しを指しており、変更は `.md` のみで docs-only の要件も満たしている。

一方で、(1.1) ルート README と `docs/setup/README.md` の「すべてリポジトリルートで実行します」という記載が、直後に示す `cd markdown-viewer-tauri` を含むコマンド列と矛盾しており、design の確認観点「コマンドがリポジトリルート基準か、各サブディレクトリ基準か明示されていること」を満たせていない。(2.1) 承認済み design が定めた OS 別文書の統一構成（PlantUML を含む 9 ステップ）から、実装は独立した PlantUML 節を省略しており、この逸脱の判断根拠が `impl.md` に記録されていない上、OS 文書間で PlantUML への参照の有無が不揃いになっている。(2.2) `impl.md` の検証コマンド記録に実行不能な 1 行が混在している。

いずれも設計方針の転換を要する欠陥ではなく、文言修正・節追加・記録整備で解消できる規模のため、**条件付き承認**とする。Phase 4 の文書最終確認前に 1.1 を修正し、2.1 / 2.2 は Phase 4 完了処理までに解消すればよい。

初回レビューでは、Phase 4 着手前に 1.1 (ルート実行基準の矛盾) を修正することを必須条件、2.1 (PlantUML 節の欠落・参照不揃い) / 2.2 (impl.md の実行不能な検証コマンド行) を Phase 4 完了処理までの解消で可とする**条件付き承認**とした。

### 再確認結果 (2026-07-13, commit `4d0baa3`)

`README.md`、`docs/setup/{README,windows,macos,linux}.md`、`impl/cross_platform_setup_readmes_impl.md` を再確認した。

- **1.1 ルート実行基準の矛盾**: `README.md` が「セットアップ後の最小確認コマンドは次のとおりです。リポジトリルートから開始し、`cd` がある場合は移動後の directory で後続コマンドを実行します。」に、`docs/setup/README.md` が「次のコマンドは clone したリポジトリのルートから開始し、`cd` 後は `markdown-viewer-tauri/` で `npm ci` を実行します。」に修正された。いずれも直後のコマンド列（`cd markdown-viewer-tauri` を含む）と矛盾しない表現になり、`windows.md`/`macos.md`/`linux.md` の「明記がない限りリポジトリルートで実行します」という表現と整合する。✓ 反映確認。
- **2.1 PlantUML 節の欠落・参照不揃い**: `windows.md`・`macos.md`・`linux.md` の「4. 実行」と「5. publish / bundle」の間に、それぞれ独立した「PlantUML（任意）」節が追加され、`docs/setup/README.md#plantuml任意` への参照が 3 文書で揃った。`linux.md` は Tauri の runtime directory 探索順（`markdown-viewer-tauri/src-tauri/`、current working directory、Rust 実行ファイルの directory）を正確に反映している。✓ 反映確認（Windows/macOS の記載精度について 3.1 を新規記録、ブロッキングではない）。
- **2.2 impl.md の実行不能な検証コマンド行**: 「文書検証コマンド」の該当行が、相対リンクの実在確認を行う実行可能な Ruby one-liner に置き換えられた。本レビューで実際にこのコマンドをそのまま実行し、`relative links: OK (11 files)`（終了コード 0）を確認した。✓ 反映確認、かつ実行結果も妥当。

再確認の過程で、`windows.md`/`macos.md` の新設 PlantUML 節が Tauri の実行時ディレクトリ探索順と完全には一致しない可能性がある点を新たに把握したが（3.1、Low、非ブロッキング）、これは Approved 済みの `docs/setup/README.md` が元々持っていた表現を踏襲したものであり、実行時 cwd の確定には手動確認を要するため、今回の承認判定はブロックしない。

**判定**: **承認 (Approved)**。

- 初回レビューの必須指摘 1.1、および完了処理までの解消で可としていた 2.1 / 2.2 のいずれも反映され、未解決の必須指摘はゼロ。
- 3.1 は改善提案（Low、非ブロッキング）として記録し、次回の docs 更新または手動確認の機会に見直すことを推奨する。
- `meta.md` の `impl_status` を `done` に更新可能な状態 (現状 `draft`)。
- Phase 4 (文書最終確認、`change_report.md` 作成、TODO archive、history 反映) への進行を承認する。

未解決の必須指摘なし。本レビューでの承認をもって Phase 3 実装レビューを完了とする。
