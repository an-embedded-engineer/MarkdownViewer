# PlantUML 表示対応履歴

## 背景

Markdown Viewer は Mermaid 表示に対応していたが、設計ドキュメントで利用される PlantUML fenced code block はコードブロックのまま表示されていた。Avalonia 版と Tauri 版の比較実装で同じ Markdown を確認できるようにするため、ローカル Java / `plantuml.jar` を使った PlantUML 表示を追加した。

## 採用したアプローチ

- Java runtime と `plantuml.jar` は同梱せず、runtime directory または `plantuml.config.json` で参照する。
- Avalonia 版は C# service (`PlantUmlRuntimeResolver` / `PlantUmlRenderService`) と `MarkdownRenderService` の非同期変換で統合する。
- Tauri 版は React が PlantUML fence を抽出し、Rust command `render_plantuml_diagrams` が host 側で PlantUML CLI を実行する。
- PlantUML 出力 SVG は DOM へ入れる前に `<script>` と `on*` event handler 属性を除去する。
- Mermaid と PlantUML が同居する Markdown では、PlantUML 結果反映後にも Mermaid を再描画する。
- PlantUML 描画には Java process 起動が伴うため、Avalonia / Tauri 双方に読み込み中表示を追加した。

## 結果

- `plantuml` / `puml` fenced code block が Avalonia / Tauri 双方でインライン SVG 表示されるようになった。
- `sample_docs/plantuml.md` で Mermaid / PlantUML / puml の同居確認ができるようになった。
- `docs/rules/development_workflow.md` と component docs に runtime 配置、検証観点、既知制約を記録した。
- `plantuml.jar` と publish 生成物はコミット対象に含めない運用を `.gitignore` とドキュメントに反映した。

## 参照

- Design analysis: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/`
- Change report: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/change_report.md`
- Branch: `feature/plantuml-rendering-support`
- Main commits:
  - `7c4acc6` Implement PlantUML rendering support
  - `632019e` Address PlantUML implementation review feedback
  - `cf18d24` Add PlantUML rendering loading indicators
  - `6c0ff27` Refine PlantUML loading feedback
  - `1bf3e04` Approve PlantUML loading feedback (Phase 4-a)
