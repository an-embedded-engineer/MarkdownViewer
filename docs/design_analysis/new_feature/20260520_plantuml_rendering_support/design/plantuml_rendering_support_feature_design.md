# PlantUML Rendering Support Feature Design

## Background, Requirements, and Completion Criteria

MarkdownViewer already renders Markdown and Mermaid diagrams in both implementations. Project design documents may also contain `plantuml` fenced code blocks, but those blocks currently remain plain code and cannot be inspected as diagrams from the viewer.

The feature adds local PlantUML rendering to both viewers while keeping `plantuml.jar` outside the repository. Java is already available in the current development environment (`openjdk 24.0.2`). `plantuml.jar` must be supplied by the user or local environment.

Completion criteria:

- ` ```plantuml ` fenced code blocks render inline in Avalonia preview.
- ` ```plantuml ` fenced code blocks render inline in Tauri preview.
- `plantuml.jar` is not committed to the repository.
- A missing Java runtime, missing jar, or PlantUML syntax error is shown as an actionable preview or status error.
- Existing Markdown, Mermaid, local image, link navigation, reload, and theme switching behavior continues to work.
- Required validation commands from `docs/rules/development_workflow.md` complete.

## Target Scope and Non-Scope

In scope:

- Render Markdown fenced code blocks whose language is `plantuml` or `puml`.
- Use local Java and a local `plantuml.jar`.
- Generate SVG using the PlantUML command line.
- Add a deterministic runtime resolver for `plantuml.jar`.
- Add permanent setup, usage, and limitation documentation.
- Add sample Markdown content for manual verification.

Out of scope:

- Bundling Java.
- Committing `plantuml.jar`.
- Calling a network PlantUML server.
- Building a PlantUML editor.
- Supporting non-SVG PlantUML outputs in the viewer.
- Adding a settings UI in this feature.

## Adopted Approach

PlantUML diagrams are rendered by host-side services:

- Avalonia: C# service executes `java -jar <plantuml.jar> -tsvg -pipe`.
- Tauri: Rust command executes `java -jar <plantuml.jar> -tsvg -pipe`.
- The Markdown layer converts each `plantuml` / `puml` fence into a placeholder.
- The host renderer replaces placeholders with SVG HTML or an inline error block before the final preview is displayed.

The official PlantUML command line supports SVG output and standard input / output processing with `-pipe`, which avoids temporary diagram output files. References:

- https://plantuml.com/command-line
- https://plantuml.com/svg

## Rejected Approaches

### PlantUML Server

Rejected because this viewer is intended to work for local project documents without introducing a network dependency or sending local design content to another process outside the machine.

### Commit `plantuml.jar`

Rejected because the jar is a third-party binary and should be managed as a local runtime dependency. The repository will document where to place or configure it instead.

### Browser-Side PlantUML Rendering

Rejected because the existing viewer stack has no PlantUML JavaScript renderer equivalent to Mermaid. Calling Java from the browser side would also blur the Tauri and Avalonia security boundaries.

### Pre-Generating Diagram Files Beside Markdown

Rejected because it mutates the selected documentation tree and creates generated artifacts that are easy to commit accidentally.

## Before / After

Before:

- Mermaid fences are rendered as diagrams.
- PlantUML fences are shown as regular code blocks.
- No setup path exists for `plantuml.jar`.

After:

- Mermaid fences continue to render through the existing path.
- PlantUML fences render as inline SVG diagrams when Java and `plantuml.jar` are available.
- PlantUML failures appear near the relevant diagram or in the existing status/error surface.
- Local runtime setup is documented and ignored by source control.

## Runtime Configuration

Use a single resolver contract in both implementations:

1. Look for `plantuml.config.json` in the runtime directory.
2. If present, read `plantUmlJarPath`.
3. Resolve relative `plantUmlJarPath` values relative to the config file directory.
4. If no config path is available, look for `plantuml.jar` in the same runtime directory.
5. If neither resolves to a file, report a missing PlantUML runtime error.

Runtime directory:

- Published app: executable directory.
- Development run: current working directory first, then executable directory. This keeps local development practical while preserving the published app convention.

Config file shape:

```json
{
  "plantUmlJarPath": "/absolute/path/to/plantuml.jar"
}
```

`plantuml.config.json` and `plantuml.jar` will be documented as local runtime files and added to `.gitignore` in Phase 3.

## Impact Range

Avalonia:

- Add `PlantUmlRuntimeOptions` / resolver service under `Services/`.
- Add `PlantUmlRenderService` under `Services/`.
- Update `MarkdownRenderService` to support async rendering and `plantuml` placeholders.
- Update `MainWindowViewModel.OpenMarkdownAsync` to await the PlantUML-capable render path.
- Update preview CSS in `HtmlTemplateService` for `.plantuml-diagram` and `.plantuml-error`.

