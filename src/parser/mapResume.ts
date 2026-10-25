// Maps extracted resume lines onto the ConsultantProfile structure.
//
// Rules:
//  - Only text that is present in the resume is used. Nothing is invented:
//    no dates, metrics, outcomes, tools or qualifications are guessed.
//  - Fields that cannot be found stay empty and are reported as issues.
//  - Text that cannot be placed is returned as "unmapped" so nothing is lost.
//  - Icon row (competencies) and case studies are not resume content and are
//    never filled from a resume.

import type { ConsultantProfile, ProfileHeader } from '../shared/types'
import { IssueList, type ReviewIssue, type UnmappedText } from './issues'
import { dedupe, mapCertifications, mapEducation, mapList, splitEducationAndCertifications } from './mapEducation'
import { mapExperience } from './mapExperience'
import { matchHeading, type SectionKind } from './sections'
import { EMAIL, LINKEDIN, normalizeLines, PHONE, splitParts, trimSeparators, wordCount } from './text'
import type { ExtractedDocument, ResumeLine } from './types'

export interface ParseResult {
  profile: ConsultantProfile
  issues: ReviewIssue[]
  unmapped: UnmappedText[]
  /** General notes, e.g. a possible multi-column PDF. */
  notes: string[]
  /** Which sections were recognised, for the review summary. */
  sectionsFound: string[]
}

interface Section {
  kind: SectionKind | 'header'
  title: string
  lines: ResumeLine[]
}

export function mapResume(doc: ExtractedDocument): ParseResult {
  const issues = new IssueList()
  const unmapped: UnmappedText[] = []
  const sections = splitSections(normalizeLines(doc.lines))
  const linesOf = (...kinds: Section['kind'][]) => sections.filter((s) => kinds.includes(s.kind)).flatMap((s) => s.lines)

  // Header and contact details
  const { header, leftover } = mapHeader(linesOf('header', 'contact'), issues)

  // Summary
  let summary = paragraphs(linesOf('summary'))
  if (!summary && leftover.length > 0 && wordCount(leftover.join(' ')) >= 15) {
    summary = leftover.join(' ')
    issues.check('summary', 'No summary heading was found; the introduction at the top of the resume was used. Check it.')
  } else if (leftover.length > 0) {
    unmapped.push({ title: 'Top of the resume', lines: leftover })
  }
  if (!summary) issues.missing('summary', 'No summary or profile found.')

  // Experience
  const experienceLines = linesOf('experience')
  const experience = mapExperience(experienceLines, issues, unmapped)
  if (experienceLines.length === 0) issues.missing('experience', 'No experience section found.')

  // Education and certifications
  const combined = splitEducationAndCertifications(linesOf('educationAndCertifications'))
  const education = mapEducation([...linesOf('education'), ...combined.education], issues, unmapped)
  const certifications = mapCertifications([...linesOf('certifications'), ...combined.certifications], issues)
  if (education.length === 0) issues.missing('education', 'No education found.')

  // Skills and tools. Tools are only taken from tools sections, "Tools:" labels
  // or project details, never guessed from the skills list.
  const isToolsLabel = (label: string) => matchHeading(label)?.kind === 'tools'
  const fromSkills = mapList(linesOf('skills'), 'skills', unmapped, isToolsLabel)
  const fromTools = mapList(linesOf('tools'), 'tools', unmapped, isToolsLabel)
  const skills = dedupe([...fromSkills.skills, ...fromTools.skills])
  const tools = dedupe([...fromTools.tools, ...fromSkills.tools, ...experience.tools])
  if (skills.length === 0) issues.missing('skills', 'No skills found.')
  if (tools.length === 0) issues.missing('tools', 'No tools section found. Tools are not guessed from skills.')
  if (experience.tools.length > 0) {
    issues.check('tools', 'Some tools were collected from project details (“Tools used: …”). Check the list.')
  }

  // Sections we recognise but do not use (languages, interests, …)
  for (const section of sections.filter((s) => s.kind === 'other' && s.lines.length > 0)) {
    unmapped.push({ title: section.title, lines: section.lines.map((l) => l.text) })
  }

  const notes = [...doc.warnings]
  notes.push('The icon row and case studies are not read from resumes. They are left out; add them in Figma if needed.')

  return {
    profile: {
      header,
      summary,
      education,
      experience: experience.entries,
      skills,
      tools,
      certifications,
    },
    issues: issues.items,
    unmapped,
    notes,
    sectionsFound: sections.filter((s) => s.kind !== 'header').map((s) => s.title),
  }
}

