// Small building blocks for native, editable Figma layers. Every container is
// an Auto Layout frame, so content of any length pushes later content down
// instead of overlapping it.
//
// Figma only allows "Fill container" sizing on a node that is already inside
// an Auto Layout parent, so every helper appends to its parent first and sets
// sizing afterwards.

import { font } from './fonts'
import { theme, type ColorToken, type FontWeight, type Padding, type TextStyleSpec } from './theme'

export type Sizing = 'FILL' | 'HUG'

export interface StackOptions {
  name: string
  direction: 'VERTICAL' | 'HORIZONTAL'
  gap?: number
  padding?: Padding
  fill?: ColorToken
  stroke?: ColorToken
  radius?: number
  /** Wrap children onto new rows (horizontal stacks only). */
  wrap?: boolean
  justify?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  align?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
}

export function solid(token: ColorToken): SolidPaint {
  return { type: 'SOLID', color: hexToRgb(theme.colors[token]) }
}

/** Creates an Auto Layout frame that is not yet attached to a parent. */
export function createStack(opts: StackOptions): FrameNode {
  const frame = figma.createFrame()
  applyStackStyle(frame, opts)
  return frame
}

/** Turns a frame or component into an Auto Layout container. */
export function applyStackStyle(frame: FrameNode | ComponentNode, opts: StackOptions): void {
  frame.name = opts.name
  frame.layoutMode = opts.direction
  frame.itemSpacing = opts.gap ?? 0
  frame.primaryAxisAlignItems = opts.justify ?? 'MIN'
  frame.counterAxisAlignItems = opts.align ?? 'MIN'
  const [top, right, bottom, left] = opts.padding ?? [0, 0, 0, 0]
  frame.paddingTop = top
  frame.paddingRight = right
  frame.paddingBottom = bottom
  frame.paddingLeft = left
  frame.fills = opts.fill ? [solid(opts.fill)] : []
  if (opts.stroke) {
    frame.strokes = [solid(opts.stroke)]
    frame.strokeWeight = 1
    frame.strokeAlign = 'INSIDE'
  }
  frame.cornerRadius = opts.radius ?? 0
  frame.clipsContent = false
  if (opts.wrap) {
    frame.layoutWrap = 'WRAP'
    frame.counterAxisSpacing = opts.gap ?? 0
  }
  // A wrapping row needs a fixed or filled width to know where to wrap.
  if (!opts.wrap) frame.layoutSizingHorizontal = 'HUG'
  frame.layoutSizingVertical = 'HUG'
}

/** Creates an Auto Layout frame inside `parent`, by default full width. */
export function addStack(parent: FrameNode | ComponentNode, opts: StackOptions, width: Sizing = 'FILL'): FrameNode {
  const frame = createStack(opts)
  parent.appendChild(frame)
  frame.layoutSizingHorizontal = width
  return frame
}

/** A piece of text with an optional weight override, e.g. a bold phrase. */
export interface TextRun {
  text: string
  weight?: FontWeight
}

export interface TextOptions {
  name?: string
  width?: Sizing
  align?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
}

/** Splits "plain **bold** plain" into runs, making the starred parts bold. */
export function parseBold(text: string): TextRun[] {
  // split() with a capture group puts the bold parts at the odd indexes.
  return text
    .split(/\*\*(.+?)\*\*/)
    .map((part, i): TextRun => (i % 2 === 1 ? { text: part, weight: 'bold' } : { text: part }))
    .filter((run) => run.text !== '')
}

export function createText(content: string | TextRun[], style: TextStyleSpec, name?: string): TextNode {
  const runs = typeof content === 'string' ? [{ text: content }] : content
  const characters = runs.map((run) => run.text).join('')

  const node = figma.createText()
  node.fontName = font(style.weight) // must be set before characters
  node.characters = characters
  node.name = name ?? characters.slice(0, 40)
  node.fontSize = style.size
  node.lineHeight = { value: style.lineHeight, unit: 'PIXELS' }
  if (style.letterSpacing) node.letterSpacing = { value: style.letterSpacing, unit: 'PERCENT' }
  if (style.uppercase) node.textCase = 'UPPER'
  if (style.paragraphSpacing) node.paragraphSpacing = style.paragraphSpacing
  node.fills = [solid(style.color)]

  let start = 0
  for (const run of runs) {
    const end = start + run.text.length
    if (run.weight && run.weight !== style.weight && end > start) {
      node.setRangeFontName(start, end, font(run.weight))
    }
    start = end
  }
  return node
}

/**
 * Adds a text layer to `parent`. FILL width wraps long text onto new lines and
 * grows in height; HUG keeps it on one line at its natural width.
 */
