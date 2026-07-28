# TODO-2026-023 Tauri pane-local tab group / pane 間移動 実装記録

## 1. 実装概要

承認済み設計 `8ecbe5a` に従い、global `OpenDocumentTab[]` をdocument dataの正本として維持したまま、primary / secondaryそれぞれへpane-localなordered tab ID groupを導入した。Explorer / relative link open、activate、local close、split off / on、pane間moveを`splitView.ts`のtyped reducerへ集約し、Appはgroup IDをglobal dataへ解決するintegration ownerだけを担う。

実装はTauri frontendと恒久ドキュメントに限定し、Rust command、custom protocol、capability、CSP、settings schemaは変更していない。

## 2. 設計と実装の対応

| 設計項目 | 実装 |
| --- | --- |
| global data + pane-local ordered references | `PaneState.orderedTabIds`を追加し、`resolveGroupTabs<T>`でAppの`useMemo`からprimary / secondary viewを各1回解決 |
| group invariant | reducer入出力でduplicate ID、active membership、nonempty / active、pending / active、single active pane、ratioを検証。不整合はthrow |
| active pane open | `open-tab`がlocal末尾へのdedupe add、selection、optional anchor、active pane更新を一括処理 |
| local close / eviction | `close-pane-tab`がsourceだけを更新し、Appが次stateの`getReferencedTabIds`から最後の参照だけをglobal dataから削除 |
| atomic move | `move-tab`がsource removal / 右→左→null fallbackとdestination dedupe add / selectを1 actionで更新し、Appがcommit後にdestination tabへfocus |
| split保持 | `enable-split` / `disable-split`からglobal ID payloadを廃止し、両groupの順序・active tabを保持。disable時はsecondary pendingだけclear |
| runtime stale判定 | handlerの直接`PanePreviewStatus` clearを全廃し、`isPanePreviewStatusCurrent`を使うgeneric effectへ一本化 |
| hidden secondary回復 | singleでprimary empty / secondary nonemptyの場合、hidden件数と`Enable Split View`案内を`role="status"`で表示 |
| accessibility / focus | split時move button、pane名込みmove / close accessible name、active tabだけのTab順、destination focus、欠落時pane focus + console error |
| visual | split時tab itemをactivate / move / closeの3列・minimum 160px、single時は既存2列、horizontal overflow維持 |

設計からの仕様差分はない。focus target欠落時だけ設計どおりdata transitionをrollbackせず、destination paneへfocusしてdevelopment consoleへintegration errorを記録する。

## 3. 状態・action・UI一覧

### 状態

- `PaneState.orderedTabIds: string[]`
- `PaneState.activeTabId: string | null`
- `PaneState.pendingNavigation: PendingPaneNavigation | null`
- global `OpenDocumentTab[]`、pane-local `PanePreviewStatus`、image viewer identityは既存責務を維持

### typed action

- `open-tab`
- `select-tab`
- `activate-pane`
- `enable-split`
- `disable-split`
- `close-pane-tab`
- `move-tab`
- `reset-root`
- `consume-navigation`
- `set-requested-ratio`

### UI

- primary tab: `→` move button
- secondary tab: `←` move button
- pane-local close button
- primary empty / hidden secondary recovery message
- split tab minimum width 160px

## 4. テスト更新

### `splitView.test.ts`

- empty initial state、primary open、same-group dedupe、同一IDの両group参照
- member select、pending clear、invalid secondary / nonmember拒否
- active / non-active local close、右→左→empty fallback、reference set
- active / non-active / last source move、destination existing dedupe、pending規則、invalid move拒否
- split off / on group保持、root reset、navigation consume
- duplicate / active membership / nonempty-active / pending invariant拒否
- generic resolverのlocal順とmissing ID throw
- 既存split width / ratio / keyboard policy回帰

### `paneRuntime.test.ts`

- move後のsource result拒否 / destination result受理
- single中のretained secondary result拒否、再split後のrevision guard
- same document両groupのpane-local error分離
- shared loading / rendering / error precedence回帰

## 5. 恒久ドキュメント反映

- `README.md`、`markdown-viewer-tauri/README.md`: 機能概要、open / local close / move手順、keyboard、split保持、hidden secondary回復
- `docs/rules/project_overview.md`: global data + pane-local groupの正本
- `docs/architecture/overview.md`: open / local close / last-reference eviction / atomic move flow
- `docs/architecture/code_patterns.md`: ordered reference group、resolver throw、typed move、generic runtime clear
- `docs/architecture/common_pitfalls.md`: global close、silent filter、implicit merge、duplicate clear、focus / stale result
- `docs/components/tauri_viewer/README.md`: module責務とsource参照
- `docs/components/tauri_viewer/basic_design.md`: data modelとinvariant
- `docs/components/tauri_viewer/detail_design.md`: App / reducer / DocumentPane / TabStripの実装契約
- `docs/components/tauri_viewer/interface_spec.md`: pane-local open / close / move / split off-on / accessibility
- `docs/rules/development_workflow.md`: 旧global TabStripの手動合否基準を新仕様へ置換
- `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md`: TODO-2026-006 baselineとTauri現行pane-local semanticsの差、およびAvalonia導入時の再評価条件を注記

## 6. 自動検証結果

実施日: 2026-07-28

| コマンド | 結果 |
| --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | 成功。5 files / 77 tests passed |
| `cd markdown-viewer-tauri && npm run build` | 成功。TypeScript compile / Vite production build完了。既知のchunk size warningのみ |
| `cd markdown-viewer-tauri/src-tauri && cargo fmt -- --check` | 成功 |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | 成功 |
| `cd markdown-viewer-tauri/src-tauri && cargo test` | 成功。22 tests passed、0 failed |
| `git diff --check` | 成功 |

UIの実機確認はPhase 4-aでユーザが実施する。確認項目は`docs/rules/development_workflow.md`のTauri手動確認と設計書§17を正とする。

## 7. 実装レビュー対応

Claude実装レビュー `cb10f6d` はblocking 0件で承認し、非ブロッキングのMedium 1件 / Low 2件を検出した。Phase 3内で全件へ対応した。

| 指摘 | 対応 |
| --- | --- |
| `interface_spec.md`に旧global表示順の記述が残る | 表示単位をpane-local group、data一意性をglobal pathとして粒度を分けて記述 |
| Avalonia rollout specに旧split継承規則だけが残る | TODO-2026-006 baselineであること、TauriはTODO-2026-023で置換済みであること、Avalonia導入時の再評価条件を注記 |
| `loadRoot`の更新順がReact batchingへ依存する | `reset-root`でgroupを先にclearし、その後global tabsをclearする順へ変更。全中間状態で`group ⊆ global tabs`を維持 |

対応後も仕様差分はなく、root scan成功後のcommit pointと既存の表示挙動を維持する。

## 8. 既知制約

- drag and drop、group内reorder、pin、複数選択、一括move / closeは対象外。
- 上下split、3 pane以上、split treeは対象外。
- group、tab順、active tab、split layoutは再起動後に永続化しない。
- Avalonia版へは適用しない。
- Rust / trusted HTML security boundaryは変更していない。
