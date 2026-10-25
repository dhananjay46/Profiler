// The review screen: an editable form of the parsed profile, with every
// missing or guessed field highlighted, before anything is drawn in Figma.

import type { IssueLevel, ParseResult, ReviewIssue } from '../parser'
import type { Certification, ConsultantProfile, EducationEntry, ExperienceEntry } from '../shared/types'
import { validateProfile } from '../shared/validate'
import { getPath, setPath, shiftPath } from './paths'

type FieldKind = 'text' | 'textarea' | 'lines'
type ListName = 'experience' | 'education' | 'certifications'

interface State {
  profile: ConsultantProfile
  /** Issues from the parser (missing / check). Required errors come from live validation. */
  issues: ReviewIssue[]
  /** Fields the user has edited; their parser issues count as reviewed. */
  touched: Set<string>
  result: ParseResult
  fileName: string
}

export interface ReviewView {
  /** Current (edited) profile and whether it can be generated. */
  read(): { profile: ConsultantProfile; errors: string[] }
}

export function renderReview(
  root: HTMLElement,
  result: ParseResult,
  fileName: string,
  onChange: (state: { requiredCount: number; reviewCount: number }) => void,
): ReviewView {
  const state: State = {
    profile: structuredClone(result.profile),
    issues: result.issues.filter((issue) => issue.level !== 'required'),
    touched: new Set(),
    result,
    fileName,
  }

  const rerender = () => {
    const scroll = root.scrollTop
    const open = new Set([...root.querySelectorAll<HTMLDetailsElement>('details[data-key]')].filter((d) => d.open).map((d) => d.dataset.key))
    root.replaceChildren(...build(state, rerender, update))
    root.querySelectorAll<HTMLDetailsElement>('details[data-key]').forEach((d) => {
      if (open.size > 0) d.open = open.has(d.dataset.key)
    })
    root.scrollTop = scroll
    update()
  }

  /** Refresh highlights, section badges and the sticky header without rebuilding inputs (keeps focus). */
  const update = () => {
    const required = requiredIssues(state.profile)
    for (const field of root.querySelectorAll<HTMLElement>('.field[data-path]')) {
      const path = field.dataset.path!
      const issue =
        required.find((r) => matchesField(r.path, path)) ??
        (state.touched.has(path) ? undefined : state.issues.find((i) => i.path === path))
      setFieldStatus(field, issue)
    }
    updateSectionBadges(state, required, root)
    updateProgress(state, required, root)
    onChange({ requiredCount: required.length, reviewCount: openIssues(state).length })
  }

  rerender()
  return {
    read: () => ({ profile: structuredClone(state.profile), errors: validateProfile(state.profile) }),
  }
}

// ---------------------------------------------------------------- building

