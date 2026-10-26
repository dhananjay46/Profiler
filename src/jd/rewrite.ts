// Rewrites the text layers of a profile frame for a job description, without
// AI: everything is rule-based and runs locally.
//
// The JD is read into a title, a role summary, responsibilities and a list of
// technologies. The frame's layers are recognised by their position, size and
// the headings around them, then rewritten section by section:
//   - the job title under the name becomes the JD's title;
//   - the summary is rebuilt around the JD, keeping the greeting, name and years;
//   - Core Competencies ("**Label:** text" highlights) take the JD's
//     responsibilities;
//   - lists of skills, tools and competencies take the JD's terms, adding items
//     when the JD has more;
//   - every other sentence (project descriptions, role bullets, project updates,
//     case studies) is adapted: the old role becomes the new one, the profile's
//     own vocabulary is swapped for the JD's field, and sentences that still
//     name none of the JD's technologies gain a few of them;
//   - each experience entry also gets bullets built from the JD's responsibilities.
// Names, contact details, companies, dates, metrics, education and
// certifications are never touched.
//
// Being rule-based, it adapts sentences rather than rewriting them freely; the
// panel says so.

import type { FrameTextLayer, RewritePlan } from '../shared/messages'

export interface JobDescription {
  title?: string
  /** Sentences describing the role, from the JD's summary or overview. */
  summary: string[]
  responsibilities: { label?: string; text: string }[]
  /** Technologies, tools and skills named in the JD, in order of appearance. */
  terms: string[]
}

// ---------------------------------------------------------------- reading the JD

const TITLE_LINE = /^(?:job\s*title|role|position|title)\s*[:–-]\s*(.+)$/i
const RESPONSIBILITY_HEADING = /responsibilit|what you.?ll do|duties|day[- ]to[- ]day|the role\b/i
const SUMMARY_HEADING = /summary|overview|about (the )?(role|job|position)|purpose/i
const BULLET = /^\s*(?:[-*•‧●▪■▶►]+|\d+[.)])\s*/

function isHeading(line: string): boolean {
  if (line.length > 60 || /[.!?]$/.test(line)) return false
  if (/:\s*\S/.test(line)) return false
  return line.replace(/:$/, '').split(/\s+/).length <= 6
}

export function readJobDescription(input: string): JobDescription {
  const lines = input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(BULLET, '').trim())
    .filter(Boolean)
  const jd: JobDescription = { summary: [], responsibilities: [], terms: [] }
  let heading = ''
  let pendingLabel: string | undefined

  for (const line of lines) {
    // Questions and placeholders are notes to the writer, not part of the job.
    if (/\?$/.test(line)) continue
    const title = TITLE_LINE.exec(line)
    if (title) {
      jd.title ??= title[1].split(/\s+\/\s+|\s+or\s+/i)[0].replace(/\[.*?\]/g, '').trim()
      continue
    }
    if (isHeading(line)) {
      if (line.endsWith(':') && !RESPONSIBILITY_HEADING.test(line) && !SUMMARY_HEADING.test(line)) pendingLabel = line.slice(0, -1).trim()
      else {
        heading = line
        pendingLabel = undefined
      }
      continue
    }
    if (/^\[.*\]$/.test(line) || /^[\w\s]+:\s*\[.*\]$/.test(line)) continue

    const labelled = /^([^:]{2,50}):\s+(.+)$/.exec(line)
    const label = labelled?.[1] ?? pendingLabel
    const text = labelled?.[2] ?? line
    pendingLabel = undefined

    if (RESPONSIBILITY_HEADING.test(heading)) {
      jd.responsibilities.push({ label, text })
    } else if (SUMMARY_HEADING.test(heading) && !labelled && line.length >= 80) {
      jd.summary.push(...sentences(line))
    }
  }
  if (jd.summary.length === 0) {
    const intro = lines.find((l) => l.length >= 120 && !/:\s/.test(l.slice(0, 40)))
    if (intro) jd.summary.push(...sentences(intro))
  }
  jd.terms = findTerms(input)
  return jd
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean)
}

