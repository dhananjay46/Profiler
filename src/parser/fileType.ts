// Checks that an uploaded file is a supported resume format before parsing.
// Both the file extension and the file's own signature bytes are checked, so a
// renamed or damaged file gets a clear message instead of a parser crash.

import { ResumeFileError } from './types'

export type ResumeFileType = 'pdf' | 'docx'

export const MAX_FILE_BYTES = 15 * 1024 * 1024

export function detectFileType(fileName: string, bytes: Uint8Array): ResumeFileType {
  const extension = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()

  if (bytes.length === 0) {
    throw new ResumeFileError(`"${fileName}" is empty.`)
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new ResumeFileError(`"${fileName}" is larger than 15 MB. Please upload a smaller file.`)
  }
  if (extension === 'doc' || isOleCompoundFile(bytes)) {
    throw new ResumeFileError(
      `"${fileName}" is an older Word (.doc) file or a password-protected document. ` +
        'Open it in Word and use File → Save As → Word Document (.docx), without a password.',
    )
  }

  if (extension === 'pdf') {
    if (!startsWithPdfHeader(bytes)) {
      throw new ResumeFileError(`"${fileName}" is not a valid PDF. It may be damaged or renamed from another format.`)
    }
    return 'pdf'
  }
  if (extension === 'docx') {
    if (!startsWithZipHeader(bytes)) {
      throw new ResumeFileError(`"${fileName}" is not a valid Word document. It may be damaged or renamed from another format.`)
    }
    return 'docx'
  }
  throw new ResumeFileError(
    `"${fileName}" is not supported. Please upload a PDF or a Word (.docx) file.`,
  )
}

/** PDFs start with "%PDF-", though some tools put a few junk bytes first. */
function startsWithPdfHeader(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.subarray(0, 1024))
  return head.includes('%PDF-')
}

/** DOCX files are ZIP archives: "PK\x03\x04". */
function startsWithZipHeader(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

/** Old .doc files and encrypted .docx files are OLE compound files. */
function isOleCompoundFile(bytes: Uint8Array): boolean {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
  return signature.every((b, i) => bytes[i] === b)
}
