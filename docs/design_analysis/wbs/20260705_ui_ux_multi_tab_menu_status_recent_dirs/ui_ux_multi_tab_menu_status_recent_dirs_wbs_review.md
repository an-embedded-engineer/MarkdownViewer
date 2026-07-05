# レビュー: UI/UX改善 WBS

- レビュー対象: `meta.md`, `wbs.md`, `report.md`, `docs/todo/todo.md`（`TODO-2026-003` 〜 `TODO-2026-012`）
- 対象コミット: `8cd0e16`
- レビュー日: 2026-07-05
- レビュー担当: Claude Sonnet 5

---

## 総評

WBS は `wbs-planning-workflow` の必須チェック（背景/目的/完了条件/非対象の固定、`meta.md`/`wbs.md`/`report.md` の作成、`WP-001`〜`WP-010` の ID 付与、各 work package への推奨 workflow/依存/目的/完了条件/変更対象/docs 更新先/検証観点の記録、実行順序と todo 引き継ぎの明記）をすべて満たしている。`docs/todo/todo.md` の `TODO-2026-003`〜`TODO-2026-012` と `wbs.md` の `WP-001`〜`WP-010` は依存順序・workflow 種別・完了条件が一致しており、矛盾は見つからなかった。承認済み調査レポート（Round 2 承認済み）の `rootPath` スコープ限定、Explorer クリック挙動（同一 path なら activate）などの決定事項も `wbs.md` に正しく引き継がれている。Tauri 先行・Avalonia 後追いの方針も、調査レポートが指摘した `NativeWebView` 変更コストの非対称性を根拠にしており妥当である。

一方、`WP-002`〜`004` および `WP-007`〜`009` の `recommended_workflow` が一律 `spec-change` になっている点は、これらが既存機能の仕様変更ではなく新規ユーザ価値の追加である以上、プロジェクトの過去実績（`todo_archive_2026.md` の `PlantUML Rendering Support` は `new-feature` 分類）や `new-feature-workflow` の選定基準と整合しない可能性がある。また `WP-003`（Tauri Multi-tab core）は移行対象 state と検証項目が他 work package より明らかに多く、1 回の通常 workflow で完了しきれるかやや不安が残る。これらは `TODO-2026-003`（`WP-001`）を通常 workflow へ引き継ぐこと自体を妨げるものではないが、`WP-002` 以降へ進む前に解消しておくことを推奨する。

---

## 指摘一覧

### 重大度: 中

#### 指摘 1: `WP-002`〜`004`, `WP-007`〜`009` の `recommended_workflow` 分類が疑わしい

| 項目 | 内容 |
| --- | --- |
| 対象箇所 | `wbs.md` §「Work Package 一覧」の `WP-002`〜`WP-004`, `WP-007`〜`WP-009` の `recommended_workflow` 列 |
| 理由 | `spec-change-workflow` の「いつ使う」は「既存機能の振る舞い・仕様・UI 契約を変更する時」、`new-feature-workflow` は「新しい機能やユーザ価値を追加する時」である。最近開いたディレクトリ、複数タブ、split view は現行実装に存在しない新規capabilityであり、後者に該当する可能性が高い。実際、`docs/todo/todo_archive_2026.md` では同様に「既存にない新機能」だった `PlantUML Rendering Support` を `new-feature` 分類にしている。さらに `new-feature-workflow` Phase 2 の必須要素（最小提供範囲・非対象・統合点・拡張性）は、`WP-003`/`WP-004` の `deferred_or_follow_up` 欄（タブ overflow は最小仕様でよい、3 ペイン以上は後続へ送る、等）とほぼそのまま対応しており、構造的にも `new-feature-workflow` の方が適合度が高い。`WP-001`/`WP-006`（既存 Toolbar の再配置）は既存 UI 契約の変更なので `spec-change` のままで妥当である。 |
| 推奨対応 | `WP-002`〜`004`, `WP-007`〜`009` を `new-feature-workflow` に変更するか、`spec-change` を維持するならその判断根拠（例: 「既存の単一ファイル表示という契約の delta として扱う」等）を `wbs.md` に一文追記する。`docs/todo/todo.md` の該当 `workflow:` フィールドも同期する。 |