export function addText(
  parent: FrameNode | ComponentNode,
  content: string | TextRun[],
  style: TextStyleSpec,
  opts: TextOptions = {},
): TextNode {
  const node = createText(content, style, opts.name)
  parent.appendChild(node)
  if ((opts.width ?? 'FILL') === 'FILL') {
    node.layoutSizingHorizontal = 'FILL'
    node.textAutoResize = 'HEIGHT'
  } else {
    node.textAutoResize = 'WIDTH_AND_HEIGHT'
  }
  if (opts.align) node.textAlignHorizontal = opts.align
  return node
}

/**
 * A numbered list with exact geometry: each item is a row with a
 * right-aligned number column and a justified text column, so wrapped lines
 * hang under the text rather than the number.
 */
export function addNumberedList(
  parent: FrameNode,
  items: string[],
  style: TextStyleSpec,
  opts: { name: string; numberWidth: number; gap: number },
): FrameNode {
  const list = addStack(parent, { name: opts.name, direction: 'VERTICAL' })
  items.forEach((item, i) => {
    const row = addStack(list, { name: `Item ${i + 1}`, direction: 'HORIZONTAL', gap: opts.gap })
    const number = addText(row, `${i + 1}.`, style, { name: 'Number', align: 'RIGHT' })
    number.layoutSizingHorizontal = 'FIXED'
    number.resize(opts.numberWidth, number.height)
    number.textAutoResize = 'HEIGHT'
    addText(row, item, style, { name: 'Text', align: 'JUSTIFIED' })
  })
  return list
}

/** Lays items out in fixed-width columns, filled top to bottom, left to right. */
export function addColumns(
  parent: FrameNode,
  items: string[],
  opts: { columns: number; columnWidth: number; style: TextStyleSpec; name: string },
): FrameNode {
  const row = addStack(parent, { name: opts.name, direction: 'HORIZONTAL' })
  const perColumn = Math.ceil(items.length / opts.columns)
  for (let c = 0; c < opts.columns; c++) {
    const column = addStack(row, { name: `Column ${c + 1}`, direction: 'VERTICAL' }, 'HUG')
    column.layoutSizingHorizontal = 'FIXED'
    column.resize(opts.columnWidth, Math.max(1, column.height))
    column.layoutSizingVertical = 'HUG'
    for (const item of items.slice(c * perColumn, (c + 1) * perColumn)) {
      addText(column, item, opts.style)
    }
  }
  return row
}

/** Fixed empty space in a vertical stack, for places where gaps differ. */
export function addSpacer(parent: FrameNode, height: number): FrameNode {
  const spacer = figma.createFrame()
  spacer.name = 'Spacer'
  spacer.fills = []
  parent.appendChild(spacer)
  spacer.resize(1, height)
  return spacer
}

/** Sets a fixed width (and keeps hug height) on an Auto Layout frame. */
export function setFixedWidth(frame: FrameNode, width: number): void {
  frame.layoutSizingHorizontal = 'FIXED'
  frame.resize(width, Math.max(1, frame.height))
  frame.layoutSizingVertical = 'HUG'
}

/**
 * A grey slot for an image (logo, screenshot). In Figma, select it and set an
 * image fill, then delete the label.
 */
export function addImagePlaceholder(
  parent: FrameNode,
  label: string,
  size: { width: Sizing | number; height: number },
): FrameNode {
  const fixedWidth = typeof size.width === 'number' ? size.width : null
  const slot = addStack(parent, {
    name: `${label} (replace with image)`,
    direction: 'VERTICAL',
    justify: 'CENTER',
    align: 'CENTER',
    fill: 'placeholder',
    radius: 4,
  })
  // resize() makes both axes fixed, so restore "Fill" afterwards when needed.
  slot.resize(fixedWidth ?? Math.max(1, slot.width), size.height)
  slot.layoutSizingHorizontal = fixedWidth === null ? 'FILL' : 'FIXED'
  slot.layoutSizingVertical = 'FIXED'
  addText(slot, label, theme.text.placeholder, { width: 'HUG', name: 'Label' })
  return slot
}

export function addRule(parent: FrameNode | ComponentNode, color: ColorToken, thickness = 1): RectangleNode {
  const rule = figma.createRectangle()
  rule.name = 'Divider'
  rule.fills = [solid(color)]
  parent.appendChild(rule)
  rule.resize(100, thickness)
  rule.layoutSizingHorizontal = 'FILL'
  return rule
}

/** Joins the non-empty parts with a separator, e.g. "London · 2019 – 2021". */
export function joinParts(parts: (string | undefined)[], separator = '  ·  '): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join(separator)
}

/** "Jan 2020 – Mar 2022". With one date, shows just that date (never assumes "Present"). */
export function dateRange(start?: string, end?: string): string {
  if (start && end) return `${start} – ${end}`
  return start ?? end ?? ''
}

function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  }
}
