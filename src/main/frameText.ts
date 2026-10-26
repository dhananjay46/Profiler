// Reads the text of a profile frame for the JD rewrite, and applies a rewrite
// to a duplicate of that frame.
//
// The duplicate keeps every layer of the original (auto layout, components,
// images, spacing). Only text changes: existing text layers get new content in
// their own styles, and list items are added by repeating an existing item.
//
// Layers are addressed by key: the child-index path from the frame, e.g.
// "2.0.3". A clone has the same tree, so a key read from the original resolves
// to the matching layer in the copy.

import type { FrameTextLayer, RewriteDiffItem, RewritePlan } from '../shared/messages'
import { placeBeside } from './components'
import { ProfilerError } from './errors'
import { PROFILE_DATA_KEY } from './render/profile'

export type FrameLike = FrameNode | ComponentNode | InstanceNode | GroupNode
type ParentNode = SceneNode & ChildrenMixin

export function isFrameLike(node: BaseNode): node is FrameLike {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'GROUP'
}

// ---------------------------------------------------------------- reading

interface Located {
  key: string
  node: TextNode
}

/** Visible text layers under the frame, in reading order (top to bottom, then left to right). */
function locateTexts(root: FrameLike): Located[] {
  const out: Located[] = []
  const walk = (node: SceneNode, key: string): void => {
    if (!node.visible) return
    if (node.type === 'TEXT') {
      out.push({ key, node })
      return
    }
    if ('children' in node) node.children.forEach((child, i) => walk(child, key ? `${key}.${i}` : `${i}`))
  }
  root.children.forEach((child, i) => walk(child, `${i}`))
  const box = (n: TextNode): Rect => n.absoluteBoundingBox ?? { x: n.x, y: n.y, width: n.width, height: n.height }
  out.sort((a, b) => box(a.node).y - box(b.node).y || box(a.node).x - box(b.node).x)
  return out
}

export function readFrameLayers(root: FrameLike): FrameTextLayer[] {
  return locateTexts(root)
    .filter(({ node }) => node.characters.trim() !== '')
    .map(({ key, node }) => ({
      key,
      name: node.name,
      section: sectionOf(node, root),
      text: markedText(node),
      fontSize: node.fontSize === figma.mixed ? Math.round(dominantStyle(node).fontSize) : node.fontSize,
      repeatable: repeatUnit(node, root) !== null,
    }))
}

/** The names of up to three ancestors below the frame, outermost first, e.g. "Experience › Example Tech". */
function sectionOf(node: SceneNode, root: FrameLike): string {
  const names: string[] = []
  let current = node.parent
  while (current && current !== root && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    names.unshift(current.name)
    current = current.parent
  }
  return names.slice(-3).join(' › ')
}

// ---------------------------------------------------------------- styles

const STYLE_FIELDS = [
  'fontName',
  'fontSize',
  'fills',
  'textDecoration',
  'textCase',
  'letterSpacing',
  'lineHeight',
  'listOptions',
  'indentation',
] as const

type Segment = Pick<
  StyledTextSegment,
  'characters' | 'start' | 'end' | (typeof STYLE_FIELDS)[number]
>

function segmentsOf(node: TextNode): Segment[] {
  if (node.characters.length === 0) return []
  return node.getStyledTextSegments([...STYLE_FIELDS])
}

function styleKey(segment: Segment): string {
  return JSON.stringify([segment.fontName, segment.fills, segment.textDecoration])
}

/** The style covering the most characters: the layer's body style. */
function dominantStyle(node: TextNode): Segment {
  const totals = new Map<string, { segment: Segment; length: number }>()
  for (const segment of segmentsOf(node)) {
    const key = styleKey(segment)
    const entry = totals.get(key) ?? { segment, length: 0 }
    entry.length += segment.end - segment.start
    totals.set(key, entry)
  }
  let best: { segment: Segment; length: number } | undefined
  for (const entry of totals.values()) if (!best || entry.length > best.length) best = entry
  return best!.segment
}

/** The most-used style that differs from the body style (bold labels, links), if any. */
function emphasisStyle(node: TextNode, base: Segment): Segment | null {
  const baseKey = styleKey(base)
  let best: Segment | null = null
  let bestLength = 0
  for (const segment of segmentsOf(node)) {
    if (styleKey(segment) === baseKey || !segment.characters.trim()) continue
    const length = segment.end - segment.start
    if (length > bestLength) {
      best = segment
      bestLength = length
    }
  }
  return best
}

