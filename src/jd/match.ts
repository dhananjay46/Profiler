// Matches parsed requirements against a ConsultantProfile and produces a
// MatchReport with evidence, status per requirement, and a weighted score.
//
// Scoring:
//   met = 100%, partial = 50%, missing = 0%, needs-verification = uncertain
// Overall and mandatory scores exclude needs-verification from the denominator
// (we don't count uncertainty against the candidate).

import type { ConsultantProfile } from '../shared/types'
import { normalize } from './parse'
import type { MatchEvidence, MatchReport, MatchResult, MatchStatus, ParsedJD, Requirement } from './types'

/** Needles too generic to be meaningful on their own: they would match everything. */
const GENERIC_NEEDLES = new Set([
  'in', 'of', 'on', 'to', 'at', 'by', 'is', 'it', 'as', 'an', 'be', 'or', 'if',
  'with', 'for', 'from', 'the', 'and', 'you', 'your', 'our', 'strong',
  'experience', 'experienced', 'knowledge', 'skills', 'skill', 'work', 'working',
  'years', 'year', 'yrs', 'plus', 'ability', 'able', 'using', 'use',
  'must', 'have', 'required', 'preferred', 'proven', 'solid',
])

interface SourceChunk {
  section: string
  text: string
  normalized: string
}

function flattenProfile(profile: ConsultantProfile): SourceChunk[] {
  const chunks: SourceChunk[] = []
  const add = (section: string, text: string | undefined | null): void => {
    if (!text) return
    chunks.push({ section, text, normalized: normalize(text) })
  }
  add('Summary', profile.summary)
  for (const skill of profile.skills ?? []) add('Skills', skill)
  for (const tool of profile.tools ?? []) add('Tools', tool)
  for (const comp of profile.competencies ?? []) add('Competencies', comp.label)
  for (const edu of profile.education ?? []) {
    add('Education', [edu.degree, edu.institution].filter(Boolean).join(' · '))
  }
  for (const cert of profile.certifications ?? []) {
    add('Certifications', [cert.name, cert.issuer].filter(Boolean).join(' · '))
  }
  for (const exp of profile.experience ?? []) {
    const head = [exp.project, exp.role, exp.company, exp.industry].filter(Boolean).join(' | ')
    const section = `Experience: ${head || 'Entry'}`
    add(section, head)
    add(section, exp.description)
    for (const r of exp.responsibilities ?? []) add(section, r)
  }
  for (const cs of profile.caseStudies ?? []) {
    const section = `Case study: ${cs.title}`
    add(section, [cs.title, cs.client].filter(Boolean).join(' · '))
    add(section, cs.challenge)
    add(section, cs.solution)
    add(section, cs.outcome)
  }
  return chunks
}

function hasPhrase(hay: string, needle: string): boolean {
  if (!needle) return false
  if (needle.length < 2) return false
  // Word-boundary-aware when the needle is a single short token; substring otherwise
  if (/^[a-z0-9+#./-]+$/.test(needle) && needle.length <= 4) {
    const re = new RegExp(`(^|[^a-z0-9])${needle.replace(/[.+*?^$()[\]{}|\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i')
    return re.test(hay)
  }
  return hay.includes(needle)
}

function searchChunks(chunks: SourceChunk[], needles: string[]): MatchEvidence[] {
  const evidence: MatchEvidence[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    for (const needle of needles) {
      if (!needle) continue
      if (hasPhrase(chunk.normalized, needle)) {
        const key = `${chunk.section}::${chunk.text}`
        if (seen.has(key)) break
        seen.add(key)
        evidence.push({
          section: chunk.section,
          snippet: chunk.text.length > 160 ? `${chunk.text.slice(0, 157)}…` : chunk.text,
        })
        break
      }
    }
    if (evidence.length >= 3) break
  }
  return evidence
}

function tokensOf(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length > 2 && !GENERIC_NEEDLES.has(t))
}

function partialOverlap(chunks: SourceChunk[], requirement: Requirement): MatchEvidence[] {
  const reqTokens = tokensOf(requirement.text)
  if (reqTokens.length === 0) return []
  const results: MatchEvidence[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    const hits = reqTokens.filter((t) => chunk.normalized.includes(t))
    if (hits.length >= Math.max(2, Math.ceil(reqTokens.length / 3))) {
      const key = `${chunk.section}::${chunk.text}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({
          section: chunk.section,
          snippet: chunk.text.length > 160 ? `${chunk.text.slice(0, 157)}…` : chunk.text,
        })
      }
    }
    if (results.length >= 2) break
  }
  return results
}

function statusWeight(status: MatchStatus): number | null {
  if (status === 'met') return 100
  if (status === 'partial') return 50
  if (status === 'missing') return 0
  return null
}

function scoreOf(results: MatchResult[]): number {
  const weighted = results
    .map((r) => statusWeight(r.status))
    .filter((v): v is number => v !== null)
  if (weighted.length === 0) return 0
  return Math.round(weighted.reduce((a, b) => a + b, 0) / weighted.length)
}

export function matchProfile(jd: ParsedJD, profile: ConsultantProfile): MatchReport {
  const chunks = flattenProfile(profile)
  const results: MatchResult[] = jd.requirements.map((req) => matchOne(req, chunks))

  const mandatory = results.filter((r) => r.requirement.priority === 'mandatory')
  const unresolvedGaps = mandatory.filter((r) => r.status === 'missing' || r.status === 'partial')

  const counts: Record<MatchStatus, number> = {
    met: results.filter((r) => r.status === 'met').length,
    partial: results.filter((r) => r.status === 'partial').length,
    missing: results.filter((r) => r.status === 'missing').length,
    'needs-verification': results.filter((r) => r.status === 'needs-verification').length,
  }

  return {
    results,
    overallScore: scoreOf(results),
    mandatoryScore: scoreOf(mandatory),
    counts,
    unresolvedGaps,
  }
}

function matchOne(req: Requirement, chunks: SourceChunk[]): MatchResult {
  const needles = [normalize(req.text), ...req.aliases.map(normalize)]
    .map((n) => n.trim())
    .filter((n) => n.length >= 2 && !GENERIC_NEEDLES.has(n))
  const direct = searchChunks(chunks, needles)
  if (direct.length > 0) {
    return {
      requirement: req,
      status: 'met',
      evidence: direct,
      reason: direct.length === 1 ? 'Direct match in one section.' : `Direct matches in ${direct.length} sections.`,
    }
  }
  // Years-of-experience phrasing is often not literally documented.
  if (req.category === 'experience') {
    return {
      requirement: req,
      status: 'needs-verification',
      evidence: [],
      reason: 'Years of experience are not stated as a count. Review manually.',
    }
  }
  const partial = partialOverlap(chunks, req)
  if (partial.length > 0) {
    return {
      requirement: req,
      status: 'partial',
      evidence: partial,
      reason: 'Related terms found; the specific requirement is not stated directly.',
    }
  }
  return {
    requirement: req,
    status: 'missing',
    evidence: [],
    reason: 'Not documented in the profile. This is not proof the person lacks the skill.',
  }
}
