import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { TEST_PROFILES } from '../src/data/testProfiles'
import { applyPlanToProfile, profileToLayers } from '../src/jd/profileLayers'
import { findTerms, readJobDescription, rewriteForJd, toPastTense } from '../src/jd/rewrite'
import type { FrameTextLayer } from '../src/shared/messages'
import { validateProfile } from '../src/shared/validate'

const MERN_JD = `Job Overview
Job Title: MERN Stack Developer / Full Stack Developer
Location: [Insert Location / Remote / Hybrid]
Employment Type: [Full-Time / Contract]
Role Summary
We are seeking a skilled MERN Stack Developer to build, optimize, and maintain scalable web applications. You will operate across the entire application lifecycle, using JavaScript/TypeScript across the entire stack—from creating intuitive user interfaces in React to architecting robust server-side logic and databases using Node.js, Express, and MongoDB.
Key Responsibilities
Frontend Development: Build responsive, highly interactive user interfaces using React.js and state management libraries (like Redux Toolkit or Context API).
Backend Architecture: Design and implement high-performance server-side logic, RESTful APIs, or GraphQL endpoints using Node.js and Express.js.
Database Management: Architect and optimize schema designs, data modeling, and queries within MongoDB using Mongoose ODM.
Testing & Security: Implement authentication and authorization mechanisms (e.g., JWT, OAuth) and write unit/integration tests (using Jest, Mocha, or Cypress).
Required Skills & Qualifications
Core Stack: Deep, hands-on expertise with the MERN Stack (MongoDB, Express.js, React.js, Node.js).
Frontend Mastery: Mastery of HTML5, CSS3/SCSS, Tailwind CSS, JavaScript (ES6+), and modern React concepts (Hooks, Functional Components).
DevTools & VCS:
 Strong proficiency with Git version control, npm/yarn package managers, and debugging tools.
Preferred Qualifications
Knowledge of containerisation (Docker) and setting up CI/CD pipelines.
What is the experience level? (Junior, Mid-level, or Senior)
`

let n = 0
function layer(text: string, section: string, fontSize = 11, repeatable = false): FrameTextLayer {
  return { key: String(n++), name: text.slice(0, 20), section, text, fontSize, repeatable }
}

/** A frame shaped like the sample profile: header, competencies, certifications, experience, tools. */
function sampleLayers(): FrameTextLayer[] {
  n = 0
  return [
    layer('Asha Rao', 'Header', 24),
    layer('UX Designer', 'Header', 14),
    layer(
      "Hi, I'm Asha Rao, a result-driven UX/UI Designer with over 5 years of experience designing user-focused digital products across Enterprise, Finance, Education, and Telecom sectors. I specialize in end-to-end design.",
      'Header',
    ),
    layer('**asha.rao@example.com** | +44 20 7946 0958', 'Header'),
    layer('Design Portfolio', 'Button'),
    layer('Empathise', 'Competencies', 10, true),
    layer('Data Visualization', 'Competencies', 10, true),
    layer('User Scenario', 'Competencies', 10, true),
    layer('**Certifications**', 'Certifications', 16),
    layer('Generative AI: Introduction and Applications', 'Certifications › Grid', 11, true),
    layer('IBM', 'Certifications › Grid', 11, true),
    layer('**Experience**', 'Experience', 16),
    layer('**End-to-End Design Process:** Proficient in the complete UX process from research to prototyping.', 'Experience › Core Competencies', 11, true),
    layer('**Stakeholder Collaboration:** Partnering with clients, developers, and teams to align on requirements.', 'Experience › Core Competencies', 11, true),
    layer('**Example Technology Services Ltd**', 'Experience › Example Tech', 12),
    layer('UX/UI Designer (June 2025 - Till date)', 'Experience › Example Tech', 11),
    layer('Led UX strategy and design for four parallel workstreams within the internal configuration platform.', 'Experience › Example Tech › My Role', 11, true),
    layer('Designed a label configuration tool enabling business users to create labels.', 'Experience › Example Tech › My Role', 11, true),
    layer('**Tools**', 'Tools', 16),
    layer('Figma', 'Tools', 10, true),
    layer('Illustrator', 'Tools', 10, true),
  ]
}

function changed(plan: ReturnType<typeof rewriteForJd>, key: string): string | undefined {
  return plan.changes.find((c) => c.key === key)?.text
}

describe('readJobDescription', () => {
  it('reads the title, summary, responsibilities and terms', () => {
    const jd = readJobDescription(MERN_JD)
    assert.equal(jd.title, 'MERN Stack Developer')
    assert.match(jd.summary[0], /^We are seeking/)
    assert.deepEqual(jd.responsibilities.map((r) => r.label), ['Frontend Development', 'Backend Architecture', 'Database Management', 'Testing & Security'])
    for (const term of ['MongoDB', 'Express.js', 'React.js', 'Node.js', 'GraphQL', 'Jest', 'Docker', 'CI/CD', 'Tailwind CSS']) {
      assert.ok(jd.terms.includes(term), `expected ${term} in ${jd.terms.join(', ')}`)
    }
  })

  it('ignores placeholders and questions', () => {
    const jd = readJobDescription(MERN_JD)
    assert.ok(!jd.terms.some((t) => /Junior|Insert|Remote/.test(t)))
  })
})

describe('findTerms', () => {
  it('deduplicates spellings and keeps first-seen order', () => {
    assert.deepEqual(findTerms('React and React.js with Node.js, then node.js and AWS'), ['React.js', 'Node.js', 'AWS'])
  })
  it('skips generic acronyms', () => {
    assert.deepEqual(findTerms('Work with UI/UX and API teams'), [])
  })
})

