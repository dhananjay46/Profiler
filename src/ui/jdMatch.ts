// The JD Match tab: paste a JD, pick a source profile, analyze and (optionally)
// generate a tailored copy of the profile as a new Figma frame.
//
// Everything happens locally in this iframe (JD parsing, matching and suggestion
// building). The main code is only asked to (a) read a selected Figma frame as
// a source profile, and (b) render the tailored profile as a new frame.

import { TEST_PROFILES } from '../data/testProfiles'
import {
  applyTailorPlan,
  buildTailorPlan,
  matchProfile,
  parseJD,
  type MatchReport,
  type MatchResult,
  type MatchStatus,
  type ParsedJD,
  type TailorPlan,
} from '../jd'
import type { FrameSourceSummary, UiToMainMessage } from '../shared/messages'
import type { ConsultantProfile } from '../shared/types'

interface JdMatchDeps {
  root: HTMLElement
  send: (message: UiToMainMessage) => void
  /** Latest reviewed resume profile, if any (set by the Upload tab). */
  getReviewedProfile: () => ConsultantProfile | null
}

interface State {
  source: 'frame' | 'reviewed' | 'sample'
  sampleId: string
  frame: FrameSourceSummary | null
  frameMessage: string | null
  jdText: string
  role: string
  client: string
  jd: ParsedJD | null
  profile: ConsultantProfile | null
  profileLabel: string
  report: MatchReport | null
  plan: TailorPlan | null
  acceptedSuggestionIds: Set<string>
  statusMessage: string | null
  statusKind: 'info' | 'error' | 'success' | null
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  met: 'Met',
  partial: 'Partial',
  missing: 'Missing',
  'needs-verification': 'Needs check',
}

const STATUS_CLASS: Record<MatchStatus, string> = {
  met: 'ok',
  partial: 'warn',
  missing: 'err',
  'needs-verification': 'info',
}

export interface JdMatchView {
  /** Called when the host receives a jd-selected-frame message. */
  onSelectedFrame(frame: FrameSourceSummary | null, message?: string): void
  /** Called when the host finishes the tailored-generate request. */
  onGenerateStatus(state: 'working' | 'success' | 'error', message: string): void
}

