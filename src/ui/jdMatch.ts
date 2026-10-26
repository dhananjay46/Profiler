// The JD Match tab: pick a source profile (a frame on the canvas or a built-in
// profile), paste a JD, and create the tailored profile.
//
// For a frame on the canvas, Analyze first reads its text layers (via the main
// code), rewrites them locally by rules (src/jd/rewrite.ts) and previews every
// change; Create then duplicates the frame and applies the rewrite to the copy.
// A built-in profile skips the preview: Create rewrites its data the same way,
// renders it as a new frame and then shows what changed.

import { TEST_PROFILES } from '../data/testProfiles'
import { applyPlanToProfile, profileToLayers } from '../jd/profileLayers'
import { rewriteForJd } from '../jd/rewrite'
import type {
  FrameTextLayer,
  MainToUiMessage,
  RewriteDiffItem,
  RewritePlan,
  SelectedFrame,
  UiToMainMessage,
} from '../shared/messages'

interface JdMatchDeps {
  root: HTMLElement
  send: (message: UiToMainMessage) => void
  selection: SelectedFrame | null
}

type SourceKind = 'canvas' | 'builtin'
type Phase = 'idle' | 'analyzing' | 'ready' | 'creating' | 'error'
type Filter = 'all' | 'changed' | 'added'

type AnalyzedSource = { kind: 'canvas'; frame: SelectedFrame } | { kind: 'builtin'; id: string; label: string }

interface Analysis {
  source: AnalyzedSource
  layers: FrameTextLayer[]
  plan: RewritePlan
  diff: RewriteDiffItem[]
}

interface Created {
  name: string
  warnings: string[]
  skipped: RewriteDiffItem[]
}

interface State {
  source: SourceKind
  builtinId: string
  selection: SelectedFrame | null
  jdText: string
  phase: Phase
  error: string | null
  analysis: Analysis | null
  created: Created | null
  filter: Filter
}

export interface JdMatchView {
  onMessage(message: MainToUiMessage): void
}

const ICONS = {
  frame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v18M17 3v18M3 7h18M3 17h18"/></svg>',
  library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 9h2M15 13h2M7 16h10"/></svg>',
}

