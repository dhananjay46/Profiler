// Plugin panel entry point (runs in Figma's UI iframe).
//
// Resume files are read and parsed here, locally. pdf.js normally runs in a
// Web Worker loaded from a URL; the plugin has no network access, so its
// worker code is bundled in and run on the main thread instead.

import * as pdfjs from 'pdfjs-dist'
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs'
import { parseResume, ResumeFileError, type ParseResult } from '../parser'
import { MAX_FILE_BYTES } from '../parser/fileType'
import type { PdfJsLike } from '../parser/pdf'
import type { FixtureOption, MainToUiMessage, SelectedFrame, UiToMainMessage } from '../shared/messages'
import { renderJdMatch, type JdMatchView } from './jdMatch'
import { renderReview, type ReviewView } from './review'

;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfWorker
const pdfjsLib = pdfjs as unknown as PdfJsLike

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const views = {
  upload: $('view-upload'),
  review: $('view-review'),
  test: $('view-test'),
  jd: $('view-jd'),
}
const footer = $('review-footer')
const reviewStatus = $('review-status')
const reviewGenerate = $<HTMLButtonElement>('review-generate')

let review: ReviewView | null = null
let fixtures: FixtureOption[] = []
let jdMatch: JdMatchView | null = null
/** The frame selected on the canvas, kept for the JD Match tab until it opens. */
let selection: SelectedFrame | null = null
/** Which screen the next status message from the main code belongs to. */
let pendingRequest: 'review' | 'test' | null = null

function send(message: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: message }, '*')
}

// ---------------------------------------------------------------- tabs

function showTab(tab: 'upload' | 'test' | 'jd'): void {
  $('tab-upload').setAttribute('aria-selected', String(tab === 'upload'))
  $('tab-test').setAttribute('aria-selected', String(tab === 'test'))
  $('tab-jd').setAttribute('aria-selected', String(tab === 'jd'))
  views.test.hidden = tab !== 'test'
  views.jd.hidden = tab !== 'jd'
  views.upload.hidden = tab !== 'upload' || review !== null
  views.review.hidden = tab !== 'upload' || review === null
  footer.hidden = views.review.hidden
  if (tab === 'jd' && !jdMatch) {
    jdMatch = renderJdMatch({ root: views.jd, send, selection })
  }
}
$('tab-upload').addEventListener('click', () => showTab('upload'))
$('tab-test').addEventListener('click', () => showTab('test'))
$('tab-jd').addEventListener('click', () => showTab('jd'))

// ---------------------------------------------------------------- upload

const fileInput = $<HTMLInputElement>('file')
const drop = $('drop')
const uploadMessage = $('upload-message')

function showUploadMessage(kind: 'error' | 'info' | null, text = ''): void {
  uploadMessage.hidden = kind === null
  uploadMessage.className = `message ${kind ?? ''}`
  uploadMessage.textContent = text
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  fileInput.value = '' // allow choosing the same file again
  if (file) void readFile(file)
})
drop.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    fileInput.click()
  }
})
drop.addEventListener('dragover', (event) => {
  event.preventDefault()
  drop.classList.add('over')
})
drop.addEventListener('dragleave', () => drop.classList.remove('over'))
drop.addEventListener('drop', (event) => {
  event.preventDefault()
  drop.classList.remove('over')
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return
  if (files.length > 1) {
    showUploadMessage('error', 'Please drop one resume at a time.')
    return
  }
  void readFile(files[0])
})

async function readFile(file: File): Promise<void> {
  if (file.size > MAX_FILE_BYTES) {
    showUploadMessage('error', `"${file.name}" is larger than 15 MB. Please upload a smaller file.`)
    return
  }
  showUploadMessage('info', `Reading “${file.name}”…`)
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = await parseResume(file.name, bytes, pdfjsLib)
    showUploadMessage(null)
    openReview(result, file.name)
  } catch (error) {
    if (error instanceof ResumeFileError) {
      showUploadMessage('error', error.message)
    } else {
      console.error('[Profiler] Could not read resume', error)
      const detail = error instanceof Error ? error.message : String(error)
      showUploadMessage('error', `Something went wrong while reading “${file.name}”: ${detail}`)
    }
  }
}

