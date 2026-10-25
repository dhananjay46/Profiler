import { addInstance, type ComponentLibrary } from '../components'
import { addStack } from '../primitives'
import { theme } from '../theme'

export interface RenderContext {
  components: ComponentLibrary
}

/** A titled section: a Section Title instance followed by the caller's content. */
export function addSection(
  parent: FrameNode,
  title: string,
  ctx: RenderContext,
  gap: number = theme.layout.sectionInnerGap,
): FrameNode {
  const section = addStack(parent, { name: title, direction: 'VERTICAL', gap })
  addInstance(section, ctx.components.sectionTitle, title)
  return section
}
