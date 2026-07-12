# Tauri Multi-tab core 導入 履歴

## 背景

UI / UX拡張WBSの`WP-003`として、Tauri版で同一root内の複数Markdownを切り替えながら参照できるmulti-tab coreを追加した。TODO-2026-003 / 004で整えたMenuBar、StatusBar、Recent Foldersを維持し、後続`TODO-2026-006 Tauri Split view`が再利用できる文書stateを作ることが目的だった。

## 採用したアプローチ

- 旧`selectedFilePath` / `selectedMarkdown`を残さず、`OpenDocumentTab[]`と`activeTabId`を文書stateの正本にした。
- Markdown本文、revision、loading/error、PlantUML結果をtab単位でcacheし、activateやtheme変更だけではPlantUMLを再実行しないようにした。
- async responseは`tabId + revision`でguardし、close済みtab、Reload前revision、旧rootの結果がactive previewを上書きしないようにした。
- Explorerとrelative Markdown linkをopen-or-activate経路へ統合し、同一pathのtab重複を防いだ。
- TabStripはhorizontal overflow、active/loading/error表示、独立close button、roving tabindex、ArrowLeft / ArrowRight / Home / Endを提供した。
- preview DOMはactive tab用の1つに限定し、pane固有anchor stateをApp直下に置いてsplit viewへの移行境界を保った。
- root scan成功をstate交換のcommit pointとし、scan失敗時は旧root / tabsを維持した。

## 結果

- 複数Markdownをtabとしてopenし、再読込なしで切り替えられるようになった。
- active / non-active / last tabのclose規則とkeyboard focus動作が確立した。
- active tabだけをReloadし、root変更時は旧tabを破棄して新rootのdefault Markdownをopenするようになった。
- relative Markdown linkは既存tabのactivateまたは新規tab openとanchor scrollを行うようになった。
- Mermaid / PlantUML / relative image / theme / Recent Foldersなど既存機能を維持した。
- component README / basic design / detail design / interface specをmulti-tab契約へ同期した。

## 参照

- Design analysis: `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/`
- Change report: `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/change_report.md`
- Branch: `new-feature/tauri-multi-tab-core`
- Main commits:
  - `19e2226` Phase 0 requirements
  - `2f37138` Phase 2 design complete
  - `e26c54d` Phase 3 implementation
  - `c4a6a09` Phase 3 review response
  - `65186a1` Phase 3 complete
  - `785dff8` Phase 4-a user verification complete