export function renderJdMatch(deps: JdMatchDeps): JdMatchView {
  const state: State = {
    source: 'sample',
    sampleId: TEST_PROFILES[0]?.id ?? '',
    frame: null,
    frameMessage: null,
    jdText: '',
    role: '',
    client: '',
    jd: null,
    profile: null,
    profileLabel: '',
    report: null,
    plan: null,
    acceptedSuggestionIds: new Set<string>(),
    statusMessage: null,
    statusKind: null,
  }

  function render(): void {
    deps.root.replaceChildren(buildTree())
  }

  function buildTree(): HTMLElement {
    const container = el('div', 'jd-match')
    container.append(buildIntro(), buildSourcePicker(), buildJdInput(), buildAnalyzeRow(), buildResults(), buildStatus())
    return container
  }

  function buildIntro(): HTMLElement {
    const wrap = el('div')
    const h = el('h1')
    h.textContent = 'Match against a job description'
    wrap.append(h)
    const p = el('p', 'intro')
    p.textContent =
      'Paste a client JD, pick a source profile and see how it covers the role. Nothing leaves this device — matching happens locally.'
    wrap.append(p)
    return wrap
  }

  function buildSourcePicker(): HTMLElement {
    const wrap = el('div', 'jd-section')
    const label = el('label', 'section-label')
    label.textContent = 'Source profile'
    wrap.append(label)

    const group = el('div', 'jd-source-group')
    group.append(
      sourceRadio('frame', 'Selected Figma frame', 'Use a profile frame currently selected on the canvas.'),
      sourceRadio('reviewed', 'Last reviewed resume', 'Use the profile from the Upload tab.'),
      sourceRadio('sample', 'Built-in sample profile', 'Pick a bundled sample to compare against.'),
    )
    wrap.append(group)

    if (state.source === 'frame') wrap.append(buildFrameRow())
    if (state.source === 'sample') wrap.append(buildSampleRow())
    if (state.source === 'reviewed') wrap.append(buildReviewedRow())
    return wrap
  }

  function sourceRadio(value: State['source'], title: string, help: string): HTMLElement {
    const row = el('label', 'jd-source-radio')
    const input = el('input') as HTMLInputElement
    input.type = 'radio'
    input.name = 'jd-source'
    input.value = value
    input.checked = state.source === value
    input.addEventListener('change', () => {
      state.source = value
      state.profile = null
      state.profileLabel = ''
      state.report = null
      state.plan = null
      render()
    })
    row.append(input)
    const text = el('div')
    const strong = el('strong')
    strong.textContent = title
    const muted = el('div', 'muted small')
    muted.textContent = help
    text.append(strong, muted)
    row.append(text)
    return row
  }

  function buildFrameRow(): HTMLElement {
    const row = el('div', 'jd-source-detail')
    const btn = el('button', 'btn') as HTMLButtonElement
    btn.textContent = 'Use selected frame'
    btn.addEventListener('click', () => {
      state.frameMessage = 'Reading selection…'
      render()
      deps.send({ type: 'jd-read-selected' })
    })
    row.append(btn)
    const note = el('div', 'muted small')
    if (state.frame) {
      note.textContent = `Loaded "${state.frame.name}" (${state.frame.profile.experience?.length ?? 0} experience entries). Click again after changing selection.`
    } else if (state.frameMessage) {
      note.textContent = state.frameMessage
    } else {
      note.textContent = 'Select a profile frame on the canvas, then click the button.'
    }
    row.append(note)
    return row
  }

  function buildSampleRow(): HTMLElement {
    const row = el('div', 'jd-source-detail')
    const select = el('select') as HTMLSelectElement
    for (const spec of TEST_PROFILES) {
      const opt = el('option') as HTMLOptionElement
      opt.value = spec.id
      opt.textContent = spec.label
      if (spec.id === state.sampleId) opt.selected = true
      select.append(opt)
    }
    select.addEventListener('change', () => {
      state.sampleId = select.value
    })
    row.append(select)
    return row
  }

  function buildReviewedRow(): HTMLElement {
    const row = el('div', 'jd-source-detail')
    const note = el('div', 'muted small')
    const reviewed = deps.getReviewedProfile()
    note.textContent = reviewed
      ? `Will use "${reviewed.header.name}" from the Upload tab.`
      : 'No reviewed resume yet. Upload one from the Upload tab first.'
    row.append(note)
    return row
  }

  function buildJdInput(): HTMLElement {
    const wrap = el('div', 'jd-section')
    const grid = el('div', 'grid2')

    const roleField = field('Role (optional)', (input) => {
      input.value = state.role
      input.addEventListener('input', () => {
        state.role = input.value
      })
    })
    const clientField = field('Client / company (optional)', (input) => {
      input.value = state.client
      input.addEventListener('input', () => {
        state.client = input.value
      })
    })
    grid.append(roleField, clientField)
    wrap.append(grid)

    const label = el('label', 'section-label')
    label.textContent = 'Job description'
    wrap.append(label)

    const ta = el('textarea', 'jd-input') as HTMLTextAreaElement
    ta.rows = 10
    ta.placeholder = 'Paste the full JD here. Requirements, responsibilities, nice-to-haves, education, etc.'
    ta.value = state.jdText
    ta.addEventListener('input', () => {
      state.jdText = ta.value
    })
    wrap.append(ta)
    return wrap
  }

  function field(labelText: string, build: (input: HTMLInputElement) => void): HTMLElement {
    const w = el('div', 'field')
    const l = el('label')
    l.textContent = labelText
    w.append(l)
    const input = el('input') as HTMLInputElement
    input.type = 'text'
    build(input)
    w.append(input)
    return w
  }

  function buildAnalyzeRow(): HTMLElement {
    const row = el('div', 'jd-analyze-row')
    const btn = el('button', 'btn primary') as HTMLButtonElement
    btn.textContent = 'Analyze JD'
    btn.addEventListener('click', onAnalyze)
    row.append(btn)
    return row
  }

  function resolveSourceProfile(): { profile: ConsultantProfile; label: string } | null {
    if (state.source === 'frame') {
      if (!state.frame) {
        setStatus('error', 'Load a selected frame first.')
        return null
      }
      return { profile: state.frame.profile, label: `Frame: ${state.frame.name}` }
    }
    if (state.source === 'reviewed') {
      const reviewed = deps.getReviewedProfile()
      if (!reviewed) {
        setStatus('error', 'No reviewed resume available. Upload one from the Upload tab first.')
        return null
      }
      return { profile: reviewed, label: `Resume: ${reviewed.header.name}` }
    }
    const spec = TEST_PROFILES.find((f) => f.id === state.sampleId)
    if (!spec) {
      setStatus('error', 'Pick a sample profile.')
      return null
    }
    return { profile: spec.profile, label: `Sample: ${spec.label}` }
  }

  function onAnalyze(): void {
    const jdText = state.jdText.trim()
    if (jdText.length < 20) {
      setStatus('error', 'Paste a JD with at least a few requirements first.')
      return
    }
    const source = resolveSourceProfile()
    if (!source) return

    const jd = parseJD(jdText, { role: state.role, client: state.client })
    if (jd.requirements.length === 0) {
      setStatus('error', 'No requirements could be extracted. Try a more structured JD with bullets or headings.')
      return
    }
    const report = matchProfile(jd, source.profile)
    const plan = buildTailorPlan(jd, source.profile, report)

    state.jd = jd
    state.profile = source.profile
    state.profileLabel = source.label
    state.report = report
    state.plan = plan
    state.acceptedSuggestionIds = new Set(plan.suggestions.filter((s) => s.accepted).map((s) => s.id))
    state.statusMessage = `Analyzed ${jd.requirements.length} requirements against ${source.label}.`
    state.statusKind = 'success'
    render()
  }

  function buildResults(): HTMLElement {
    const wrap = el('div', 'jd-section')
    if (!state.report || !state.jd || !state.profile || !state.plan) {
      wrap.hidden = true
      return wrap
    }
    wrap.append(buildScoreCard(state.report, state.jd))
    wrap.append(buildRequirementList(state.report))
    wrap.append(buildSuggestions(state.plan))
    wrap.append(buildGenerateRow())
    return wrap
  }

  function buildScoreCard(report: MatchReport, jd: ParsedJD): HTMLElement {
    const card = el('div', 'jd-score')
    const title = el('div', 'jd-score-title')
    title.textContent = jd.role ? `Coverage for ${jd.role}` : 'Overall coverage'
    card.append(title)

    const row = el('div', 'jd-score-row')
    row.append(scorePill('Overall', report.overallScore, scoreClass(report.overallScore)))
    row.append(scorePill('Mandatory', report.mandatoryScore, scoreClass(report.mandatoryScore)))
    row.append(countChip('ok', `${report.counts.met} met`))
    row.append(countChip('warn', `${report.counts.partial} partial`))
    row.append(countChip('err', `${report.counts.missing} missing`))
    row.append(countChip('info', `${report.counts['needs-verification']} needs check`))
    card.append(row)

    if (report.unresolvedGaps.length > 0) {
      const gaps = el('div', 'jd-gaps')
      const gTitle = el('div', 'jd-gaps-title')
      gTitle.textContent = `Unresolved mandatory gaps (${report.unresolvedGaps.length}):`
      gaps.append(gTitle)
      const ul = el('ul', 'jd-gap-list')
      for (const g of report.unresolvedGaps) {
        const li = el('li')
        li.textContent = `${STATUS_LABEL[g.status]} — ${g.requirement.text}`
        ul.append(li)
      }
      gaps.append(ul)
      card.append(gaps)
    }
    return card
  }

  function buildRequirementList(report: MatchReport): HTMLElement {
    const wrap = el('details', 'section')
    wrap.setAttribute('open', '')
    const summary = el('summary')
    const chev = el('span', 'chev')
    const t = el('span', 'title')
    t.textContent = `Requirements (${report.results.length})`
    summary.append(chev, t)
    wrap.append(summary)

    const body = el('div', 'section-body')
    for (const result of report.results) {
      body.append(buildRequirementRow(result))
    }
    wrap.append(body)
    return wrap
  }

  function buildRequirementRow(result: MatchResult): HTMLElement {
    const row = el('div', 'jd-req')
    const head = el('div', 'jd-req-head')
    const badge = el('span', `status-badge ${STATUS_CLASS[result.status]}`)
    badge.textContent = STATUS_LABEL[result.status]
    const text = el('span', 'jd-req-text')
    text.textContent = result.requirement.text
    const priority = el('span', 'pill ' + (result.requirement.priority === 'mandatory' ? 'required' : 'check'))
    priority.textContent = result.requirement.priority === 'mandatory' ? 'Must' : 'Nice'
    head.append(badge, priority, text)
    row.append(head)

    const meta = el('div', 'jd-req-meta')
    meta.textContent = `${result.requirement.category} · ${result.reason}`
    row.append(meta)

    if (result.evidence.length > 0) {
      const ev = el('ul', 'jd-req-evidence')
      for (const e of result.evidence) {
        const li = el('li')
        const sec = el('strong')
        sec.textContent = `${e.section}: `
        li.append(sec, document.createTextNode(e.snippet))
        ev.append(li)
      }
      row.append(ev)
    }
    return row
  }

  function buildSuggestions(plan: TailorPlan): HTMLElement {
    const wrap = el('details', 'section')
    wrap.setAttribute('open', '')
    const summary = el('summary')
    const chev = el('span', 'chev')
    const t = el('span', 'title')
    t.textContent = `Suggested edits (${plan.suggestions.length})`
    summary.append(chev, t)
    wrap.append(summary)

    const body = el('div', 'section-body')
    if (plan.suggestions.length === 0) {
      const empty = el('div', 'muted small')
      empty.textContent = 'No tailoring edits suggested — the source already lines up.'
      body.append(empty)
    }
    for (const s of plan.suggestions) {
      const row = el('div', 'jd-sug')
      const label = el('label', 'jd-sug-label')
      const cb = el('input') as HTMLInputElement
      cb.type = 'checkbox'
      cb.checked = state.acceptedSuggestionIds.has(s.id)
      cb.addEventListener('change', () => {
        if (cb.checked) state.acceptedSuggestionIds.add(s.id)
        else state.acceptedSuggestionIds.delete(s.id)
      })
      const body2 = el('div')
      const strong = el('strong')
      strong.textContent = s.summary
      const det = el('div', 'muted small jd-sug-detail')
      det.textContent = s.detail
      body2.append(strong, det)
      label.append(cb, body2)
      row.append(label)
      body.append(row)
    }
    wrap.append(body)
    return wrap
  }

  function buildGenerateRow(): HTMLElement {
    const row = el('div', 'jd-generate-row')
    const btn = el('button', 'btn primary') as HTMLButtonElement
    btn.textContent = 'Generate tailored Figma frame'
    btn.addEventListener('click', onGenerate)
    row.append(btn)
    return row
  }

  function onGenerate(): void {
    if (!state.profile || !state.plan) return
    const tailored = applyTailorPlan(state.profile, state.plan, state.acceptedSuggestionIds)
    setStatus('info', 'Generating tailored profile…')
    deps.send({ type: 'jd-generate-tailored', profile: tailored, role: state.jd?.role || state.role || undefined })
  }

  function buildStatus(): HTMLElement {
    const el2 = el('div', `message ${state.statusKind ?? ''} jd-status`)
    el2.hidden = !state.statusMessage
    el2.textContent = state.statusMessage ?? ''
    return el2
  }

  function setStatus(kind: 'info' | 'error' | 'success', text: string): void {
    state.statusKind = kind
    state.statusMessage = text
    render()
  }

  const view: JdMatchView = {
    onSelectedFrame(frame, message) {
      state.frame = frame
      state.frameMessage = message ?? (frame ? null : 'Nothing suitable is selected. Click a profile frame on the canvas and try again.')
      render()
    },
    onGenerateStatus(result, text) {
      state.statusKind = result === 'error' ? 'error' : result === 'success' ? 'success' : 'info'
      state.statusMessage = text
      render()
    },
  }

  render()
  return view
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

function scoreClass(score: number): string {
  if (score >= 75) return 'ok'
  if (score >= 50) return 'warn'
  return 'err'
}

function scorePill(label: string, score: number, cls: string): HTMLElement {
  const pill = el('div', `jd-score-pill ${cls}`)
  const num = el('span', 'jd-score-num')
  num.textContent = `${score}`
  const lbl = el('span', 'jd-score-lbl')
  lbl.textContent = label
  pill.append(num, lbl)
  return pill
}

function countChip(cls: string, text: string): HTMLElement {
  const chip = el('span', `pill ${cls}`)
  chip.textContent = text
  return chip
}
