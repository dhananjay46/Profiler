import { addText, parseBold } from '../primitives'
import { theme } from '../theme'

/**
 * The summary sits in the header, under the title, without a section title.
 * Blank lines separate paragraphs; **phrases** are bold.
 */
export function renderSummary(parent: FrameNode, summary: string): TextNode | null {
  const paragraphs = summary
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
  if (paragraphs.length === 0) return null
  // One text layer; paragraph spacing (from the theme) separates paragraphs.
  return addText(parent, parseBold(paragraphs.join('\n')), theme.text.summary, { name: 'Summary' })
}
