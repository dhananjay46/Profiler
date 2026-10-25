// Extracts a structured list of requirements from free-text JD input.
//
// The input is any string the user pastes. The output is a deduplicated list of
// requirements, each with a priority (mandatory vs preferred), a category (skill,
// tool, responsibility, etc.) and alias expansions used later during matching.
//
// This is deliberately rule-based (no AI). It's robust to typical JD shapes:
// bullet lists, "Required:" / "Preferred:" headings, "X+ years" phrases, etc.

import { expandAliases, SYNONYMS } from './synonyms'
import type { ParsedJD, Priority, Requirement, RequirementCategory } from './types'

const SECTION_HEADINGS: { pattern: RegExp; priority: Priority; category?: RequirementCategory }[] = [
  { pattern: /^(must[- ]?have|required(\s+skills)?|requirements|essential|minimum\s+qualifications?)\b.*:?$/i, priority: 'mandatory' },
  { pattern: /^(nice[- ]?to[- ]?have|preferred(\s+qualifications)?|bonus|desirable)\b.*:?$/i, priority: 'preferred' },
  { pattern: /^(responsibilities|duties|what\s+you.?ll\s+do|the\s+role)\b.*:?$/i, priority: 'mandatory', category: 'responsibility' },
  { pattern: /^(skills|technical\s+skills|tech\s+stack)\b.*:?$/i, priority: 'mandatory', category: 'skill' },
  { pattern: /^(tools?|technologies|software)\b.*:?$/i, priority: 'mandatory', category: 'tool' },
  { pattern: /^(education|academic\s+qualifications)\b.*:?$/i, priority: 'mandatory', category: 'education' },
  { pattern: /^(certifications?|credentials)\b.*:?$/i, priority: 'preferred', category: 'certification' },
  { pattern: /^(soft\s+skills|interpersonal\s+skills)\b.*:?$/i, priority: 'preferred', category: 'soft-skill' },
]

const CATEGORY_HINTS: { pattern: RegExp; category: RequirementCategory }[] = [
  { pattern: /\b(years?|yrs?)\s*(of\s+)?experience\b|\b\d+\+?\s*years?\b/i, category: 'experience' },
  { pattern: /\b(bachelor|master|phd|degree|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?)\b/i, category: 'education' },
  { pattern: /\b(certified|certification|certificate)\b/i, category: 'certification' },
  { pattern: /\b(figma|sketch|photoshop|illustrator|miro|jira|confluence|excel|powerpoint|azure|aws|gcp|docker|kubernetes)\b/i, category: 'tool' },
  { pattern: /\b(communication|collaboration|leadership|mentoring|empathy|stakeholder|cross[-\s]functional|teamwork)\b/i, category: 'soft-skill' },
  { pattern: /\b(design|develop|conduct|facilitate|lead|manage|deliver|create|collaborate|present|synthesi[sz]e|analyze|analyse)\b/i, category: 'responsibility' },
  { pattern: /\b(finance|banking|insurance|healthcare|retail|energy|telecom|automotive|public\s+sector|government|e[-\s]?commerce|saas)\b/i, category: 'domain' },
]

const INLINE_PREFERRED = /\b(nice\s*to\s*have|preferred|bonus|plus|desirable|optional)\b/i
const INLINE_MANDATORY = /\b(must(?:\s+have)?|required|essential|minimum|needed)\b/i

const ROLE_LINE = /^(role|position|job\s*title)\s*[:-]\s*(.+)$/i
const CLIENT_LINE = /^(client|company|employer|organi[sz]ation)\s*[:-]\s*(.+)$/i

const BULLET_PREFIX = /^\s*[-*•‧●▪■▶►]+\s*/

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+#./ -]/g, ' ').replace(/\s+/g, ' ').trim()
}

function cleanBullet(line: string): string {
  return line.replace(BULLET_PREFIX, '').replace(/^\d+[.)]\s+/, '').trim()
}