function build(state: State, rerender: () => void, update: () => void): Node[] {
  const { result } = state
  const bind = (label: string, path: string, kind: FieldKind = 'text', placeholder = '') =>
    field(state, label, path, kind, placeholder, update)

  const nodes: Node[] = [stickyHeader(state)]

  if (result.notes.length > 0) {
    nodes.push(el('ul', { class: 'notes' }, result.notes.map((note) => el('li', {}, [note]))))
  }

  nodes.push(
    section(state, 'header', 'Header', [
      bind('Name *', 'header.name'),
      bind('Job title', 'header.title'),
      el('div', { class: 'grid2' }, [bind('Location', 'header.location'), bind('Email', 'header.email')]),
      el('div', { class: 'grid2' }, [bind('Phone', 'header.phone'), bind('LinkedIn', 'header.linkedin')]),
    ]),
    section(state, 'summary', 'Summary', [
      bind('Summary', 'summary', 'textarea', 'Blank line between paragraphs. Wrap phrases in **double asterisks** for bold.'),
    ]),
    listSection(state, 'experience', 'Experience', rerender, (entry: ExperienceEntry, i) => {
      const p = `experience[${i}]`
      return [
        el('div', { class: 'grid2' }, [bind('Project', `${p}.project`), bind('Role', `${p}.role`)]),
        el('div', { class: 'grid2' }, [bind('Company / client', `${p}.company`), bind('Industry', `${p}.industry`)]),
        el('div', { class: 'grid2' }, [bind('Start date', `${p}.startDate`), bind('End date', `${p}.endDate`, 'text', 'e.g. Present')]),
        bind('Region', `${p}.region`),
        bind('Description', `${p}.description`, 'textarea'),
        bind('Responsibilities (one per line)', `${p}.responsibilities`, 'lines'),
      ]
    }, () => ({ role: '', responsibilities: [] })),
    listSection(state, 'education', 'Education', rerender, (_entry: EducationEntry, i) => {
      const p = `education[${i}]`
      return [
        bind('Degree *', `${p}.degree`),
        el('div', { class: 'grid2' }, [bind('Institution', `${p}.institution`), bind('Location', `${p}.location`)]),
        el('div', { class: 'grid2' }, [bind('Start year', `${p}.startYear`), bind('End year', `${p}.endYear`)]),
      ]
    }, () => ({ degree: '', institution: '' })),
    listSection(state, 'certifications', 'Certifications', rerender, (_cert: Certification, i) => {
      const p = `certifications[${i}]`
      return [
        bind('Name *', `${p}.name`),
        el('div', { class: 'grid2' }, [bind('Issuer', `${p}.issuer`), bind('Year', `${p}.year`)]),
        bind('Link URL', `${p}.url`, 'text', 'https://...'),
      ]
    }, () => ({ name: '' })),
    section(state, 'skills', 'Skills & tools', [
      bind('Skills (one per line)', 'skills', 'lines'),
      bind('Tools (one per line)', 'tools', 'lines'),
    ]),
  )

  if (result.unmapped.length > 0) {
    nodes.push(
      section(state, 'unmapped', 'Text not used in the profile', [
        el('p', { class: 'muted small', style: 'margin:0' }, ['For reference. Copy anything you need into the fields above.']),
        el(
          'div',
          { class: 'unmapped' },
          result.unmapped.flatMap((block) => [el('strong', {}, [block.title]), el('pre', {}, [block.lines.join('\n')])]),
        ),
      ], false),
    )
  }
  return nodes
}

// ---------------------------------------------------------------- sticky header

function stickyHeader(state: State): HTMLElement {
  const { profile, fileName } = state
  const stats = [
    `${profile.experience.length} ${plural(profile.experience.length, 'project', 'projects')}`,
    `${profile.education.length} education`,
    `${profile.certifications.length} ${plural(profile.certifications.length, 'cert', 'certs')}`,
    `${profile.skills.length} skills`,
    `${profile.tools.length} tools`,
  ].join(' · ')

  return el('div', { class: 'review-head', id: 'review-head' }, [
    el('div', { class: 'review-filename' }, [
      svg('file'),
      el('span', { class: 'fname', title: fileName }, [`Review “${fileName}”`]),
    ]),
    el('div', { class: 'review-stats' }, [`Found ${stats}. Missing details are left empty, nothing is made up.`]),
    el('div', { class: 'progress-row', id: 'review-progress' }, []),
  ])
}

function updateProgress(state: State, required: ReviewIssue[], root: HTMLElement): void {
  const row = root.querySelector('#review-progress')
  if (!row) return
  const open = openIssues(state)
  const checkCount = open.filter((i) => i.level === 'check').length
  const missingCount = open.filter((i) => i.level === 'missing').length

  const chips: Node[] = []
  if (required.length > 0) {
    chips.push(progressChip('required', required.length, 'required', 'alert'))
  }
  if (missingCount > 0) {
    chips.push(progressChip('review', missingCount, 'not found', 'eye'))
  }
  if (checkCount > 0) {
    chips.push(progressChip('review', checkCount, 'to check', 'eye'))
  }
  if (chips.length === 0) {
    chips.push(progressChip('ready', 0, 'Ready to generate', 'check'))
  }
  row.replaceChildren(...chips)
}

