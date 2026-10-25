import type { CaseStudy } from '../../shared/types'
import { addImagePlaceholder, addStack, addText, solid, type TextRun } from '../primitives'
import { theme } from '../theme'

/**
 * Optional, full page width, no section title (as in the reference): each
 * case study is a centered heading followed by screenshot slots.
 */
export function renderCaseStudies(parent: FrameNode, studies: CaseStudy[] | undefined): FrameNode | null {
  if (!studies || studies.length === 0) return null
  const layout = theme.layout
  const block = addStack(parent, {
    name: 'Case Studies',
    direction: 'VERTICAL',
    gap: layout.caseStudyGap,
    padding: [layout.caseStudiesTop, 0, 0, 0],
  })
  for (const study of studies) renderCaseStudy(block, study)
  return block
}

function renderCaseStudy(parent: FrameNode, study: CaseStudy): void {
  const layout = theme.layout
  const block = addStack(parent, {
    name: study.title,
    direction: 'VERTICAL',
    align: 'CENTER',
    gap: layout.caseHeadingToImages,
  })

  // Client (regular) and title (bold) as one centered two-line text layer.
  const runs: TextRun[] = study.client
    ? [{ text: `${study.client}\n` }, { text: study.title, weight: 'bold' }]
    : [{ text: study.title, weight: 'bold' }]
  addText(block, runs, theme.text.caseHeading, { name: 'Heading', align: 'CENTER' })

  const count = study.imageCount ?? 2
  const shots = addStack(block, { name: 'Screenshots', direction: 'HORIZONTAL', gap: layout.screenshotGap }, 'HUG')
  const width = count === 1 ? 2 * layout.screenshotWidth + layout.screenshotGap : layout.screenshotWidth
  for (let i = 0; i < count; i++) {
    addImagePlaceholder(shots, 'Screenshot', { width, height: layout.screenshotHeight })
  }

  renderDetails(block, study)
  if (study.url) {
    const label = 'View case study →'
    const link = addText(block, label, theme.text.link, { name: 'Link', width: 'HUG', align: 'CENTER' })
    link.setRangeHyperlink(0, label.length, { type: 'URL', value: study.url })
    link.setRangeFills(0, label.length, [solid('primary')])
    link.setRangeTextDecoration(0, label.length, 'UNDERLINE')
  }
}

/** Optional challenge / solution / outcome under the screenshots. */
function renderDetails(block: FrameNode, study: CaseStudy): void {
  const parts = [
    ['Challenge', study.challenge],
    ['Solution', study.solution],
    ['Outcome', study.outcome],
  ].filter((part): part is [string, string] => !!part[1] && part[1].trim() !== '')
  if (parts.length === 0) return

  const layout = theme.layout
  const details = addStack(
    block,
    { name: 'Details', direction: 'HORIZONTAL', gap: layout.caseDetailsGap },
    'HUG',
  )
  details.layoutSizingHorizontal = 'FIXED'
  details.resize(2 * layout.screenshotWidth + layout.screenshotGap, Math.max(1, details.height))
  details.layoutSizingVertical = 'HUG'
  for (const [label, content] of parts) {
    const column = addStack(details, { name: label, direction: 'VERTICAL', gap: 2 })
    addText(column, label, theme.text.label, { name: 'Label' })
    addText(column, content, theme.text.body, { name: 'Text' })
  }
}
