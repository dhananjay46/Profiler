// Messages exchanged between the plugin panel (src/ui) and the main code (src/main).

import type { ConsultantProfile } from './types'

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

/** One text layer of the selected frame, as sent to the JD rewrite. */
export interface FrameTextLayer {
  /** Child-index path from the frame, e.g. "2.0.3". Stable across a duplicate. */
  key: string
  name: string
  /** Names of the enclosing groups, outermost first, e.g. "Experience › Example Tech". */
  section: string
  /** The text, with **…** around runs styled differently from the body (bold labels, links). */
  text: string
  fontSize: number
  /** True when similar items can be added after this one by duplicating it. */
  repeatable: boolean
}

/** What the rewrite changes in a frame. Keys refer to FrameTextLayer.key. */
export interface RewritePlan {
  changes: { key: string; text: string }[]
  /** New list items, each a copy of the layer at afterKey, inserted after it in order. */
  additions: { afterKey: string; texts: string[] }[]
  /** Things the rewrite could not change, such as images and icons. */
  notes: string[]
}

export interface RewriteDiffItem {
  kind: 'changed' | 'added' | 'skipped'
  section: string
  before: string
  after: string
  reason?: string
}

export interface SelectedFrame {
  id: string
  name: string
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
  /** Read the text layers of the selected frame for the JD rewrite. */
  | { type: 'jd-read-layers' }
  /** Duplicate the frame and apply the rewrite to the copy. */
  | { type: 'jd-apply-rewrite'; frameId: string; plan: RewritePlan; name: string }
  /** Render a rewritten built-in profile as a new frame. */
  | { type: 'jd-generate-profile'; profile: ConsultantProfile; name: string }

export type MainToUiMessage =
  | { type: 'init'; fixtures: FixtureOption[] }
  | { type: 'status'; state: 'working' | 'success' | 'error'; message: string }
  /** The frame currently selected on the canvas, sent whenever the selection changes. */
  | { type: 'selection'; frame: SelectedFrame | null }
  | { type: 'jd-frame-layers'; frame: SelectedFrame | null; layers: FrameTextLayer[]; error?: string }
  | { type: 'jd-rewrite-result'; ok: true; copyName: string; diff: RewriteDiffItem[]; warnings: string[] }
  | { type: 'jd-rewrite-result'; ok: false; error: string }