function progressChip(kind: 'ready' | 'required' | 'review', count: number, label: string, icon: 'check' | 'alert' | 'eye'): HTMLElement {
  const chip = el('span', { class: `progress-chip ${kind}` }, [svg(icon)])
  const text = kind === 'ready' ? label : `${count} ${label}`
  chip.append(text)
  return chip
}

// ---------------------------------------------------------------- sections

function section(_state: State, key: string, title: string, children: Node[], open = true): HTMLElement {
  const details = el('details', { class: 'section', 'data-key': key }, [
    el('summary', {}, [
      el('span', { class: 'chev' }),
      el('span', { class: 'title' }, [title]),
      el('span', { class: 'status-badge', 'data-badge': key }, []),
    ]),
    el('div', { class: 'section-body' }, children),
  ]) as HTMLDetailsElement
  details.open = open
  return details
}

function listSection<T>(
  state: State,
  list: ListName,
  title: string,
  rerender: () => void,
  fields: (item: T, index: number) => Node[],
  blank: () => T,
): HTMLElement {
  const items = state.profile[list] as unknown as T[]
  const sectionIssue = state.issues.find((issue) => issue.path === list)
  const body: Node[] = []
  if (sectionIssue && items.length === 0) {
    body.push(el('p', { class: 'muted small', style: 'margin:0' }, [sectionIssue.message]))
  }
  const singular = title.replace(/s$/, '')
  items.forEach((item, i) => {
    body.push(
      el('div', { class: 'entry' }, [
        el('div', { class: 'entry-head' }, [
          el('strong', {}, [`${singular} ${i + 1}`]),
          button('Remove', 'btn small', () => {
            items.splice(i, 1)
            remapAfterRemove(state, list, i)
            rerender()
          }),
        ]),
        ...fields(item, i),
      ]),
    )
  })
  body.push(
    button(`+ Add ${singular.toLowerCase()}`, 'btn small', () => {
      items.push(blank())
      rerender()
    }),
  )
  const details = section(state, list, `${title}`, body)
  const summary = details.querySelector('summary') as HTMLElement
  summary.insertBefore(
    el('span', { class: 'count' }, [`${items.length}`]),
    summary.querySelector('.status-badge'),
  )
  return details
}

function updateSectionBadges(state: State, required: ReviewIssue[], root: HTMLElement): void {
  const bySection: Record<string, { req: number; review: number }> = {}
  for (const issue of required) {
    const key = sectionKeyOf(issue.path)
    if (!key) continue
    bySection[key] = bySection[key] ?? { req: 0, review: 0 }
    bySection[key].req++
  }
  for (const issue of openIssues(state)) {
    const key = sectionKeyOf(issue.path)
    if (!key) continue
    bySection[key] = bySection[key] ?? { req: 0, review: 0 }
    bySection[key].review++
  }
  for (const badge of root.querySelectorAll<HTMLElement>('.status-badge[data-badge]')) {
    const key = badge.dataset.badge!
    const stats = bySection[key]
    if (!stats || (stats.req === 0 && stats.review === 0)) {
      badge.className = 'status-badge ok'
      badge.textContent = key === 'unmapped' ? '' : 'OK'
      if (key === 'unmapped') badge.classList.remove('ok')
    } else if (stats.req > 0) {
      badge.className = 'status-badge err'
      badge.textContent = `${stats.req} to fill`
    } else {
      badge.className = 'status-badge warn'
      badge.textContent = `${stats.review} to check`
    }
  }
}