/** Well-known names, so they are found even without telltale casing, in their usual spelling. */
const KNOWN_TERMS = [
  'MERN Stack', 'MEAN Stack', 'MongoDB', 'Express.js', 'React.js', 'Node.js', 'Next.js', 'Vue.js', 'Angular',
  'TypeScript', 'JavaScript', 'Redux Toolkit', 'Redux', 'Context API', 'GraphQL', 'RESTful APIs', 'REST APIs',
  'Mongoose', 'JWT', 'OAuth', 'Jest', 'Mocha', 'Cypress', 'Playwright', 'Selenium', 'HTML5', 'CSS3', 'SCSS', 'Sass',
  'Tailwind CSS', 'Bootstrap', 'ES6+', 'React Hooks', 'Git', 'GitHub', 'GitLab', 'npm', 'yarn', 'Webpack', 'Vite',
  'AWS', 'Azure', 'GCP', 'Heroku', 'Vercel', 'Netlify', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'Linux',
  'Python', 'Django', 'Flask', 'Java', 'Spring Boot', 'Kotlin', 'Swift', 'Go', 'Rust', 'C#', '.NET', 'PHP', 'Laravel',
  'SQL', 'PostgreSQL', 'MySQL', 'Redis', 'Firebase', 'Supabase', 'Microservices', 'Serverless', 'WebSockets',
  'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'Miro', 'Jira', 'Confluence', 'Storybook',
  'Agile', 'Scrum', 'Kanban', 'TDD', 'Power BI', 'Tableau', 'Excel', 'Salesforce', 'SAP',
]
const NOT_TERMS = new Set(['api', 'apis', 'ui', 'ux', 'ui/ux', 'ux/ui', 'or', 'and', 'and/or', 'e.g', 'i.e', 'etc', 'it', 'hr', 'jd', 'ios', 'vcs', 'x+', 'odm', 'orm', 'devtools'])

function termKey(term: string): string {
  return term.toLowerCase().replace(/\.js$/, '').replace(/s$/, '')
}

/** Technology and tool names in the text, deduplicated, in order of first appearance. */
export function findTerms(text: string): string[] {
  const found: { term: string; index: number }[] = []
  const known = new Map(KNOWN_TERMS.map((t) => [termKey(t), t]))
  for (const term of KNOWN_TERMS) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(term).replace(/\\\.js$/, '(?:\\.js)?')})(?![A-Za-z0-9+])`, 'i')
    const match = pattern.exec(text)
    if (match) found.push({ term, index: match.index + match[1].length })
  }
  // Names that look technical: inner capitals (GraphQL), dots or symbols (Node.js, CI/CD), or short acronyms (AWS).
  const token = /[A-Za-z][A-Za-z0-9]*(?:[.#+/][A-Za-z0-9]+)*\+?/g
  let match: RegExpExecArray | null
  while ((match = token.exec(text)) !== null) {
    const word = match[0]
    if (NOT_TERMS.has(word.toLowerCase())) continue
    // "JavaScript/TypeScript" is two known names, found on their own above.
    if (word.includes('/') && word.split('/').every((part) => known.has(termKey(part)))) continue
    const technical = /[a-z][A-Z]/.test(word) || /^[A-Z]{2,5}\d?$/.test(word) || (/[.#+]/.test(word) && word.length <= 12 && /[A-Za-z]{2}/.test(word))
    if (technical) found.push({ term: known.get(termKey(word)) ?? word, index: match.index })
  }
  found.sort((a, b) => a.index - b.index)
  const out: string[] = []
  const seen = new Set<string>()
  for (const { term } of found) {
    const key = termKey(term)
    // "MERN" is already covered by "MERN Stack"; "React" by "React.js".
    if (seen.has(key) || out.some((t) => t.includes(' ') && termKey(t).split(' ').includes(key))) continue
    seen.add(key)
    out.push(term)
  }
  return out
}

// ---------------------------------------------------------------- verbs

const IRREGULAR: Record<string, string> = {
  build: 'built', write: 'wrote', lead: 'led', run: 'ran', make: 'made', drive: 'drove', take: 'took', set: 'set',
  keep: 'kept', hold: 'held', bring: 'brought', teach: 'taught', think: 'thought', grow: 'grew', give: 'gave',
  get: 'got', put: 'put', meet: 'met', find: 'found', understand: 'understood', oversee: 'oversaw', spend: 'spent',
}
const VERBS = new Set([
  'build', 'design', 'develop', 'implement', 'maintain', 'optimize', 'optimise', 'architect', 'create', 'write',
  'identify', 'ensure', 'participate', 'collaborate', 'lead', 'manage', 'deliver', 'deploy', 'integrate', 'test',
  'own', 'drive', 'improve', 'support', 'define', 'review', 'mentor', 'debug', 'monitor', 'automate', 'configure',
  'set', 'research', 'plan', 'analyze', 'analyse', 'document', 'coordinate', 'conduct', 'establish', 'migrate',
  'refactor', 'scale', 'secure', 'translate', 'work', 'partner', 'contribute', 'handle', 'run', 'make', 'take',
])

function pastOf(verb: string): string {
  const lower = verb.toLowerCase()
  let past = IRREGULAR[lower]
  if (!past) {
    if (lower.endsWith('e')) past = `${lower}d`
    else if (/[^aeiou]y$/.test(lower)) past = `${lower.slice(0, -1)}ied`
    else if (/^(plan|scan|ship|map|log|tag|chat)$/.test(lower)) past = `${lower}${lower.slice(-1)}ed`
    else past = `${lower}ed`
  }
  return verb[0] === verb[0].toUpperCase() ? past[0].toUpperCase() + past.slice(1) : past
}

/** "Build X, optimize Y and ensure Z" → "Built X, optimized Y and ensured Z". */
export function toPastTense(text: string): string {
  return text.replace(/(^|[,;]\s*|\band\s+|\bor\s+)([A-Za-z]+)\b/g, (whole, lead: string, word: string) =>
    VERBS.has(word.toLowerCase()) ? `${lead}${pastOf(word)}` : whole,
  )
}

/** "build X and ensure Y" → "builds X and ensures Y", for third-person summaries. */
function toThirdPerson(text: string): string {
  return text.replace(/(^|[,;]\s*|\band\s+|\bor\s+)([A-Za-z]+)\b/g, (whole, lead: string, word: string) => {
    if (!VERBS.has(word.toLowerCase())) return whole
    const s = /(s|sh|ch|x|z)$/.test(word) ? `${word}es` : /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`
    return `${lead}${s}`
  })
}

