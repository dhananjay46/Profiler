// Messages exchanged between the plugin panel (src/ui) and the main code (src/main).

import type { ConsultantProfile } from './types'

export interface FrameSourceSummary {
  id: string
  name: string
  profile: ConsultantProfile
}

export interface FixtureOption {
  id: string
  label: string
  description: string
  kind: 'sample' | 'edge-case'
  name: string
  title: string
  stats: {
    experience: number
    education: number
    certifications: number
    skills: number
    tools: number
    caseStudies: number
  }
}

export type UiToMainMessage =
  | { type: 'ready' }
  /** Generate from built-in test data. */
  | { type: 'generate'; fixtureId: string }
  /** Generate from a reviewed resume. */
  | { type: 'generate-profile'; profile: ConsultantProfile }
  /** Panel asked to be resized (user dragged the grip). */
  | { type: 'resize'; width: number; height: number }
  | { type: 'close' }
  /** Read the currently selected frame as a source profile for JD Match. */
  | { type: 'jd-read-selected' }
  /** Generate a tailored copy of the profile from the JD Match flow. */
  | { type: 'jd-generate-tailored'; profile: ConsultantProfile; role?: string }

export type MainToUiMessage =
  | { type: 'init'; fixtures: FixtureOption[] }
  | { type: 'status'; state: 'working' | 'success' | 'error'; message: string }
  | { type: 'jd-selected-frame'; frame: FrameSourceSummary | null; message?: string }