describe('toPastTense', () => {
  it('turns coordinated verbs into past tense', () => {
    assert.equal(toPastTense('Build X, optimize Y and ensure Z'), 'Built X, optimized Y and ensured Z')
    assert.equal(toPastTense('Design and implement APIs'), 'Designed and implemented APIs')
  })
})

describe('rewriteForJd', () => {
  const layers = sampleLayers()
  const plan = rewriteForJd(MERN_JD, layers)

  it('sets the title and rebuilds the summary around the JD, keeping the greeting and years', () => {
    assert.equal(changed(plan, '1'), 'MERN Stack Developer')
    const summary = changed(plan, '2') ?? ''
    assert.match(summary, /^Hi, I'm Asha Rao, a result-driven MERN Stack Developer with over 5 years of experience/)
    assert.match(summary, /MongoDB/)
    assert.match(summary, /\bI build, optimize, and maintain scalable web applications\./)
  })

  it('never touches the name, contact details or certifications', () => {
    for (const key of ['0', '3', '9', '10']) assert.equal(changed(plan, key), undefined, `layer ${key} should be unchanged`)
  })

  it('rewrites labelled highlights with the JD responsibilities and adds the rest', () => {
    assert.match(changed(plan, '12') ?? '', /^\*\*Frontend Development:\*\* Built responsive/)
    assert.match(changed(plan, '13') ?? '', /^\*\*Backend Architecture:\*\* Designed and implemented/)
    const more = plan.additions.find((a) => a.afterKey === '13')
    assert.ok(more)
    assert.equal(more.texts.length, 2)
  })

  it('replaces the old role in experience but keeps the company and dates', () => {
    assert.equal(changed(plan, '14'), undefined)
    assert.equal(changed(plan, '15'), 'MERN Stack Developer (June 2025 - Till date)')
  })

  it('adds JD bullets to each experience entry, after its last bullet', () => {
    const added = plan.additions.find((a) => a.afterKey === '17')
    assert.ok(added)
    assert.match(added.texts[0], /^Built responsive/)
  })

  it('fills tool lists with the JD terms and adds the remaining ones', () => {
    assert.equal(changed(plan, '19'), 'MERN Stack')
    assert.equal(changed(plan, '20'), 'JavaScript')
    const more = plan.additions.find((a) => a.afterKey === '20')
    assert.ok(more && more.texts.length > 0)
  })

  it('relabels competencies with the JD focus areas', () => {
    assert.equal(changed(plan, '5'), 'Frontend Development')
  })

  it('adapts the wording of every other section for the new field', () => {
    assert.match(changed(plan, '16') ?? '', /^Led full-stack architecture and development for four parallel workstreams/)
    assert.match(changed(plan, '17') ?? '', /^Developed a label configuration tool/)
    // Facts stay: the company name and dates are untouched, only the role changes.
    assert.match(changed(plan, '15') ?? '', /\(June 2025 - Till date\)$/)
  })

  it('leaves status lines alone and adds no bullets under them', () => {
    const status = layer('Launching first phase on the first week of January, currently in development.', 'Experience › Example Tech › Project Update', 11, true)
    const result = rewriteForJd(MERN_JD, [...sampleLayers(), status])
    assert.equal(result.changes.find((c) => c.key === status.key), undefined)
    assert.equal(result.additions.find((a) => a.afterKey === status.key), undefined)
  })

  it('only refers to layers that exist', () => {
    const keys = new Set(layers.map((l) => l.key))
    for (const c of plan.changes) assert.ok(keys.has(c.key))
    for (const a of plan.additions) assert.ok(keys.has(a.afterKey))
  })
})

describe('built-in profiles', () => {
  for (const spec of TEST_PROFILES.filter((p) => p.kind === 'sample')) {
    it(`rewrites "${spec.label}" into a valid profile without touching the original`, () => {
      const before = JSON.stringify(spec.profile)
      const plan = rewriteForJd(MERN_JD, profileToLayers(spec.profile))
      const tailored = applyPlanToProfile(spec.profile, plan)
      assert.equal(JSON.stringify(spec.profile), before)
      assert.deepEqual(validateProfile(tailored), [])
      assert.equal(tailored.header.title, 'MERN Stack Developer')
      assert.equal(tailored.header.name, spec.profile.header.name)
      assert.ok(tailored.tools.includes('MongoDB') || tailored.skills.includes('MongoDB'))
      const bullets = (p: typeof tailored): number => p.experience.reduce((n, e) => n + e.responsibilities.length, 0)
      if (spec.profile.experience.some((e) => e.responsibilities.some((r) => r.length >= 40))) {
        assert.ok(bullets(tailored) > bullets(spec.profile), 'expected JD bullets to be added to experience')
      }
    })
  }

  it('inserts list items after their anchor, keeping later anchors in place', () => {
    const profile = structuredClone(TEST_PROFILES[0].profile)
    profile.tools = ['A', 'B', 'C']
    const tailored = applyPlanToProfile(profile, {
      changes: [{ key: 'tools.0', text: '**X**' }],
      additions: [
        { afterKey: 'tools.0', texts: ['X1'] },
        { afterKey: 'tools.2', texts: ['C1', 'C2'] },
      ],
      notes: [],
    })
    assert.deepEqual(tailored.tools, ['X', 'X1', 'B', 'C', 'C1', 'C2'])
  })
})
