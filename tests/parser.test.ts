// End-to-end parser tests: real DOCX/PDF bytes → extraction → mapping.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parseResume, type ParseResult } from '../src/parser'
import { validateProfile } from '../src/shared/validate'
import { classic, multiLine, noHeadings, projectBased, variations } from './fixtures/resumes'
import { makeDocx, makePdf, type Para } from './helpers/documents'
import { pdfjsLib } from './helpers/pdfjs'

const formats = {
  docx: (paras: Para[]) => parseResume('resume.docx', makeDocx(paras), pdfjsLib),
  pdf: (paras: Para[]) => parseResume('resume.pdf', makePdf(paras), pdfjsLib),
}

const issueAt = (result: ParseResult, path: string) => result.issues.filter((i) => i.path === path)

for (const [format, parse] of Object.entries(formats)) {
  describe(`${format}: classic chronological resume`, async () => {
    const result = await parse(classic)
    const { profile } = result

    test('header and contact details', () => {
      assert.equal(profile.header.name, 'Priya Sharma')
      assert.equal(profile.header.title, 'Senior UX Designer')
      assert.equal(profile.header.email, 'priya.sharma@example.com')
      assert.equal(profile.header.phone, '+91 98765 43210')
      assert.equal(profile.header.linkedin, 'linkedin.com/in/priya-example')
      assert.equal(profile.header.location, undefined, 'unlabelled location is not guessed')
    })

    test('summary is one paragraph, including wrapped PDF lines', () => {
      assert.match(profile.summary, /^UX designer with 9 years .* accessible interfaces\.$/)
      assert.ok(!profile.summary.includes('\n'))
    })

    test('experience entries with roles, companies and dates', () => {
      assert.equal(profile.experience.length, 2)
      const [first, second] = profile.experience
      assert.equal(first.role, 'Senior UX Designer')
      assert.equal(first.company, 'Example Bank Ltd')
      assert.equal(first.startDate, 'Jan 2020')
      assert.equal(first.endDate, 'Present')
      assert.equal(first.responsibilities.length, 3)
      assert.match(first.responsibilities[0], /^Led research .* engineering leads\.$/, 'wrapped bullet is rejoined')
      assert.equal(second.company, 'Sample Insurance Co')
      assert.equal(second.startDate, 'Jun 2016')
      assert.equal(second.endDate, 'Dec 2019')
    })

    test('education, certification, skills and tools', () => {
      assert.deepEqual(profile.education, [
        { degree: 'Bachelor of Design', institution: 'Example Institute of Design', endYear: '2016' },
      ])
      assert.equal(profile.certifications[0].year, '2021')
      assert.equal(profile.certifications[0].name, 'Certified Usability Analyst – Example UX Academy')
      assert.deepEqual(profile.skills, ['User Research', 'Wireframing', 'Prototyping', 'Usability Testing'])
      assert.deepEqual(profile.tools, ['Figma', 'Sketch', 'Miro'])
    })

    test('nothing that is not in the resume is added', () => {
      assert.equal(profile.competencies, undefined)
      assert.equal(profile.caseStudies, undefined)
      for (const entry of profile.experience) {
        assert.equal(entry.industry, undefined)
        assert.equal(entry.project, undefined)
      }
    })

    test('the result is a valid profile', () => {
      assert.deepEqual(validateProfile(profile), [])
    })
  })

  describe(`${format}: multi-line headers, no summary heading, no tools`, async () => {
    const result = await parse(multiLine)
    const { profile } = result

    test('intro paragraph becomes the summary, flagged for review', () => {
      assert.match(profile.summary, /^Product designer who enjoys/)
      assert.equal(issueAt(result, 'summary')[0]?.level, 'check')
    })

    test('entries are split on header lines and plain lines become responsibilities', () => {
      assert.equal(profile.experience.length, 2)
      const [lead, designer] = profile.experience
      assert.equal(lead.role, 'Lead Product Designer')
      assert.equal(lead.company, 'Globex Ltd')
      assert.equal(lead.region, 'London')
      assert.equal(lead.startDate, '2018')
      assert.equal(lead.endDate, '2021')
      assert.deepEqual(lead.responsibilities, [
        'Led the redesign of the customer portal.',
        'Ran weekly design critiques with the team.',
      ])
      assert.equal(designer.role, 'Product Designer')
      assert.equal(designer.company, 'Initech')
    })

    test('education spread over three lines', () => {
      assert.deepEqual(profile.education, [
        { degree: 'MA Interaction Design', institution: 'Royal College of Art', startYear: '2013', endYear: '2015' },
      ])
    })

    test('tools are left empty, not guessed from skills', () => {
      assert.deepEqual(profile.skills, ['Interaction design', 'Prototyping', 'Accessibility'])
      assert.deepEqual(profile.tools, [])
      assert.equal(issueAt(result, 'tools')[0]?.level, 'missing')
    })
  })

  describe(`${format}: project-based resume with labelled fields`, async () => {
    const result = await parse(projectBased)
    const { profile } = result

    test('summary keeps paragraphs', () => {
      if (format === 'docx') assert.equal(profile.summary.split('\n\n').length, 2)
      assert.match(profile.summary, /design systems\.$/)
    })

    test('labelled project fields are mapped exactly', () => {
      assert.equal(profile.experience.length, 2)
      const [portal, workbench] = profile.experience
      assert.equal(portal.project, 'Turbine Monitoring Portal')
      assert.equal(portal.company, 'Example Energy Corp')
      assert.equal(portal.industry, 'Energy')
      assert.equal(portal.role, 'Lead Designer')
      assert.equal(portal.startDate, 'Mar 2019')
      assert.equal(portal.endDate, 'Dec 2020')
      assert.equal(portal.description, 'A web application for monitoring turbine health in real time.')
      assert.deepEqual(portal.responsibilities, ['Conducted stakeholder interviews.', 'Created wireframes and prototypes.'])
      assert.equal(workbench.project, 'Agent Workbench')
      assert.equal(workbench.role, undefined, 'no role stated, so none is set')
      assert.deepEqual(workbench.responsibilities, [
        'Designed the information architecture.',
        'Ran usability tests with insurance agents.',
      ])
    })

    test('tools from project details, skills from an inline heading', () => {
      assert.deepEqual(profile.tools, ['Figma', 'Miro'])
      assert.deepEqual(profile.skills, ['Research', 'Wireframing', 'Visual Design'])
    })

    test('combined education and certifications section', () => {
      assert.equal(profile.education.length, 1)
      assert.equal(profile.education[0].degree, 'B.Des')
      assert.equal(profile.education[0].institution, 'Example National Institute of Design')
      assert.deepEqual(profile.certifications, [{ name: 'Google UX Design Certificate', year: '2021' }])
    })

    test('unused sections are kept for reference', () => {
      const languages = result.unmapped.find((u) => u.title === 'Languages')
      assert.deepEqual(languages?.lines, ['English, Hindi'])
    })
  })

  describe(`${format}: resume without section headings`, async () => {
    const result = await parse(noHeadings)
    const { profile } = result

    test('name is found; everything unknown stays empty', () => {
      assert.equal(profile.header.name, 'Jamie Lee')
      assert.equal(profile.header.title, '')
      assert.deepEqual(profile.experience, [])
      assert.deepEqual(profile.education, [])
      assert.deepEqual(profile.skills, [])
      assert.deepEqual(profile.tools, [])
      assert.deepEqual(profile.certifications, [])
    })

    test('missing sections are reported', () => {
      for (const path of ['header.title', 'experience', 'education', 'skills', 'tools']) {
        assert.ok(issueAt(result, path).length > 0, `issue for ${path}`)
      }
    })
  })

  describe(`${format}: format variations`, async () => {
    const result = await parse(variations)
    const { profile } = result

    test('capitalised name and labelled contact details', () => {
      assert.equal(profile.header.name, 'SAM O’BRIEN')
      assert.equal(profile.header.email, 'sam@example.com')
      assert.equal(profile.header.phone, '+44 7700 900123')
    })

    test('"Role at Company" and different date formats', () => {
      assert.equal(profile.experience.length, 2)
      const [first, second] = profile.experience
      assert.equal(first.role, 'Senior Interaction Designer')
      assert.equal(first.company, 'Example Studio')
      assert.equal(first.startDate, '06/2019')
      assert.equal(first.endDate, '08/2021')
      assert.deepEqual(first.responsibilities, ['Designed booking flows for a national travel website.'])
      assert.equal(second.company, 'Sample Agency')
      assert.equal(second.startDate, '2015')
      assert.equal(second.endDate, '2017')
      assert.deepEqual(second.responsibilities, ['Built a reusable pattern library.'])
    })

    test('degree with dash separator; grades and interests kept aside', () => {
      assert.deepEqual(profile.education, [
        { degree: 'BSc Psychology', institution: 'University of Example', endYear: '2014' },
      ])
      const titles = result.unmapped.map((u) => u.title)
      assert.ok(titles.includes('Education: grades and scores'))
      assert.ok(titles.includes('INTERESTS'))
    })
  })
}
