// Reusable Figma components (section title, tool tile). They are created once per
// page inside a "Profiler · Components" frame and reused on every run, so
// editing a main component restyles every generated profile that uses it.

import { ProfilerError } from './errors'
import { loadFontsUsedIn } from './fonts'
import { addStack, addText, applyStackStyle, type Sizing } from './primitives'
import { theme } from './theme'

const COMPONENT_KEY = 'profiler-component'
const LIBRARY_KEY = 'profiler-library'
/**
 * Increase after changing how components are built (or their theme styles).
 * Components from older versions are left alone and new ones are created.
 */
const COMPONENT_VERSION = 4
/** Size of the image slot inside each tool tile (edge of a square frame). */
const TOOL_ICON_SIZE = 38
/** Name of the text layer inside each component that receives the content. */
const LABEL = 'Label'

type ComponentId = 'section-title' | 'tool-tile'

export interface ComponentLibrary {
  sectionTitle: ComponentNode
  toolTile: ComponentNode
}

const BUILDERS: Record<ComponentId, { name: string; build: () => ComponentNode }> = {
  'section-title': { name: 'Profiler / Section Title', build: buildSectionTitle },
  'tool-tile': { name: 'Profiler / Tool Tile', build: buildToolTile },
}

/** Finds the components on `page`, creating any that are missing. */
export async function getComponentLibrary(page: PageNode): Promise<ComponentLibrary> {
  const found = new Map<string, ComponentNode>()
  for (const node of page.findAllWithCriteria({ types: ['COMPONENT'] })) {
    const key = node.getPluginData(COMPONENT_KEY)
    if (key && !found.has(key)) found.set(key, node)
  }

  const get = async (id: ComponentId): Promise<ComponentNode> => {
    const key = `${id}@${COMPONENT_VERSION}`
    const existing = found.get(key)
    if (existing) {
      await loadFontsUsedIn(existing) // the designer may have changed its font
      return existing
    }
    const component = BUILDERS[id].build()
    component.name = BUILDERS[id].name
    component.description = 'Created by Profiler. Edit this component to restyle every generated profile.'
    component.setPluginData(COMPONENT_KEY, key)
    getOrCreateLibraryFrame(page).appendChild(component)
    return component
  }

  return {
    sectionTitle: await get('section-title'),
    toolTile: await get('tool-tile'),
  }
}

/** Places an instance of `component` in `parent` and sets its label text. */
export function addInstance(
  parent: FrameNode,
  component: ComponentNode,
  label: string,
  width: Sizing = 'FILL',
): InstanceNode {
  const instance = component.createInstance()
  parent.appendChild(instance)
  if (width === 'FILL') instance.layoutSizingHorizontal = 'FILL'

  const text = instance.findOne((n) => n.type === 'TEXT' && n.name === LABEL) as TextNode | null
  if (!text) {
    throw new ProfilerError(
      `The "${component.name}" component needs a text layer named "${LABEL}". Rename it back, or delete the component so it is recreated.`,
    )
  }
  text.characters = label
  return instance
}

function getOrCreateLibraryFrame(page: PageNode): FrameNode {
  const existing = page.children.find(
    (n): n is FrameNode => n.type === 'FRAME' && n.getPluginData(LIBRARY_KEY) === String(COMPONENT_VERSION),
  )
  if (existing) return existing

  const frame = figma.createFrame()
  applyStackStyle(frame, {
    name: `Profiler · Components v${COMPONENT_VERSION}`,
    direction: 'VERTICAL',
    gap: 24,
    padding: [24, 24, 24, 24],
    fill: 'page',
    stroke: 'ring',
  })
  frame.setPluginData(LIBRARY_KEY, String(COMPONENT_VERSION))
  page.appendChild(frame)
  placeRightOfContent(frame, page)
  return frame
}

function buildSectionTitle(): ComponentNode {
  const component = figma.createComponent()
  applyStackStyle(component, { name: 'Section Title', direction: 'VERTICAL' })
  component.layoutSizingHorizontal = 'FIXED'
  component.resize(240, Math.max(1, component.height))
  component.layoutSizingVertical = 'HUG'
  addText(component, 'Section title', theme.text.sectionTitle, { name: LABEL })
  return component
}

