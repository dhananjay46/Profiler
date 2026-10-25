// Education, certification, skill and tool lists.

import type { Certification, EducationEntry } from '../shared/types'
import type { IssueList, UnmappedText } from './issues'
import { findYears, splitParts, trimSeparators, wordCount } from './text'
import type { ResumeLine } from './types'

// Degree words in any case; abbreviations only in capitals ("BE", not "be").
const DEGREE_WORDS =
  /\b(?:bachelor\w*|master\w*|doctor\w*|doctorate|diploma|associate degree|degree|high\s+school|secondary|higher\s+secondary|a-levels|post\s?graduate|graduation)\b/i
const DEGREE_ABBR =
  /\b(?:B\.?\s?(?:Sc|Tech|E|A|Com|Des|Arch|FA|S)|M\.?\s?(?:Sc|Tech|E|A|Com|Des|FA|S|Phil)|Ph\.?\s?D|MBA|BBA|BCA|MCA|PGDM|PGD|BFA|MFA|BDes|MDes|HSC|SSC|GCSE)\b/
const DEGREE = { test: (text: string) => DEGREE_WORDS.test(text) || DEGREE_ABBR.test(text) }
const INSTITUTION =
  /\b(?:university|college|institute|institution|school|academy|polytechnic|iit|iim|nid|vidyapeeth|vidyalaya|mahavidyalaya|campus)\b/i
const CERTIFICATE = /\b(?:certif\w*|course|training|licen[cs]e\w*|accredit\w*|nanodegree|bootcamp)\b/i
const GRADE = /\b(?:cgpa|gpa|percentage|grade|class|division|distinction|honours|honors|marks)\b|\d+(?:\.\d+)?\s*%/i

/** Lines from a combined "Education & Certifications" section, split by kind. */
export function splitEducationAndCertifications(lines: ResumeLine[]): { education: ResumeLine[]; certifications: ResumeLine[] } {
  const education: ResumeLine[] = []
  const certifications: ResumeLine[] = []
  for (const line of lines) {
    if (CERTIFICATE.test(line.text) && !DEGREE.test(line.text) && !INSTITUTION.test(line.text)) certifications.push(line)
    else if (DEGREE.test(line.text) || INSTITUTION.test(line.text)) education.push(line)
    else certifications.push(line) // e.g. "Design Thinking – Example Institute" is ambiguous; treated as a course
  }
  return { education, certifications }
}

export function mapEducation(lines: ResumeLine[], issues: IssueList, unmapped: UnmappedText[]): EducationEntry[] {
  // Group lines into entries: a new entry starts when a second degree or a
  // second institution would appear in the current one.
  const groups: string[][] = []
  let hasDegree = false
  let hasInstitution = false
  for (const line of lines) {
    const degree = DEGREE.test(line.text)
    const institution = INSTITUTION.test(line.text)
    if (groups.length === 0 || (degree && hasDegree) || (institution && hasInstitution && !degree)) {
      groups.push([])
      hasDegree = false
      hasInstitution = false
    }
    groups[groups.length - 1].push(line.text)
    hasDegree ||= degree
    hasInstitution ||= institution
  }

  const grades: string[] = []
  const entries = groups.map((group, i) => {
    const path = `education[${i}]`
    const years = findYears(group.join(' '))
    const parts: string[] = []
    for (const text of group) {
      if (GRADE.test(text) && !DEGREE.test(text)) {
        grades.push(text)
        continue
      }
      const cleaned = text.replace(/\(?\b(?:19|20)\d{2}\b\)?/g, ' ').replace(/\b(?:to|till|until)\b/gi, ' ')
      parts.push(...splitParts(cleaned).flatMap((p) => p.split(/\s*,\s*/)).map(trimSeparators).filter(Boolean))
    }

    const instIndex = parts.findIndex((p) => INSTITUTION.test(p))
    const degreeIndex = parts.findIndex((p) => DEGREE.test(p) && !INSTITUTION.test(p))
    const entry: EducationEntry = { degree: '', institution: '' }

    if (degreeIndex >= 0) {
      // "Master of Design, Interaction Design" → keep the specialisation with the degree.
      const end = instIndex > degreeIndex ? instIndex : parts.length
      entry.degree = parts.slice(degreeIndex, Math.min(end, degreeIndex + 2)).join(', ')
    }
    if (instIndex >= 0) {
      entry.institution = parts[instIndex]
      const after = parts[instIndex + 1]
      if (after && !DEGREE.test(after) && wordCount(after) <= 4) {
        entry.location = after
        issues.check(`${path}.location`, `“${after}” was read as the location. Check it.`)
      }
    }
    if (!entry.degree) {
      const first = parts.find((_p, j) => j !== instIndex)
      if (first) {
        entry.degree = first
        issues.check(`${path}.degree`, `No degree keyword found; “${first}” was used as the degree. Check it.`)
      } else {
        issues.required(`${path}.degree`, 'No degree or qualification found. Add one, or remove this entry.')
      }
    }
    if (!entry.institution) issues.missing(`${path}.institution`, 'No school or university found.')

    if (years.length >= 2) {
      entry.startYear = years[0]
      entry.endYear = years[years.length - 1]
    } else if (years.length === 1) {
      entry.endYear = years[0]
      issues.check(`${path}.endYear`, `Only one year (${years[0]}) was found; it is shown as the completion year.`)
    } else {
      issues.missing(`${path}.endYear`, 'No year found.')
    }
    return entry
  })

  if (grades.length > 0) unmapped.push({ title: 'Education: grades and scores', lines: grades })
  return entries
}

