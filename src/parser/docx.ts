// Extracts text from a .docx file. A .docx is a ZIP archive; the body text is
// in word/document.xml and page headers (often holding the name and contact
// details) are in word/header*.xml.
//
// The XML is read with a small tag scanner instead of a DOM parser so the
// same code runs in the plugin panel and in Node tests.

import { unzipSync } from 'fflate'
import { ResumeFileError, type ExtractedDocument, type ResumeLine } from './types'

export function extractDocx(bytes: Uint8Array, fileName = 'This file'): ExtractedDocument {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, {
      filter: (file) => file.name === 'word/document.xml' || /^word\/header\d*\.xml$/.test(file.name),
    })
  } catch (_e) {
    throw new ResumeFileError(`"${fileName}" could not be opened. The Word file may be damaged.`)
  }

  const body = files['word/document.xml']
  if (!body) {
    throw new ResumeFileError(`"${fileName}" does not look like a Word document (no document text found).`)
  }

  const decoder = new TextDecoder('utf-8')
  const headerNames = Object.keys(files)
    .filter((name) => name.startsWith('word/header'))
    .sort()
  const lines: ResumeLine[] = []
  for (const name of headerNames) lines.push(...paragraphsToLines(decoder.decode(files[name])))
  lines.push(...paragraphsToLines(decoder.decode(body)))

  if (lines.every((line) => line.text.trim() === '')) {
    throw new ResumeFileError(`"${fileName}" contains no readable text.`)
  }
  return { kind: 'docx', lines, warnings: [] }
}

interface Paragraph {
  text: string
  bullet: boolean
  heading: boolean
  boldChars: number
  textChars: number
}

const TOKEN = /<(\/?)([A-Za-z][\w.:-]*)([^>]*?)(\/?)>|([^<]+)/g

/** Turns WordprocessingML into lines, one per paragraph (or manual line break). */
export function paragraphsToLines(xml: string): ResumeLine[] {
  const lines: ResumeLine[] = []
  const stack: Paragraph[] = [] // text boxes can nest paragraphs inside paragraphs
  let inText = false
  let inRunProps = false
  let runBold = false

  const current = (): Paragraph | undefined => stack[stack.length - 1]
  const append = (text: string, bold = runBold) => {
    const p = current()
    if (!p) return
    p.text += text
    const visible = text.replace(/\s/g, '').length
    p.textChars += visible
    if (bold) p.boldChars += visible
  }

  for (const match of xml.matchAll(TOKEN)) {
    const [, closing, tag, attrs, selfClosing, textContent] = match
    if (textContent !== undefined) {
      if (inText) append(decodeEntities(textContent))
      continue
    }
    const isOpen = !closing
    switch (tag) {
      case 'w:p':
        if (isOpen && !selfClosing) {
          stack.push({ text: '', bullet: false, heading: false, boldChars: 0, textChars: 0 })
        } else if (closing) {
          const p = stack.pop()
          if (p) lines.push(...toLines(p))
        }
        break
      case 'w:pStyle': {
        const style = attr(attrs, 'w:val') ?? ''
        const p = current()
        if (p && /heading|title/i.test(style)) p.heading = true
        if (p && /list/i.test(style)) p.bullet = true
        break
      }
      case 'w:numPr':
        if (isOpen && current()) current()!.bullet = true
        break
      case 'w:r':
        if (isOpen) runBold = false
        break
      case 'w:rPr':
        inRunProps = isOpen && !selfClosing
        break
      case 'w:b':
        if (inRunProps) runBold = !/^(0|false|off)$/i.test(attr(attrs, 'w:val') ?? 'true')
        break
      case 'w:t':
        inText = isOpen && !selfClosing
        break
      case 'w:tab':
        if (isOpen) append('\t', false)
        break
      case 'w:br':
      case 'w:cr':
        if (isOpen) append('\n', false)
        break
    }
  }
  return lines
}

function toLines(p: Paragraph): ResumeLine[] {
  const bold = p.textChars > 0 && p.boldChars / p.textChars > 0.6
  return p.text
    .split('\n')
    .map((text) => text.replace(/[ \u00a0]+/g, ' ').trim())
    .filter((text) => text.replace(/\t/g, '').trim() !== '')
    .map((text) => ({ text, bullet: p.bullet, heading: p.heading, bold, breakBefore: true }))
}

function attr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`))
  return match?.[1]
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code: string) => {
    const lower = code.toLowerCase()
    if (lower === 'amp') return '&'
    if (lower === 'lt') return '<'
    if (lower === 'gt') return '>'
    if (lower === 'quot') return '"'
    if (lower === 'apos') return "'"
    const n = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
    return Number.isFinite(n) ? String.fromCodePoint(n) : whole
  })
}