### 重大度: 低〜中

#### 指摘 2: `WP-003`（Tauri Multi-tab core）の粒度がやや大きい

| 項目 | 内容 |
| --- | --- |
| 対象箇所 | `wbs.md` §「Work Package 一覧」の `WP-003` 行、`report.md` §「分解結果の要約」 |
| 理由 | 調査レポートは `selectedFilePath` / `selectedMarkdown` / `previewRevision` / `pendingAnchor` / `plantUmlRenderState` / `previewRef` の 6 つの単一ファイル前提 state を tab 単位へ移行する必要があると指摘している。`WP-003` の完了条件・検証観点はこれをすべて 1 work package（かつ `WP-004` の土台）に含めており、検証項目数（6 項目の手動確認）も他 work package より多い。1 回の通常 workflow（`spec-change` または `new-feature`）で確実に完了できるかは設計 Phase で見積もってみないと分からない。 |
| 推奨対応 | `wbs.md` の `WP-003` の `deferred_or_follow_up` に、「設計 Phase で見積もりが工数超過する場合は、タブ切替/close/reload/theme までを完了条件とし、Markdown 内リンクのタブ挙動や overflow 表示は `TODO-2026-005` から分離した follow-up todo へ送る」旨の縮小条件を明記しておく。 |

### 重大度: 低

#### 指摘 3: 調査レポートの承認済み具体内容への参照が `wbs.md` / `todo.md` から直接たどれない

| 項目 | 内容 |
| --- | --- |
| 対象箇所 | `wbs.md` の `WP-001` 行、`docs/todo/todo.md` の `TODO-2026-003` |
| 理由 | 調査レポート（Round 2 承認済み）には File/View/Help のメニュー構成案、`Recent Folders` の追加タイミング、英語 UI 文字列ルールなど具体的な確定事項がある。`wbs.md`/`todo.md` の `WP-001`/`TODO-2026-003` はこれらを再掲せず、`meta.md` の `source_refs` のみが調査レポートを参照している。`TODO-2026-003` から着手する実装者が `todo.md` → `wbs.md` だけを読み `meta.md` を読み飛ばすと、承認済みメニュー構成を再設計してしまうリスクがある。 |
| 推奨対応 | `TODO-2026-003`（および他の TODO）に `source_report: docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md` のような参照行を追加するか、`wbs.md` 冒頭に調査レポートへの明示リンクを追加する。 |

#### 指摘 4: ADR 候補 4 件がどの work package の `docs_targets` にも現れない

| 項目 | 内容 |
| --- | --- |
| 対象箇所 | `report.md` §「ADR 候補」、`wbs.md` §「Work Package 一覧」の全行 |
| 理由 | `report.md` は 4 件の ADR 候補（アプリ内 MenuBar 採用、タブの root 限定、Tauri 先行段階導入、Recent Directory の app config JSON 保存）を挙げているが、`docs/adr/README.md` の起票条件は「既に採用済みである」ことを要求するため、計画段階の WBS では ADR 追加不要という判断自体は正しい。ただし、実装完了後にどの work package で ADR 化を検討するかが `wbs.md` のどこにも書かれていない。 |
| 推奨対応 | `WP-005` または `WP-010`（最終同期系 work package）の `verification_points` か `docs_targets` に「ADR 候補の起票要否を確認する」旨を一文追加する。 |

---

## 未解決事項

| 項目 | 状態 | 備考 |
| --- | --- | --- |
| `WP-002`〜`004`, `WP-007`〜`009` の workflow 分類 | 要確認 | 指摘 #1 参照。`WP-002` 着手前に確定させることを推奨。 |
| `WP-003` の粒度リスク | 要監視 | 指摘 #2 参照。設計 Phase 見積もり時に縮小条件を適用できるようにしておく。 |
| 調査レポート具体内容への参照経路 | 軽微 | 指摘 #3 参照。`WP-001` 着手前に追記しておくと手戻りを防げる。 |
| ADR 化タイミング | 軽微 | 指摘 #4 参照。`WP-005`/`WP-010` の段階で確認すれば十分。 |

