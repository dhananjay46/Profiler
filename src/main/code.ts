// Plugin entry point. Runs in Figma's main thread with access to the document.
// Talks to the panel (src/ui) only through messages.

import { fixtureStats, TEST_PROFILES } from '../data/testProfiles'
import type { FixtureOption, FrameSourceSummary, MainToUiMessage, UiToMainMessage } from '../shared/messages'
import type { ConsultantProfile } from '../shared/types'
import { validateProfile } from '../shared/validate'
import { describeError, ProfilerError } from './errors'
import { readProfileFromFrame } from './readFrame'
import { generateProfile } from './render/profile'
import { theme } from './theme'

const DEFAULT_SIZE = { width: 480, height: 720 }
const MIN_SIZE = { width: 360, height: 500 }
const MAX_SIZE = { width: 1000, height: 1200 }

figma.showUI(__html__, { ...DEFAULT_SIZE, themeColors: true })

let busy = false

figma.ui.onmessage = async (msg: UiToMainMessage) => {
  if (msg.type === 'ready') {
    post({ type: 'init', fixtures: TEST_PROFILES.map(toFixtureOption) })
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
  if (msg.type === 'jd-read-selected') {
    post({ type: 'jd-selected-frame', frame: readSelectedFrame() })
    return
  }
  if (msg.type === 'jd-generate-tailored') {
    if (busy) return
    busy = true
    try {
      await handleGenerate(msg.profile, 'JD-tailored profile', `JD Tailored Profile${msg.role ? ` – ${msg.role}` : ''}`)
    } finally {
      busy = false
    }
    return
  }
}

function readSelectedFrame(): FrameSourceSummary | null {
  const selection = figma.currentPage.selection
  const node = selection.find(
    (n) => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'GROUP',
  ) as FrameNode | ComponentNode | InstanceNode | GroupNode | undefined
  if (!node) return null
  try {
    const profile = readProfileFromFrame(node)
    return { id: node.id, name: node.name, profile }
  } catch (error) {
    console.error('[Profiler] Could not read selected frame', error)
    return null
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

async function handleGenerate(
  profile: ConsultantProfile | undefined,
  source: string,
  nameOverride?: string,
): Promise<void> {
  post({ type: 'status', state: 'working', message: 'Generating profile…' })
  try {
    if (!profile) throw new ProfilerError(`Unknown ${source}.`)

    // Validate again here: the main code never trusts data from the panel blindly.
    const problems = validateProfile(profile)
    if (problems.length > 0) {
      throw new ProfilerError(`The profile data has ${problems.length} problem(s):\n• ${problems.join('\n• ')}`)
    }

    const { frame, fontFamily } = await generateProfile(profile)
    if (nameOverride) frame.name = nameOverride
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
