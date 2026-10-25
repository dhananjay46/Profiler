// The profile data contract.
//
// Everything the renderer draws comes from an object of this shape. It comes
// either from the test data in src/data/testProfiles.ts or from an uploaded
// resume (src/parser), reviewed by the user before generating.

export interface ConsultantProfile {
  header: ProfileHeader
  /**
   * Shown beside the photo. Separate paragraphs with a blank line.
   * Wrap key phrases in **double asterisks** to make them bold.
   */
  summary: string
  /** Optional row of icon circles under the header, e.g. "Empathise", "Ideate". */
  competencies?: Competency[]
  education: EducationEntry[]
  experience: ExperienceEntry[]
  skills: string[]
  tools: string[]
  certifications: Certification[]
  /** Optional. The section is skipped when missing or empty. */
  caseStudies?: CaseStudy[]
}

export interface ProfileHeader {
  name: string
  /** May be empty when the resume does not state a job title. */
  title: string
  location?: string
  email?: string
  phone?: string
  linkedin?: string
}

export interface Competency {
  label: string
  /**
   * Built-in icon name: empathise, data-visualization, user-scenario,
   * mind-mapping, ideate, design. Unknown or missing names use a generic icon.
   */
  icon?: string
}

export interface EducationEntry {
  degree: string
  /** May be empty when the resume does not name the school. */
  institution?: string
  location?: string
  startYear?: string
  endYear?: string
}

/**
 * One project or role. At least one of `project` or `role` is required.
 * Heading: "**Project** | Role | Company | Industry | Region" (empty parts skipped).
 */
export interface ExperienceEntry {
  project?: string
  role?: string
  company?: string
  industry?: string
  region?: string
  startDate?: string
  /**
   * As written in the resume, e.g. "Mar 2021" or "Present". When omitted only
   * the start date is shown. "Present" is never assumed.
   */
  endDate?: string
  /** Paragraph shown above the responsibilities. Supports **bold**. */
  description?: string
  responsibilities: string[]
}

export interface Certification {
  name: string
  issuer?: string
  year?: string
  /** Optional link to the credential (verifier, badge, or issuer page). */
  url?: string
}

export interface CaseStudy {
  title: string
  /** Shown above the title, e.g. "Manufacturing Domain". */
  client?: string
  /** Number of screenshot slots: 1 (one wide image) or 2 (side by side). Default 2. */
  imageCount?: number
  /** Optional text shown under the screenshots. */
  challenge?: string
  solution?: string
  outcome?: string
  /** Optional "View case study" link. */
  url?: string
}