---

## 承認可否

**条件付き承認**

`TODO-2026-003`（`WP-001`: Tauri MenuBar / StatusBar 導入）は `spec-change-workflow` への引き継ぎを承認する。分類・粒度・参照経路のいずれにも `WP-001` を妨げる問題はない。

ただし、`WP-002` 以降を通常 workflow へ引き継ぐ前に、以下を `wbs.md` / `docs/todo/todo.md` へ反映することを承認条件とする。

1. **指摘 #1**: `WP-002`〜`004`, `WP-007`〜`009` の `recommended_workflow` を確定させる（`new-feature-workflow` へ変更、または `spec-change` を維持する根拠を明記）。
2. **指摘 #2**: `WP-003` に、設計 Phase で工数超過した場合の完了条件縮小方針を追記する。

指摘 #3・#4 は軽微であり、`WP-001` 実施と並行して、または次回の `wbs.md` 更新時に反映すれば承認条件としない。

---

## Round 2: 指摘対応確認 (対応コミット: 769ceaf)

- レビュー日: 2026-07-05
- レビュー担当: Claude Sonnet 5

### 確認結果

| 指摘 | 重大度 | 対応状況 | 確認内容 |
| --- | --- | --- | --- |
| #1 `WP-002`〜`004`, `WP-007`〜`009` の workflow 分類 | 中 | 解消 | `wbs.md` の該当 6 行の `recommended_workflow` が `spec-change` から `new-feature` に変更され、`docs/todo/todo.md` の `TODO-2026-004`〜`TODO-2026-006`, `TODO-2026-009`〜`TODO-2026-011` の `workflow:` フィールドも同じく `new-feature` へ同期済み。`WP-001`/`WP-006`（既存 Toolbar 再配置）は `spec-change` のまま維持されており、区別の妥当性も保たれている。 |
| #2 `WP-003` の粒度縮小条件 | 低〜中 | 解消 | `wbs.md` `WP-003` 行の `deferred_or_follow_up` に「設計 Phase で工数超過と判断した場合は、タブ切替 / close / Reload / theme までを完了条件に縮小し、Markdown 内リンクのタブ挙動や overflow 表示は follow-up todo へ分離する」を追記済み。縮小時の最小完了ラインと分離先（follow-up todo）が明確になっている。 |
| #3 調査レポートへの直接参照 | 低 | 解消 | `wbs.md` 冒頭に `## Source References` を新設し、調査レポート・調査レビュー・WBS レビュー自身への直接リンクを追加済み。`todo.md` の各エントリは既存の `wbs:` リンク経由でこのセクションに到達できるため、todo → wbs → report の参照経路が確立された。 |
| #4 ADR 候補の起票タイミング | 低 | 解消 | `WP-005` の `verification_points` に「ADR 候補の起票要否確認」を追加し、`WP-010` の `docs_targets` に「必要に応じて `docs/adr/*`」、`verification_points` にも同じく「ADR 候補の起票要否確認」を追加済み。実装完了後の 2 段階（Tauri 確定時・両実装最終同期時）で確認する導線ができている。 |

### 残課題（軽微・非ブロッキング）

- `meta.md` の `related_commits` が `5439a1a` のままで、レビュー対応コミット（`8cd0e16`, `769ceaf` 等）が未反映。次回 `meta.md` 更新時に追記すれば十分で、承認条件とはしない。

### 承認可否

**承認**

承認条件だった指摘 #1・#2 がすべて解消され、軽微指摘の #3・#4 も反映済みである。`wbs.md` と `docs/todo/todo.md` の間に新たな矛盾は確認されなかった。

本 WBS（`meta.md`, `wbs.md`, `report.md`, および `docs/todo/todo.md` の `TODO-2026-003`〜`TODO-2026-012`）は、`WP-001` から順に計画済みの各 workflow（`spec-change-workflow` / `new-feature-workflow` / `documentation-workflow`）への引き継ぎを承認する。
