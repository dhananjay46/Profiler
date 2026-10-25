// Reads text from a selected Figma frame and maps it heuristically to a
// ConsultantProfile shape, so the JD matcher has something to compare against.
//
// This is a best-effort mapping: it looks for section headings matching the
// renderer's output (Education, Work Experience, Skills, Tools, Certifications)
// and treats their following text blocks as the content for that section.
// Anything it can't map goes into the summary field.

import type { ConsultantProfile, ExperienceEntry } from '../shared/types'

type Section = 'summary' | 'education' | 'experience' | 'skills' | 'tools' | 'certifications' | 'other'

const HEADINGS: { pattern: RegExp; section: Section }[] = [
  { pattern: /^education(\s*&?\s*certifications?)?$/i, section: 'education' },
  { pattern: /^certifications?$/i, section: 'certifications' },
  { pattern: /^(work\s+)?experience$/i, section: 'experience' },
  { pattern: /^skills$/i, section: 'skills' },
  { pattern: /^tools$/i, section: 'tools' },
  { pattern: /^summary|about$/i, section: 'summary' },
]

function detectHeading(text: string): Section | null {
  const t = text.trim()
  if (!t || t.length > 60) return null
  for (const { pattern, section } of HEADINGS) {
    if (pattern.test(t)) return section
  }
  return null
}

function collectTextNodes(node: SceneNode): TextNode[] {
  const out: TextNode[] = []
  const walk = (n: SceneNode): void => {
    if (n.type === 'TEXT') {
      out.push(n)
      return
    }
    if ('children' in n) {
      for (const child of n.children) walk(child)
    }
  }
  walk(node)
  return out
}

export function readProfileFromFrame(frame: FrameNode | ComponentNode | InstanceNode | GroupNode): ConsultantProfile {
  const texts = collectTextNodes(frame as unknown as SceneNode)
  // Order by vertical then horizontal position so the reader walks the layout.
  texts.sort((a, b) => a.absoluteBoundingBox!.y - b.absoluteBoundingBox!.y || a.absoluteBoundingBox!.x - b.absoluteBoundingBox!.x)

  const lines = texts.map((t) => t.characters.trim()).filter(Boolean)
  let name = ''
  let title = ''
  // The renderer places name as the largest text at the top; take the first two.
  if (lines.length > 0) name = lines[0]
  if (lines.length > 1) title = lines[1]

  const sections: Record<Section, string[]> = {
    summary: [],
    education: [],
    experience: [],
    skills: [],
    tools: [],
    certifications: [],
    other: [],
  }
  let current: Section = 'summary'
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]
    const heading = detectHeading(line)
    if (heading) {
      current = heading
      continue
    }
    sections[current].push(line)
  }

  const skills = flatten(sections.skills)
  const tools = flatten(sections.tools)
  const certifications = sections.certifications.map((name) => ({ name }))
  const education = sections.education.map((raw) => parseEducationLine(raw))
  const experience = parseExperienceLines(sections.experience)
  const summary = sections.summary.join('\n\n')

  return {
    header: { name: name || 'Unknown', title },
    summary,
    skills,
    tools,
    education,
    certifications,
    experience,
  }
}

function flatten(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    for (const part of line.split(/[,•·|]+/).map((s) => s.trim()).filter(Boolean)) {
      out.push(part)
    }
  }
  return out
}

function parseEducationLine(raw: string): { degree: string; institution?: string; endYear?: string } {
  const yearMatch = raw.match(/(19|20)\d{2}/)
  const endYear = yearMatch ? yearMatch[0] : undefined
  const parts = raw.split(/[—–,|]/).map((s) => s.trim()).filter(Boolean)
  return {
    degree: parts[0] || raw,
    institution: parts[1],
    endYear,
  }
}

function parseExperienceLines(lines: string[]): ExperienceEntry[] {
  // The renderer prints a heading line "**Project** | Role | Company | Industry | Region"
  // followed by a description paragraph and bullet responsibilities. We approximate.
  const entries: ExperienceEntry[] = []
  let current: ExperienceEntry | null = null
  for (const line of lines) {
    const looksLikeHeading = line.includes('|') || /^(project|role)[:-]/i.test(line)
    if (looksLikeHeading) {
      if (current) entries.push(current)
      const parts = line.split('|').map((s) => s.trim())
      current = {
        project: parts[0] || undefined,
        role: parts[1] || undefined,
        company: parts[2] || undefined,
        industry: parts[3] || undefined,
        region: parts[4] || undefined,
        responsibilities: [],
      }
      continue
    }
    if (!current) {
      current = { responsibilities: [] }
    }
    if (!current.description && line.length > 60 && !/^[-•*]/.test(line)) {
      current.description = line
    } else {
      current.responsibilities.push(line.replace(/^[-•*]\s*/, ''))
    }
  }
  if (current) entries.push(current)
  return entries
}
