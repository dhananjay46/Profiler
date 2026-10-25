import type { ExperienceEntry } from '../../shared/types'
import { addNumberedList, addSpacer, addStack, addText, dateRange, parseBold, solid, type TextRun } from '../primitives'
import { theme } from '../theme'
import { addSection, type RenderContext } from './section'

/** Any number of entries stack vertically; each grows to fit its text. */
export function renderExperience(parent: FrameNode, entries: ExperienceEntry[], ctx: RenderContext): FrameNode | null {
  if (entries.length === 0) return null
  const section = addSection(parent, 'Work Experience', ctx)
  const list = addStack(section, { name: 'Entries', direction: 'VERTICAL', gap: theme.layout.entryGap })
  for (const entry of entries) renderExperienceEntry(list, entry)
  return section
}

function renderExperienceEntry(list: FrameNode, entry: ExperienceEntry): void {
  const layout = theme.layout
  const heading = headingRuns(entry)
  const block = addStack(list, { name: heading.map((run) => run.text).join(''), direction: 'VERTICAL' })

  // "Project | Industry | Region", with dates pinned right when present.
  const row = addStack(block, { name: 'Heading', direction: 'HORIZONTAL', gap: 12, align: 'BASELINE' })
  const title = addText(row, heading, theme.text.entryHeading, { name: 'Title' })
  colorFirstSeparator(title)
  const dates = entry.startDate ? dateRange(entry.startDate, entry.endDate) : ''
  if (dates) addText(row, dates, theme.text.entryDates, { name: 'Dates', width: 'HUG' })

  if (entry.description) {
    addSpacer(block, layout.headingToDescription)
    // Descriptions stop 13 px short of the list's right edge, as in the reference.
    const wrap = addStack(block, {
      name: 'Description',
      direction: 'VERTICAL',
      padding: [0, layout.descriptionInsetRight, 0, 0],
    })
    addText(wrap, parseBold(entry.description), theme.text.body, { name: 'Text', align: 'JUSTIFIED' })
  }
  if (entry.responsibilities.length > 0) {
    addSpacer(block, entry.description ? layout.descriptionToList : layout.headingToDescription)
    addNumberedList(block, entry.responsibilities, theme.text.body, {
      name: 'Responsibilities',
      numberWidth: layout.listNumberWidth,
      gap: layout.listNumberGap,
    })
  }
}

const SEPARATOR = ' | '

/** Lead (project, else role) in medium weight, the remaining parts after " | ". */
function headingRuns(entry: ExperienceEntry): TextRun[] {
  const lead = entry.project ?? entry.role ?? ''
  const rest = [entry.project ? entry.role : undefined, entry.company, entry.industry, entry.region].filter(
    (part): part is string => !!part && part.trim() !== '',
  )
  const runs: TextRun[] = [{ text: lead, weight: 'medium' }]
  if (rest.length > 0) runs.push({ text: `${SEPARATOR}${rest.join(SEPARATOR)}` })
  return runs
}

/** The reference shows only the first "|" in a light grey. */
function colorFirstSeparator(node: TextNode): void {
  const index = node.characters.indexOf(SEPARATOR)
  if (index < 0) return
  const start = index + 1 // the "|" itself
  node.setRangeFills(start, start + 1, [solid('separator')])
}