function splitSections(lines: ResumeLine[]): Section[] {
  let current: Section = { kind: 'header', title: 'Header', lines: [] }
  const sections: Section[] = [current]
  for (const line of lines) {
    const heading = line.bullet ? null : matchHeading(line.text)
    if (heading) {
      // "Tools used: Figma" inside an experience entry is a detail, not a new section.
      if (heading.rest && current.kind === 'experience' && (heading.kind === 'tools' || heading.kind === 'skills')) {
        current.lines.push(line)
        continue
      }
      current = { kind: heading.kind, title: heading.title, lines: [] }
      sections.push(current)
      if (heading.rest) current.lines.push({ ...line, text: heading.rest, breakBefore: true })
      continue
    }
    current.lines.push(line)
  }
  return sections
}

function mapHeader(lines: ResumeLine[], issues: IssueList): { header: ProfileHeader; leftover: string[] } {
  const header: ProfileHeader = { name: '', title: '' }
  const candidates: string[] = []

  for (const line of lines) {
    let text = line.text
    const location = text.match(/^(?:location|address|city|based\s+in)\s*[:\-–]\s*(.+)$/i)
    if (location) {
      header.location = location[1].trim()
      continue
    }
    text = text.replace(/\b(?:e-?mail|phone|mobile|mob|tel|cell|contact|linked\s?in)\s*(?:no\.?)?\s*[:\-–]\s*/gi, ' ')

    const linkedin = text.match(LINKEDIN)
    if (linkedin) {
      header.linkedin ??= linkedin[0].replace(/^https?:\/\/(?:www\.)?/i, '')
      text = text.replace(linkedin[0], ' ')
    }
    const email = text.match(EMAIL)
    if (email) {
      header.email ??= email[0]
      text = text.replace(email[0], ' ')
    }
    const phone = text.match(PHONE)
    if (phone && (phone[0].match(/\d/g) ?? []).length >= 8 && (phone[0].match(/\d/g) ?? []).length <= 15) {
      header.phone ??= phone[0].trim()
      text = text.replace(phone[0], ' ')
    }
    for (const part of splitParts(text)) {
      const value = trimSeparators(part)
      if (value && !/^(?:curriculum\s+vitae|resume|résumé|cv)$/i.test(value)) candidates.push(value)
    }
  }

  const nameIndex = candidates.findIndex(isNameLike)
  if (nameIndex >= 0) header.name = candidates[nameIndex]
  else issues.required('header.name', 'No name found. Add the consultant’s name.')

  const rest = candidates.filter((_c, i) => i !== nameIndex)
  const titleIndex = rest.findIndex((c) => wordCount(c) <= 12 && !/[.!?]$/.test(c))
  if (titleIndex >= 0 && (nameIndex < 0 || candidates.indexOf(rest[titleIndex]) > nameIndex)) {
    header.title = rest[titleIndex]
    rest.splice(titleIndex, 1)
    issues.check('header.title', `“${header.title}” was read as the job title. Check it.`)
  } else {
    issues.missing('header.title', 'No job title found.')
  }

  if (!header.email && !header.phone && !header.linkedin && !header.location) {
    issues.missing('header.email', 'No contact details found. They are optional.')
  }
  return { header, leftover: rest }
}

function isNameLike(text: string): boolean {
  const words = text.split(/\s+/)
  return (
    words.length >= 1 &&
    words.length <= 5 &&
    text.length <= 40 &&
    /^[\p{L}][\p{L}.'’ -]*$/u.test(text) &&
    words.every((w) => /^\p{Lu}/u.test(w) || /^(?:van|von|de|da|del|der|di|la|le|bin|al)$/i.test(w)) &&
    matchHeading(text) === null
  )
}

/** Joins lines into paragraphs (blank-line separated), respecting paragraph breaks. */
function paragraphs(lines: ResumeLine[]): string {
  const out: string[] = []
  for (const line of lines) {
    if (out.length === 0 || line.breakBefore || line.bullet) out.push(line.text)
    else out[out.length - 1] += ` ${line.text}`
  }
  return out.join('\n\n')
}
