// Built-in line icons for the competency row, drawn on a 36 × 36 grid.
// They become native, editable vector layers via figma.createNodeFromSvg.

const ICONS: Record<string, string> = {
  // Head in profile with a heart inside.
  empathise: `
    <path d="M23 33v-5.2c4.3-1.7 7.2-5.8 7.2-10.6C30.2 10.4 25 5 18.3 5 11.8 5 6.6 10 6.6 16.3c0 1.3.2 2.5.7 3.6l-2.2 4.2c-.3.6.1 1.4.8 1.4h3v3.4c0 1.3 1 2.3 2.3 2.3h2.6V33"/>
    <path d="M18.6 23.8s-5.9-3.5-5.9-7.3a3.1 3.1 0 0 1 5.9-1.4 3.1 3.1 0 0 1 5.9 1.4c0 3.8-5.9 7.3-5.9 7.3z"/>`,

  // Bar chart with an eye above it.
  'data-visualization': `
    <path d="M4.5 4.5v27h27"/>
    <path d="M9.5 31.5v-8M15 31.5V20M20.5 31.5v-6M26 31.5V17"/>
    <path d="M9 11c2.6-3.3 5.6-5 9-5s6.4 1.7 9 5c-2.6 3.3-5.6 5-9 5s-6.4-1.7-9-5z"/>
    <circle cx="18" cy="11" r="2.2"/>`,

  // Two stacked documents, the front one with a picture and text lines.
  'user-scenario': `
    <path d="M12 8V4h12.5l5 5v19.5H26"/>
    <path d="M24.5 4v5h5"/>
    <rect x="7" y="8" width="19" height="24.5" rx="1"/>
    <rect x="10.5" y="11.5" width="12" height="8"/>
    <path d="M10.5 18l3.5-3.2 2.5 2.2 2.2-1.6 3.8 3"/>
    <path d="M10.5 23.5h12M10.5 26.5h12M10.5 29.5h8"/>`,

  // A brain in a circle with connected nodes around it.
  'mind-mapping': `
    <circle cx="18" cy="18" r="7.5"/>
    <path d="M18 12.5v11M15.2 14.2c-1.6.5-2.2 2.2-1.1 3.3-1.1 1.2-.5 2.8 1.1 3.3M20.8 14.2c1.6.5 2.2 2.2 1.1 3.3 1.1 1.2.5 2.8-1.1 3.3"/>
    <circle cx="5.5" cy="6" r="2.3"/><circle cx="30.5" cy="6" r="2.3"/>
    <circle cx="3.8" cy="22" r="2.3"/><circle cx="32.2" cy="22" r="2.3"/>
    <circle cx="11" cy="32" r="2.3"/><circle cx="25" cy="32" r="2.3"/>
    <path d="M7.2 7.6l5.6 5M28.8 7.6l-5.6 5M6.1 21.4l4.6-1.3M29.9 21.4l-4.6-1.3M12 29.9l2.4-4.9M24 29.9l-2.4-4.9"/>`,

  // Light bulb with a gear inside and rays around it.
  ideate: `
    <path d="M13.6 26.5c0-2.7-4.1-4.9-4.1-10.2a8.5 8.5 0 0 1 17 0c0 5.3-4.1 7.5-4.1 10.2z"/>
    <path d="M13.6 29.5h8.8M15.2 32.5h5.6"/>
    <circle cx="18" cy="16.3" r="2.3"/>
    <path d="M18 11.6v1.7M18 19.3V21M13.3 16.3H15M21 16.3h1.7M14.7 13l1.2 1.2M20.1 18.4l1.2 1.2M21.3 13l-1.2 1.2M15.9 18.4l-1.2 1.2"/>
    <path d="M18 2v2.4M6.3 6.3l1.7 1.7M29.7 6.3L28 8M2.5 16.3h2.4M31.1 16.3h2.4"/>`,

  // Monitor with a sketch on screen and a pen.
  design: `
    <rect x="3" y="6" width="25" height="18" rx="1.5"/>
    <path d="M11.5 29.5h8M15.5 24v5.5"/>
    <path d="M7 20l4-7.5 3 4.5 2.2-3 3.3 6"/>
    <path d="M32.8 8.6L26.6 22.5l-2 2.7.4-3.4 6.1-13.9a.9.9 0 0 1 1.7.7z"/>`,

  // Fallback: a simple sparkle.
  generic: `
    <path d="M18 5l2.8 8.2L29 16l-8.2 2.8L18 27l-2.8-8.2L7 16l8.2-2.8z"/>
    <path d="M28 25l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>`,
}

/** SVG markup for a built-in icon; unknown names get the generic icon. */
export function iconSvg(name: string | undefined, size: number, color: string): string {
  const body = (name && ICONS[name]) || ICONS.generic
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}
