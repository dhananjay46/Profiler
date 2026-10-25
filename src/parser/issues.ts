/**
 * Something the user should look at on the review screen.
 *  - required: generation is blocked until it is fixed
 *  - missing:  not found in the resume; left empty
 *  - check:    filled from the resume, but the mapping was a guess
 */
export type IssueLevel = 'required' | 'missing' | 'check'

export interface ReviewIssue {
  /** Field path in the profile, e.g. "experience[0].startDate", or "" for general notes. */
  path: string
  level: IssueLevel
  message: string
}

/** Resume text that could not be placed into the profile, shown for reference. */
export interface UnmappedText {
  title: string
  lines: string[]
}

export class IssueList {
  readonly items: ReviewIssue[] = []
  required(path: string, message: string): void {
    this.items.push({ path, level: 'required', message })
  }
  missing(path: string, message: string): void {
    this.items.push({ path, level: 'missing', message })
  }
  check(path: string, message: string): void {
    this.items.push({ path, level: 'check', message })
  }
}
