import type { Certification, EducationEntry } from '../../shared/types'
import { addStack, addText, solid } from '../primitives'
import { theme } from '../theme'
import { addSection, type RenderContext } from './section'

/** One combined section, one line per item: education (bold), then certifications. */
export function renderEducationAndCertifications(
  parent: FrameNode,
  education: EducationEntry[],
  certifications: Certification[],
  ctx: RenderContext,
): FrameNode | null {
  if (education.length === 0 && certifications.length === 0) return null
  const section = addSection(parent, 'Education & Certifications', ctx)
  const list = addStack(section, { name: 'Items', direction: 'VERTICAL' })
  for (const entry of education) addEducationLine(list, entry)
  for (const cert of certifications) addCertificationLine(list, cert)
  return section
}

/** "Degree - Institution, Location (2014)" */
export function addEducationLine(list: FrameNode, entry: EducationEntry): TextNode {
  const year = entry.endYear ?? entry.startYear
  const place = [entry.institution, entry.location].filter(Boolean).join(', ')
  const line = `${entry.degree}${place ? ` - ${place}` : ''}${year ? ` (${year})` : ''}`
  return addText(list, line, theme.text.educationLine, { name: entry.degree })
}

/**
 * "Certification - Issuer (2022)" with an optional "View credential" link
 * appended when the cert carries a url. The link is a styled, hyperlinked
 * range inside the same text node so each certification stays one row.
 */
export function addCertificationLine(list: FrameNode, cert: Certification): TextNode {
  const issuer = cert.issuer ? ` - ${cert.issuer}` : ''
  const year = cert.year ? ` (${cert.year})` : ''
  const main = `${cert.name}${issuer}${year}`
  if (!cert.url) {
    return addText(list, main, theme.text.certificationLine, { name: cert.name })
  }
  const linkLabel = 'View credential'
  const separator = '  ·  '
  const text = `${main}${separator}${linkLabel}`
  const node = addText(list, text, theme.text.certificationLine, { name: cert.name })
  const start = main.length + separator.length
  const end = start + linkLabel.length
  node.setRangeHyperlink(start, end, { type: 'URL', value: cert.url })
  node.setRangeFills(start, end, [solid('primary')])
  node.setRangeTextDecoration(start, end, 'UNDERLINE')
  return node
}
