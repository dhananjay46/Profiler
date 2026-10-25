// Resume parsing entry point: file bytes → extracted lines → profile draft.
// Everything runs locally; no data leaves the plugin.

import { extractDocx } from './docx'
import { detectFileType } from './fileType'
import { mapResume, type ParseResult } from './mapResume'
import { extractPdf, type PdfJsLike } from './pdf'
import type { ExtractedDocument } from './types'

export type { ParseResult } from './mapResume'
export type { ReviewIssue, UnmappedText, IssueLevel } from './issues'
export { ResumeFileError } from './types'

export async function extractResume(fileName: string, bytes: Uint8Array, pdfjs: PdfJsLike): Promise<ExtractedDocument> {
  const type = detectFileType(fileName, bytes)
  return type === 'pdf' ? extractPdf(bytes, pdfjs, fileName) : extractDocx(bytes, fileName)
}

export async function parseResume(fileName: string, bytes: Uint8Array, pdfjs: PdfJsLike): Promise<ParseResult> {
  return mapResume(await extractResume(fileName, bytes, pdfjs))
}