function splitLines(input: string): string[] {
  return input
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function categorize(line: string, override?: RequirementCategory): RequirementCategory {
  if (override) return override
  for (const { pattern, category } of CATEGORY_HINTS) {
    if (pattern.test(line)) return category
  }
  return 'skill'
}

function keywordsFrom(line: string): string[] {
  const stop = new Set([
    'the', 'and', 'with', 'for', 'from', 'into', 'that', 'this', 'these', 'those',
    'you', 'your', 'our', 'their', 'will', 'able', 'ability', 'strong', 'proven',
    'experience', 'experienced', 'knowledge', 'understanding', 'familiar', 'using',
    'use', 'work', 'working', 'skills', 'skill', 'years', 'year', 'yrs', 'plus',
    'etc', 'such', 'including', 'especially', 'ideally', 'preferably', 'must',
    'have', 'required', 'preferred', 'nice', 'bonus', 'essential', 'desirable',
    'minimum', 'maximum', 'least', 'more', 'less', 'than', 'over', 'under',
  ])
  const tokens = normalize(line).split(' ').filter((t) => t.length > 1 && !stop.has(t))
  const seen = new Set<string>()
  const out: string[] = []
  for (const token of tokens) {
    if (seen.has(token)) continue
    seen.add(token)
    out.push(token)
    if (out.length >= 5) break
  }
  return out
}

function aliasesFor(text: string): string[] {
  const base = keywordsFrom(text)
  const extra = new Set<string>(base)
  for (const token of base) {
    for (const alias of expandAliases(token)) extra.add(alias)
  }
  const lower = text.toLowerCase()
  for (const phrase of Object.keys(SYNONYMS)) {
    if (lower.includes(phrase)) {
      for (const alias of expandAliases(phrase)) extra.add(alias)
    }
  }
  const canonical = normalize(text)
  extra.delete(canonical)
  return [...extra].filter(Boolean)
}

function detectPriority(line: string, sectionDefault: Priority): Priority {
  if (INLINE_PREFERRED.test(line)) return 'preferred'
  if (INLINE_MANDATORY.test(line)) return 'mandatory'
  return sectionDefault
}

function dedupe(list: Requirement[]): Requirement[] {
  const seen = new Map<string, Requirement>()
  for (const req of list) {
    const key = `${req.category}::${normalize(req.text)}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, { ...req })
    } else if (existing.priority === 'preferred' && req.priority === 'mandatory') {
      seen.set(key, { ...req, id: existing.id })
    }
  }
  return [...seen.values()]
}

/**
 * Split a long "X, Y, and Z" line into separate requirements.
 * Keeps the line intact when it's a sentence rather than a list.
 */
function splitInlineList(text: string): string[] {
  if (!/,/.test(text)) return [text]
  const commas = (text.match(/,/g) || []).length
  if (commas < 2) return [text]
  if (/\b(and|while|because|so\s+that|in\s+order\s+to)\b.*[,;]/i.test(text)) return [text]
  const parts = text.split(/,\s*(?:and\s+)?|\s+and\s+/i).map((p) => p.trim()).filter(Boolean)
  if (parts.some((p) => p.split(' ').length > 6)) return [text]
  return parts
}

export function parseJD(input: string, meta?: { role?: string; client?: string }): ParsedJD {
  const lines = splitLines(input)
  let sectionPriority: Priority = 'mandatory'
  let sectionCategory: RequirementCategory | undefined
  let role = meta?.role?.trim() || undefined
  let client = meta?.client?.trim() || undefined
  const requirements: Requirement[] = []
  let idCounter = 0

  for (const raw of lines) {
    const roleMatch = ROLE_LINE.exec(raw)
    if (roleMatch && !role) {
      role = roleMatch[2].trim()
      continue
    }
    const clientMatch = CLIENT_LINE.exec(raw)
    if (clientMatch && !client) {
      client = clientMatch[2].trim()
      continue
    }

    // Heading detection: handles both "Must have:" alone and "Must have: X, Y" with inline content.
    let line = cleanBullet(raw)
    const colonIdx = raw.indexOf(':')
    const headPart = colonIdx >= 0 ? raw.slice(0, colonIdx).trim() : raw.trim()
    const tailPart = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : ''
    const headingHit = SECTION_HEADINGS.find((h) => h.pattern.test(headPart.replace(/:$/, '').trim()))
    if (headingHit && headPart.length < 60) {
      sectionPriority = headingHit.priority
      sectionCategory = headingHit.category
      if (!tailPart) continue
      line = cleanBullet(tailPart)
    }
    if (!line || line.length < 2) continue
    if (line.length > 300) continue

    for (const piece of splitInlineList(line)) {
      if (piece.length < 2) continue
      const priority = detectPriority(piece, sectionPriority)
      const category = categorize(piece, sectionCategory)
      requirements.push({
        id: `req-${++idCounter}`,
        text: piece,
        category,
        priority,
        aliases: aliasesFor(piece),
      })
    }
  }

  return { role, client, requirements: dedupe(requirements) }
}