// ---------------------------------------------------------------- recognising layers

const PROTECTED = /@|https?:|www\.|\.com\b|\+?\d[\d\s().-]{7,}\d|linkedin/i
/** Factual "Label: value" lines, e.g. "Industry: Healthcare", "Duration: 2019 – 2021". */
const FACT_LINE = /^(?:industry|client|duration|location|domain|team size|employment type|tenure|period)\s*:/i
const PROTECTED_CONTEXT = /certif|educat|degree|universit|college|school|contact|award|languag/i
const LIST_CONTEXT = /skill|tool|tech|stack|software|competenc|method|framework|expertise|capabilit|strength|proficienc/i
const TERM_LIST_CONTEXT = /skill|tool|tech|stack|software|proficienc/i
const HIGHLIGHT_CONTEXT = /competenc|expertise|core|highlight|strength|key skill/i
const EXPERIENCE_CONTEXT = /experience|employment|career|work history|project|my role|responsib|roles?\b/i
const ROLE_TITLE = /\b(?:senior\s+|lead\s+|junior\s+|principal\s+)?(?:UX\s*\/\s*UI|UI\s*\/\s*UX|UX|UI|Product|Visual|Interaction|Graphic|Web)(?:\s+(?:and|&)\s+\w+)?\s+Designer\b/i

interface Info {
  layer: FrameTextLayer
  plain: string
  words: number
  /** The section name plus the nearest heading above the layer. */
  context: string
  boldOnly: boolean
}

function plainOf(text: string): string {
  return text.replace(/\*\*/g, '')
}

function describe(layers: FrameTextLayer[]): Info[] {
  const sizes = layers.map((l) => l.fontSize).sort((a, b) => a - b)
  const body = sizes[Math.floor(sizes.length / 2)] ?? 12
  let heading = ''
  return layers.map((layer) => {
    const plain = plainOf(layer.text).trim()
    const words = plain.split(/\s+/).length
    const boldOnly = /^\*\*[^*]+\*\*$/.test(layer.text.trim())
    const info: Info = { layer, plain, words, context: `${layer.section} ${heading}`, boldOnly }
    if (words <= 5 && !/[.:]$/.test(plain) && (layer.fontSize >= body + 2 || (boldOnly && layer.fontSize >= body))) {
      heading = plain
      info.context = `${layer.section} ${plain}`
    }
    return info
  })
}

// ---------------------------------------------------------------- the rewrite

