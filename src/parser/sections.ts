// Recognises resume section headings such as "Work Experience", "SKILLS:" or
// "Employment History", including headings with content on the same line
// ("Skills: Figma, Sketch").

export type SectionKind =
  | 'summary'
  | 'experience'
  | 'education'
  | 'educationAndCertifications'
  | 'certifications'
  | 'skills'
  | 'tools'
  | 'contact'
  | 'other'

const HEADINGS: Record<SectionKind, string[]> = {
  summary: [
    'summary', 'professional summary', 'profile', 'profile summary', 'professional profile', 'about me', 'about',
    'objective', 'career objective', 'career summary', 'overview', 'executive summary', 'experience summary',
    'personal statement', 'introduction', 'summary of qualifications',
  ],
  experience: [
    'experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history',
    'career history', 'relevant experience', 'projects', 'project experience', 'key projects', 'professional background',
    'project details', 'projects handled', 'assignments', 'career', 'experience details', 'work',
  ],
  education: [
    'education', 'academic background', 'academics', 'academic qualifications', 'educational qualifications',
    'educational qualification', 'qualifications', 'education and training', 'academic details', 'educational background',
    'academic profile', 'education details',
  ],
  educationAndCertifications: ['education and certifications', 'education and certification', 'certifications and education'],
  certifications: [
    'certifications', 'certification', 'certificates', 'licenses', 'licences', 'licenses and certifications',
    'courses', 'training', 'trainings', 'professional development', 'certifications and training',
    'professional certifications', 'courses and certifications',
  ],
  skills: [
    'skills', 'core skills', 'key skills', 'technical skills', 'skill set', 'skillset', 'competencies',
    'core competencies', 'areas of expertise', 'expertise', 'key competencies', 'strengths', 'professional skills',
    'soft skills', 'skills and expertise', 'design skills',
  ],
  tools: [
    'tools', 'software', 'technologies', 'tech stack', 'tools and technologies', 'software skills', 'technical tools',
    'design tools', 'tools and software', 'software and tools', 'tools used',
  ],
  contact: ['contact', 'contact details', 'contact information', 'personal details', 'personal information'],
  other: [
    'languages', 'language', 'interests', 'hobbies', 'hobbies and interests', 'references', 'awards', 'achievements',
    'awards and achievements', 'honors', 'honours', 'publications', 'volunteering', 'volunteer experience',
    'declaration', 'extracurricular activities', 'activities', 'accomplishments', 'additional information',
  ],
}

const LOOKUP = new Map<string, SectionKind>()
for (const [kind, names] of Object.entries(HEADINGS) as [SectionKind, string[]][]) {
  for (const name of names) LOOKUP.set(name, kind)
}

export interface HeadingMatch {
  kind: SectionKind
  /** The heading as written, e.g. "WORK HISTORY". */
  title: string
  /** Text after "Heading:" on the same line, if any. */
  rest: string
}

export function matchHeading(text: string): HeadingMatch | null {
  const whole = lookup(text)
  if (whole) return { kind: whole, title: text.trim(), rest: '' }

  // "Skills: Figma, Sketch" or "Tools - Figma"
  const inline = text.match(/^([^:–—-]{3,40})\s*[:–—-]\s+(.+)$/)
  if (inline) {
    const kind = lookup(inline[1])
    if (kind) return { kind, title: inline[1].trim(), rest: inline[2].trim() }
  }
  return null
}

function lookup(text: string): SectionKind | null {
  if (text.length > 45) return null
  const key = text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (key === '' || key.split(' ').length > 5) return null
  return LOOKUP.get(key) ?? null
}
