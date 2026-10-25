// Test resumes with different structures. All people and companies are fictional.

import type { Para } from '../helpers/documents'

/** A: classic chronological resume — pipes, date ranges, bullets, all main sections. */
export const classic: Para[] = [
  { text: 'Priya Sharma', heading: true },
  'Senior UX Designer',
  'Pune, India | priya.sharma@example.com | +91 98765 43210 | linkedin.com/in/priya-example',
  { text: 'PROFESSIONAL SUMMARY', heading: true },
  'UX designer with 9 years of experience designing enterprise web and mobile products for banking and insurance clients, with a focus on research-led design and accessible interfaces.',
  { text: 'WORK EXPERIENCE', heading: true },
  { text: 'Senior UX Designer | Example Bank Ltd | Jan 2020 – Present', bold: true },
  { text: 'Led research and design for the retail banking app used across web, iOS and Android, working closely with product owners and engineering leads.', bullet: true },
  { text: 'Introduced a shared design system for four product teams.', bullet: true },
  { text: 'Ran monthly usability testing sessions with customers.', bullet: true },
  { text: 'UX Designer | Sample Insurance Co | Jun 2016 – Dec 2019', bold: true },
  { text: 'Designed claim submission journeys for web and mobile.', bullet: true },
  { text: 'Created wireframes and prototypes for stakeholder reviews.', bullet: true },
  { text: 'EDUCATION', heading: true },
  'Bachelor of Design, Example Institute of Design, 2016',
  { text: 'CERTIFICATIONS', heading: true },
  'Certified Usability Analyst – Example UX Academy (2021)',
  { text: 'SKILLS', heading: true },
  'User Research, Wireframing, Prototyping, Usability Testing',
  { text: 'TOOLS', heading: true },
  'Figma, Sketch, Miro',
]

/** B: headers split over several lines, plain-line responsibilities, intro instead of a summary, no tools. */
export const multiLine: Para[] = [
  'Alex Morgan',
  'Product Designer',
  'alex.morgan@example.com',
  'Product designer who enjoys turning complex problems into simple, friendly interfaces for the people who use them every day.',
  { text: 'Experience', heading: true },
  'Lead Product Designer',
  'Globex Ltd, London',
  '2018 - 2021',
  'Led the redesign of the customer portal.',
  'Ran weekly design critiques with the team.',
  'Product Designer',
  'Initech',
  '2015 - 2018',
  'Designed onboarding flows for new customers.',
  'Worked with engineers on front-end details.',
  { text: 'Education', heading: true },
  'MA Interaction Design',
  'Royal College of Art',
  '2013 - 2015',
  { text: 'Skills', heading: true },
  'Interaction design',
  'Prototyping',
  'Accessibility',
]

/** C: project-based consulting resume with labelled fields, like the reference layout. */
export const projectBased: Para[] = [
  'Rahul Verma',
  'Lead Experience Designer',
  { text: 'Summary', heading: true },
  'Experience designer with 12 years of experience across energy, insurance and retail.',
  'Specialises in research, information architecture and design systems.',
  { text: 'Projects', heading: true },
  'Project: Turbine Monitoring Portal',
  'Client: Example Energy Corp',
  'Domain: Energy',
  'Duration: Mar 2019 to Dec 2020',
  'Role: Lead Designer',
  'Description: A web application for monitoring turbine health in real time.',
  'Responsibilities:',
  '1. Conducted stakeholder interviews.',
  '2. Created wireframes and prototypes.',
  'Tools used: Figma, Miro',
  'Project: Agent Workbench',
  'Client: Example Insurance',
  'Duration: 2017 - 2019',
  'Responsibilities:',
  'Designed the information architecture.',
  'Ran usability tests with insurance agents.',
  { text: 'Education & Certifications', heading: true },
  'B.Des, Example National Institute of Design, 2014',
  'Google UX Design Certificate (2021)',
  'Skills: Research, Wireframing, Visual Design',
  { text: 'Languages', heading: true },
  'English, Hindi',
]

/** D: no section headings at all. */
export const noHeadings: Para[] = [
  'Jamie Lee',
  'Freelance illustrator and designer based in Leeds, working with publishers and small studios on books, packaging and branding projects.',
]

/** E: capitals, "Role at Company", numeric and unspaced date ranges, typed dashes, extra sections. */
export const variations: Para[] = [
  'SAM O’BRIEN',
  'Senior Interaction Designer',
  'Email: sam@example.com | Mobile: +44 7700 900123',
  { text: 'WORK HISTORY', heading: true },
  'Senior Interaction Designer at Example Studio',
  '06/2019 - 08/2021',
  '• Designed booking flows for a national travel website.',
  'Interaction Designer at Sample Agency',
  '2015–2017',
  '- Built a reusable pattern library.',
  { text: 'EDUCATION', heading: true },
  'BSc Psychology - University of Example (2014)',
  'Grade: First Class Honours',
  { text: 'INTERESTS', heading: true },
  'Cycling, photography',
]
