// Lets the JD rewrite work on profile data (the built-in profiles) the same way
// it works on a frame: the profile is described as the text layers the
// renderer would draw, rewritten, and the rewrite is applied back to the data.
//
// Keys name the field they come from, e.g. "summary", "skills.3",
// "experience.1.responsibilities.0".

import type { FrameTextLayer, RewritePlan } from '../shared/messages'
import type { ConsultantProfile } from '../shared/types'

// Sizes follow the renderer's hierarchy, so headings and the name read as such.
const NAME_SIZE = 24
const TITLE_SIZE = 14
const BODY_SIZE = 11
const ITEM_SIZE = 10

export function profileToLayers(profile: ConsultantProfile): FrameTextLayer[] {
  const layers: FrameTextLayer[] = []
  const add = (key: string, section: string, text: string | undefined, fontSize: number, repeatable = false): void => {
    if (text && text.trim()) layers.push({ key, name: key, section, text, fontSize, repeatable })
  }
  add('header.name', 'Header', profile.header.name, NAME_SIZE)
  add('header.title', 'Header', profile.header.title, TITLE_SIZE)
  add('summary', 'Header › Summary', profile.summary, BODY_SIZE)
  profile.competencies?.forEach((c, i) => add(`competencies.${i}`, 'Competencies', c.label, ITEM_SIZE, true))
  profile.experience.forEach((entry, i) => {
    const section = `Work Experience › ${entry.company || entry.project || `Entry ${i + 1}`}`
    add(`experience.${i}.project`, section, entry.project, BODY_SIZE)
    add(`experience.${i}.role`, section, entry.role, BODY_SIZE)
    add(`experience.${i}.description`, section, entry.description, BODY_SIZE)
    entry.responsibilities.forEach((r, j) => add(`experience.${i}.responsibilities.${j}`, `${section} › Responsibilities`, r, BODY_SIZE, true))
  })
  profile.skills.forEach((s, i) => add(`skills.${i}`, 'Skills', s, ITEM_SIZE, true))
  profile.tools.forEach((t, i) => add(`tools.${i}`, 'Tools', t, ITEM_SIZE, true))
  return layers
}

/** A copy of the profile with the rewrite applied. Fields without bold support lose the ** markers. */
export function applyPlanToProfile(profile: ConsultantProfile, plan: RewritePlan): ConsultantProfile {
  const next = structuredClone(profile)
  const plain = (text: string): string => text.replace(/\*\*/g, '')

  for (const { key, text } of plan.changes) {
    const [field, a, b, c] = key.split('.')
    const i = Number(a)
    if (field === 'header' && (a === 'title' || a === 'name')) next.header[a] = plain(text)
    else if (field === 'summary') next.summary = text
    else if (field === 'competencies' && next.competencies?.[i]) next.competencies[i].label = plain(text)
    else if (field === 'skills' && i < next.skills.length) next.skills[i] = plain(text)
    else if (field === 'tools' && i < next.tools.length) next.tools[i] = plain(text)
    else if (field === 'experience' && next.experience[i]) {
      const entry = next.experience[i]
      if (b === 'project' || b === 'role') entry[b] = plain(text)
      else if (b === 'description') entry.description = text
      else if (b === 'responsibilities' && Number(c) < entry.responsibilities.length) entry.responsibilities[Number(c)] = plain(text)
    }
  }

  // Insert from the highest index down within each list, so earlier inserts don't shift later anchors.
  const additions = [...plan.additions].sort((x, y) => lastIndex(y.afterKey) - lastIndex(x.afterKey))
  for (const { afterKey, texts } of additions) {
    const [field, a, b] = afterKey.split('.')
    const i = Number(a)
    const items = texts.map(plain)
    if (field === 'skills') next.skills.splice(i + 1, 0, ...items)
    else if (field === 'tools') next.tools.splice(i + 1, 0, ...items)
    else if (field === 'competencies' && next.competencies?.[i]) {
      const icon = next.competencies[i].icon
      next.competencies.splice(i + 1, 0, ...items.map((label) => ({ label, icon })))
    } else if (field === 'experience' && b === 'responsibilities' && next.experience[i]) {
      next.experience[i].responsibilities.splice(lastIndex(afterKey) + 1, 0, ...items)
    }
  }
  return next
}

function lastIndex(key: string): number {
  return Number(key.split('.').pop())
}
