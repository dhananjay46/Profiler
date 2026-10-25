# Profiler

A Figma Design plugin that generates an editable consultant profile from structured data, using native
Figma layers (Auto Layout frames, text, components).

## Build

Requires Node.js. From this folder:

```
npm install        # once
npm run build      # type-check + bundle src/ into code.js
npm run watch      # optional: rebuild code.js on every save (no type-check)
npm run lint
```

`code.js` is generated. Never edit it; edit files in `src/` and rebuild.

## Run in Figma Desktop

Development plugins only run in the desktop app.

1. Open a design file.
2. Menu → Plugins → Development → Import plugin from manifest… → choose `manifest.json` in this folder.
3. Menu → Plugins → Development → Profiler.
4. Pick a test profile and click **Generate profile**.

After rebuilding, re-run the plugin to pick up changes (no re-import needed).
Errors are shown in the panel; full details are in Plugins → Development → Show/Hide console.

## Structure

```
manifest.json            plugin settings (entry: code.js, panel: ui.html)
ui.html                  the plugin panel
src/
  shared/types.ts        the ConsultantProfile data contract
  shared/validate.ts     checks data before rendering
  shared/messages.ts     panel <-> main code messages
  data/testProfiles.ts   hardcoded test content
  main/code.ts           entry point
  main/theme.ts          colors, type, spacing — edit to restyle
  main/fonts.ts          font loading with fallbacks
  main/primitives.ts     Auto Layout / text helpers
  main/components.ts     reusable Section Title and Chip components
  main/render/           one file per profile section
```

The plugin creates a **Profiler · Components vN** frame on the page holding the main components. Editing those
components restyles every generated profile. After changing how components look in code, increase
`COMPONENT_VERSION` in `src/main/components.ts`; a fresh components frame is created on the next run.

Photo, logo, screenshot and tool-logo slots are placeholders: select one in Figma and set an image fill
(or paste the logo over a tool tile).
In profile text, wrap phrases in `**double asterisks**` to make them bold (summary and experience descriptions).

The layout uses the Ubuntu font (available in Figma via Google Fonts) and falls back to Inter.
Sizes and spacing in `src/main/theme.ts` are measured from the reference profile at 852 px wide.
Competency icons are built-in vectors in `src/main/icons.ts`: empathise, data-visualization,
user-scenario, mind-mapping, ideate, design (unknown names get a generic icon).