export function rewriteForJd(jdText: string, layers: FrameTextLayer[]): RewritePlan {
  const jd = readJobDescription(jdText)
  const infos = describe(layers)
  const plan: RewritePlan = { changes: [], additions: [], notes: [] }
  const done = new Set<string>()
  const change = (info: Info, text: string): void => {
    if (text !== info.layer.text) plan.changes.push({ key: info.layer.key, text })
    done.add(info.layer.key)
  }
  const title = jd.title
  const responsibilities = jd.responsibilities.map((r) => ({ label: r.label, text: toPastTense(r.text) }))
  const labels = jd.responsibilities.map((r) => r.label).filter((l): l is string => !!l)

  // Name: the biggest text near the top. Title: the short line right after it.
  const top = infos.slice(0, 6)
  const name = top.reduce<Info | undefined>((best, i) => (!best || i.layer.fontSize > best.layer.fontSize ? i : best), undefined)
  if (name) done.add(name.layer.key)
  const nameIndex = name ? infos.indexOf(name) : -1
  const titleInfo = infos.slice(nameIndex + 1, nameIndex + 4).find((i) => i.words <= 6 && !PROTECTED.test(i.plain) && i.plain.length > 1)
  const oldTitle = titleInfo?.plain
  if (titleInfo && title) change(titleInfo, keepMarkers(titleInfo.layer.text, title))

  for (const info of infos) {
    if (PROTECTED.test(info.plain) || FACT_LINE.test(info.plain) || PROTECTED_CONTEXT.test(info.context)) done.add(info.layer.key)
  }

  // Summary: the first long paragraph after the title.
  const summary = infos.slice(Math.max(nameIndex, 0)).find((i) => !done.has(i.layer.key) && i.plain.length >= 150)
  if (summary && title) change(summary, buildSummary(summary.plain, oldTitle, title, jd))

  // Core Competencies: "**Label:** text" highlights take the JD's responsibilities, in order.
  // Labelled bullets elsewhere (project summaries) keep their facts and are adapted below.
  const highlights = infos.filter((i) => !done.has(i.layer.key) && /^\*\*[^*]{2,60}\*\*\s*:|^\*\*[^*]{2,60}:\*\*/.test(i.layer.text.trim()))
  const highlightGroups = groupBy(highlights, (i) => i.layer.section).filter(([, group]) => group.length >= 2 && group.some((i) => HIGHLIGHT_CONTEXT.test(i.context)))
  for (const [, group] of highlightGroups) {
    const usable = responsibilities.filter((r) => r.label)
    if (usable.length === 0) break
    const colonInside = /^\*\*[^*]+:\*\*/.test(group[0].layer.text.trim())
    const format = (r: { label?: string; text: string }): string => (colonInside ? `**${r.label}:** ${r.text}` : `**${r.label}**: ${r.text}`)
    group.forEach((info, i) => {
      if (i < usable.length) change(info, format(usable[i]))
    })
    const last = [...group].reverse().find((i) => i.layer.repeatable)
    if (last && usable.length > group.length) plan.additions.push({ afterKey: last.layer.key, texts: usable.slice(group.length).map(format) })
  }

  // Lists of short items under a skills/tools/competencies heading.
  const listItems = infos.filter((i) => !done.has(i.layer.key) && i.words <= 4 && i.plain.length <= 40 && LIST_CONTEXT.test(i.context))
  const termPool = [...jd.terms]
  const labelPool = [...labels, ...jd.terms]
  for (const [, group] of groupBy(listItems, (i) => i.layer.section)) {
    if (group.length < 2) continue
    const termsFirst = TERM_LIST_CONTEXT.test(group[0].context)
    const items = group.filter((i) => !i.boldOnly || !termsFirst)
    const headers = group.filter((i) => i.boldOnly && !termsFirst)
    const values = items.filter((i) => !headers.includes(i))
    // Column headers (bold) take responsibility labels; their items take terms.
    headers.forEach((info, i) => {
      const next = labels[i % Math.max(labels.length, 1)]
      if (next) change(info, `**${next}**`)
    })
    const pool = termsFirst || headers.length > 0 ? termPool : labelPool
    values.forEach((info) => {
      const next = pool.shift()
      if (next) change(info, keepMarkers(info.layer.text, next))
    })
    const last = [...values].reverse().find((i) => i.layer.repeatable)
    if (last && pool.length > 0 && termsFirst) plan.additions.push({ afterKey: last.layer.key, texts: pool.splice(0, 8) })
    for (const info of group) done.add(info.layer.key)
  }

  // Experience entries: each list of work bullets gets bullets built from the JD's responsibilities.
  // Status lists ("Project Update: launching in January") are left alone.
  const bullets = infos.filter((i) => !done.has(i.layer.key) && i.layer.repeatable && i.plain.length >= 40 && !/^\*\*/.test(i.layer.text.trim()) && EXPERIENCE_CONTEXT.test(i.context))
  const entries = groupBy(bullets, (i) => i.layer.section).filter(([, group]) => group.some((i) => describesWork(i.layer.text, i.words)))
  let next = 0
  for (const [, group] of entries) {
    if (responsibilities.length === 0) break
    const last = group[group.length - 1]
    const texts: string[] = []
    for (let n = 0; n < Math.min(2, responsibilities.length); n++) {
      texts.push(responsibilities[next % responsibilities.length].text)
      next++
    }
    plan.additions.push({ afterKey: last.layer.key, texts })
  }

  // Every remaining section, in reading order: role lines, project descriptions, bullets, case studies.
  const lexicon = lexiconFor(jdText, jd, layers)
  const stack = jd.terms.filter((t) => !title || !title.toLowerCase().includes(t.toLowerCase()))
  let turn = 0
  for (const info of infos) {
    if (done.has(info.layer.key)) continue
    let text = info.layer.text
    if (title) text = replaceRole(text, oldTitle, title)
    // Short lines (project names, headings, buttons) only take the new role.
    if (info.words >= 6) {
      text = applyLexicon(text, lexicon)
      // Only statements of work take the JD's stack: "Led…", "Built…", labelled bullets, long descriptions.
      if (stack.length > 0 && describesWork(text, info.words) && !mentionsAny(text, jd.terms)) {
        text = addStack(text, pick(stack, turn, info.words >= 25 ? 3 : 2))
        turn++
      }
    }
    if (text !== info.layer.text) change(info, text)
  }

  if (!title) plan.notes.push('The job description has no "Job Title:" line, so the title and summary were kept.')
  if (jd.responsibilities.length === 0) plan.notes.push('No responsibilities section was found in the job description, so no experience bullets were added.')
  plan.notes.push("Sentences are adapted by rules, not rewritten freely: role and field terms are swapped and the JD's stack is added. Read the result through before sharing it.")
  plan.notes.push('Images, logos and icons are unchanged; check that they still fit the new role.')
  return plan
}