/** Layer text with **…** around runs that differ from the body style. */
function markedText(node: TextNode): string {
  const segments = segmentsOf(node)
  if (segments.length <= 1) return node.characters
  const baseKey = styleKey(dominantStyle(node))
  return segments
    .map((segment) => {
      if (styleKey(segment) === baseKey || !segment.characters.trim()) return segment.characters
      // Keep surrounding spaces outside the markers.
      const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(segment.characters)!
      return `${match[1]}**${match[2]}**${match[3]}`
    })
    .join('')
}

function parseMarked(text: string): { plain: string; emphasis: [number, number][] } {
  let plain = ''
  const emphasis: [number, number][] = []
  text.split(/\*\*([\s\S]+?)\*\*/).forEach((part, i) => {
    if (i % 2 === 1) emphasis.push([plain.length, plain.length + part.length])
    plain += part
  })
  return { plain, emphasis }
}

function applyStyle(node: TextNode, start: number, end: number, style: Segment): void {
  if (end <= start) return
  node.setRangeFontName(start, end, style.fontName)
  node.setRangeFontSize(start, end, style.fontSize)
  node.setRangeFills(start, end, style.fills)
  node.setRangeTextDecoration(start, end, style.textDecoration)
  node.setRangeTextCase(start, end, style.textCase)
  node.setRangeLetterSpacing(start, end, style.letterSpacing)
  node.setRangeLineHeight(start, end, style.lineHeight)
  try {
    node.setRangeListOptions(start, end, style.listOptions)
    node.setRangeIndentation(start, end, style.indentation)
  } catch {
    // List formatting is optional; plain paragraphs are fine without it.
  }
}

/** Replace a layer's text, keeping its body style and putting **runs** in its emphasis style. */
async function setMarkedText(node: TextNode, marked: string): Promise<void> {
  if (node.hasMissingFont) throw new ProfilerError(`"${node.name}" uses a font that is not installed.`)
  const base = dominantStyle(node)
  const emphasis = emphasisStyle(node, base) ?? (await boldVariant(base))
  const fonts = node.characters.length > 0 ? node.getRangeAllFontNames(0, node.characters.length) : []
  await Promise.all([...fonts, base.fontName, ...(emphasis ? [emphasis.fontName] : [])].map((f) => figma.loadFontAsync(f)))

  const { plain, emphasis: ranges } = parseMarked(marked)
  node.characters = plain
  applyStyle(node, 0, plain.length, base)
  if (emphasis) for (const [start, end] of ranges) applyStyle(node, start, end, emphasis)
}

let fontStyles: Map<string, Set<string>> | null = null

/** The body style in its family's bold weight, for layers that had no emphasis of their own. */
async function boldVariant(base: Segment): Promise<Segment | null> {
  if (!fontStyles) {
    fontStyles = new Map()
    for (const { fontName } of await figma.listAvailableFontsAsync()) {
      if (!fontStyles.has(fontName.family)) fontStyles.set(fontName.family, new Set())
      fontStyles.get(fontName.family)!.add(fontName.style)
    }
  }
  const styles = fontStyles.get(base.fontName.family)
  if (!styles) return null
  const italic = /italic/i.test(base.fontName.style)
  for (const weight of ['Bold', 'SemiBold', 'Semibold', 'Semi Bold']) {
    const style = italic ? `${weight} Italic` : weight
    if (styles.has(style)) return { ...base, fontName: { family: base.fontName.family, style } }
  }
  return null
}

// ---------------------------------------------------------------- repeating items

function countTexts(node: SceneNode): number {
  if (node.type === 'TEXT') return 1
  return 'children' in node ? node.children.reduce((sum, child) => sum + countTexts(child), 0) : 0
}

function insideInstance(node: BaseNode, root: FrameLike): boolean {
  for (let n = node.parent; n && n !== root.parent; n = n.parent) if (n.type === 'INSTANCE') return true
  return false
}

/**
 * The layer to duplicate when adding an item like this text: the text itself,
 * or its wrapper when the wrapper holds no other text (a bullet row with an
 * icon, a chip with a background). Null when the item cannot be repeated.
 */
function repeatUnit(text: TextNode, root: FrameLike): SceneNode | null {
  let unit: SceneNode = text
  while (unit.parent && unit.parent !== root && 'children' in unit.parent && countTexts(unit.parent as SceneNode) === 1) {
    unit = unit.parent as SceneNode
  }
  const parent = unit.parent
  if (!parent || parent.type === 'PAGE' || parent.type === 'DOCUMENT' || parent.type === 'INSTANCE') return null
  if (insideInstance(unit, root)) return null
  return unit
}

