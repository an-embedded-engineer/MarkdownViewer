# Tauri Split view 導入 変更レポート

## 対象

- TODO: `TODO-2026-006 Tauri Split view 導入`
- Branch: `new-feature/tauri-split-view`
- Base branch: `main`
- Base commit: `c023374eb223651e4434fbcbcb2979ab9c82b648`
- Report commit range: `c023374..f8f6136`
- 作成日: 2026-07-26

workflow規定の`git merge-base master HEAD`は、このrepositoryに`master`が存在しないため実行できなかった。既定branchの`main`を用いて`git merge-base main HEAD`を実行し、上記base commitを取得した。

## 変更概要

Tauri版Markdown Viewerへ、single viewと左右2pane Split Viewを切り替えて同一root内の2文書を同時参照する機能を追加した。

- `View > Split View`からsingle / splitを切り替える。
- primary / secondaryごとにactive tab、pending navigation、preview runtime、DOM refを分離する。
- Explorer、TabStrip、Reload、relative Markdown link、StatusBar / ErrorBannerをactive paneまたは発生元paneへroutingする。
- Markdown、Mermaid、PlantUML、trusted HTML、image viewerをpane / tab / revisionでguardする。
- pointer / keyboard対応のsplit separator、active pane表示、pane-scoped DOM ID / IDREFを提供する。

## 実装

- `markdown-viewer-tauri/src/splitView.ts`
  - single / split、pane selection、close / root fallback、pending navigation、split ratioとwidth policyをpure transitionとして実装した。
- `markdown-viewer-tauri/src/paneRuntime.ts`
  - pane選択とtab revisionの独立判定、stale result guard、shared tab stateとpane-local preview stateの合成を実装した。
- `markdown-viewer-tauri/src/App.tsx`
  - single / split共通の`DocumentPane`、pane-aware routing、App所有Mermaid queue、pane別HTML handshake、image viewer lifecycleを実装した。
- `markdown-viewer-tauri/src/App.css`
  - preview grid、active pane、split separator、resize中のcursor / selection抑止を追加した。
- `splitView.test.ts` / `paneRuntime.test.ts`
  - transition、fallback、狭幅、keyboard、pane / tab / revision guard、表示state非混線を検証した。

Rust command、custom protocol、Tauri capability、CSP、settings schemaは変更していない。

## ドキュメント

- root / Tauri README
- `docs/rules/project_overview.md`
- `docs/architecture/overview.md` / `code_patterns.md` / `common_pitfalls.md`
- `docs/components/tauri_viewer/README.md` / `basic_design.md` / `detail_design.md` / `interface_spec.md`
- `docs/rules/development_workflow.md`

上記をSplit Viewの利用方法、state / runtime境界、security、accessibility、手動確認項目へ同期した。

## レビュー

- Phase 2 design review:
  - 初回9件（Medium 3 / Low 6）を指摘し、split off fallback、TabStrip state合成、pure guard、DOM ID、HTML activation、Mermaid ID、width境界を反映した。
  - follow-up review `68f1fa5`でApproved、未解決0件となった。
- Phase 3 implementation review:
  - 初回4件（Medium 1 / Low 3）を指摘し、preview focus登録、pane status clear、極小幅ratio、HTML bridge判定分離を修正した。
  - follow-up review `7eb32ea`でApproved、未解決0件となった。

## Phase 4-a ユーザー確認

ユーザーが起動したTauri版で次を確認し、本workflowの提供範囲をOKと判断した。

- `View > Split View`で画面分割を切り替えられる。
- primary / secondaryそれぞれでtabを開き、異なるfileを同時にpreviewできる。

## 検証結果

- `npm test -- --run`: 成功。5 files / 71 tests、0 failures。
- `npm run build`: 成功。既知のVite chunk size warningのみ。
- `cargo fmt -- --check`: 成功。
- `cargo check`: 成功。
- `cargo test`: 成功。22 tests、0 failures。
- `git diff --check c023374..f8f6136`: 成功。
- Claude design / implementation follow-up review: Approved、未解決0件。

## 生成物

- `diff.zip`
  - `git diff --binary --full-index c023374..f8f6136`で単一patchを生成し、zip化した。
  - 16コミット、30変更file、3,372 insertions / 273 deletionsを収録した。
  - `unzip -t`で整合確認済み。

## 既知制約 / Follow-up

- 現行はglobalなopen tab collectionを両TabStripへ表示し、paneごとに選択だけを分離する。pane-local tab groupは`TODO-2026-023`で扱う。
- pane間tab移動は`TODO-2026-024`、上下2pane splitは`TODO-2026-025`で扱う。
- 3pane以上、入れ子split tree、layout永続化、tab reorder / pin、編集・未保存stateは対象外である。
- Avalonia版は`TODO-2026-011`、Tauri先行UX評価と共通仕様化は`TODO-2026-007`で扱う。

## Phase 4-c

ユーザーの最終承認後、`new-feature/tauri-split-view`を`main`へ`--no-ff`でマージした。merge commitは`834cc75`。
