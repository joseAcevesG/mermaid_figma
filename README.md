# Mermaid FigJam Suite

Professional FigJam plugin + widget combo for importing Mermaid projects.

## Project structure

```
/manifest.json           – Figma manifest referencing both plugin + widget bundles
/package.json            – npm scripts + dependencies
/tsconfig.json           – shared TS config for plugin + widget
/shared/types.ts         – MermaidProject + message contracts
/plugin
  ├── src/main.ts        – plugin main thread (canvas manipulation)
  ├── src/ui.ts          – plugin iframe UI logic
  └── ui.html            – static HTML for the UI iframe
/widget
  └── src/index.tsx      – MermaidWidget implementation (FigJam widget API)
/dist                    – build artifacts consumed by Figma (generated)
```

## Installation

```bash
npm install
```

## Building

```bash
npm run build
```

Outputs are written to `dist/` and match the paths declared in `manifest.json`.

For iterative development you can run the individual watch scripts:

- `npm run dev:plugin` – main thread bundle
- `npm run dev:ui` – UI iframe bundle
- `npm run dev:widget` – MermaidWidget bundle

Each command writes to `dist/` with `--watch`. Keep them running in separate shells while iterating.

## Loading into FigJam

1. Run `npm run build` once so `dist/` exists.
2. In Figma desktop, open **Resources → Plugins → Development → Import plugin from manifest…**.
3. Choose `manifest.json` from this repository.
4. Open a FigJam file. Launch the plugin from the **Resources** panel.
5. After importing JSON, the plugin programmatically creates Sections and widget instances.

## JSON format

```ts
interface MermaidProject {
  [folderName: string]: {
    [fileName: string]: string; // Mermaid code
  };
}
```

Example:

```json
{
  "Folder A": {
    "diagram1.mmd": "graph TD; A-->B;",
    "diagram2.mmd": "sequenceDiagram\nA->>B: Hello"
  },
  "Folder B": {
    "another.mmd": "flowchart LR; X-->Y;"
  }
}
```

## Plugin workflow

1. The UI iframe (React-less vanilla DOM) accepts pasted JSON or a `.json` upload.
2. It validates that the structure matches `MermaidProject` before posting to the main thread.
3. `plugin/src/main.ts` receives the `import-project` message, then for each folder:
   - Creates a **Section** that acts as the column for that folder.
   - Creates nested **file Sections** within that column.
   - Inside each file section, instantiates the `mermaid-widget` widget and seeds its synced state.
4. The layout uses generous padding to avoid overlap and automatically scrolls/zooms the viewport to the new content.

## MermaidWidget details

- Implemented with the FigJam Widget API (TSX via `figma.widget`).
- Keeps `code` and `title` in `syncedState` so instances stay in sync with plugin imports.
- Uses the official `mermaid` npm package. Rendering happens client-side via `mermaid.render` and feeds the resulting SVG to the `<SVG>` node.
- Errors (syntax issues, unsupported diagrams) are surfaced inside the widget instead of throwing.

### Runtime limitations and workarounds

- Widgets run in a constrained environment (no DOM). Mermaid works because it renders purely to SVG strings. For complex diagrams with external assets, security rules may block fetches—stick to inline Mermaid syntax.
- FigJam widgets cannot dynamically resize based on external assets without re-rendering. This implementation caps the width at 900px and lets the diagram height grow based on the generated SVG.
- Re-importing JSON is currently the way to update diagrams in bulk. Editing individual widget state manually is possible via the widget properties panel if needed.

## Next steps (optional ideas)

- Persist layout preferences (column width, padding) via plugin `clientStorage`.
- Support incremental updates instead of recreating every folder.
- Add toolbar controls to the widget to toggle Mermaid themes locally.