function hasAutoLayout(node: BaseNode | null): boolean {
  return !!node && 'layoutMode' in node && node.layoutMode !== 'NONE'
}

// ---------------------------------------------------------------- applying

export interface RewriteResult {
  copy: FrameLike
  diff: RewriteDiffItem[]
  warnings: string[]
}

function resolve(root: FrameLike, key: string): SceneNode | null {
  let node: SceneNode = root
  for (const part of key.split('.')) {
    if (!('children' in node)) return null
    const child: SceneNode | undefined = (node as ParentNode).children[Number(part)]
    if (!child) return null
    node = child
  }
  return node === root ? null : node
}

export async function applyRewrite(frameId: string, plan: RewritePlan, name: string): Promise<RewriteResult> {
  const original = await figma.getNodeByIdAsync(frameId)
  if (!original || original.removed || !isFrameLike(original)) {
    throw new ProfilerError('The selected frame is no longer on the canvas. Select it and try again.')
  }
  const copy = original.clone()
  // Next to the original, never inside its parent's layout. Placed again at the end,
  // once the rewrite has given the copy its final size.
  placeBeside(copy, original)
  copy.name = name
  // The stored profile data describes the original's text, not the rewrite.
  if (copy.getPluginData(PROFILE_DATA_KEY)) copy.setPluginData(PROFILE_DATA_KEY, '')

  const diff: RewriteDiffItem[] = []
  const warnings: string[] = []
  const sizes = new Map<TextNode, { width: number; height: number }>()
  const track = (node: TextNode): void => {
    if (!sizes.has(node)) sizes.set(node, { width: node.width, height: node.height })
  }

  // Resolve every key before inserting anything: insertions shift child indexes.
  const changes = plan.changes.map((change) => ({ change, node: resolve(copy, change.key) }))
  const additions = plan.additions.map((addition) => ({ addition, node: resolve(copy, addition.afterKey) }))

  for (const { change, node } of changes) {
    if (!node || node.type !== 'TEXT') continue
    const before = markedText(node)
    if (before === change.text) continue
    const section = sectionOf(node, copy) || node.name
    try {
      track(node)
      await setMarkedText(node, change.text)
      diff.push({ kind: 'changed', section, before, after: change.text })
    } catch (error) {
      diff.push({ kind: 'skipped', section, before, after: change.text, reason: messageOf(error) })
    }
  }

  for (const { addition, node } of additions) {
    if (!node || node.type !== 'TEXT') continue
    const section = sectionOf(node, copy) || node.name
    const unit = repeatUnit(node, copy)
    if (!unit) {
      for (const text of addition.texts) diff.push({ kind: 'skipped', section, before: '', after: text, reason: 'This item cannot be repeated (it is inside a component instance).' })
      continue
    }
    const parent = unit.parent as ParentNode
    const autoLayout = hasAutoLayout(parent)
    let anchor = unit
    for (const text of addition.texts) {
      const dup = unit.clone()
      parent.insertChild(parent.children.indexOf(anchor) + 1, dup)
      if (!autoLayout) {
        // Without auto layout nothing moves out of the way; stack it below its anchor.
        dup.x = anchor.x
        dup.y = anchor.y + anchor.height + 4
      }
      const textNode = dup.type === 'TEXT' ? dup : (dup as ParentNode).findOne((n) => n.type === 'TEXT') as TextNode | null
      try {
        if (!textNode) throw new ProfilerError('The copied item has no text layer.')
        await setMarkedText(textNode, text)
        diff.push({ kind: 'added', section, before: '', after: text })
      } catch (error) {
        dup.remove()
        diff.push({ kind: 'skipped', section, before: '', after: text, reason: messageOf(error) })
        continue
      }
      anchor = dup
    }
    if (!autoLayout && addition.texts.length > 0) {
      warnings.push(`New items in "${section}" were placed below the last item, but that group has no auto layout, so they may overlap the layers under it.`)
    }
  }

  for (const [node, size] of sizes) {
    const grew = node.height > size.height + 0.5 || node.width > size.width + 0.5
    if (!grew) continue
    if (node.textAutoResize === 'NONE' || node.textAutoResize === 'TRUNCATE') {
      warnings.push(`"${node.name}" has a fixed-size text box, so the new text may be cut off.`)
    } else if (!hasAutoLayout(node.parent)) {
      warnings.push(`"${node.name}" grew, and its parent has no auto layout, so it may overlap the layers below.`)
    }
  }

  placeBeside(copy, original)
  return { copy, diff, warnings: [...new Set(warnings)] }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
