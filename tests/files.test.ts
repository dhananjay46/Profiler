// File-type checks and handling of unreadable or malformed files.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { extractResume, ResumeFileError } from '../src/parser'
import { classic } from './fixtures/resumes'
import { makeDocx, makeImageOnlyPdf, makePdf } from './helpers/documents'
import { pdfjsLib } from './helpers/pdfjs'

const extract = (name: string, bytes: Uint8Array) => extractResume(name, bytes, pdfjsLib)

async function rejectsWith(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ResumeFileError, `expected ResumeFileError, got ${String(error)}`)
    assert.match(error.message, pattern)
    return true
  })
}

describe('file type checks', () => {
  test('unsupported extension', () => rejectsWith(extract('resume.txt', strToU8('hello')), /not supported.*PDF or a Word/))
  test('empty file', () => rejectsWith(extract('resume.pdf', new Uint8Array()), /is empty/))
  test('old .doc file', () => rejectsWith(extract('resume.doc', strToU8('anything')), /Save As .*\.docx/))
  test('encrypted or legacy Office file renamed to .docx', () =>
    rejectsWith(extract('resume.docx', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])), /password-protected/))
  test('a DOCX renamed to .pdf', () => rejectsWith(extract('resume.pdf', makeDocx(classic)), /not a valid PDF/))
  test('a PDF renamed to .docx', () => rejectsWith(extract('resume.docx', makePdf(classic)), /not a valid Word document/))
  test('file names are matched case-insensitively', async () => {
    const doc = await extract('RESUME.DOCX', makeDocx(classic))
    assert.equal(doc.kind, 'docx')
  })
})

describe('malformed DOCX', () => {
  test('damaged ZIP', () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...strToU8('this is not really a zip file at all')])
    return rejectsWith(extract('resume.docx', bytes), /could not be opened|damaged/)
  })
  test('ZIP without a Word document inside', () =>
    rejectsWith(extract('resume.docx', zipSync({ 'notes.txt': strToU8('hello') })), /does not look like a Word document/))
  test('Word document with no text', () => rejectsWith(extract('resume.docx', makeDocx([])), /no readable text/))
})

describe('malformed PDF', () => {
  test('header but no PDF structure', () =>
    rejectsWith(extract('resume.pdf', strToU8('%PDF-1.4\nthis is not really a pdf')), /could not be read|damaged/))
  test('scanned / image-only PDF', () => rejectsWith(extract('resume.pdf', makeImageOnlyPdf()), /no selectable text.*scanned/))
  test('truncated PDF is reported, not crashed on', async () => {
    const bytes = makePdf(classic).slice(0, 200)
    try {
      await extract('resume.pdf', bytes)
    } catch (error) {
      assert.ok(error instanceof ResumeFileError, `expected ResumeFileError, got ${String(error)}`)
    }
  })
})

describe('extraction details', () => {
  test('DOCX page header (name and contact details) is read before the body', async () => {
    const doc = await extract('resume.docx', makeDocx(['Summary', 'Body text here.'], { header: ['Priya Sharma', 'priya@example.com'] }))
    assert.deepEqual(
      doc.lines.map((l) => l.text),
      ['Priya Sharma', 'priya@example.com', 'Summary', 'Body text here.'],
    )
  })

  test('DOCX list items, headings, bold runs and tabs', async () => {
    const doc = await extract(
      'resume.docx',
      makeDocx([{ text: 'Experience', heading: true }, { text: 'Designer\tAcme', bold: true }, { text: 'Did things.', bullet: true }]),
    )
    assert.deepEqual(doc.lines, [
      { text: 'Experience', heading: true, bullet: false, bold: false, breakBefore: true },
      { text: 'Designer\tAcme', heading: false, bullet: false, bold: true, breakBefore: true },
      { text: 'Did things.', heading: false, bullet: true, bold: false, breakBefore: true },
    ])
  })

  test('DOCX XML entities are decoded', async () => {
    const doc = await extract('resume.docx', makeDocx(['Research & Design <UX> “quoted”']))
    assert.equal(doc.lines[0].text, 'Research & Design <UX> “quoted”')
  })

  test('PDF lines keep reading order across pages', async () => {
    const paragraphs = Array.from({ length: 30 }, (_, i) => `Line number ${i + 1} of the test document.`)
    const doc = await extract('resume.pdf', makePdf(paragraphs, { linesPerPage: 12 }))
    assert.deepEqual(
      doc.lines.map((l) => l.text),
      paragraphs,
    )
  })

  test('PDF two-column layout produces a warning', async () => {
    const rows = Array.from({ length: 14 }, (_, i) => [
      { text: `Left column item ${i + 1}`, x: 50 },
      { text: `Right column item ${i + 1}`, x: 330, sameLine: true },
    ]).flat()
    const doc = await extract('resume.pdf', makePdf(rows))
    assert.equal(doc.warnings.length, 1)
    assert.match(doc.warnings[0], /more than one column/)
  })
})