// ---------------------------------------------------------------- adapting sentences

/**
 * Design vocabulary and its engineering counterpart, used when a design profile
 * is tailored to an engineering job. Longest phrases first, so "design system"
 * wins over "design".
 */
const DESIGN_TO_ENGINEERING: [string, string][] = [
  ['UX strategy and design', 'full-stack architecture and development'],
  ['end-to-end UX design', 'end-to-end full-stack development'],
  ['end-to-end UX process', 'end-to-end development lifecycle'],
  ['complete UX process', 'complete software development lifecycle'],
  ['user experience design', 'full-stack development'],
  ['end-to-end user experience', 'end-to-end application delivery'],
  ['UI/UX design', 'full-stack development'],
  ['UX/UI design', 'full-stack development'],
  ['UX design', 'full-stack development'],
  ['user interface design', 'frontend development'],
  ['interaction design', 'frontend engineering'],
  ['visual design', 'UI implementation'],
  ['product design', 'product engineering'],
  ['design thinking', 'engineering best practices'],
  ['design systems', 'component libraries'],
  ['design system', 'component library'],
  ['design tokens', 'reusable style tokens'],
  ['design reviews', 'code reviews'],
  ['design review', 'code review'],
  ['design-to-development handoff documentation', 'technical documentation'],
  ['design handoff', 'technical handoff'],
  ['design deliverables', 'code deliverables'],
  ['design documentation', 'technical documentation'],
  ['high-fidelity wireframes', 'production-ready UI components'],
  ['low-fidelity wireframes', 'UI scaffolds'],
  ['wireframes', 'UI components'],
  ['wireframing', 'component development'],
  ['wireframe', 'UI component'],
  ['interactive prototypes', 'interactive features'],
  ['clickable prototypes', 'working features'],
  ['prototypes', 'working features'],
  ['prototyping', 'rapid development'],
  ['prototype', 'working feature'],
  ['mockups', 'responsive layouts'],
  ['mock-ups', 'responsive layouts'],
  ['user flows', 'application flows'],
  ['user flow', 'application flow'],
  ['task flows', 'application flows'],
  ['usability testing', 'automated testing'],
  ['usability tests', 'integration tests'],
  ['user testing', 'end-to-end testing'],
  ['user research', 'requirements analysis'],
  ['UX research', 'technical discovery'],
  ['user interviews', 'requirements workshops'],
  ['personas', 'user stories'],
  ['journey maps', 'system flow diagrams'],
  ['journey mapping', 'system flow mapping'],
  ['information architecture', 'application architecture'],
  ['heuristic evaluation', 'code audit'],
  ['UI screens', 'UI views'],
  ['screens', 'views'],
  ['UX designers', 'software engineers'],
  ['UI designers', 'frontend engineers'],
  ['designers', 'engineers'],
  ['designer', 'engineer'],
  ['redesigned', 're-engineered'],
  ['redesign', 're-engineering'],
  ['designed', 'developed'],
  ['designing', 'developing'],
  ['UX', 'engineering'],
  ['design', 'development'],
]

