// Small text utilities used by the resume mapper.

import type { ResumeLine } from './types'

const BULLET = /^(?:[•●▪■◦○◆◇►▸▶➢➤✓✔∙·*]|[-–—](?=\s)|\(?\d{1,2}[.)])\s*/

/**
 * Cleans up lines and detects typed bullets ("•", "-", "1."), removing the
 * marker. A line that is only a bullet glyph marks the next line as a bullet.
 */
export function normalizeLines(lines: ResumeLine[]): ResumeLine[] {
  const out: ResumeLine[] = []
  let pendingBullet = false
  for (const line of lines) {
    const text = line.text
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/[ \u00a0]+/g, ' ')
      .replace(/ *\t[\t ]*/g, '\t')
      .trim()
    if (text === '') continue
    if (/^[•●▪■◦○◆◇►▸▶➢➤✓✔∙·*-]$/.test(text)) {
      pendingBullet = true
      continue
    }
    const marker = text.match(BULLET)
    // "2019 - 2020" or "10.5" are not bullets: require text after the marker.
    const isTypedBullet = !!marker && marker[0].length < text.length && !/^\d{1,2}[.)]\d/.test(text)
    out.push({
      ...line,
      text: isTypedBullet ? text.slice(marker![0].length).trim() : text,
      bullet: line.bullet || isTypedBullet || pendingBullet,
    })
    pendingBullet = false
  }
  return out
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

// ---- Dates ----

const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?'
const YEAR = '(?:19|20)\\d{2}'
const DATE = `(?:${MONTH}\\s*,?\\s*${YEAR}|\\d{1,2}[/.-]${YEAR}|${YEAR})`
const CURRENT = '(?:present|current|now|till\\s+date|to\\s+date|ongoing|today)'
const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|to|till|until)\\s*(${DATE}|${CURRENT})`, 'i')
const SINGLE = new RegExp(`\\b(${DATE})\\b`, 'i')

export interface DateMatch {
  start: string
  /** As written, e.g. "Mar 2021" or "Present". Undefined when only one date is given. */
  end?: string
  /** The matched text, for removing it from the line. */
  matched: string
}

/** Finds a date range ("Jan 2019 – Present", "06/2019 - 08/2021", "2015–2017") or a single date. */
export function findDates(text: string): DateMatch | null {
  const range = text.match(RANGE)
  if (range) return { start: tidyDate(range[1]), end: tidyDate(range[2]), matched: range[0] }
  const single = text.match(SINGLE)
  if (single) return { start: tidyDate(single[1]), matched: single[0] }
  return null
}

export function hasDateRange(text: string): boolean {
  return RANGE.test(text)
}

export function findYears(text: string): string[] {
  return text.match(new RegExp(`\\b${YEAR}\\b`, 'g')) ?? []
}

function tidyDate(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return /^[a-z]/.test(text) ? text[0].toUpperCase() + text.slice(1) : text
}

// ---- Contact details ----

export const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/
export const LINKEDIN = /(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/[^\s|,;]+/i
export const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d[\d\s.-]{6,}\d/

/** Splits text on the separators resumes commonly use between fields. */
export function splitParts(text: string): string[] {
  return text
    .split(/\s*(?:\t|\||•|·|\s[-–—]\s|\s{3,})\s*/)
    .map((part) => part.trim())
    .filter((part) => part !== '' && !/^[-–—,|]+$/.test(part))
}

/** Removes leftover separators at the ends of a fragment. */
export function trimSeparators(text: string): string {
  return text.replace(/^[\s,|:;\-–—()]+|[\s,|:;\-–—()]+$/g, '').trim()
}
