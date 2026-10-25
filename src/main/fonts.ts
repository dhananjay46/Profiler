// Figma refuses to set text until its font is loaded. All fonts are loaded
// once, up front, before any text node is created.

import { ProfilerError } from './errors'
import type { FontWeight } from './theme'

// Style names differ between font versions ("Semi Bold" vs "SemiBold"), so
// each weight lists alternatives in order of preference.
const STYLE_CANDIDATES: Record<FontWeight, string[]> = {
  regular: ['Regular'],
  medium: ['Medium', 'Regular'],
  semibold: ['Semi Bold', 'SemiBold', 'Medium', 'Bold'],
  bold: ['Bold', 'Semi Bold', 'SemiBold'],
}

let loaded: Record<FontWeight, FontName> | null = null

/**
 * Loads the first family in `families` that is fully available and returns
 * its name, e.g. falls back to Inter when Ubuntu is missing.
 */
export async function loadFonts(families: string[]): Promise<string> {
  for (const family of families) {
    try {
      loaded = await loadFamily(family)
      return family
    } catch (error) {
      if (!(error instanceof ProfilerError)) throw error
      // Try the next family.
    }
  }
  throw new ProfilerError(`None of these fonts could be loaded: ${families.join(', ')}.`)
}

async function loadFamily(family: string): Promise<Record<FontWeight, FontName>> {
  const weights = Object.keys(STYLE_CANDIDATES) as FontWeight[]
  const fonts = await Promise.all(weights.map((w) => loadFirstAvailable(family, STYLE_CANDIDATES[w])))
  const result = {} as Record<FontWeight, FontName>
  weights.forEach((w, i) => (result[w] = fonts[i]))
  return result
}

export function font(weight: FontWeight): FontName {
  if (!loaded) throw new Error('font() called before loadFonts()')
  return loaded[weight]
}

/** Loads every font used by a component's text layers (the designer may have edited it). */
export async function loadFontsUsedIn(node: ComponentNode): Promise<void> {
  const texts = node.findAllWithCriteria({ types: ['TEXT'] })
  const fonts = new Map<string, FontName>()
  for (const t of texts) {
    const names = t.fontName === figma.mixed ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName]
    for (const f of names) fonts.set(`${f.family}/${f.style}`, f)
  }
  try {
    await Promise.all([...fonts.values()].map((f) => figma.loadFontAsync(f)))
  } catch (_e) {
    throw new ProfilerError(
      `A font used in "${node.name}" is not available on this computer. Install it, or delete that frame so the plugin recreates it.`,
    )
  }
}

async function loadFirstAvailable(family: string, styles: string[]): Promise<FontName> {
  for (const style of styles) {
    const candidate = { family, style }
    try {
      await figma.loadFontAsync(candidate)
      return candidate
    } catch (_e) {
      // Try the next style name.
    }
  }
  throw new ProfilerError(`Could not load the font "${family}" (tried: ${styles.join(', ')}).`)
}
