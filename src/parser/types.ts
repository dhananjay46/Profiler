// Types shared by the resume extractors and the mapper.

/** One line of resume text, with whatever layout hints the file format gave us. */
export interface ResumeLine {
  text: string
  /** Started with a bullet or number, or was a Word list item. */
  bullet?: boolean
  /** Styled as a heading in Word, or noticeably larger text in a PDF. */
  heading?: boolean
  /** Mostly bold text. */
  bold?: boolean
  /** Starts a new paragraph (Word paragraph, or a larger vertical gap in a PDF). */
  breakBefore?: boolean
}

export interface ExtractedDocument {
  kind: 'pdf' | 'docx'
  lines: ResumeLine[]
  /** Notes about the extraction itself, e.g. a possible multi-column layout. */
  warnings: string[]
}

/** A problem with the uploaded file. The message is shown to the user as-is. */
export class ResumeFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResumeFileError'
  }
}
