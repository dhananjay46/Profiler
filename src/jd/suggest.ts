// Generates evidence-backed suggestions for tailoring a profile to a JD.
// Never invents facts: suggestions only reorder, highlight or annotate.

import type { ConsultantProfile, ExperienceEntry } from '../shared/types'
import { normalize } from './parse'
import type { JdSuggestion, MatchReport, ParsedJD } from './types'

export interface TailorPlan {
  suggestions: JdSuggestion[]
  /** Experience entries re-sorted by relevance. Original order preserved as `originalIndex`. */
  experienceOrder: number[]
  /** Skills promoted to the top (deduped). */
  promotedSkills: string[]
  /** Tools promoted to the top (deduped). */
  promotedTools: string[]
}

function experienceRelevance(entry: ExperienceEntry, jd: ParsedJD): number {
  const text = normalize(
    [
      entry.project ?? '',
      entry.role ?? '',
      entry.company ?? '',
      entry.industry ?? '',
      entry.description ?? '',
      ...(entry.responsibilities ?? []),
    ].join(' '),
  )
  if (!text) return 0
  let score = 0
  for (const req of jd.requirements) {
    const weight = req.priority === 'mandatory' ? 2 : 1
    const terms = [req.text, ...req.aliases].map(normalize).filter(Boolean)
    for (const term of terms) {
      if (term.length >= 2 && text.includes(term)) {
        score += weight
        break
      }
    }
  }
  return score
}

export function buildTailorPlan(jd: ParsedJD, profile: ConsultantProfile, report: MatchReport): TailorPlan {
  const suggestions: JdSuggestion[] = []
  let idCounter = 0
  const nextId = (): string => `sug-${++idCounter}`

  // Reorder experience by relevance.
  const scores = (profile.experience ?? []).map((entry, index) => ({ index, score: experienceRelevance(entry, jd) }))
  const sorted = [...scores].sort((a, b) => b.score - a.score || a.index - b.index)
  const experienceOrder = sorted.map((s) => s.index)
  const changed = experienceOrder.some((idx, i) => idx !== i)
  if (changed && experienceOrder.length > 1) {
    suggestions.push({
      id: nextId(),
      kind: 'reorder-experience',
      summary: 'Reorder experience to put JD-relevant projects first',
      detail: `New order: ${experienceOrder
        .map((idx) => profile.experience?.[idx]?.project || profile.experience?.[idx]?.role || `Entry ${idx + 1}`)
        .join(' → ')}`,
      accepted: true,
    })
  }

  // Promote met skills/tools to top.
  const metSkillTexts = new Set(
    report.results
      .filter((r) => r.status === 'met' && (r.requirement.category === 'skill' || r.requirement.category === 'soft-skill'))
      .map((r) => normalize(r.requirement.text)),
  )
  const metToolTexts = new Set(
    report.results.filter((r) => r.status === 'met' && r.requirement.category === 'tool').map((r) => normalize(r.requirement.text)),
  )

  const promotedSkills = promote(profile.skills ?? [], metSkillTexts)
  const promotedTools = promote(profile.tools ?? [], metToolTexts)

  if (promotedSkills.length > 0 && !sameOrder(profile.skills ?? [], promotedSkills)) {
    suggestions.push({
      id: nextId(),
      kind: 'highlight-skill',
      summary: 'Promote JD-matched skills to the top of the Skills list',
      detail: `Promoted: ${firstFew(promotedSkills, profile.skills ?? [])}`,
      accepted: true,
    })
  }
  if (promotedTools.length > 0 && !sameOrder(profile.tools ?? [], promotedTools)) {
    suggestions.push({
      id: nextId(),
      kind: 'highlight-tool',
      summary: 'Promote JD-matched tools to the top of the Tools list',
      detail: `Promoted: ${firstFew(promotedTools, profile.tools ?? [])}`,
      accepted: true,
    })
  }

  // Gap note on the summary: never rewrites, just flags.
  const mandatoryGaps = report.unresolvedGaps.filter((g) => g.status === 'missing')
  if (mandatoryGaps.length > 0) {
    suggestions.push({
      id: nextId(),
      kind: 'summary-note',
      summary: `${mandatoryGaps.length} mandatory requirement${mandatoryGaps.length === 1 ? '' : 's'} not documented. Confirm with the consultant before sharing.`,
      detail: mandatoryGaps.map((g) => `• ${g.requirement.text}`).join('\n'),
      accepted: false,
    })
  }

  return { suggestions, experienceOrder, promotedSkills, promotedTools }
}

function promote(list: string[], matched: Set<string>): string[] {
  if (list.length === 0 || matched.size === 0) return list.slice()
  const top: string[] = []
  const rest: string[] = []
  for (const item of list) {
    const key = normalize(item)
    if ([...matched].some((m) => key.includes(m) || m.includes(key))) {
      top.push(item)
    } else {
      rest.push(item)
    }
  }
  return [...top, ...rest]
}

function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

function firstFew(after: string[], before: string[]): string {
  // Show items that actually moved up.
  const movedUp: string[] = []
  for (let i = 0; i < after.length; i++) {
    const originalIndex = before.indexOf(after[i])
    if (originalIndex > i) movedUp.push(after[i])
    if (movedUp.length >= 5) break
  }
  return movedUp.length > 0 ? movedUp.join(', ') : after.slice(0, 5).join(', ')
}

/** Apply a tailor plan (with user-accepted suggestions) to produce a tailored profile copy. */
export function applyTailorPlan(
  profile: ConsultantProfile,
  plan: TailorPlan,
  acceptedIds: Set<string>,
): ConsultantProfile {
  const next: ConsultantProfile = {
    ...profile,
    skills: profile.skills ? [...profile.skills] : [],
    tools: profile.tools ? [...profile.tools] : [],
    experience: profile.experience ? [...profile.experience] : [],
  }
  for (const s of plan.suggestions) {
    if (!acceptedIds.has(s.id)) continue
    if (s.kind === 'reorder-experience' && plan.experienceOrder.length === next.experience.length) {
      next.experience = plan.experienceOrder.map((i) => next.experience[i])
    }
    if (s.kind === 'highlight-skill') next.skills = plan.promotedSkills
    if (s.kind === 'highlight-tool') next.tools = plan.promotedTools
  }
  return next
}
