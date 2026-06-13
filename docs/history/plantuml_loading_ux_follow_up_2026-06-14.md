# PlantUML Loading UX Follow-up 履歴

## 背景

PlantUML 表示対応の完了後、長めの描画待ち時間における UX の追補が
`TODO-2026-002` として起票された。特に、Tauri 側では pending placeholder が
最終 error と同じ見た目になっており、描画待ちと失敗の区別が付きにくかった。
また、Avalonia / Tauri の双方で busy 中に重複操作を許すと stale preview や
重複レンダリングを誘発しうるため、busy-state 制御の見直しが必要だった。

## 採用したアプローチ

- Avalonia は既存の `IsBusy` を唯一の制御点として、Toolbar と Explorer の
  `IsEnabled` を binding で抑止した。
- Avalonia の loading overlay は半透明化し、読み込み中であることを示しつつ
  プレビュー内容を完全には隠さないようにした。
- Tauri は `isMarkdownLoading || isPlantUmlRendering` を aggregate busy-state と
  して導入し、Open Folder / Theme / Reload / file selection を一時無効化した。
- Tauri の pending placeholder は `.plantuml-loading` を新設し、最終失敗だけが
  `.plantuml-error` を使うように分離した。
- Phase 4-a の user verification のため、`sample_docs/plantuml.md` に確実に
  syntax error となる PlantUML block を追加した。

## 結果

- Avalonia / Tauri の双方で busy 中の重複操作が抑止されるようになった。
- Tauri の pending / final error の視覚差が明確になった。
- component README / detail design に loading UX の仕様を反映した。
- User verification では、両 viewer で syntax error 表示が確認され、該当図だけが
  描画失敗になることを確認した。

## 参照

- Design analysis: `docs/design_analysis/new_feature/20260613_plantuml_loading_ux_follow_up/`
- Change report: `docs/design_analysis/new_feature/20260613_plantuml_loading_ux_follow_up/change_report.md`
- Branch: `feature/plantuml-loading-ux-follow-up`
- Main commits:
  - `efb13db` Implement PlantUML loading UX follow-up
  - `bdbaae2` Add combined Phase 2/3 review record
  - `01cdae2` Approve combined review and update meta
  - `97b24b3` Add syntax-error sample for Phase 4-a verification