// ---------------------------------------------------------------- review

function openReview(result: ParseResult, fileName: string): void {
  review = renderReview(views.review, result, fileName, ({ requiredCount, reviewCount }) => {
    reviewGenerate.disabled = requiredCount > 0 || pendingRequest === 'review'
    reviewStatus.className = 'status'
    reviewStatus.textContent =
      requiredCount > 0
        ? `Fill ${requiredCount} required ${requiredCount === 1 ? 'field' : 'fields'} to continue.`
        : reviewCount > 0
          ? `${reviewCount} ${reviewCount === 1 ? 'item' : 'items'} left to check (optional).`
          : 'Ready to generate.'
  })
  views.review.scrollTop = 0
  showTab('upload')
}

$('review-back').addEventListener('click', () => {
  review = null
  views.review.replaceChildren()
  showTab('upload')
})

reviewGenerate.addEventListener('click', () => {
  if (!review) return
  const { profile, errors } = review.read()
  if (errors.length > 0) {
    reviewStatus.textContent = `Fix these first: ${errors.join(' ')}`
    return
  }
  pendingRequest = 'review'
  reviewGenerate.disabled = true
  send({ type: 'generate-profile', profile })
})

// ---------------------------------------------------------------- test data

const fixtureSelect = $<HTMLSelectElement>('fixture')
const testGenerate = $<HTMLButtonElement>('generate-test')
const testMessage = $('test-message')
const previewRoot = $('fixture-preview')
const previewAvatar = $('preview-avatar')
const previewName = $('preview-name')
const previewRole = $('preview-role')
const previewDesc = $('preview-desc')
const previewStats = $('preview-stats')

const STAT_LABELS: { key: keyof FixtureOption['stats']; label: string }[] = [
  { key: 'experience', label: 'Projects' },
  { key: 'education', label: 'Education' },
  { key: 'certifications', label: 'Certs' },
  { key: 'skills', label: 'Skills' },
  { key: 'tools', label: 'Tools' },
  { key: 'caseStudies', label: 'Case studies' },
]

function renderPreview(fixture: FixtureOption | undefined): void {
  if (!fixture) {
    previewRoot.hidden = true
    return
  }
  previewRoot.hidden = false
  const initials = (fixture.name.match(/\b[A-Z]/g)?.slice(0, 2).join('') || '?').toUpperCase()
  previewAvatar.textContent = initials
  previewAvatar.className = `avatar ${fixture.kind === 'edge-case' ? 'edge' : ''}`
  previewName.textContent = fixture.name
  previewRole.textContent = fixture.title || 'No job title'
  previewDesc.textContent = fixture.description
  previewStats.replaceChildren(
    ...STAT_LABELS.map(({ key, label }) => {
      const val = fixture.stats[key]
      const stat = document.createElement('div')
      stat.className = `stat${val === 0 ? ' zero' : ''}`
      const valEl = document.createElement('span')
      valEl.className = 'val'
      valEl.textContent = String(val)
      const lblEl = document.createElement('span')
      lblEl.className = 'lbl'
      lblEl.textContent = label
      stat.append(valEl, lblEl)
      return stat
    }),
  )
}

function populateFixtureOptions(options: FixtureOption[]): void {
  const samples = options.filter((o) => o.kind === 'sample')
  const edgeCases = options.filter((o) => o.kind === 'edge-case')

  const makeOption = (option: FixtureOption) => {
    const el = document.createElement('option')
    el.value = option.id
    el.textContent = option.label
    return el
  }

  const children: Node[] = []
  if (samples.length > 0) {
    const group = document.createElement('optgroup')
    group.label = 'Examples'
    group.append(...samples.map(makeOption))
    children.push(group)
  }
  if (edgeCases.length > 0) {
    const group = document.createElement('optgroup')
    group.label = 'Edge cases'
    group.append(...edgeCases.map(makeOption))
    children.push(group)
  }
  fixtureSelect.replaceChildren(...children)
}

fixtureSelect.addEventListener('change', () => {
  renderPreview(fixtures.find((f) => f.id === fixtureSelect.value))
})

