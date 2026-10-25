import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { testProfile } from '../src/data/testProfiles'
import { applyTailorPlan, buildTailorPlan, matchProfile, parseJD } from '../src/jd'
import type { ConsultantProfile } from '../src/shared/types'

const SAMPLE_JD = `
Role: Senior UX Designer
Client: Acme Corp

Must have:
- 5+ years of experience in UX design
- Strong usability testing and user research skills
- Figma expertise
- Design system experience

Nice to have:
- Experience with accessibility (WCAG)
- Mentoring junior designers

Responsibilities:
- Lead design workshops with stakeholders
- Create wireframes and prototypes
- Collaborate with cross-functional teams
`.trim()

describe('parseJD', () => {
  it('extracts role and client from headings', () => {
    const jd = parseJD(SAMPLE_JD)
    assert.equal(jd.role, 'Senior UX Designer')
    assert.equal(jd.client, 'Acme Corp')
  })

  it('splits mandatory and preferred by section', () => {
    const jd = parseJD(SAMPLE_JD)
    const mandatory = jd.requirements.filter((r) => r.priority === 'mandatory')
    const preferred = jd.requirements.filter((r) => r.priority === 'preferred')
    assert.ok(mandatory.length >= 4, `expected 4+ mandatory, got ${mandatory.length}`)
    assert.ok(preferred.length >= 2, `expected 2+ preferred, got ${preferred.length}`)
  })

  it('deduplicates identical requirements', () => {
    const jd = parseJD('Must have:\n- Figma\n- Figma\n- figma')
    const figma = jd.requirements.filter((r) => r.text.toLowerCase().includes('figma'))
    assert.equal(figma.length, 1)
  })

  it('categorizes education, tools and soft skills', () => {
    const jd = parseJD('Must have:\n- Bachelor degree in design\n- Figma proficiency\n- Strong communication skills')
    const byCat = (c: string) => jd.requirements.find((r) => r.category === c)
    assert.ok(byCat('education'))
    assert.ok(byCat('tool'))
    assert.ok(byCat('soft-skill'))
  })

  it('returns no requirements for empty input', () => {
    assert.equal(parseJD('').requirements.length, 0)
  })

  it('handles very large JDs without crashing', () => {
    const big = SAMPLE_JD + '\n'.repeat(200) + 'extra: ' + 'content '.repeat(5000)
    const jd = parseJD(big)
    assert.ok(jd.requirements.length > 0)
  })

  it('splits inline comma-separated lists', () => {
    const jd = parseJD('Must have: Figma, Sketch, Photoshop')
    const names = jd.requirements.map((r) => r.text.toLowerCase())
    assert.ok(names.some((n) => n.includes('figma')))
    assert.ok(names.some((n) => n.includes('sketch')))
    assert.ok(names.some((n) => n.includes('photoshop')))
  })
})

