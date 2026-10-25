// Types for the JD Match feature.
//
// A JD is parsed into a list of Requirements. Each requirement is matched
// against the source profile to produce a MatchResult. The results together
// form a MatchReport with a weighted coverage score.

export type RequirementCategory =
  | 'skill'
  | 'tool'
  | 'responsibility'
  | 'domain'
  | 'experience'
  | 'education'
  | 'certification'
  | 'soft-skill'

export type Priority = 'mandatory' | 'preferred'

export interface Requirement {
  id: string
  text: string
  category: RequirementCategory
  priority: Priority
  /** Alternate phrasings (synonyms, acronyms, variations) to match against. */
  aliases: string[]
}

export type MatchStatus = 'met' | 'partial' | 'missing' | 'needs-verification'

export interface MatchEvidence {
  /** Where the matching text came from, e.g. "Skills", "Experience: Acme Co.". */
  section: string
  /** Exact snippet matched, trimmed. */
  snippet: string
}

export interface MatchResult {
  requirement: Requirement
  status: MatchStatus
  evidence: MatchEvidence[]
  /** Human-readable explanation for the status. */
  reason: string
}

export interface MatchReport {
  results: MatchResult[]
  /** Weighted score 0–100 across all requirements. */
  overallScore: number
  /** Weighted score 0–100 across only mandatory requirements. */
  mandatoryScore: number
  /** Count of met/partial/missing/needs-verification across all. */
  counts: Record<MatchStatus, number>
  /** Missing + partial mandatory requirements, in display order. */
  unresolvedGaps: MatchResult[]
}

export interface ParsedJD {
  role?: string
  client?: string
  requirements: Requirement[]
}

export interface JdSuggestion {
  id: string
  kind: 'reorder-experience' | 'highlight-skill' | 'highlight-tool' | 'summary-note'
  summary: string
  detail: string
  /** Default accepted; the user can reject it. */
  accepted: boolean
}
