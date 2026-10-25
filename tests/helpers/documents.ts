// Builds real .docx and .pdf files in memory for tests, from a simple list of
// paragraphs. This exercises the same extraction code the plugin uses.

import { strToU8, zipSync } from 'fflate'

export type Para =
  | string
  | {
      text: string
      /** Word list item (docx) or "•" prefix (pdf). */
      bullet?: boolean
      /** Word heading style (docx) or larger bold text (pdf). */
      heading?: boolean
      bold?: boolean
      /** PDF only: draw this paragraph at this x (for two-column layouts). */
      x?: number
      /** PDF only: draw on the same line as the previous paragraph. */
      sameLine?: boolean
    }

const norm = (p: Para) => (typeof p === 'string' ? { text: p } : p)

// ---------------------------------------------------------------- DOCX

export function makeDocx(paragraphs: Para[], opts: { header?: Para[] } = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>',
    ),
    'word/document.xml': strToU8(wordXml('w:document', `<w:body>${paragraphs.map(paragraphXml).join('')}</w:body>`)),
  }
  if (opts.header) files['word/header1.xml'] = strToU8(wordXml('w:hdr', opts.header.map(paragraphXml).join('')))
  return zipSync(files)
}

function wordXml(root: string, inner: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<${root} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${inner}</${root}>`
  )
}

function paragraphXml(para: Para): string {
  const p = norm(para)
  const props: string[] = []
  if (p.heading) props.push('<w:pStyle w:val="Heading1"/>')
  if (p.bullet) props.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')
  const runProps = p.bold ? '<w:rPr><w:b/></w:rPr>' : ''
  // Tabs become <w:tab/>, like Word writes them.
  const runs = p.text
    .split('\t')
    .map((chunk) => `<w:r>${runProps}<w:t xml:space="preserve">${escapeXml(chunk)}</w:t></w:r>`)
    .join(`<w:r><w:tab/></w:r>`)
  return `<w:p>${props.length ? `<w:pPr>${props.join('')}</w:pPr>` : ''}${runs}</w:p>`
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------- PDF

interface PdfLine {
  text: string
  x: number
  y: number
  size: number
  bold: boolean
}

/**
 * A minimal text PDF using the built-in Helvetica fonts. Long paragraphs are
 * wrapped into several lines, as real PDFs are; paragraphs get extra space.
 */
export function makePdf(paragraphs: Para[], opts: { wrapAt?: number; linesPerPage?: number } = {}): Uint8Array {
  const wrapAt = opts.wrapAt ?? 95
  const linesPerPage = opts.linesPerPage ?? 60
  const pages: PdfLine[][] = [[]]
  let y = 800
  let count = 0

  for (const para of paragraphs) {
    const p = norm(para)
    const size = p.heading ? 14 : 10
    const text = p.bullet ? `• ${p.text}` : p.text
    const wrapped = wrap(text, p.heading ? 1000 : wrapAt)
    if (p.sameLine) {
      y += 14 // undo the move to the next line
    } else {
      y -= p.heading ? 14 : 8 // paragraph spacing, as in real documents
    }
    wrapped.forEach((chunk, i) => {
      if (count >= linesPerPage) {
        pages.push([])
        y = 800
        count = 0
      }
      const indent = p.bullet && i > 0 ? 8 : 0
      pages[pages.length - 1].push({ text: chunk, x: (p.x ?? 50) + indent, y, size, bold: !!(p.bold || p.heading) })
      y -= 14
      count++
    })
  }
  return buildPdf(pages)
}

/** A PDF whose pages have no text at all (like a scanned image). */
export function makeImageOnlyPdf(): Uint8Array {
  return buildPdf([[]], '0.5 g 50 50 200 200 re f')
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > width) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines
}

function buildPdf(pages: PdfLine[][], extraContent = ''): Uint8Array {
  const objects: string[] = []
  const add = (body: string) => objects.push(body) // object number = index + 1

  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // pages tree, filled in below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')

  const kids: number[] = []
  for (const lines of pages) {
    const ops = lines
      .map((l) => `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf 1 0 0 1 ${l.x} ${l.y} Tm (${pdfString(l.text)}) Tj ET`)
      .join('\n')
    const content = `${extraContent}\n${ops}`
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    const contentRef = objects.length
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentRef} 0 R ` +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>',
    )
    kids.push(objects.length)
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  // Latin-1: one byte per character, matching the offsets above.
  return Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff)
}

const WIN_ANSI: Record<string, number> = { '•': 0x95, '–': 0x96, '—': 0x97, '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94 }

function pdfString(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = WIN_ANSI[ch] ?? ch.charCodeAt(0)
    if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`
    else if (code > 126 || code < 32) out += `\\${code.toString(8).padStart(3, '0')}`
    else out += ch
  }
  return out
}
