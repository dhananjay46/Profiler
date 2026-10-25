// Assembles a full profile page from the section renderers.
//
//  ┌──────────────────── page (852 wide, height hugs content) ─┐
//  │ ▇▇▇▇                                          [Logo]      │
//  │ ▇┌─────┐  Name                                            │
//  │  │photo│  Title                                           │
//  │  └─────┘  Summary paragraphs with **bold** phrases        │
//  │  (◯)   (◯)   (◯)   (◯)   (◯)   (◯)   competencies         │
//  │ Education & Certifications                                │
//  │ Work Experience  (any number of entries)                  │
//  │ Skills           (3 columns)                              │
//  │ Tools            (tiles)                                  │
//  │           centered case studies with screenshots          │
//  └───────────────────────────────────────────────────────────┘
//
// The page itself has no padding: header, icon row, content and case studies
// each set their own horizontal position, as measured from the reference.

import type { ConsultantProfile } from '../../shared/types'
import { getComponentLibrary, placeRightOfContent } from '../components'
import { loadFonts } from '../fonts'
import { addStack, createStack } from '../primitives'
import { theme } from '../theme'
import { renderCaseStudies } from './caseStudies'
import { renderCompetencies } from './competencies'
import { renderEducationAndCertifications } from './educationCertifications'
import { renderExperience } from './experience'
import { renderHeader } from './header'
import type { RenderContext } from './section'
import { renderSkills, renderTools } from './skillsTools'
import { renderSummary } from './summary'

export const GENERATED_KEY = 'profiler-generated'
export const PROFILE_DATA_KEY = 'profiler-profile-data'

export interface GenerateResult {
  frame: FrameNode
  /** The font family actually used (a fallback when the preferred one is missing). */
  fontFamily: string
}

export async function generateProfile(
  profile: ConsultantProfile,
  page: PageNode = figma.currentPage,
): Promise<GenerateResult> {
  // Fonts must be loaded before any text layer is created or edited.
  const fontFamily = await loadFonts(theme.fontFamilies)
  const ctx: RenderContext = { components: await getComponentLibrary(page) }
  const layout = theme.layout

  const root = createStack({
    name: `Consultant Profile – ${profile.header.name}`,
    direction: 'VERTICAL',
    padding: [0, 0, layout.pageBottom, 0],
    fill: 'page',
  })
  page.appendChild(root)

  try {
    root.layoutSizingHorizontal = 'FIXED'
    root.resize(layout.pageWidth, Math.max(1, root.height))
    root.layoutSizingVertical = 'HUG'
    root.clipsContent = true

    const intro = renderHeader(root, profile.header)
    renderSummary(intro, profile.summary)
    const competencies = renderCompetencies(root, profile.competencies)

    const content = addStack(root, {
      name: 'Content',
      direction: 'VERTICAL',
      gap: layout.sectionGap,
      padding: withTop(layout.contentPadding, competencies ? layout.contentTop : layout.sectionGap),
    })
    renderEducationAndCertifications(content, profile.education, profile.certifications, ctx)
    renderExperience(content, profile.experience, ctx)
    renderSkills(content, profile.skills, ctx)
    renderTools(content, profile.tools, ctx)
    if (content.children.length === 0) content.remove()

    renderCaseStudies(root, profile.caseStudies)

    root.setPluginData(GENERATED_KEY, 'profile')
    root.setPluginData(PROFILE_DATA_KEY, JSON.stringify(profile))
    placeRightOfContent(root, page)
    return { frame: root, fontFamily }
  } catch (error) {
    // Don't leave a half-drawn profile on the canvas.
    if (!root.removed) root.remove()
    throw error
  }
}

function withTop([, right, bottom, left]: [number, number, number, number], top: number): [number, number, number, number] {
  return [top, right, bottom, left]
}
