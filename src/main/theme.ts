// The visual system. Every color, size and spacing value the renderer uses
// lives here, so the look can be changed without touching layout code.
//
// Values are measured from the reference profile (852 px wide export).
// Spacing values are the gaps between text *boxes*; they are derived from the
// measured ink positions using Ubuntu's metrics (ascent 0.932, descent 0.189,
// ascender height 0.776), so fractional values are intentional.
//
// The Section Title and Tool Tile components are created once per page and
// reused. After changing their styles here, increase COMPONENT_VERSION in
// components.ts so fresh components are created on the next run.

/** [top, right, bottom, left] */
export type Padding = [number, number, number, number]
export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold'

const colors = {
  page: '#FFFFFF',
  primary: '#0071AD', // name, headings, accent block, icons
  headerText: '#000000', // title, summary, icon labels
  text: '#4A4A4A', // all section content
  separator: '#ABABAB', // first "|" in experience headings
  ring: '#EBEBEB', // icon circle outline
  placeholder: '#E9EDF2', // photo / logo / screenshot slots
  placeholderText: '#8A929C',
  tile: '#F1F3F6', // tool tiles
}

export type ColorToken = keyof typeof colors

export interface TextStyleSpec {
  weight: FontWeight
  size: number
  lineHeight: number
  color: ColorToken
  /** Percent of font size. */
  letterSpacing?: number
  uppercase?: boolean
  /** Extra space between paragraphs. */
  paragraphSpacing?: number
}

const layout = {
  pageWidth: 852,
  pageBottom: 48,
  contentPadding: [0, 44, 0, 83] as Padding, // content runs from x 83 to x 808

  header: {
    paddingLeft: 41, // accent block starts at x 41
    paddingRight: 44,
    gap: 49, // photo group ends at x 175, text starts at x 224
    accent: { width: 80, height: 131 },
    photo: { x: 14, y: 65, width: 120, height: 142 }, // relative to the accent block
    nameTop: 59.3,
    nameToTitle: 5.4,
    titleToSummary: 13.2,
    logo: { show: true, x: 633, y: 36, width: 174, height: 37 }, // relative to the page
  },

  competencies: {
    top: 12.2, // header bottom to circle top
    paddingLeft: 38.5, // first circle centered at x 103
    itemWidth: 129, // circle centers 129 apart
    circle: 75,
    icon: 36,
    circleToLabel: 4.9,
  },

  contentTop: 23.6, // after the icon row (28 when there is no icon row)
  sectionGap: 28,
  sectionInnerGap: 12, // section title to content
  skillsInnerGap: 14,
  toolsInnerGap: 15.5,

  entryGap: 28, // between experience entries
  headingToDescription: 6.2,
  descriptionToList: 10,
  descriptionInsetRight: 13, // descriptions end at x 795, lists at x 808
  listNumberWidth: 24, // numbers right-aligned in x 83–107
  listNumberGap: 4, // item text starts at x 111

  skillColumnWidth: 196,
  skillColumns: 3,

  toolTile: 42,
  toolGap: 20.25,
  toolsIndent: 2.5,
  toolRadius: 8,

  caseStudiesTop: 44.5, // content bottom to first case-study heading
  caseStudyGap: 41,
  caseHeadingToImages: 17.5,
  screenshotWidth: 350,
  screenshotHeight: 200,
  screenshotGap: 21,
  caseDetailsGap: 24,
}

const text = {
  name: { weight: 'bold', size: 18, lineHeight: 22, color: 'primary' },
  title: { weight: 'bold', size: 14, lineHeight: 18, color: 'headerText' },
  contact: { weight: 'regular', size: 12, lineHeight: 18, color: 'headerText' },
  summary: { weight: 'regular', size: 12, lineHeight: 18, color: 'headerText', paragraphSpacing: 3 },
  competencyLabel: { weight: 'regular', size: 12, lineHeight: 18, color: 'headerText' },
  sectionTitle: { weight: 'medium', size: 16, lineHeight: 20, color: 'primary' },
  educationLine: { weight: 'bold', size: 12, lineHeight: 19, color: 'text' },
  certificationLine: { weight: 'regular', size: 12, lineHeight: 19, color: 'text' },
  link: { weight: 'medium', size: 12, lineHeight: 19, color: 'primary' },
  entryHeading: { weight: 'regular', size: 14, lineHeight: 20, color: 'text' },
  entryDates: { weight: 'regular', size: 12, lineHeight: 20, color: 'text' },
  body: { weight: 'regular', size: 12, lineHeight: 18, color: 'text' },
  skill: { weight: 'regular', size: 12, lineHeight: 19, color: 'text' },
  toolTile: { weight: 'medium', size: 13, lineHeight: 16, color: 'text' },
  caseHeading: { weight: 'regular', size: 16, lineHeight: 18, color: 'text' },
  label: { weight: 'bold', size: 10, lineHeight: 14, color: 'primary', letterSpacing: 6, uppercase: true },
  placeholder: { weight: 'medium', size: 11, lineHeight: 14, color: 'placeholderText' },
} satisfies Record<string, TextStyleSpec>

export const theme = {
  /** Tried in order; the first family that loads is used. */
  fontFamilies: ['Ubuntu', 'Inter'],
  colors,
  layout,
  text,
}