/** Design tools a profile may name; each is swapped for one of the JD's own tools. */
const DESIGN_TOOLS = /\b(Figma|Adobe XD|Sketch|InVision|Zeplin|Miro|Photoshop|Illustrator|Axure|Balsamiq|Framer|Canva|ProtoPie|FigJam)\b/g

const ENGINEERING_TERMS = /\b(react|node|java|python|typescript|javascript|angular|vue|\.net|c#|golang|kotlin|swift|sql|mongodb|aws|docker|kubernetes|api|backend|frontend|full[- ]stack|devops|software engineer|developer)\b/gi

interface Lexicon {
  pattern: RegExp
  /** Lower-cased phrase → replacement. */
  to: Map<string, string>
}

function lexiconFor(jdText: string, jd: JobDescription, layers: FrameTextLayer[]): Lexicon | null {
  const profile = layers.map((l) => l.text).join(' ')
  const designProfile = (profile.match(/\b(UX|UI|design(?:er|ed|ing|s)?|wireframes?|prototypes?|usability)\b/gi) ?? []).length >= 5
  const engineeringJob = (jdText.match(ENGINEERING_TERMS) ?? []).length >= 5 && !/designer/i.test(jd.title ?? '')
  const to = new Map<string, string>()
  if (designProfile && engineeringJob) for (const [from, replacement] of DESIGN_TO_ENGINEERING) to.set(from.toLowerCase(), replacement)
  // Tools the profile names that the JD does not, swapped for the JD's own tools in turn.
  const jdTools = jd.terms.filter((t) => !/stack$/i.test(t))
  let i = 0
  for (const tool of new Set(profile.match(DESIGN_TOOLS) ?? [])) {
    if (jdTools.length === 0 || jd.terms.some((t) => t.toLowerCase() === tool.toLowerCase())) continue
    to.set(tool.toLowerCase(), jdTools[i++ % jdTools.length])
  }
  if (to.size === 0) return null
  // One alternation, longest phrase first, so "design system" wins over "design" and
  // nothing a replacement produced is ever replaced again.
  const phrases = [...to.keys()].sort((x, y) => y.length - x.length).map(escapeRegExp)
  return { pattern: new RegExp(`(^|[^A-Za-z0-9/-])(${phrases.join('|')})(?![A-Za-z0-9-])`, 'gi'), to }
}

function applyLexicon(text: string, lexicon: Lexicon | null): string {
  if (!lexicon) return text
  return text.replace(lexicon.pattern, (whole, lead: string, word: string, offset: number, all: string) => {
    const replacement = lexicon.to.get(word.toLowerCase())
    if (!replacement) return whole
    const before = plainOf(all.slice(0, offset + lead.length)).trimEnd()
    const sentenceStart = before === '' || /[.!?:]$/.test(before)
    return `${lead}${matchCase(word, replacement, sentenceStart)}`
  })
}

/** Capitalised like the word it replaces; an acronym ("UX") only counts at the start of a sentence. */
function matchCase(source: string, replacement: string, sentenceStart: boolean): string {
  const acronym = /^[A-Z]{2,}(?![a-z])/.test(source)
  if (/^[A-Z]/.test(source) && (!acronym || sentenceStart)) return replacement[0].toUpperCase() + replacement.slice(1)
  return replacement
}

function describesWork(text: string, words: number): boolean {
  const plain = plainOf(text).trim()
  if (/^[^:]{2,60}:\s/.test(plain)) return true
  if (words >= 25) return true
  const first = plain.split(/\s+/)[0]?.toLowerCase() ?? ''
  return /ed$/.test(first) || Object.values(IRREGULAR).includes(first)
}

function mentionsAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase()
  return terms.some((t) => lower.includes(t.toLowerCase().replace(/\.js$/, '')))
}

