// Turns the lines of an experience section into ExperienceEntry objects.
//
// Entries are recognised by "header" lines (dates, separators, bold or Title
// Case, short) or by labels such as "Project:", "Client:" and "Role:".
// Unlabelled header text is assigned in reading order (role, then company)
// and flagged for review; nothing is invented.

import type { ExperienceEntry } from '../shared/types'
import type { IssueList, UnmappedText } from './issues'
import { findDates, hasDateRange, splitParts, trimSeparators, wordCount } from './text'
import type { ResumeLine } from './types'

interface Draft {
  project?: string
  role?: string
  company?: string
  industry?: string
  region?: string
  startDate?: string
  endDate?: string
  headerLines: string[]
  body: string[]
  responsibilities: string[]
  extras: string[] // labelled details with no field, e.g. "Team size: 6"
  labelled: boolean
}

type Field = 'project' | 'role' | 'company' | 'industry' | 'region' | 'dates' | 'tools' | 'description' | 'extra'

const LABELS: [RegExp, Field][] = [
  [/^project(?:\s+(?:name|title))?$/i, 'project'],
  [/^(?:role|designation|position|job\s+title|title)$/i, 'role'],
  [/^(?:client|customer|company|employer|organi[sz]ation|firm)$/i, 'company'],
  [/^(?:domain|industry|sector|vertical)$/i, 'industry'],
  [/^(?:location|region|place|geography)$/i, 'region'],
  [/^(?:duration|period|dates?|tenure|timeline)$/i, 'dates'],
  [/^(?:tools(?:\s+used)?|technolog(?:y|ies)|tech\s+stack|software|environment|platforms?)$/i, 'tools'],
  [/^(?:description|project\s+description|summary|overview|about(?:\s+the)?\s+project)$/i, 'description'],
  [/^(?:team\s+size|team|methodology|reporting\s+to)$/i, 'extra'],
]

const RESPONSIBILITY_MARKER =
  /^(?:(?:key\s+)?(?:roles?\s*(?:&|and)\s*)?responsibilit(?:y|ies)|key\s+contributions?|contributions?|achievements?|key\s+achievements?|highlights?|accomplishments?)\s*:?$/i

export interface ExperienceResult {
  entries: ExperienceEntry[]
  /** Tools named in project details ("Tools used: …"). */
  tools: string[]
}

export function mapExperience(lines: ResumeLine[], issues: IssueList, unmapped: UnmappedText[]): ExperienceResult {
  const drafts: Draft[] = []
  const tools: string[] = []
  // Typed via `as` so TypeScript does not narrow it to null; start() reassigns it.
  let current = null as Draft | null
  let inResponsibilities = false
  let lastWasItem = false

  const start = (): Draft => {
    current = { headerLines: [], body: [], responsibilities: [], extras: [], labelled: false }
    drafts.push(current)
    inResponsibilities = false
    lastWasItem = false
    return current
  }
  const hasContent = (d: Draft | null) => !!d && (d.body.length > 0 || d.responsibilities.length > 0)

  for (const line of lines) {
    const text = line.text

    if (RESPONSIBILITY_MARKER.test(text)) {
      if (!current) start()
      inResponsibilities = true
      lastWasItem = false
      continue
    }

    const labelled = matchLabel(text)
    if (labelled) {
      const { field, value } = labelled
      let draft: Draft = current ?? start()
      // A project/role/company label starts a new entry once the current one
      // already has that field, or already has responsibilities.
      const repeats = (field === 'project' || field === 'role' || field === 'company') && !!draft[field]
      if (repeats || ((field === 'project' || field === 'role' || field === 'company') && hasContent(draft))) {
        draft = start()
      }
      draft.labelled = true
      applyLabel(draft, field, value, tools)
      lastWasItem = false
      continue
    }

    if (line.bullet) {
      const draft = current ?? start()
      draft.responsibilities.push(text)
      lastWasItem = true
      continue
    }

    const score = headerScore(line)

    // A wrapped line of the previous bullet (PDFs break long bullets into lines).
    if (lastWasItem && current && score < 2 && !line.breakBefore) {
      appendToLast(current.responsibilities, text)
      continue
    }

    if (score >= 2) {
      const draft: Draft = hasContent(current) ? start() : (current ?? start())
      draft.headerLines.push(text)
      inResponsibilities = false
      lastWasItem = false
      continue
    }

    const draft = current ?? start()
    if (inResponsibilities) {
      // Responsibilities written as plain lines after a "Responsibilities:" label.
      if (line.breakBefore || draft.responsibilities.length === 0 || /[.;:]$/.test(draft.responsibilities[draft.responsibilities.length - 1])) {
        draft.responsibilities.push(text)
      } else {
        appendToLast(draft.responsibilities, text)
      }
      lastWasItem = true
    } else {
      if (line.breakBefore || draft.body.length === 0) draft.body.push(text)
      else appendToLast(draft.body, text)
      lastWasItem = false
    }
  }

  const entries = drafts
    .filter((d) => d.headerLines.length > 0 || d.labelled || d.responsibilities.length > 0 || d.body.length > 0)
    .map((draft, i) => finishDraft(draft, i, issues, unmapped))
  return { entries, tools }
}

/** How much a non-bullet line looks like an entry header ("Designer | Acme | 2019 – 2021"). */
function headerScore(line: ResumeLine): number {
  const text = line.text
  const words = wordCount(text)
  let score = 0
  if (hasDateRange(text)) score += 3
  else if (findDates(text) && words <= 8) score += 2
  if (line.bold) score += 2
  if (line.heading) score += 1
  if (/\t|\s\|\s|\s[–—-]\s|\sat\s/.test(text)) score += 1
  if (titleCaseRatio(text) >= 0.6 && words <= 10) score += 1
  if (words <= 6 && !/[.!?;:]$/.test(text)) score += 1
  if (line.breakBefore) score += 0.5
  if (/[.!?]$/.test(text)) score -= 2
  if (words > 14) score -= 3
  if (/^[a-z]/.test(text)) score -= 3
  return score
}

