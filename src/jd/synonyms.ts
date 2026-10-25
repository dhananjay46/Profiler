// A small, curated synonym and acronym map used when matching JD requirements
// against resume evidence. Kept intentionally short: not a knowledge base.
// Everything is lowercase. Both directions are expanded at lookup time.

export const SYNONYMS: Record<string, string[]> = {
  'ux': ['user experience', 'experience design'],
  'ui': ['user interface', 'interface design'],
  'ux/ui': ['user experience', 'user interface', 'ux', 'ui'],
  'ia': ['information architecture'],
  'hci': ['human-computer interaction', 'human computer interaction'],
  'qa': ['quality assurance', 'testing'],
  'js': ['javascript'],
  'ts': ['typescript'],
  'py': ['python'],
  'k8s': ['kubernetes'],
  'ci/cd': ['continuous integration', 'continuous delivery', 'continuous deployment'],
  'ml': ['machine learning'],
  'ai': ['artificial intelligence'],
  'nlp': ['natural language processing'],
  'api': ['application programming interface'],
  'rest': ['restful', 'rest api'],
  'graphql': ['gql'],
  'postgres': ['postgresql'],
  'figma': ['figma design'],
  'sketch': ['sketch app'],
  'adobe xd': ['xd'],
  'photoshop': ['adobe photoshop', 'ps'],
  'illustrator': ['adobe illustrator', 'ai'],
  'wireframe': ['wireframing', 'wireframes'],
  'prototype': ['prototyping', 'prototypes'],
  'usability testing': ['user testing', 'usability study'],
  'user research': ['ux research', 'design research'],
  'interaction design': ['ixd'],
  'visual design': ['graphic design'],
  'design system': ['design systems', 'component library', 'pattern library'],
  'agile': ['scrum', 'kanban'],
  'stakeholder': ['stakeholders', 'client', 'business partner'],
  'cross-functional': ['cross functional', 'multidisciplinary'],
  'mentoring': ['mentor', 'coaching'],
  'leadership': ['leading', 'led', 'managed'],
  'accessibility': ['a11y', 'wcag'],
  'responsive': ['responsive design', 'adaptive design'],
  'mobile': ['ios', 'android', 'mobile app'],
}

/** Expand a term to the set of all equivalent phrasings (lowercased). */
export function expandAliases(term: string): string[] {
  const lower = term.toLowerCase().trim()
  const out = new Set<string>([lower])
  const direct = SYNONYMS[lower]
  if (direct) direct.forEach((a) => out.add(a))
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (values.includes(lower)) {
      out.add(key)
      values.forEach((a) => out.add(a))
    }
  }
  return [...out]
}
