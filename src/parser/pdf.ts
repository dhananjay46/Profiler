// Extracts text from a text-based PDF using pdf.js.
//
// pdf.js returns positioned text fragments, not lines, so fragments are grouped
// into visual lines by their vertical position, ordered left to right, and
// larger vertical gaps are recorded as paragraph breaks.
//
// The pdf.js library is passed in, so the plugin panel can use the browser
// build and Node tests can use the legacy build.

import { ResumeFileError, type ExtractedDocument, type ResumeLine } from './types'

/** The small part of the pdf.js API used here. */
export interface PdfJsLike {
  getDocument(src: {
    data: Uint8Array
    isEvalSupported?: boolean
    disableFontFace?: boolean
    useSystemFonts?: boolean
    stopAtErrors?: boolean
  }): { promise: Promise<PdfDocument>; destroy(): Promise<void> }
}

interface PdfDocument {
  numPages: number
  getPage(n: number): Promise<PdfPage>
  destroy(): Promise<void>
}

interface PdfPage {
  getTextContent(): Promise<{ items: unknown[] }>
}

interface TextItem {
  str: string
  transform: number[]
  width: number
  height: number
  hasEOL?: boolean
}

interface Fragment {
  text: string
  x: number
  right: number
  y: number
  size: number
}

interface VisualLine {
  fragments: Fragment[]
  y: number
  size: number
  page: number
}

export async function extractPdf(bytes: Uint8Array, pdfjs: PdfJsLike, fileName = 'This file'): Promise<ExtractedDocument> {
  // pdf.js may detach the buffer it is given, so pass a copy.
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  })

  let doc: PdfDocument
  try {
    doc = await task.promise
  } catch (error) {
    throw describePdfError(error, fileName)
  }

  try {
    const lines: VisualLine[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      lines.push(...groupIntoLines(content.items.filter(isTextItem).map(toFragment), n))
    }

    const characters = lines.reduce((sum, line) => sum + lineText(line).replace(/\s/g, '').length, 0)
    if (characters === 0) {
      throw new ResumeFileError(
        `"${fileName}" has no selectable text. It is probably a scanned image. ` +
          'Please export the resume as a text-based PDF or a Word (.docx) file. Scanned documents are not supported.',
      )
    }
    if (characters < 40) {
      throw new ResumeFileError(`"${fileName}" contains too little text to be a resume.`)
    }

    const warnings: string[] = []
    if (looksMultiColumn(lines)) {
      warnings.push(
        'This PDF seems to use more than one column. Text from side-by-side columns may be mixed up, so please check every section carefully.',
      )
    }
    return { kind: 'pdf', lines: toResumeLines(lines), warnings }
  } finally {
    await doc.destroy().catch(() => undefined)
  }
}

function describePdfError(error: unknown, fileName: string): ResumeFileError {
  const name = (error as { name?: string } | null)?.name ?? ''
  if (name === 'PasswordException') {
    return new ResumeFileError(`"${fileName}" is password-protected. Please upload a copy without a password.`)
  }
  if (name === 'InvalidPDFException' || name === 'FormatError') {
    return new ResumeFileError(`"${fileName}" could not be read. The PDF may be damaged.`)
  }
  const detail = error instanceof Error ? error.message : String(error)
  return new ResumeFileError(`"${fileName}" could not be read as a PDF (${detail}).`)
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item
}

function toFragment(item: TextItem): Fragment {
  const [a, b, , d, e, f] = item.transform
  const size = Math.hypot(b, d) || Math.abs(a) || item.height || 10
  return { text: item.str, x: e, right: e + item.width, y: f, size }
}

/** Groups fragments on (nearly) the same baseline into lines, top to bottom. */
function groupIntoLines(fragments: Fragment[], page: number): VisualLine[] {
  const sorted = fragments
    .filter((f) => f.text.trim() !== '')
    .sort((p, q) => q.y - p.y || p.x - q.x)
  const lines: VisualLine[] = []
  for (const fragment of sorted) {
    const line = lines.find((l) => Math.abs(l.y - fragment.y) < Math.max(l.size, fragment.size) * 0.45)
    if (line) {
      line.fragments.push(fragment)
      line.size = Math.max(line.size, fragment.size)
    } else {
      lines.push({ fragments: [fragment], y: fragment.y, size: fragment.size, page })
    }
  }
  for (const line of lines) line.fragments.sort((p, q) => p.x - q.x)
  return lines.sort((p, q) => q.y - p.y)
}

/**
 * Joins a line's fragments. A small gap becomes a space; a very large gap
 * (tab stops, right-aligned dates) becomes a tab so later stages can split on it.
 */
function lineText(line: VisualLine): string {
  let text = ''
  let previous: Fragment | null = null
  for (const fragment of line.fragments) {
    if (previous) {
      const gap = fragment.x - previous.right
      if (gap > line.size * 2) text += '\t'
      else if (gap > line.size * 0.15 && !/\s$/.test(text) && !/^\s/.test(fragment.text)) text += ' '
    }
    text += fragment.text
    previous = fragment
  }
  return text.replace(/[ \u00a0]+/g, ' ').trim()
}

function toResumeLines(lines: VisualLine[]): ResumeLine[] {
  if (lines.length === 0) return []
  const sizes = lines.map((l) => l.size).sort((p, q) => p - q)
  const bodySize = sizes[Math.floor(sizes.length / 2)]

  // The usual distance between consecutive lines on the same page.
  const gaps: number[] = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].page === lines[i - 1].page) gaps.push(lines[i - 1].y - lines[i].y)
  }
  gaps.sort((p, q) => p - q)
  const usualGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : bodySize * 1.2

  return lines
    .map((line, i): ResumeLine => {
      const previous = lines[i - 1]
      const gap = previous && previous.page === line.page ? previous.y - line.y : Infinity
      // A new paragraph has more space above it than a wrapped line. Compare
      // with both the usual gap and the text size, because in resumes where
      // every line is its own paragraph the usual gap is a paragraph gap.
      const size = previous ? Math.max(previous.size, line.size) : line.size
      const threshold = Math.min(usualGap * 1.4, size * 1.55)
      return {
        text: lineText(line),
        heading: line.size > bodySize * 1.15,
        breakBefore: i === 0 || gap > threshold,
      }
    })
    .filter((line) => line.text !== '')
}

/** Many lines with a wide gap in the middle of the page suggests two columns. */
function looksMultiColumn(lines: VisualLine[]): boolean {
  if (lines.length < 10) return false
  const split = lines.filter((line) =>
    line.fragments.some((f, i) => i > 0 && f.x - line.fragments[i - 1].right > line.size * 6),
  )
  return split.length / lines.length > 0.3
}
