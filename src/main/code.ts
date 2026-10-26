// Plugin entry point. Runs in Figma's main thread with access to the document.
// Talks to the panel (src/ui) only through messages.

import { fixtureStats, TEST_PROFILES } from '../data/testProfiles'
import type { FixtureOption, MainToUiMessage, RewritePlan, SelectedFrame, UiToMainMessage } from '../shared/messages'
import type { ConsultantProfile } from '../shared/types'
import { validateProfile } from '../shared/validate'
import { describeError, ProfilerError } from './errors'
import { applyRewrite, isFrameLike, readFrameLayers, type FrameLike } from './frameText'
import { generateProfile } from './render/profile'
import { theme } from './theme'

const DEFAULT_SIZE = { width: 480, height: 720 }
const MIN_SIZE = { width: 360, height: 500 }
const MAX_SIZE = { width: 1000, height: 1200 }

figma.showUI(__html__, { ...DEFAULT_SIZE, themeColors: true })
figma.on('selectionchange', () => post({ type: 'selection', frame: summarize(selectedFrame()) }))

let busy = false

figma.ui.onmessage = async (msg: UiToMainMessage) => {
  if (msg.type === 'ready') {
    post({ type: 'init', fixtures: TEST_PROFILES.map(toFixtureOption) })
    post({ type: 'selection', frame: summarize(selectedFrame()) })
    return
  }
  if (msg.type === 'resize') {
    figma.ui.resize(clamp(msg.width, MIN_SIZE.width, MAX_SIZE.width), clamp(msg.height, MIN_SIZE.height, MAX_SIZE.height))
    return
  }
  if (msg.type === 'close') {
    figma.closePlugin()
    return
  }
  if (msg.type === 'generate' || msg.type === 'generate-profile') {
    if (busy) return
    busy = true
    try {
      if (msg.type === 'generate') {
        const fixture = TEST_PROFILES.find((f) => f.id === msg.fixtureId)
        await handleGenerate(fixture?.profile, `test profile "${msg.fixtureId}"`)
      } else {
        await handleGenerate(msg.profile, 'reviewed resume')
      }
    } finally {
      busy = false
    }
    return
  }
  if (msg.type === 'jd-read-layers') {
    const frame = selectedFrame()
    if (!frame) {
      post({ type: 'jd-frame-layers', frame: null, layers: [], error: 'Select a profile frame on the canvas first.' })
      return
    }
    try {
      post({ type: 'jd-frame-layers', frame: summarize(frame), layers: readFrameLayers(frame) })
    } catch (error) {
      console.error('[Profiler] Could not read selected frame', error)
      post({ type: 'jd-frame-layers', frame: summarize(frame), layers: [], error: describeError(error) })
    }
    return
  }
  if (msg.type === 'jd-apply-rewrite' || msg.type === 'jd-generate-profile') {
    if (busy) return
    busy = true
    try {
      if (msg.type === 'jd-apply-rewrite') await handleApplyRewrite(msg.frameId, msg.plan, msg.name)
      else await handleGenerateTailored(msg.profile, msg.name)
    } finally {
      busy = false
    }
  }
}

function selectedFrame(): FrameLike | null {
  return (figma.currentPage.selection.find(isFrameLike) as FrameLike | undefined) ?? null
}

function summarize(frame: FrameLike | null): SelectedFrame | null {
  return frame ? { id: frame.id, name: frame.name } : null
}

async function handleApplyRewrite(frameId: string, plan: RewritePlan, name: string): Promise<void> {
  try {
    const { copy, diff, warnings } = await applyRewrite(frameId, plan, name)
    figma.currentPage.selection = [copy]
    figma.viewport.scrollAndZoomIntoView([copy])
    figma.notify(`Created "${copy.name}".`)
    post({ type: 'jd-rewrite-result', ok: true, copyName: copy.name, diff, warnings })
  } catch (error) {
    console.error('[Profiler]', error)
    const message = describeError(error)
    figma.notify(message.split('\n')[0], { error: true })
    post({ type: 'jd-rewrite-result', ok: false, error: message })
  }
}

async function handleGenerateTailored(profile: ConsultantProfile, name: string): Promise<void> {
  try {
    // Validate again here: the main code never trusts data from the panel blindly.
    const problems = validateProfile(profile)
    if (problems.length > 0) {
      throw new ProfilerError(`The profile data has ${problems.length} problem(s):\n• ${problems.join('\n• ')}`)
    }
    const { frame } = await generateProfile(profile)
    frame.name = name
    figma.currentPage.selection = [frame]
    figma.viewport.scrollAndZoomIntoView([frame])
    figma.notify(`Created "${frame.name}".`)
    post({ type: 'jd-rewrite-result', ok: true, copyName: frame.name, diff: [], warnings: [] })
  } catch (error) {
    console.error('[Profiler]', error)
    const message = describeError(error)
    figma.notify(message.split('\n')[0], { error: true })
    post({ type: 'jd-rewrite-result', ok: false, error: message })
  }
}

function toFixtureOption(spec: (typeof TEST_PROFILES)[number]): FixtureOption {
  const header = spec.profile.header ?? ({ name: 'Untitled', title: '' } as ConsultantProfile['header'])
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    kind: spec.kind,
    name: header.name || '(no name)',
    title: header.title || '',
    stats: fixtureStats(spec.profile),
  }
}

async function handleGenerate(profile: ConsultantProfile | undefined, source: string): Promise<void> {
  post({ type: 'status', state: 'working', message: 'Generating profile…' })
  try {
    if (!profile) throw new ProfilerError(`Unknown ${source}.`)

    // Validate again here: the main code never trusts data from the panel blindly.
    const problems = validateProfile(profile)
    if (problems.length > 0) {
      throw new ProfilerError(`The profile data has ${problems.length} problem(s):\n• ${problems.join('\n• ')}`)
    }

    const { frame, fontFamily } = await generateProfile(profile)
    figma.currentPage.selection = [frame]
    figma.viewport.scrollAndZoomIntoView([frame])

    const preferred = theme.fontFamilies[0]
    const fontNote = fontFamily === preferred ? '' : ` ${preferred} was not available, so ${fontFamily} was used.`
    const message = `Generated profile for ${profile.header.name}.${fontNote}`
    figma.notify(message)
    post({ type: 'status', state: 'success', message })
  } catch (error) {
    console.error('[Profiler]', error)
    const message = describeError(error)
    figma.notify(message.split('\n')[0], { error: true })
    post({ type: 'status', state: 'error', message })
  }
}

function post(message: MainToUiMessage): void {
  figma.ui.postMessage(message)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
