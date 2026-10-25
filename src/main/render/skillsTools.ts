import { addInstance } from '../components'
import { addColumns, addStack } from '../primitives'
import { theme } from '../theme'
import { addSection, type RenderContext } from './section'

/** Skills as plain text in fixed-width columns, filled top to bottom. */
export function renderSkills(parent: FrameNode, skills: string[], ctx: RenderContext): FrameNode | null {
  const values = nonEmpty(skills)
  if (values.length === 0) return null
  const section = addSection(parent, 'Skills', ctx, theme.layout.skillsInnerGap)
  addColumns(section, values, {
    columns: theme.layout.skillColumns,
    columnWidth: theme.layout.skillColumnWidth,
    style: theme.text.skill,
    name: 'Skill columns',
  })
  return section
}

/**
 * Tools as a row of square tiles. Each tile wraps a 38×38 image slot named
 * "Logo (replace with image)": in Figma Desktop, double-click a tile to drill
 * in, select the slot, and apply the tool's official logo via Fill > Image.
 * Brand marks are trademarks of their owners, so none are bundled.
 */
export function renderTools(parent: FrameNode, tools: string[], ctx: RenderContext): FrameNode | null {
  const values = nonEmpty(tools)
  if (values.length === 0) return null
  const layout = theme.layout
  const section = addSection(parent, 'Tools', ctx, layout.toolsInnerGap)
  const row = addStack(section, {
    name: 'Tiles',
    direction: 'HORIZONTAL',
    gap: layout.toolGap,
    padding: [0, 0, 0, layout.toolsIndent],
    wrap: true,
  })
  for (const tool of values) {
    const tile = addInstance(row, ctx.components.toolTile, initials(tool), 'HUG')
    tile.name = tool
  }
  return section
}

/** "Adobe XD" → "Xd", "Photoshop" → "Ps", "Power BI" → "PB", "Jira" → "Ji". */
export function initials(tool: string): string {
  const known: Record<string, string> = {
    photoshop: 'Ps',
    illustrator: 'Ai',
    'after effects': 'Ae',
    indesign: 'Id',
    xd: 'Xd',
  }
  const name = tool.replace(/^adobe\s+/i, '').trim()
  const match = known[name.toLowerCase()]
  if (match) return match
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 1).toUpperCase() + name.slice(1, 2).toLowerCase()
}

function nonEmpty(items: string[]): string[] {
  return items.filter((item) => item.trim() !== '')
}
