import type { ProfileHeader } from '../../shared/types'
import { addImagePlaceholder, addSpacer, addStack, addText, joinParts, solid } from '../primitives'
import { theme } from '../theme'

/**
 * Accent block + photo on the left; name and title on the right; logo slot
 * pinned to the top-right corner. Returns the right-hand column so the
 * summary can be placed under the title.
 */
export function renderHeader(parent: FrameNode, header: ProfileHeader): FrameNode {
  const h = theme.layout.header
  const block = addStack(parent, {
    name: 'Header',
    direction: 'HORIZONTAL',
    gap: h.gap,
    padding: [0, h.paddingRight, 0, h.paddingLeft],
  })
  addPhotoSlot(block)

  const column = addStack(block, { name: 'Intro', direction: 'VERTICAL', padding: [h.nameTop, 0, 0, 0] })
  addText(column, header.name, theme.text.name, { name: 'Name' })
  if (header.title.trim()) {
    addSpacer(column, h.nameToTitle)
    addText(column, header.title, theme.text.title, { name: 'Title' })
  }

  const contact = joinParts([header.location, header.email, header.phone, header.linkedin], '   |   ')
  if (contact) addText(column, contact, theme.text.contact, { name: 'Contact' })

  addSpacer(column, h.titleToSummary)

  if (h.logo.show) {
    // Positioned absolutely so it does not push the name down.
    const logo = addImagePlaceholder(block, 'Logo', { width: h.logo.width, height: h.logo.height })
    logo.layoutPositioning = 'ABSOLUTE'
    logo.x = h.logo.x
    logo.y = h.logo.y
  }
  return column
}

/** Blue accent block at the top edge with the photo slot overlapping it. */
function addPhotoSlot(parent: FrameNode): void {
  const { accent, photo } = theme.layout.header
  const group = figma.createFrame() // plain frame: children are positioned freely
  group.name = 'Photo'
  group.fills = []
  group.clipsContent = false
  parent.appendChild(group)
  group.resize(Math.max(accent.width, photo.x + photo.width), Math.max(accent.height, photo.y + photo.height))

  const block = figma.createRectangle()
  block.name = 'Accent'
  block.fills = [solid('primary')]
  group.appendChild(block)
  block.resize(accent.width, accent.height)
  block.x = 0
  block.y = 0

  const slot = figma.createRectangle()
  slot.name = 'Photo (replace fill with image)'
  slot.fills = [solid('placeholder')]
  group.appendChild(slot)
  slot.resize(photo.width, photo.height)
  slot.x = photo.x
  slot.y = photo.y
}