function sectionKeyOf(path: string): string | null {
  if (!path) return null
  const key = path.split(/[.[]/)[0]
  if (key === 'tools') return 'skills'
  if (key === 'header' || key === 'summary' || key === 'experience' || key === 'education' || key === 'certifications' || key === 'skills') return key
  return null
}

function field(
  state: State,
  label: string,
  path: string,
  kind: FieldKind,
  placeholder: string,
  update: () => void,
): HTMLElement {
  const value = getPath(state.profile, path)
  const text = kind === 'lines' ? ((value as string[] | undefined) ?? []).join('\n') : ((value as string | undefined) ?? '')
  const id = `f-${path.replace(/[^\w]/g, '-')}`
  const input =
    kind === 'text'
      ? el('input', { id, type: 'text', placeholder })
      : el('textarea', { id, rows: kind === 'lines' ? '5' : '4', placeholder })
  ;(input as HTMLInputElement).value = text
  input.addEventListener('input', () => {
    const raw = (input as HTMLInputElement).value
    setPath(state.profile, path, kind === 'lines' ? raw.split('\n').map((l) => l.trim()).filter(Boolean) : raw)
    state.touched.add(path)
    update()
  })

  // Pull out the required marker so it can be styled separately.
  const required = /\*$/.test(label)
  const cleanLabel = label.replace(/\s*\*$/, '')
  const labelNode = el('label', { for: id }, [cleanLabel])
  if (required) labelNode.append(el('span', { class: 'req', title: 'Required' }, [' *']))

  return el('div', { class: 'field', 'data-path': path }, [labelNode, input, el('div', { class: 'note' })])
}

// ---------------------------------------------------------------- issues

function requiredIssues(profile: ConsultantProfile): ReviewIssue[] {
  return validateProfile(profile).map((message) => ({
    path: message.split(' ')[0],
    level: 'required' as const,
    message: capitalize(message.replace(/^\S+\s/, '').replace(/^is required\.$/, 'Required.')),
  }))
}

/** "experience[0]" (needs a project or role) highlights both of those fields. */
function matchesField(issuePath: string, fieldPath: string): boolean {
  if (issuePath === fieldPath) return true
  return /\[\d+\]$/.test(issuePath) && (fieldPath === `${issuePath}.role` || fieldPath === `${issuePath}.project`)
}

function setFieldStatus(field: HTMLElement, issue: ReviewIssue | undefined): void {
  field.classList.remove('required', 'missing', 'check')
  const note = field.querySelector('.note')!
  note.replaceChildren()
  if (issue) {
    field.classList.add(issue.level)
    note.append(svg(ICON_FOR_LEVEL[issue.level]), document.createTextNode(issue.message))
  }
}

function openIssues(state: State): ReviewIssue[] {
  return state.issues.filter((issue) => !state.touched.has(issue.path))
}

const ICON_FOR_LEVEL: Record<IssueLevel, 'alert' | 'eye' | 'eye'> = {
  required: 'alert',
  missing: 'eye',
  check: 'eye',
}

function remapAfterRemove(state: State, list: ListName, index: number): void {
  state.issues = state.issues
    .map((issue) => ({ ...issue, path: shiftPath(issue.path, list, index) }))
    .filter((issue): issue is ReviewIssue => issue.path !== null)
  state.touched = new Set([...state.touched].map((p) => shiftPath(p, list, index)).filter((p): p is string => p !== null))
}

// ---------------------------------------------------------------- DOM helpers

function el(tag: string, attrs: Record<string, string>, children: (Node | string)[] = []): HTMLElement {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) if (value !== '') node.setAttribute(key, value)
  node.append(...children)
  return node
}

function button(label: string, className: string, onClick: () => void, children: Node[] = []): HTMLButtonElement {
  const node = el('button', { type: 'button', class: className }, label ? [label, ...children] : children) as HTMLButtonElement
  node.addEventListener('click', onClick)
  return node
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

// Inline SVGs so we don't depend on an icon font.
const SVG_PATHS: Record<string, string> = {
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
}

function svg(name: keyof typeof SVG_PATHS | string): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  node.setAttribute('viewBox', '0 0 24 24')
  node.setAttribute('fill', 'none')
  node.setAttribute('stroke', 'currentColor')
  node.setAttribute('stroke-width', '2')
  node.setAttribute('stroke-linecap', 'round')
  node.setAttribute('stroke-linejoin', 'round')
  node.setAttribute('aria-hidden', 'true')
  node.innerHTML = SVG_PATHS[name] ?? ''
  return node
}
