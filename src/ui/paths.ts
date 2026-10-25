// Read and write nested profile values by path, e.g. "experience[0].startDate".

type Key = string | number

export function parsePath(path: string): Key[] {
  const keys: Key[] = []
  for (const part of path.split('.')) {
    const match = part.match(/^([^[]+)((?:\[\d+\])*)$/)
    if (!match) continue
    keys.push(match[1])
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) keys.push(Number(index[1]))
  }
  return keys
}

export function getPath(target: unknown, path: string): unknown {
  let value: unknown = target
  for (const key of parsePath(path)) {
    if (value === null || typeof value !== 'object') return undefined
    value = (value as Record<Key, unknown>)[key]
  }
  return value
}

export function setPath(target: object, path: string, value: unknown): void {
  const keys = parsePath(path)
  let node = target as Record<Key, unknown>
  keys.slice(0, -1).forEach((key) => {
    node = node[key] as Record<Key, unknown>
  })
  node[keys[keys.length - 1]] = value
}

/**
 * After removing item `index` from list `list`, rewrites a path so it still
 * points at the same item ("experience[3].role" → "experience[2].role").
 * Returns null if the path pointed into the removed item.
 */
export function shiftPath(path: string, list: string, index: number): string | null {
  const match = path.match(new RegExp(`^${list}\\[(\\d+)\\](.*)$`))
  if (!match) return path
  const i = Number(match[1])
  if (i === index) return null
  return i > index ? `${list}[${i - 1}]${match[2]}` : path
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name', title: 'Job title', location: 'Location', email: 'Email', phone: 'Phone', linkedin: 'LinkedIn',
  project: 'Project', role: 'Role', company: 'Company / client', industry: 'Industry', region: 'Region',
  startDate: 'Start date', endDate: 'End date', description: 'Description', responsibilities: 'Responsibilities',
  degree: 'Degree', institution: 'Institution', startYear: 'Start year', endYear: 'End year',
  issuer: 'Issuer', year: 'Year', url: 'Link URL',
}
const LIST_LABELS: Record<string, string> = {
  header: 'Header', summary: 'Summary', experience: 'Experience', education: 'Education',
  certifications: 'Certification', skills: 'Skills', tools: 'Tools',
}

/** "experience[0].startDate" produces "Experience 1 · Start date". */
export function describePath(path: string): string {
  if (!path) return 'General'
  const keys = parsePath(path)
  const parts: string[] = []
  keys.forEach((key, i) => {
    if (typeof key === 'number') parts[parts.length - 1] += ` ${key + 1}`
    else parts.push(i === 0 ? (LIST_LABELS[key] ?? key) : (FIELD_LABELS[key] ?? key))
  })
  return parts.join(' · ')
}