export function mapCertifications(lines: ResumeLine[], issues: IssueList): Certification[] {
  const merged: string[] = []
  for (const line of lines) {
    // A line starting in lower case continues the previous certification.
    if (merged.length > 0 && /^[a-z]/.test(line.text) && !line.bullet) merged[merged.length - 1] += ` ${line.text}`
    else merged.push(line.text)
  }
  return merged.map((text, i) => {
    const cert: Certification = { name: text }
    const years = findYears(text)
    if (years.length > 0) {
      cert.year = years[years.length - 1]
      cert.name = trimSeparators(text.replace(new RegExp(`[(,\\s–—-]*\\b${cert.year}\\b[)]?`), ''))
    } else {
      issues.missing(`certifications[${i}].year`, 'No year found.')
    }
    const issuer = cert.name.match(/^(.+?)\s*(?:[-–—,|]\s*)?(?:issued\s+by|issuer:|by)\s+(.+)$/i)
    if (issuer) {
      cert.name = trimSeparators(issuer[1])
      cert.issuer = trimSeparators(issuer[2])
    }
    return cert
  })
}

export interface ListResult {
  skills: string[]
  tools: string[]
}

/**
 * Splits skill or tool lines into items. A labelled line inside a skills
 * section ("Tools: Figma, Sketch") goes to the matching list.
 */
export function mapList(
  lines: ResumeLine[],
  target: 'skills' | 'tools',
  unmapped: UnmappedText[],
  isToolsLabel: (label: string) => boolean,
): ListResult {
  const result: ListResult = { skills: [], tools: [] }
  const tooLong: string[] = []
  for (const line of lines) {
    let text = line.text
    let list = target
    const labelled = text.match(/^([^:]{2,30}):\s*(.+)$/)
    if (labelled && wordCount(labelled[1]) <= 4) {
      if (isToolsLabel(labelled[1])) list = 'tools'
      text = labelled[2]
    }
    for (const item of text.split(/\s*(?:[,;|•·\t]|\s\/\s)\s*/)) {
      const value = trimSeparators(item)
      if (!value) continue
      if (value.length > 50 || wordCount(value) > 6) tooLong.push(value)
      else result[list].push(value)
    }
  }
  if (tooLong.length > 0) {
    unmapped.push({ title: target === 'skills' ? 'Skills: sentences (not single skills)' : 'Tools: sentences', lines: tooLong })
  }
  return result
}

export function dedupe(items: string[]): string[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
