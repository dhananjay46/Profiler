// Checks that profile data matches the contract before anything is drawn.
// Returns a list of human-readable problems (empty list = valid). Written
// against `unknown` so it also works for parser output later, not just for
// the typed test data.

type Obj = Record<string, unknown>

export function validateProfile(data: unknown): string[] {
  const errors: string[] = []

  if (!isObject(data)) {
    return ['Profile must be an object.']
  }

  if (!isObject(data.header)) {
    errors.push('header is required.')
  } else {
    requireText(data.header, 'name', 'header', errors)
    if (typeof data.header.title !== 'string') errors.push('header.title must be text.')
    for (const key of ['location', 'email', 'phone', 'linkedin']) {
      optionalText(data.header, key, 'header', errors)
    }
  }

  if (typeof data.summary !== 'string') {
    errors.push('summary must be text.')
  }

  if (data.competencies !== undefined) {
    checkList(data, 'competencies', errors, (item, path) => {
      requireText(item, 'label', path, errors)
      optionalText(item, 'icon', path, errors)
    })
  }

  checkList(data, 'education', errors, (item, path) => {
    requireText(item, 'degree', path, errors)
    for (const key of ['institution', 'location', 'startYear', 'endYear']) {
      optionalText(item, key, path, errors)
    }
  })

  checkList(data, 'experience', errors, (item, path) => {
    for (const key of ['project', 'role', 'company', 'industry', 'region', 'startDate', 'endDate', 'description']) {
      optionalText(item, key, path, errors)
    }
    if (!hasText(item.project) && !hasText(item.role)) {
      errors.push(`${path} needs a project or a role.`)
    }
    checkStringList(item, 'responsibilities', path, errors)
  })

  checkStringList(data, 'skills', '', errors)
  checkStringList(data, 'tools', '', errors)

  checkList(data, 'certifications', errors, (item, path) => {
    requireText(item, 'name', path, errors)
    for (const key of ['issuer', 'year', 'url']) {
      optionalText(item, key, path, errors)
    }
  })

  if (data.caseStudies !== undefined) {
    checkList(data, 'caseStudies', errors, (item, path) => {
      requireText(item, 'title', path, errors)
      for (const key of ['client', 'challenge', 'solution', 'outcome', 'url']) {
        optionalText(item, key, path, errors)
      }
      const count = item.imageCount
      if (count !== undefined && count !== 1 && count !== 2) {
        errors.push(`${path}.imageCount must be 1 or 2.`)
      }
    })
  }

  return errors
}

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key
}

function requireText(obj: Obj, key: string, path: string, errors: string[]): void {
  const value = obj[key]
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${join(path, key)} is required.`)
  }
}

function optionalText(obj: Obj, key: string, path: string, errors: string[]): void {
  const value = obj[key]
  if (value !== undefined && typeof value !== 'string') {
    errors.push(`${join(path, key)} must be text.`)
  }
}

function checkList(
  obj: Obj,
  key: string,
  errors: string[],
  checkItem: (item: Obj, path: string) => void,
): void {
  const list = obj[key]
  if (!Array.isArray(list)) {
    errors.push(`${key} must be a list.`)
    return
  }
  list.forEach((item, i) => {
    const path = `${key}[${i}]`
    if (isObject(item)) {
      checkItem(item, path)
    } else {
      errors.push(`${path} must be an object.`)
    }
  })
}

function checkStringList(obj: Obj, key: string, path: string, errors: string[]): void {
  const list = obj[key]
  if (!Array.isArray(list)) {
    errors.push(`${join(path, key)} must be a list.`)
    return
  }
  list.forEach((item, i) => {
    if (typeof item !== 'string') {
      errors.push(`${join(path, key)}[${i}] must be text.`)
    }
  })
}