function titleCaseRatio(text: string): number {
  const words = text.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && w.length > 3)
  if (words.length === 0) return 0
  return words.filter((w) => /^[A-Z]/.test(w)).length / words.length
}

function matchLabel(text: string): { field: Field; value: string } | null {
  const match = text.match(/^([A-Za-z][A-Za-z &/]{1,30}?)\s*[:–—]\s*(.+)$/)
  if (!match) return null
  for (const [pattern, field] of LABELS) {
    if (pattern.test(match[1].trim())) return { field, value: match[2].trim() }
  }
  return null
}

function applyLabel(draft: Draft, field: Field, value: string, tools: string[]): void {
  switch (field) {
    case 'dates': {
      const dates = findDates(value)
      if (dates) {
        draft.startDate = dates.start
        draft.endDate = dates.end
      } else {
        draft.extras.push(`Duration: ${value}`)
      }
      break
    }
    case 'tools':
      tools.push(...value.split(/\s*[,;|/]\s*/).map((t) => t.trim()).filter(Boolean))
      break
    case 'description':
      draft.body.push(value)
      break
    case 'extra':
      draft.extras.push(value)
      break
    default:
      draft[field] = value
  }
}

function finishDraft(draft: Draft, index: number, issues: IssueList, unmapped: UnmappedText[]): ExperienceEntry {
  const path = `experience[${index}]`
  const leftovers: string[] = [...draft.extras]
  const unlabelled: string[] = []

  for (const original of draft.headerLines) {
    let text = original
    if (!draft.startDate) {
      const dates = findDates(text)
      if (dates) {
        draft.startDate = dates.start
        draft.endDate = dates.end
        text = text.replace(dates.matched, ' ')
      }
    }
    const at = text.match(/^(.+?)\s+at\s+(.+)$/i)
    if (at && !/\t|\|/.test(text)) {
      unlabelled.push(trimSeparators(at[1]), trimSeparators(at[2]))
    } else {
      unlabelled.push(...splitParts(text).map(trimSeparators).filter(Boolean))
    }
  }

  // Fill empty fields from unlabelled header text, in reading order.
  const parts = unlabelled.filter(Boolean)
  const assigned: string[] = []
  if (!draft.role && !draft.project && parts.length > 0) {
    draft.role = parts.shift()
    assigned.push(`role "${draft.role}"`)
  }
  if (!draft.company && parts.length > 0) {
    draft.company = parts.shift()
    assigned.push(`company "${draft.company}"`)
  }
  if (!draft.region && parts.length === 1 && /,|remote|india|uk|usa|united|europe|worldwide|global/i.test(parts[0])) {
    draft.region = parts.shift()
    assigned.push(`location "${draft.region}"`)
  }
  // "Globex Ltd, London": the part after the last comma is the location.
  const comma = draft.company?.match(/^(.+),\s*([^,]+)$/)
  if (comma && !draft.region && assigned.some((a) => a.startsWith('company'))) {
    draft.company = comma[1]
    draft.region = comma[2]
    assigned[assigned.findIndex((a) => a.startsWith('company'))] = `company "${draft.company}", location "${draft.region}"`
  }
  leftovers.push(...parts)

  // No bullets, but several one-sentence paragraphs: treat them as responsibilities.
  if (draft.responsibilities.length === 0 && draft.body.length >= 2 && draft.body.every((p) => wordCount(p) <= 35)) {
    draft.responsibilities = draft.body
    draft.body = []
    issues.check(`${path}.responsibilities`, 'Separate lines under this entry were read as responsibilities. Check them.')
  }

  if (assigned.length > 0) {
    issues.check(
      `${path}.${draft.project ? 'company' : 'role'}`,
      `Read ${assigned.join(', ')} from “${draft.headerLines.join(' / ')}”. Check each value is in the right field.`,
    )
  }
  if (!draft.role && !draft.project) issues.required(`${path}.role`, 'No role or project name found. Add one, or remove this entry.')
  if (!draft.company) issues.missing(`${path}.company`, 'No company or client found.')
  if (!draft.startDate) issues.missing(`${path}.startDate`, 'No dates found.')
  else if (!draft.endDate) issues.check(`${path}.endDate`, `Only one date (“${draft.startDate}”) was found. Add the end date if there is one.`)
  if (draft.responsibilities.length === 0) issues.missing(`${path}.responsibilities`, 'No responsibilities found.')

  if (leftovers.length > 0) {
    unmapped.push({ title: `Experience ${index + 1}: other details`, lines: leftovers })
  }

  const entry: ExperienceEntry = { responsibilities: draft.responsibilities }
  if (draft.project) entry.project = draft.project
  if (draft.role || !draft.project) entry.role = draft.role ?? '' // empty role is flagged above
  if (draft.company) entry.company = draft.company
  if (draft.industry) entry.industry = draft.industry
  if (draft.region) entry.region = draft.region
  if (draft.startDate) entry.startDate = draft.startDate
  if (draft.endDate) entry.endDate = draft.endDate
  if (draft.body.length > 0) entry.description = draft.body.join(' ')
  return entry
}

function appendToLast(list: string[], text: string): void {
  if (list.length === 0) list.push(text)
  else list[list.length - 1] = `${list[list.length - 1]} ${text}`
}
