# クロスプラットフォーム環境構築・README 整備 設計レビュー

**レビュー日**: 2026-07-13
**対象ドキュメント**: `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/design/cross_platform_setup_readmes_design.md`
**対象 meta**: `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-013
**初回レビュー対象コミット**: `7ff0ce2 docs: design cross-platform setup documentation`
**判定**: **条件付き承認 (Conditional Approval)**。Phase 3 進行可、ただし 1.1 / 1.2 を Phase 3 着手前に design へ反映すること。

---

## 概要

TODO-2026-013 (クロスプラットフォーム環境構築・README 整備) の Phase 2 設計レビュー。新規ルート README / `docs/setup/{README,windows,macos,linux}.md` と、Avalonia/Tauri 各実装 README・`docs/rules/project_overview.md` の更新方針を、`docs/rules/development_workflow.md`（project 固有コマンドの正本）、既存 Avalonia/Tauri README の現行記述、`scripts/publish_apps_with_plantuml.sh` の実際の OS 制約、`docs/rules/language_rules.md`、ADR 索引（該当 ADR なし）と突き合わせて検証した。

---

## 1. 齟齬・不整合

### 1.1 `npm ci` 方針が確認観点「development_workflow.md とコマンドが一致すること」と自己矛盾する

**ドキュメント記載**: 更新方針 5 (design 38 行) は「`package-lock.json` があるため Tauri 依存復元には再現性を優先して `npm ci` を使う。既存の `npm install` は依存更新時の用途として区別する」と明記する。一方、確認観点 (design 55 行) は「`docs/rules/development_workflow.md`、project/manifest、publish スクリプトとコマンドが一致すること」を確認項目としている。

`docs/rules/development_workflow.md` の現行セットアップ節（17-20 行）は次の通りで、`npm ci` の記載はない。

```bash
# Tauri
cd markdown-viewer-tauri
npm install
```

`development_workflow.md` は CLAUDE.md 2 節で必須参照、CLAUDE.md 3 節で「project 固有の実行・テスト・publish コマンドは `docs/rules/development_workflow.md` を正とする」と明記された文書である。design の対象文書一覧（7-17 行）にも非対象（19-24 行）にも `development_workflow.md` は含まれていない。

**差異**: このまま Phase 3 へ進むと、setup 文書側は `npm ci` を案内し `development_workflow.md` は `npm install` のまま残るため、design 自身の確認観点 55 行「development_workflow.md とコマンドが一致すること」を満たせない。逆に `development_workflow.md` に合わせて setup 文書を `npm install` のみにすると、方針 5 が意図する「clone 直後は再現性優先で `npm ci`」という区別が失われる。どちらの経路を選んでも design 内の記載同士が矛盾したまま Phase 3 に引き継がれる。

**推奨対応**: 対象文書一覧に「更新 `docs/rules/development_workflow.md`: Tauri セットアップ節に `npm ci`（再現性優先の初回復元）と `npm install`（依存更新時）の使い分けを追記する」を追加する。あるいは `development_workflow.md` を非対象のまま据え置くなら、確認観点 55 行を「development_workflow.md と矛盾しないこと（`npm ci`/`npm install` の使い分けが明記されていること）」のように、単純一致ではなく整合基準として明確化する。

**severity**: High

### 1.2 既存 Avalonia README の Linux 記述が新方針と矛盾したまま残るリスク

**ドキュメント記載**: 更新方針 7 (design 40 行) は「Avalonia 版は `NativeWebView` を使用しており、現構成の Linux 実行はサポート対象外であることを明記する」、確認観点 (design 57 行) は「Linux の Avalonia `NativeWebView` 制約を誤って『必要パッケージを入れれば実行可能』と案内しないこと」と明記する。

一方、現行 `Avalonia/MarkdownViewer.Avalonia/README.md` の Requirements 節は次の記載を含む。

```text
- Linux: WPE WebKit runtime libraries are required by `NativeWebView`
```

これは「必要なランタイムライブラリさえ入れれば `NativeWebView` は動く」という前提を読者に与える文である。design の対象文書一覧（14 行）における Avalonia README の更新指示は「日本語化し、環境構築、実行、publish への導線を追加」とだけ記載され、この既存 1 行を訂正する作業は明記されていない。「削除・統合・移動・archive」節（45-48 行）も「既存文書の削除・移動は行わない」「重複している簡易 Development/Run 記述の整理」に触れるのみで、Requirements 節のこの記述を書き換える対象としては読み取れない。

**差異**: 対象文書一覧の指示（日本語化・導線追加）だけを読んだ Phase 3 実装者は、この 1 行をそのまま翻訳して残す可能性が高い。その場合、design が確認観点で明示的に禁止している「必要パッケージを入れれば実行可能」という誤案内が、日本語版 README にそのまま（あるいは翻訳された形で）残存し、design 自身の確認観点 57 行を満たせなくなる。

**推奨対応**: 対象文書一覧の Avalonia README 項目に「既存 Requirements の Linux 記載（WPE WebKit runtime libraries を導入すれば実行できるという趣旨の文）を、現構成では `NativeWebView` の Linux 実行がサポート対象外である旨の記載に置き換える」を明記する。

**severity**: High

---

## 2. ドキュメント不足

### 2.1 `meta.md` の `components` が新設 `docs/setup/*` を明示していない

**該当箇所**: `meta.md` の `components`（`root_readme` / `avalonia_readme` / `tauri_readme` / `development_documentation`）は、対象文書一覧にある `docs/setup/README.md` と OS 別 3 ファイルを個別に列挙していない。`development_documentation` がこれらを指すのか、`docs/rules/project_overview.md` のみを指すのかが design 側から一意に読み取れない。

**推奨対応**: `components` に `setup_docs` 相当の項目を追加するか、design に「`development_documentation` は `docs/setup/*` と `docs/rules/project_overview.md` を指す」と一文明記する。

**severity**: Low

---

## 3. 改善提案

### 3.1 実装 README の日本語化方針と `language_rules.md` の適用範囲の関係が未記載

**該当箇所**: `docs/rules/language_rules.md` は「`docs/` 配下ドキュメント: 日本語」と明記しており、対象は `docs/` 配下に限定されている。`Avalonia/MarkdownViewer.Avalonia/README.md`、`markdown-viewer-tauri/README.md`、および新設予定のリポジトリ直下 `README.md` はいずれも `docs/` の外にあり、既存の 2 ファイルは現在英語である。design の更新方針 4（37 行）はこれらを日本語化する方針を採るが、これは `language_rules.md` が明文で規定する範囲を超えた判断であり、既存の英語 README という慣行からの変更でもある。

**推奨対応**: `language_rules.md` の明文には無い拡張判断であることを design に一文残す（例:「`docs/` 配下限定の言語ルールを、実装 README にも同様に適用する判断として本設計で明記する」）。矛盾ではないが、将来 `language_rules.md` を改定する際の参照点になる。

**severity**: Low

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| Windows/macOS/Linux の前提ツール、clone、restore/install、build、実行手順が文書化される | 「対象文書」「更新方針 3」(design 11-13, 36 行) | ✓ 整合 |
| Avalonia/Tauri の publish 手順と OS・実装ごとの制約が文書化される | 「更新方針 6, 7」(design 39-40 行) | ✓ 整合。macOS 専用統合スクリプトと OS 別標準 CLI publish の区別、Linux 実行非対応の明記が既に方針化されている |
| ルート README から各実装と環境構築へ、各実装 README から環境構築・実行・publish へ遷移できる | 「対象文書」「更新方針 1, 4」(design 9, 34, 37 行) | ✓ 整合 |
| リンクと既存の開発コマンドとの整合が確認される | 「確認観点」(design 52-59 行) | △ 確認観点自体は妥当だが、55 行「development_workflow.md とコマンドが一致すること」が 1.1 の `npm ci` 方針と自己矛盾するため、現状の記載のままでは条件を満たせない |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| Avalonia の Linux 実行非対応と restore/build 可否を混同しない方針（design 40 行）が、現行 Avalonia README の `.NET SDK 10.0+` / WebView2 記載と矛盾しない | ✓ 整合 |
| `scripts/publish_apps_with_plantuml.sh` が `ditto`（macOS 専用コマンド）を無条件に要求し、Avalonia/Tauri いずれの publish でも macOS 上でのみ動作することを実機のスクリプトで確認した。design 39 行の「macOS 専用の統合スクリプトと OS 別標準 CLI publish を区別する」という前提は実態と一致する | ✓ 整合 |
| `docs/rules/development_workflow.md` の `.NET SDK: 10.0+` と、既存 Avalonia README の `.NET SDK 10.0 or newer` が一致する | ✓ 整合 |
| PlantUML jar 非コミット運用（design 41 行）が `development_workflow.md` の既存運用と一致する | ✓ 整合 |
| 関連 ADR は現時点で 0 件（`docs/adr/README.md` 一覧が空）であり、本設計が既存 ADR と矛盾する余地はない | ✓ 該当なし |
| 非対象（ソースコード/project/manifest/設定/スクリプトの変更をしない、design 21 行）が、対象文書一覧に実装コードや `.csproj`/`package.json` 等が含まれていないことと一致する | ✓ 整合 |
| Windows PowerShell と macOS/Linux shell の記法混在を避ける方針（design 56 行）と、コマンドがリポジトリルート基準かサブディレクトリ基準かを明示する方針（design 54 行）が、`development_workflow.md` の既存コマンド表記（相対 path 指定と `cd` の使い分け）と矛盾しない | ✓ 整合 |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 高 | 1.1 `npm ci`/development_workflow.md 不一致 | 設計内の方針と確認観点が自己矛盾しており、Phase 3 でどちらの基準に従うべきか判断できない |
| 高 | 1.2 Avalonia README の Linux 記述の訂正漏れ | 対応しないまま日本語化すると、design 自身が禁止する「必要パッケージを入れれば実行可能」という誤案内が実文書に残る |
| 低 | 2.1 `meta.md` components の粒度 | 追跡性の問題であり、文書内容そのものへの影響は小さい |
| 低 | 3.1 README 日本語化と language_rules.md 適用範囲 | 矛盾ではないが、既存ルール文書の明文を超える判断の根拠付けが望ましい |

---

## 7. 残リスク / Phase 3 での注意点

- 1.1 は `development_workflow.md` を対象文書に追加するだけで解決できる規模だが、Phase 3 着手前に方針を確定させないと、setup 文書と `development_workflow.md` のどちらが正なのかが実装中に揺れる。
- 1.2 は Avalonia README の該当 1 行を具体的にどう書き換えるか（「Linux では NativeWebView 実行は現構成でサポート対象外」等）を Phase 3 の impl で明文化し、確認観点 57 行の検証時に該当行が残っていないか grep で確認すること。
- 2.1 / 3.1 は Phase 3 の docs 反映時に一文追記すれば解消できる規模であり、Phase 3 着手を妨げない。
- 確認観点自体（相対リンク実在性、双方向導線、コマンド基準の明示、生成物非コミット、用語統一）は妥当であり、Phase 3 完了時に改めてこれらを再チェックすること。

---

## 8. 結論

設計は TODO-2026-013 の完了条件（OS 別環境構築手順の文書化、publish 手順と制約の文書化、README 間導線、既存コマンドとの整合確認）を概ね反映しており、ルート README を薄い入口にし詳細を `docs/setup/*` に集約する構成、Avalonia の Linux 実行非対応と restore/build 可否を混同しない方針、publish スクリプトの macOS 専用性を正しく踏まえた OS 別 publish の区別は、いずれも実態（`scripts/publish_apps_with_plantuml.sh` の `ditto` 依存、既存 README の SDK バージョン記載）と整合する。

一方で、(1.1) `npm ci` を推す更新方針が「development_workflow.md とコマンドが一致すること」という自らの確認観点と自己矛盾しており、development_workflow.md 自体が対象文書に含まれていない点、(2.2) 既存 Avalonia README の「WPE WebKit を入れれば実行できる」という趣旨の Linux 記載を訂正する作業が対象文書一覧に明記されておらず、日本語化だけでは design 自身が禁止する誤案内が残存しかねない点の 2 点は、いずれも Phase 3 完了後に受け入れ条件「リンクと既存の開発コマンドとの整合が確認される」「Linux の制約が正しく文書化される」を壊しうる。これらは設計方針自体の転換ではなく、対象文書一覧への追記・既存記述の訂正方針の明記で解消できる規模のため、**条件付き承認**とする。Phase 3 着手前に 1.1 / 1.2 を design へ反映し、2.1 / 3.1 は Phase 3 の docs 反映時に併せて解消すればよい。

未解決指摘: 1.1（development_workflow.md との npm ci/npm install 不一致）、1.2（Avalonia README Linux 記述の訂正漏れ）の 2 件。この 2 件を design へ反映した上で、再度レビュー担当 Agent に指摘対応確認を依頼すること。