/** A few terms starting at a rotating position, so neighbouring bullets don't repeat each other. */
function pick(terms: string[], turn: number, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < Math.min(count, terms.length); i++) out.push(terms[(turn * count + i) % terms.length])
  return [...new Set(out)]
}

/** "Did X." → "Did X, using A and B." Paragraphs of several sentences get a short closing sentence instead. */
function addStack(text: string, terms: string[]): string {
  const list = joinList(terms)
  const trimmed = text.trimEnd()
  const end = /[.!]$/.test(trimmed) ? trimmed.slice(-1) : ''
  const body = end ? trimmed.slice(0, -1) : trimmed
  if (sentences(plainOf(trimmed)).length > 1) return `${trimmed}${end ? '' : '.'} Built with ${list}.`
  return `${body}, using ${list}${end || '.'}`
}

function buildSummary(original: string, oldTitle: string | undefined, title: string, jd: JobDescription): string {
  const firstPerson = /\bI\b|\bI['’]m\b|\bmy\b/.test(original)
  const role = roleIndex(original, oldTitle)
  // Keep the greeting and name ("Hi, I'm Asha, a result-driven ") when it comes first.
  const prefix = role && role.index <= 90 ? original.slice(0, role.index) : firstPerson ? "I'm a " : ''
  const years = /\b(?:over|more than|nearly|almost)?\s*\d+\+?\s*years?\b/i.exec(original)?.[0].trim()
  const stack = jd.terms.filter((t) => !title.toLowerCase().includes(t.toLowerCase())).slice(0, 5)
  const lead = `${prefix}${prefix ? title : `${article(title)} ${title}`.replace(/^./, (c) => c.toUpperCase())}${years ? ` with ${years} of experience` : ''}${stack.length > 0 ? ` building scalable, high-performance applications with ${joinList(stack)}` : ''}.`
  const about = jd.summary
    .map((s) => personal(s, firstPerson))
    .filter((s): s is string => !!s)
    .slice(0, 2)
  return [lead, ...about].join(' ')
}

/** Turn a JD sentence about the role into one about the candidate, or drop it. */
function personal(sentence: string, firstPerson: boolean): string | null {
  let s = sentence.trim()
  const seeking = /^we\s+are\s+(?:seeking|looking\s+for|hiring)\s+.+?\s+to\s+(.+)$/i.exec(s)
  if (seeking) s = seeking[1]
  else if (/^you\s+will\s+/i.test(s)) s = s.replace(/^you\s+will\s+/i, '')
  else if (/^(the|this)\s+(role|position|candidate)/i.test(s)) return null
  else if (/\b(we|our|us)\b/i.test(s)) return null
  s = s.replace(/\byour\b/gi, 'my').replace(/\byou\b/gi, 'I')
  if (firstPerson) return `I ${s.replace(/^./, (c) => c.toLowerCase())}`
  const third = toThirdPerson(s)
  return third.replace(/^./, (c) => c.toUpperCase())
}

function roleIndex(text: string, oldTitle: string | undefined): { index: number; length: number } | null {
  if (oldTitle) {
    const at = text.toLowerCase().indexOf(oldTitle.toLowerCase())
    if (at >= 0) return { index: at, length: oldTitle.length }
  }
  const match = ROLE_TITLE.exec(text)
  return match ? { index: match.index, length: match[0].length } : null
}

function replaceRole(text: string, oldTitle: string | undefined, title: string): string {
  let out = text
  if (oldTitle && oldTitle.length >= 4) out = out.replace(new RegExp(escapeRegExp(oldTitle), 'gi'), title)
  return out.replace(new RegExp(ROLE_TITLE.source, 'gi'), title)
}

/** New text in the layer's styling: wrapped in ** when the whole layer was. */
function keepMarkers(original: string, text: string): string {
  return /^\*\*[^*]+\*\*$/.test(original.trim()) ? `**${text}**` : text
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) && !/^(uni|use|eu)/i.test(word) ? 'an' : 'a'
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return [...groups]
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