testGenerate.addEventListener('click', () => {
  pendingRequest = 'test'
  send({ type: 'generate', fixtureId: fixtureSelect.value })
})

// ---------------------------------------------------------------- theme toggle

type ThemeMode = 'auto' | 'light' | 'dark'
const THEME_STORAGE_KEY = 'profiler.theme'
const THEME_ORDER: ThemeMode[] = ['auto', 'light', 'dark']
const THEME_LABELS: Record<ThemeMode, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' }
// Simple inline SVGs; each inherits currentColor so they stay AAA against the chip background.
const THEME_ICONS: Record<ThemeMode, string> = {
  auto: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>',
  light: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  dark: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
}

const themeToggle = $<HTMLButtonElement>('theme-toggle')
const themeIcon = $('theme-icon')
const themeLabel = $('theme-label')

function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'auto' || stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage may be blocked in a sandboxed iframe; fall back to default.
  }
  return 'auto'
}

function writeStoredTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Ignore; theme choice simply won't persist across sessions.
  }
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode)
  themeIcon.innerHTML = THEME_ICONS[mode]
  themeLabel.textContent = THEME_LABELS[mode]
  themeToggle.setAttribute('aria-label', `Theme: ${THEME_LABELS[mode]} (click to switch)`)
  themeToggle.title = `Theme: ${THEME_LABELS[mode]}. Click to cycle Auto, Light, Dark.`
}

let currentTheme: ThemeMode = readStoredTheme()
applyTheme(currentTheme)

themeToggle.addEventListener('click', () => {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(currentTheme) + 1) % THEME_ORDER.length]
  currentTheme = next
  writeStoredTheme(next)
  applyTheme(next)
})

// ---------------------------------------------------------------- resize grip

interface DragState {
  startX: number
  startY: number
  startW: number
  startH: number
}
let drag: DragState | null = null

function startDrag(event: PointerEvent): void {
  event.preventDefault()
  drag = {
    startX: event.clientX,
    startY: event.clientY,
    startW: window.innerWidth,
    startH: window.innerHeight,
  }
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent): void {
  if (!drag) return
  const width = Math.round(drag.startW + (event.clientX - drag.startX))
  const height = Math.round(drag.startH + (event.clientY - drag.startY))
  send({ type: 'resize', width, height })
}
function endDrag(event: PointerEvent): void {
  if (!drag) return
  ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
  drag = null
}
for (const id of ['grip', 'grip-floating']) {
  const grip = document.getElementById(id)
  if (!grip) continue
  grip.addEventListener('pointerdown', startDrag)
  grip.addEventListener('pointermove', moveDrag)
  grip.addEventListener('pointerup', endDrag)
  grip.addEventListener('pointercancel', endDrag)
}

// ---------------------------------------------------------------- messages from the main code

window.addEventListener('message', (event: MessageEvent) => {
  const msg = (event.data as { pluginMessage?: MainToUiMessage } | null)?.pluginMessage
  if (!msg) return

  if (msg.type === 'init') {
    fixtures = msg.fixtures
    populateFixtureOptions(fixtures)
    const first = fixtures[0]
    if (first) {
      fixtureSelect.value = first.id
      renderPreview(first)
    }
    testGenerate.disabled = fixtures.length === 0
    return
  }

  if (msg.type === 'status') {
    const target = pendingRequest
    if (msg.state !== 'working') pendingRequest = null
    if (target === 'test') {
      testMessage.hidden = false
      testMessage.className = `message ${msg.state === 'error' ? 'error' : msg.state === 'success' ? 'success' : 'info'}`
      testMessage.textContent = msg.message
      testGenerate.disabled = msg.state === 'working'
    } else if (target === 'review') {
      reviewStatus.className = `status ${msg.state === 'error' ? 'error' : msg.state === 'success' ? 'success' : ''}`
      reviewStatus.textContent = msg.message
      reviewGenerate.disabled = msg.state === 'working'
    }
    return
  }

  if (msg.type === 'selection') selection = msg.frame
  jdMatch?.onMessage(msg)
})

send({ type: 'ready' })