export function renderJdMatch(deps: JdMatchDeps): JdMatchView {
  const state: State = {
    source: deps.selection ? 'canvas' : 'builtin',
    builtinId: TEST_PROFILES[0]?.id ?? '',
    selection: deps.selection,
    jdText: '',
    phase: 'idle',
    error: null,
    analysis: null,
    created: null,
    filter: 'all',
  }

  function render(): void {
    // Re-rendering replaces the textarea; keep the caret where the user left it.
    const active = document.activeElement
    const caret = active instanceof HTMLTextAreaElement && active.classList.contains('jd-input') ? [active.selectionStart, active.selectionEnd] : null
    deps.root.replaceChildren(buildTree())
    if (caret) {
      const ta = deps.root.querySelector<HTMLTextAreaElement>('.jd-input')
      ta?.focus()
      ta?.setSelectionRange(caret[0], caret[1])
    }
  }

  function buildTree(): HTMLElement {
    const container = el('div', 'jd-match')
    container.append(buildIntro(), buildSourceCard(), buildJdCard())
    if (state.source === 'canvas') container.append(buildAnalyzeRow())
    if (state.phase === 'error' && state.error) container.append(message('error', state.error))
    // A built-in profile shows its changes once it has been created; a frame previews them first.
    if (state.analysis && (state.source === 'canvas' || state.created)) container.append(buildResults(state.analysis))
    if (state.source === 'builtin' || (state.analysis && hasChanges(state.analysis))) container.append(buildCreateBar())
    return container
  }

  // ---------------------------------------------------------------- source

  function buildIntro(): HTMLElement {
    const wrap = el('div')
    const h = el('h1')
    h.textContent = 'Tailor a profile to a job'
    const p = el('p', 'intro')
    p.textContent = 'Choose a profile and paste the job description. Every section is rewritten for the role, and you see exactly what changed.'
    wrap.append(h, p)
    return wrap
  }

  function buildSourceCard(): HTMLElement {
    const card = el('div', 'jd-card')
    card.append(cardTitle('1', 'Source profile'))

    const group = el('div', 'jd-segment')
    group.setAttribute('role', 'radiogroup')
    group.setAttribute('aria-label', 'Source profile')
    group.append(
      sourceOption('canvas', ICONS.frame, 'On the canvas', 'A frame you select'),
      sourceOption('builtin', ICONS.library, 'Built-in', 'One of the sample profiles'),
    )
    card.append(group)
    card.append(state.source === 'canvas' ? buildSelectionRow() : buildBuiltinRow())
    return card
  }

  function sourceOption(value: SourceKind, icon: string, title: string, help: string): HTMLElement {
    const selected = state.source === value
    const button = el('button', `jd-segment-option ${selected ? 'on' : ''}`) as HTMLButtonElement
    button.type = 'button'
    button.setAttribute('role', 'radio')
    button.setAttribute('aria-checked', String(selected))
    button.disabled = busy()
    const iconWrap = el('span', 'jd-segment-icon')
    iconWrap.innerHTML = icon
    const text = el('span', 'jd-segment-text')
    const strong = el('strong')
    strong.textContent = title
    const small = el('span', 'muted small')
    small.textContent = help
    text.append(strong, small)
    button.append(iconWrap, text)
    button.addEventListener('click', () => {
      if (state.source === value) return
      state.source = value
      invalidate()
      render()
    })
    return button
  }

  function buildSelectionRow(): HTMLElement {
    const row = el('div', `jd-frame jd-selection-row ${state.selection ? 'ready' : ''}`)
    row.setAttribute('aria-live', 'polite')
    const dot = el('span', 'jd-frame-dot')
    const text = el('span', 'jd-frame-text')
    const name = el(state.selection ? 'strong' : 'span')
    name.textContent = state.selection ? state.selection.name : 'No frame selected'
    const hint = el('span', 'muted small')
    hint.textContent = state.selection ? 'Selected on the canvas' : 'Click a profile frame on the canvas.'
    text.append(name, hint)
    row.append(dot, text)
    return row
  }

  function buildBuiltinRow(): HTMLElement {
    const wrap = el('div', 'jd-builtin')
    const select = el('select', 'jd-select') as HTMLSelectElement
    select.setAttribute('aria-label', 'Built-in profile')
    select.disabled = busy()
    for (const kind of ['sample', 'edge-case'] as const) {
      const specs = TEST_PROFILES.filter((spec) => spec.kind === kind)
      if (specs.length === 0) continue
      const optgroup = el('optgroup') as HTMLOptGroupElement
      optgroup.label = kind === 'sample' ? 'Sample profiles' : 'Edge cases'
      for (const spec of specs) {
        const opt = el('option') as HTMLOptionElement
        opt.value = spec.id
        opt.textContent = spec.label
        opt.selected = spec.id === state.builtinId
        optgroup.append(opt)
      }
      select.append(optgroup)
    }
    select.addEventListener('change', () => {
      state.builtinId = select.value
      invalidate()
      render()
    })
    const spec = TEST_PROFILES.find((s) => s.id === state.builtinId)
    const who = el('div', 'muted small')
    who.textContent = spec ? [spec.profile.header.name, spec.profile.header.title].filter(Boolean).join(' · ') : ''
    wrap.append(select, who)
    return wrap
  }

  // ---------------------------------------------------------------- JD

  function buildJdCard(): HTMLElement {
    const card = el('div', 'jd-card')
    card.append(cardTitle('2', 'Job description'))
    const ta = el('textarea', 'jd-input') as HTMLTextAreaElement
    ta.rows = 9
    ta.placeholder = 'Paste the full job description, including the title and responsibilities.'
    ta.value = state.jdText
    ta.disabled = busy()
    ta.setAttribute('aria-label', 'Job description')
    const meta = el('div', 'jd-input-meta')
    const count = el('span', 'muted small')
    const setCount = (): void => {
      const words = state.jdText.trim() ? state.jdText.trim().split(/\s+/).length : 0
      count.textContent = words === 0 ? 'Empty' : `${words} words`
    }
    setCount()
    const clear = el('button', 'jd-text-btn') as HTMLButtonElement
    clear.type = 'button'
    clear.textContent = 'Clear'
    clear.hidden = !state.jdText
    clear.disabled = busy()
    clear.addEventListener('click', () => {
      state.jdText = ''
      invalidate()
      render()
    })
    ta.addEventListener('input', () => {
      const hadAnalysis = !!state.analysis
      state.jdText = ta.value
      setCount()
      clear.hidden = !state.jdText
      // A changed JD makes the preview stale; drop it so Create never applies an old analysis.
      if (hadAnalysis) {
        invalidate()
        render()
      }
    })
    meta.append(count, clear)
    card.append(ta, meta)
    return card
  }

  function buildAnalyzeRow(): HTMLElement {
    const btn = el('button', `btn lg ${state.analysis ? '' : 'primary'}`) as HTMLButtonElement
    btn.type = 'button'
    btn.textContent = state.phase === 'analyzing' ? 'Analyzing…' : state.analysis ? 'Analyze again' : 'Analyze'
    btn.disabled = busy()
    btn.addEventListener('click', onAnalyze)
    return btn
  }

  // ---------------------------------------------------------------- results

  function buildResults(analysis: Analysis): HTMLElement {
    const wrap = el('div', 'jd-section jd-result')
    const changed = analysis.diff.filter((d) => d.kind === 'changed')
    const added = analysis.diff.filter((d) => d.kind === 'added')

    if (state.created) wrap.append(buildCreatedBanner(state.created))

    const head = el('div', 'jd-result-head')
    const title = el('div', 'jd-result-title')
    title.textContent = state.created ? 'What changed' : 'Preview of the changes'
    const sub = el('div', 'muted small')
    sub.textContent =
      analysis.source.kind === 'canvas'
        ? `"${analysis.source.frame.name}" stays as it is; the changes go on a copy.`
        : `A tailored copy of "${analysis.source.label}" was created as a new frame.`
    head.append(title, sub)
    wrap.append(head)

    const stats = el('div', 'jd-stats')
    stats.append(stat(changed.length, 'changed', 'warn'), stat(added.length, 'added', 'ok'))
    wrap.append(stats)

    if (analysis.plan.notes.length > 0) wrap.append(listBox('info', 'Good to know', analysis.plan.notes))
    if (!hasChanges(analysis)) {
      wrap.append(message('info', 'Nothing in this profile matched what the rewrite looks for, so there is nothing to change.'))
      return wrap
    }

    // Sticky so the filters stay in reach while scrolling a long list of changes.
    const filters = el('div', 'jd-filters')
    filters.setAttribute('role', 'tablist')
    const options: [Filter, string, number][] = [
      ['all', 'All', changed.length + added.length],
      ['changed', 'Changed', changed.length],
      ['added', 'Added', added.length],
    ]
    for (const [value, label, n] of options) {
      const b = el('button', `jd-filter ${state.filter === value ? 'on' : ''}`) as HTMLButtonElement
      b.type = 'button'
      b.setAttribute('role', 'tab')
      b.setAttribute('aria-selected', String(state.filter === value))
      const count = el('span', 'jd-filter-count')
      count.textContent = String(n)
      b.append(label, count)
      b.addEventListener('click', () => {
        state.filter = value
        render()
      })
      filters.append(b)
    }
    wrap.append(filters)

    const shown = analysis.diff.filter((d) => state.filter === 'all' || d.kind === state.filter)
    if (shown.length === 0) wrap.append(message('info', `No ${state.filter} items.`))
    for (const [section, items] of groupBy(shown, (d) => d.section || 'Other')) {
      const group = el('details', 'section jd-group')
      group.setAttribute('open', '')
      const summary = el('summary')
      const chev = el('span', 'chev')
      const t = el('span', 'title')
      t.textContent = section
      const count = el('span', 'jd-group-count')
      count.textContent = String(items.length)
      summary.append(chev, t, count)
      const body = el('div', 'section-body')
      for (const item of items) body.append(diffCard(item))
      group.append(summary, body)
      wrap.append(group)
    }
    return wrap
  }

  function buildCreatedBanner(created: Created): HTMLElement {
    const wrap = el('div', 'jd-section')
    wrap.append(message('success', `Created "${created.name}" on the canvas.`))
    if (created.warnings.length > 0) wrap.append(listBox('warn', 'Check the layout', created.warnings))
    if (created.skipped.length > 0) {
      wrap.append(listBox('error', 'Could not apply', created.skipped.map((s) => `${s.section || 'Layer'}: ${s.reason ?? 'skipped'}`)))
    }
    return wrap
  }

  function buildCreateBar(): HTMLElement {
    const bar = el('div', 'jd-create-bar')
    const caption = el('div', 'muted small jd-create-caption')
    const analysis = state.analysis
    const n = analysis?.diff.length ?? 0
    const spec = TEST_PROFILES.find((s) => s.id === state.builtinId)
    caption.textContent =
      analysis?.source.kind === 'canvas'
        ? `Copies "${analysis.source.frame.name}" and applies ${n} change${n === 1 ? '' : 's'}`
        : `Creates a tailored "${spec?.label ?? 'profile'}" as a new frame`
    const btn = el('button', 'btn primary lg') as HTMLButtonElement
    btn.type = 'button'
    btn.textContent = state.phase === 'creating' ? 'Creating…' : state.created ? 'Create another copy' : 'Create tailored profile'
    btn.disabled = busy()
    btn.addEventListener('click', onCreate)
    bar.append(caption, btn)
    return bar
  }

  // ---------------------------------------------------------------- actions

  function busy(): boolean {
    return state.phase === 'analyzing' || state.phase === 'creating'
  }

  function invalidate(): void {
    state.analysis = null
    state.created = null
    state.error = null
    if (!busy()) state.phase = 'idle'
  }

  function fail(text: string): void {
    state.phase = 'error'
    state.error = text
    render()
  }

  function onAnalyze(): void {
    if (state.jdText.trim().length < 40) return fail('Paste the full job description first.')
    if (!state.selection) return fail('Select a profile frame on the canvas first.')
    state.error = null
    state.created = null
    state.phase = 'analyzing'
    render()
    deps.send({ type: 'jd-read-layers' })
  }

  function analyze(source: AnalyzedSource, layers: FrameTextLayer[]): void {
    try {
      const plan = rewriteForJd(state.jdText.trim(), layers)
      state.analysis = { source, layers, plan, diff: previewDiff(layers, plan) }
      state.phase = 'ready'
      state.filter = 'all'
      render()
    } catch (error) {
      console.error('[Profiler]', error)
      fail(`Something went wrong while analyzing: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function onCreate(): void {
    // A built-in profile is rewritten right here, without a separate preview step.
    if (state.source === 'builtin') {
      if (state.jdText.trim().length < 40) return fail('Paste the full job description first.')
      const spec = TEST_PROFILES.find((s) => s.id === state.builtinId)
      if (!spec) return fail('Pick a built-in profile.')
      const layers = profileToLayers(spec.profile)
      const plan = rewriteForJd(state.jdText.trim(), layers)
      state.analysis = { source: { kind: 'builtin', id: spec.id, label: spec.label }, layers, plan, diff: previewDiff(layers, plan) }
    }
    const analysis = state.analysis
    if (!analysis) return
    const base = analysis.source.kind === 'canvas' ? analysis.source.frame.name : analysis.source.label
    const name = `${base} – ${roleOf(state.jdText) ?? 'Tailored'}`
    state.phase = 'creating'
    state.created = null
    render()
    if (analysis.source.kind === 'canvas') {
      deps.send({ type: 'jd-apply-rewrite', frameId: analysis.source.frame.id, plan: analysis.plan, name })
      return
    }
    const { id } = analysis.source
    const spec = TEST_PROFILES.find((s) => s.id === id)
    if (!spec) return fail('That built-in profile is no longer available.')
    deps.send({ type: 'jd-generate-profile', profile: applyPlanToProfile(spec.profile, analysis.plan), name })
  }

  const view: JdMatchView = {
    onMessage(msg) {
      if (msg.type === 'selection') {
        state.selection = msg.frame
        // Swap just the selection row, so typing in the JD box is never interrupted.
        deps.root.querySelector('.jd-selection-row')?.replaceWith(buildSelectionRow())
      } else if (msg.type === 'jd-frame-layers' && state.phase === 'analyzing') {
        if (!msg.frame || msg.error) return fail(msg.error ?? 'Select a profile frame on the canvas first.')
        if (msg.layers.length === 0) return fail(`"${msg.frame.name}" has no visible text to rewrite.`)
        analyze({ kind: 'canvas', frame: msg.frame }, msg.layers)
      } else if (msg.type === 'jd-rewrite-result' && state.phase === 'creating') {
        if (!msg.ok) return fail(msg.error)
        state.created = {
          name: msg.copyName,
          warnings: msg.warnings,
          skipped: msg.diff.filter((d) => d.kind === 'skipped'),
        }
        state.phase = 'ready'
        render()
        deps.root.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
  }

  render()
  return view
}

// ---------------------------------------------------------------- pieces

function hasChanges(analysis: Analysis): boolean {
  return analysis.diff.length > 0
}

/** The changes in the order the profile reads, each layer's additions right after it. */
function previewDiff(layers: FrameTextLayer[], plan: RewritePlan): RewriteDiffItem[] {
  const changes = new Map(plan.changes.map((c) => [c.key, c.text]))
  const additions = new Map(plan.additions.map((a) => [a.afterKey, a.texts]))
  const diff: RewriteDiffItem[] = []
  for (const layer of layers) {
    const section = layer.section || layer.name
    const after = changes.get(layer.key)
    if (after !== undefined && after !== layer.text) diff.push({ kind: 'changed', section, before: layer.text, after })
    for (const text of additions.get(layer.key) ?? []) diff.push({ kind: 'added', section, before: '', after: text })
  }
  return diff
}

/** The job title from a "Job Title:" / "Role:" line, for naming the result. */
function roleOf(jd: string): string | null {
  const match = /^\s*(?:job\s*title|role|position)\s*[:–-]\s*(.+)$/im.exec(jd)
  return match ? match[1].split(/\s+\/\s+/)[0].trim().slice(0, 60) : null
}

function cardTitle(step: string, text: string): HTMLElement {
  const row = el('div', 'jd-card-title')
  const badge = el('span', 'jd-step-badge')
  badge.textContent = step
  const label = el('span')
  label.textContent = text
  row.append(badge, label)
  return row
}

function diffCard(item: RewriteDiffItem): HTMLElement {
  const card = el('div', `jd-diff ${item.kind}`)
  if (item.kind === 'added') {
    const after = el('div', 'jd-diff-text')
    after.append(span(plain(item.after), 'ins'))
    card.append(diffRow('New', after))
    return card
  }
  const { before, after } = wordDiff(plain(item.before), plain(item.after))
  card.append(diffRow('Before', before), diffRow('After', after))
  return card
}

function diffRow(labelText: string, text: HTMLElement): HTMLElement {
  const row = el('div', 'jd-diff-row')
  const label = el('span', 'jd-diff-label')
  label.textContent = labelText
  row.append(label, text)
  return row
}

/** Word-level diff: removed words struck through in "before", new words highlighted in "after". */
function wordDiff(a: string, b: string): { before: HTMLElement; after: HTMLElement } {
  const before = el('div', 'jd-diff-text')
  const after = el('div', 'jd-diff-text')
  const x = a.split(/(\s+)/)
  const y = b.split(/(\s+)/)
  if (x.length * y.length > 250_000) {
    // Too long to diff word by word: show both in full.
    before.append(span(a, 'del'))
    after.append(span(b, 'ins'))
    return { before, after }
  }
  // Longest common subsequence over words; whitespace runs are their own tokens.
  const table: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const isSpace = (t: string): boolean => /^\s*$/.test(t)
  let i = 0
  let j = 0
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      before.append(x[i])
      after.append(y[j])
      i++
      j++
    } else if (j < y.length && (i === x.length || table[i][j + 1] >= table[i + 1][j])) {
      after.append(isSpace(y[j]) ? y[j] : span(y[j], 'ins'))
      j++
    } else {
      before.append(isSpace(x[i]) ? x[i] : span(x[i], 'del'))
      i++
    }
  }
  return { before, after }
}

function plain(text: string): string {
  return text.replace(/\*\*/g, '')
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

function stat(value: number, label: string, cls: string): HTMLElement {
  const pill = el('div', `jd-score-pill ${cls}`)
  const num = el('span', 'jd-score-num')
  num.textContent = String(value)
  const lbl = el('span', 'jd-score-lbl')
  lbl.textContent = label
  pill.append(num, lbl)
  return pill
}

function listBox(cls: string, title: string, items: string[]): HTMLElement {
  const box = el('div', `message ${cls} jd-list-box`)
  const body = el('div')
  const t = el('strong')
  t.textContent = title
  const ul = el('ul')
  for (const item of items) {
    const li = el('li')
    li.textContent = item
    ul.append(li)
  }
  body.append(t, ul)
  box.append(body)
  return box
}

function message(cls: string, text: string): HTMLElement {
  const box = el('div', `message ${cls}`)
  box.textContent = text
  return box
}

function span(text: string, className: string): HTMLElement {
  const s = el('span', className)
  s.textContent = text
  return s
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}