/**
 * A square tile that wraps a 38×38 image slot. In Figma, select the inner
 * "Logo (replace with image)" slot (double-click to drill into the instance),
 * then paste the tool's official brand mark or use Fill > Image. The fallback
 * initials text stays visible until an image is set and can be deleted after.
 * No brand logos are bundled with the plugin.
 */
function buildToolTile(): ComponentNode {
  const { toolTile, toolRadius } = theme.layout
  const padding = Math.max(0, Math.round((toolTile - TOOL_ICON_SIZE) / 2))
  const component = figma.createComponent()
  applyStackStyle(component, {
    name: 'Tool Tile',
    direction: 'VERTICAL',
    justify: 'CENTER',
    align: 'CENTER',
    padding: [padding, padding, padding, padding],
    radius: toolRadius,
    fill: 'tile',
  })
  component.resize(toolTile, toolTile)
  component.layoutSizingHorizontal = 'FIXED'
  component.layoutSizingVertical = 'FIXED'

  const slot = addStack(
    component,
    {
      name: 'Logo (replace with image)',
      direction: 'VERTICAL',
      justify: 'CENTER',
      align: 'CENTER',
      fill: 'tile',
      radius: Math.max(0, toolRadius - padding),
    },
    'HUG',
  )
  slot.resize(TOOL_ICON_SIZE, TOOL_ICON_SIZE)
  slot.layoutSizingHorizontal = 'FIXED'
  slot.layoutSizingVertical = 'FIXED'
  addText(slot, 'Ab', theme.text.toolTile, { name: LABEL, width: 'HUG' })

  return component
}

/**
 * Puts `copy` side by side with `original`: in the same page or section, just
 * to its right and top-aligned, with `gap` between them. Anything already in
 * that spot is stepped past, so nothing overlaps; a section grows to fit.
 *
 * When the original sits inside a frame, group or instance, the copy goes
 * beside the outermost one instead, since a copy inside it would join its
 * layout or be clipped. Call again once the copy has its final size.
 */
export function placeBeside(copy: SceneNode, original: SceneNode, gap = 120): void {
  let anchor: SceneNode = original
  while (anchor.parent && anchor.parent.type !== 'PAGE' && anchor.parent.type !== 'SECTION') {
    anchor = anchor.parent as SceneNode
  }
  const parent = anchor.parent as PageNode | SectionNode
  if (copy.parent !== parent) parent.insertChild(parent.children.indexOf(anchor) + 1, copy)

  copy.x = anchor.x + anchor.width + gap
  copy.y = anchor.y
  // Siblings in the way, including any earlier copies: keep a full gap clear of each.
  const others = parent.children.filter((n) => n !== copy && n !== anchor)
  let moved = true
  while (moved) {
    moved = false
    for (const other of others) {
      const overlaps =
        copy.x < other.x + other.width + gap &&
        copy.x + copy.width + gap > other.x &&
        copy.y < other.y + other.height &&
        copy.y + copy.height > other.y
      if (overlaps) {
        copy.x = other.x + other.width + gap
        moved = true
      }
    }
  }

  if (parent.type === 'SECTION') {
    const width = Math.max(parent.width, copy.x + copy.width + gap / 2)
    const height = Math.max(parent.height, copy.y + copy.height + gap / 2)
    if (width !== parent.width || height !== parent.height) parent.resizeWithoutConstraints(width, height)
  }
}

/** Moves `node` to the right of everything else on the page, so nothing overlaps. */
export function placeRightOfContent(node: SceneNode, page: PageNode, gap = 120): void {
  const others = page.children.filter((n) => n !== node)
  if (others.length === 0) {
    node.x = 0
    node.y = 0
    return
  }
  node.x = Math.max(...others.map((n) => n.x + n.width)) + gap
  node.y = Math.min(...others.map((n) => n.y))
}
