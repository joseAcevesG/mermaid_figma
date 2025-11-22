# Mermaid FigJam Suite

Professional FigJam plugin for importing Mermaid projects.

## Project structure

```
/manifest.json           – Figma manifest (Plugin)
/package.json            – npm scripts + dependencies
/tsconfig.json           – shared TS config
/shared/types.ts         – MermaidProject + message contracts
/plugin
  ├── src/main.tsx       – plugin main thread (canvas manipulation & widget generation)
  ├── src/ui.ts          – plugin iframe UI logic (Mermaid rendering)
  └── ui.html            – static HTML for the UI iframe
/widget
  └── src/index.tsx      – MermaidWidget component definition
/dist                    – build artifacts
```

## Installation

```bash
pnpm install
```

## Building

```bash
pnpm run build
```

Outputs are written to `dist/`.

For iterative development you can run the individual watch scripts:

- `pnpm run dev:plugin` – main thread bundle
- `pnpm run dev:ui` – UI iframe bundle

## Loading into FigJam

1. Run `pnpm run build` once so `dist/` exists.
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

1. The UI iframe accepts pasted JSON or a `.json` upload.
2. It renders the Mermaid code to SVG strings using the `mermaid` library (running in the browser environment).
3. It sends the processed data (code + SVG) to the main thread.
4. `plugin/src/main.tsx` receives the `import-project` message, then for each folder:
   - Creates a **Section** that acts as the column for that folder.
   - Creates nested **file Sections** within that column.
   - Instantiates the `MermaidWidget` using `figma.createNodeFromJSXAsync` and seeds its synced state with the SVG.
5. The layout uses generous padding to avoid overlap and automatically scrolls/zooms the viewport to the new content.

## MermaidWidget details

- Implemented as a React component using the FigJam Widget API.
- Keeps `code`, `title`, and `svg` in `syncedState`.
- The plugin generates these widgets dynamically.
- **Rendering**: Mermaid rendering happens in the Plugin UI (DOM), and the resulting SVG is passed to the widget for display. This bypasses the sandbox limitations of widgets.

## Next steps (optional ideas)

- Persist layout preferences (column width, padding) via plugin `clientStorage`.
- Support incremental updates instead of recreating every folder.
- Add toolbar controls to the widget to toggle Mermaid themes locally (would require re-rendering in UI).
