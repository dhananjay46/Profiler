import type { Competency } from '../../shared/types'
import { iconSvg } from '../icons'
import { addStack, addText, setFixedWidth } from '../primitives'
import { theme } from '../theme'

/** A row of white circles with a line icon each and a label underneath. */
export function renderCompetencies(parent: FrameNode, items: Competency[] | undefined): FrameNode | null {
  if (!items || items.length === 0) return null
  const c = theme.layout.competencies
  const row = addStack(parent, {
    name: 'Competencies',
    direction: 'HORIZONTAL',
    padding: [c.top, 0, 0, c.paddingLeft],
  })
  for (const item of items) renderCompetency(row, item)
  return row
}

function renderCompetency(row: FrameNode, item: Competency): void {
  const c = theme.layout.competencies
  const cell = addStack(row, { name: item.label, direction: 'VERTICAL', align: 'CENTER', gap: c.circleToLabel }, 'HUG')
  setFixedWidth(cell, c.itemWidth)

  const circle = addStack(cell, { name: 'Circle', direction: 'VERTICAL', justify: 'CENTER', align: 'CENTER', fill: 'page', stroke: 'ring' }, 'HUG')
  circle.resize(c.circle, c.circle)
  circle.layoutSizingHorizontal = 'FIXED'
  circle.layoutSizingVertical = 'FIXED'
  circle.cornerRadius = c.circle / 2
  circle.effects = [
    {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.06 },
      offset: { x: 0, y: 1 },
      radius: 3,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    },
  ]

  const icon = figma.createNodeFromSvg(iconSvg(item.icon, c.icon, theme.colors.primary))
  icon.name = `Icon / ${item.icon ?? 'generic'}`
  icon.fills = []
  circle.appendChild(icon)

  addText(cell, item.label, theme.text.competencyLabel, { name: 'Label', align: 'CENTER' })
}