describe('matchProfile', () => {
  it('identifies strong matches against the sample profile', () => {
    const jd = parseJD(SAMPLE_JD)
    const report = matchProfile(jd, testProfile)
    const metCount = report.counts.met
    assert.ok(metCount >= 2, `expected 2+ met, got ${metCount} out of ${report.results.length}`)
  })

  it('synonyms produce met status (ux ↔ user experience)', () => {
    const jd = parseJD('Must have:\n- UX expertise')
    const report = matchProfile(jd, testProfile)
    const result = report.results[0]
    assert.equal(result.status, 'met', `expected met, got ${result.status}; reason: ${result.reason}`)
  })

  it('missing requirement is reported as missing, not fabricated', () => {
    const jd = parseJD('Must have:\n- Expertise in Fortran')
    const report = matchProfile(jd, testProfile)
    assert.equal(report.results[0].status, 'missing')
    assert.equal(report.results[0].evidence.length, 0)
  })

  it('mandatory gaps are listed separately from preferred', () => {
    const jd = parseJD('Must have:\n- Fortran\nNice to have:\n- COBOL')
    const report = matchProfile(jd, testProfile)
    assert.equal(report.unresolvedGaps.length, 1)
    assert.equal(report.unresolvedGaps[0].requirement.priority, 'mandatory')
  })

  it('years-of-experience phrasing becomes needs-verification', () => {
    const jd = parseJD('Must have:\n- 10+ years experience')
    const report = matchProfile(jd, testProfile)
    assert.equal(report.results[0].status, 'needs-verification')
  })

  it('score reflects status weights', () => {
    const jd = parseJD('Must have:\n- Figma\n- Fortran')
    const report = matchProfile(jd, testProfile)
    assert.ok(report.overallScore >= 0 && report.overallScore <= 100)
    // One met + one missing should be around 50.
    assert.ok(Math.abs(report.overallScore - 50) <= 5, `score ${report.overallScore} not near 50`)
  })

  it('ambiguous partial evidence yields partial status', () => {
    const jd = parseJD('Must have:\n- Advanced interaction design and prototyping for enterprise commerce flows')
    const report = matchProfile(jd, testProfile)
    const status = report.results[0].status
    assert.ok(status === 'met' || status === 'partial', `expected met/partial, got ${status}`)
  })
})

describe('buildTailorPlan + applyTailorPlan', () => {
  it('reorders experience to put JD-relevant projects first', () => {
    const jd = parseJD('Must have:\n- Turbine monitoring and energy industry experience')
    const report = matchProfile(jd, testProfile)
    const plan = buildTailorPlan(jd, testProfile, report)
    const reorder = plan.suggestions.find((s) => s.kind === 'reorder-experience')
    assert.ok(reorder, 'expected a reorder suggestion')
    const tailored = applyTailorPlan(testProfile, plan, new Set([reorder.id]))
    const firstProject = tailored.experience[0].project ?? ''
    assert.match(firstProject, /turbine/i)
  })

  it('rejected suggestions do not change the profile', () => {
    const jd = parseJD('Must have:\n- Figma')
    const report = matchProfile(jd, testProfile)
    const plan = buildTailorPlan(jd, testProfile, report)
    const tailored = applyTailorPlan(testProfile, plan, new Set())
    assert.deepEqual(
      tailored.experience.map((e) => e.project),
      testProfile.experience.map((e) => e.project),
    )
    assert.deepEqual(tailored.skills, testProfile.skills)
  })

  it('tailoring never mutates the original profile', () => {
    const jd = parseJD('Must have:\n- Energy industry')
    const report = matchProfile(jd, testProfile)
    const plan = buildTailorPlan(jd, testProfile, report)
    const originalOrder = testProfile.experience.map((e) => e.project)
    const accepted = new Set(plan.suggestions.map((s) => s.id))
    applyTailorPlan(testProfile, plan, accepted)
    assert.deepEqual(testProfile.experience.map((e) => e.project), originalOrder)
  })

  it('flags unresolved mandatory gaps in a summary note', () => {
    const jd = parseJD('Must have:\n- Fortran mastery')
    const report = matchProfile(jd, testProfile)
    const plan = buildTailorPlan(jd, testProfile, report)
    const note = plan.suggestions.find((s) => s.kind === 'summary-note')
    assert.ok(note)
    assert.equal(note!.accepted, false, 'gap note starts unchecked — user must opt in')
  })

  it('empty profile stays empty under tailoring', () => {
    const empty: ConsultantProfile = {
      header: { name: 'X', title: '' },
      summary: '',
      skills: [],
      tools: [],
      education: [],
      certifications: [],
      experience: [],
    }
    const jd = parseJD('Must have:\n- Figma')
    const report = matchProfile(jd, empty)
    const plan = buildTailorPlan(jd, empty, report)
    const tailored = applyTailorPlan(empty, plan, new Set(plan.suggestions.map((s) => s.id)))
    assert.equal(tailored.experience.length, 0)
    assert.equal(tailored.skills.length, 0)
  })
})