Tauri:

- Add a serializable render request / response model in `src-tauri/src/lib.rs`.
- Add `render_plantuml_diagrams` command or combine diagram rendering with Markdown read response.
- Keep file reading and PlantUML execution in Rust, not React.
- Update `src/App.tsx` to replace PlantUML fences with renderer results before Markdown HTML conversion.
- Update `src/App.css` for `.plantuml-diagram` and `.plantuml-error`.

Docs and samples:

- Add a PlantUML sample Markdown file to each sample docs area that already exists or to a shared sample location if introduced.
- Update component docs and development workflow setup notes.

## Design Policy

### Rendering Format

SVG is the only viewer output for this feature. SVG integrates naturally with the existing WebView / browser preview, avoids base64 PNG handling, and preserves text clarity under zoom.

### PlantUML Source Wrapping

The renderer accepts the fenced block body. If the block does not contain `@start...` / `@end...`, the implementation wraps it with `@startuml` and `@enduml` before invoking PlantUML. If explicit start/end directives are present, the source is passed through unchanged.

### Process Execution

The renderer invokes:

```bash
java -jar <plantuml.jar> -tsvg -pipe
```

The diagram source is written to stdin. SVG is read from stdout. stderr and exit code are captured for actionable errors.

Timeout:

- Apply a per-diagram timeout of 10 seconds.
- On timeout, kill the process and show a PlantUML timeout error.

Concurrency:

- Render PlantUML blocks sequentially per preview load for the initial implementation.
- This avoids parallel Java process spikes and keeps error association simple.

### Error Behavior

Per-diagram errors render as:

```html
<pre class="plantuml-error">PlantUML render failed: ...</pre>
```

Global resolver errors use the same inline error block for each PlantUML fence and the existing status/error banner where available.

The viewer must not silently leave stale SVG output after reload or theme switch.

### Security and Sanitization

- Markdown HTML remains disabled in the Tauri `markdown-it` path.
- PlantUML SVG is generated locally from trusted local Markdown content selected by the user.
- No network server is called.
- The renderer does not pass user content through shell expansion; it must start `java` directly with argument arrays.
- `plantuml.jar` path must resolve to a file and must not be inferred from Markdown content.

### Theme Behavior

Phase 3 should keep theme handling simple:

- Render SVG without PlantUML dark-mode by default.
- Wrap SVG in `.plantuml-diagram` with the viewer background and border variables.
- Treat deeper PlantUML dark-mode support as follow-up because it can change diagram semantics and styling beyond the current viewer theme contract.

## Compatibility and Migration

Existing documents require no migration. Existing Mermaid fences remain on the current Mermaid renderer path. Documents without PlantUML blocks do not execute Java and do not require `plantuml.jar`.

Users who want PlantUML support must either:

- Place `plantuml.jar` in the runtime directory, or
- Create `plantuml.config.json` with `plantUmlJarPath`.

## Permanent Documentation Updates

Update these documents in Phase 3:

- `docs/rules/development_workflow.md`: PlantUML local setup and validation sample.
- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/architecture/overview.md`
- `docs/architecture/code_patterns.md`
- `docs/architecture/common_pitfalls.md`

## Test and User Verification

Automated / command checks:

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`
- `npm run build` in `markdown-viewer-tauri/`
- `cargo check` in `markdown-viewer-tauri/src-tauri/`
- `cargo fmt -- --check` in `markdown-viewer-tauri/src-tauri/` if Rust code is changed.

Manual checks:

- Open a folder containing Mermaid and PlantUML samples in Avalonia.
- Open the same folder in Tauri.
- Confirm PlantUML SVG renders inline.
- Confirm missing jar produces an actionable message.
- Confirm invalid PlantUML syntax is shown near the failed diagram.
- Confirm Mermaid still renders after reload.
- Confirm Light / Dark switching does not overlap or hide PlantUML output.

## Risks and Follow-Up

Risks:

- Java process startup may make large documents with many diagrams slow.
- PlantUML syntax or Graphviz-dependent diagrams may fail depending on local PlantUML capabilities.
- SVG emitted by PlantUML may not match viewer dark theme colors.
- Config file discovery differs between dev and published launch contexts if runtime directory assumptions are not documented clearly.

Follow-up candidates:

- Diagram cache keyed by source hash, jar path, and theme.
- Optional PlantUML dark-mode rendering.
- Settings UI for `plantuml.jar` path.
- Version check command that displays Java and PlantUML versions.
