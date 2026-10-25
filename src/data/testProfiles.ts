// Hardcoded test content. No rendering logic lives here.
// All people, companies, dates and metrics are fictional. The linked and
// career fixtures reuse different structural shapes (3 roles + 8 certs with
// URLs + 4 case studies with URLs, and 6 roles + 1 case study) so the
// renderer gets a variety of layouts to test.

import type { ConsultantProfile, ExperienceEntry } from '../shared/types'

export const testProfile: ConsultantProfile = {
  header: {
    name: 'Jordan Ellis',
    title: 'Senior Experience Design Consultant',
  },
  summary: [
    'Versatile experience designer with 14 years of experience delivering cross-platform digital products. Has worked across financial services, energy, healthcare, retail, telecom and the public sector, for clients ranging from start-ups to global enterprises.',
    'Believes that understanding people is the foundation of useful and effective products. Brings deep experience in **crafting digital product solutions, user research, synthesising insights, usability testing** and **industry standards** to create meaningful experiences for users and businesses alike. Has also led work on **building and evolving design systems, ensuring consistency, scalability and efficiency across product portfolios**. Enjoys learning, mentoring and solving complex problems with cross-functional teams.',
  ].join('\n\n'),
  competencies: [
    { label: 'Empathise', icon: 'empathise' },
    { label: 'Data Visualization', icon: 'data-visualization' },
    { label: 'User Scenario', icon: 'user-scenario' },
    { label: 'Mind Mapping', icon: 'mind-mapping' },
    { label: 'Ideate', icon: 'ideate' },
    { label: 'Design', icon: 'design' },
  ],
  education: [
    { degree: 'Master of Design, Interaction Design', institution: 'Northfield School of Design', endYear: '2014' },
    { degree: 'Bachelor of Fine Arts', institution: 'Riverside University', endYear: '2011' },
  ],
  certifications: [
    { name: 'Design Thinking Practitioner', issuer: 'Example Design Institute', year: '2022' },
    { name: 'Agile Product Ownership', issuer: 'Example Agile Council', year: '2021' },
    { name: 'Certified Usability Analyst', issuer: 'Example UX Academy', year: '2019' },
    { name: 'Human-Computer Interaction', issuer: 'Example Online University', year: '2016' },
    { name: 'Mobile Experience Design', issuer: 'Example Online University', year: '2016' },
  ],
  experience: [
    {
      project: 'Responsive Commerce Platform',
      industry: 'E-commerce',
      region: 'Region, Worldwide',
      description:
        'Designed the end-to-end commerce experience for a print and service plan offered to both businesses and consumers by one of the world’s largest imaging manufacturers. The project focused on simplifying complex workflows such as plan comparison, onboarding, subscription management and self-service. The solution prioritised usability, accessibility and seamless integration with existing digital touchpoints, improving overall customer satisfaction and retention.',
      responsibilities: [
        'Collaborated with stakeholders to gather project requirements and define the scope of work.',
        'Facilitated workshops to understand existing workflows and identify new business needs.',
        'Redesigned the registration process to streamline onboarding and reduce friction for new customers.',
        'Identified opportunities for upsell and cross-sell within the customer journey and incorporated them into the experience design to support business growth.',
        'Contributed to and maintained the design system to ensure consistency, scalability and efficiency across products.',
        'Studied and applied the client’s platform design guidelines to enhance screens, ensuring alignment with platform standards and improving the user experience.',
        'Created wireframes based on synthesised research findings to align with user needs and business goals.',
        'Translated wireframes into high-fidelity mock-ups and detailed interaction flows that follow platform guidelines and accessibility standards.',
        'Conducted stakeholder demos to validate concepts and gain approval on proposed designs.',
        'Partnered with development teams to ensure pixel-perfect implementation by delivering detailed assets and design specifications.',
      ],
    },
    {
      project: 'Turbine Monitoring Portal',
      industry: 'Energy Industry',
      region: 'Region, Worldwide',
      description:
        'A global manufacturer of electrical equipment and devices already had a web application for monitoring turbine health in real time, managing financial processes such as billing and invoicing, and gaining actionable insights from performance data. The goal was to enhance the overall application experience by improving usability and making sure it met user needs.',
      responsibilities: [
        'Collaborated with stakeholders to understand the project requirements and scope of work.',
        'Connected with subject-matter experts to gather detailed information about contract processes.',
        'Conducted observation and interview sessions to empathise with users from different regions.',
        'Maintained and enhanced design systems to promote alignment and efficiency across product ecosystems.',
        'Created wireframes based on summarised research data.',
        'Converted wireframes into high-fidelity mock-ups and interaction workflows for usability testing.',
        'Conducted multiple remote usability tests to receive feedback from users.',
        'Gave regular demos to the client and secured sign-off on suggested concepts.',
        'Collaborated with the development team to ensure a pixel-perfect product by sharing assets and designs.',
      ],
    },
    {
      project: 'Patient Records Modernisation',
      industry: 'Healthcare',
      region: 'Region, UK',
      description:
        'A healthcare organisation providing electronic health records, practice management and revenue-cycle management solutions wanted a modern, efficient responsive web application to replace its twenty-year-old desktop application. The goal was to move away from the outdated interface and rebuild the application as a robust, responsive and seamlessly integrated web app that needs fewer clicks to complete tasks.',
      responsibilities: [
        'Coordinated and discussed with stakeholders for business and functional requirements.',
        'Connected with domain experts to understand the application in detail.',
        'Worked on existing journeys and provided an optimised workflow for users to accomplish desired tasks.',
        'Met daily with cross-functional teams to build a shared understanding of deliverables and track timelines.',
        'Led an offshore team and guided them throughout the project for effective output.',
        'Updated the existing design system with newly identified elements.',
        'Connected with stakeholders on concepts and ideas and gained sign-off on visual designs before development.',
      ],
    },
    {
      project: 'Agent Workbench',
      industry: 'Fintech',
      region: 'Region, UK',
      description:
        'A financial services company providing life and health insurance, annuities and workforce benefits through a family of brands. The existing landscape consisted of three separate mobile applications that were difficult for agents to manage, so we proposed and designed a one-stop solution for agents to manage customers and their insurance plans efficiently.',
      responsibilities: [
        'Coordinated discussions with business users for business requirements and functional feasibility.',
        'Connected with subject-matter experts to identify gaps in the existing applications.',
        'Created the information architecture to finalise the application’s structure.',
        'Ideated and sketched the concept of the mobile application.',
        'Converted approved paper sketches and wireframes into high-fidelity mock-ups.',
        'Executed the project using an agile delivery model with two-week sprints, managed and prioritised in Jira.',
        'Provided an optimised workflow for users to accomplish their desired tasks.',
      ],
    },
  ],
  skills: [
    'User Research',
    'User Interviews',
    'User Flow',
    'Journey Mapping',
    'Information Architecture',
    'Persona Creation',
    'Critical & Logical Thinking',
    'Problem Solving',
    'Data Visualization',
    'Design Systems',
    'Sketching',
    'Wireframing',
    'Visual Design',
    'Prototyping',
    'Testing',
  ],
  tools: ['Figma', 'Adobe XD', 'Sketch', 'Zeplin', 'InVision', 'Miro', 'Marvel', 'Photoshop', 'Illustrator'],
  caseStudies: [
    { client: 'Manufacturing Domain', title: 'Transforming User Experience for Modernization', imageCount: 2 },
    { title: 'Healthcare Application', imageCount: 2 },
    { title: 'Ecommerce Application, Design System', imageCount: 1 },
  ],
}

/**
 * Linked-credentials fixture: 3 roles, 8 certifications with URL links, and
 * 4 case studies with URL links. All names, companies, projects, dates and
 * metrics are fictional placeholders used only to exercise the renderer.
 */
export const linkedProfile: ConsultantProfile = {
  header: {
    name: 'Riley Carter',
    title: 'UX / UI Designer',
    email: 'riley@example.com',
    phone: '+00 00 0000 0000',
  },
  summary: [
    'Designer with **XX years** of experience across multiple industries. Delivers user-focused digital products from research through to prototyping and usability testing.',
    'Specialises in **end-to-end design**: research, information architecture, wireframes, interactive prototypes and handoff. Works closely with stakeholders to deliver scalable, engaging solutions that streamline workflows and enhance user experience.',
  ].join('\n\n'),
  competencies: [
    { label: 'Empathise', icon: 'empathise' },
    { label: 'Data Visualization', icon: 'data-visualization' },
    { label: 'User Scenario', icon: 'user-scenario' },
    { label: 'Mind Mapping', icon: 'mind-mapping' },
    { label: 'Ideate', icon: 'ideate' },
    { label: 'Design', icon: 'design' },
  ],
  education: [
    { degree: 'Bachelor’s Degree', institution: 'Example University', endYear: 'YYYY' },
  ],
  certifications: [
    { name: 'Certification One', issuer: 'Example Institute', year: 'YYYY', url: 'https://example.com/credential/one' },
    { name: 'Certification Two', issuer: 'Example Institute', year: 'YYYY', url: 'https://example.com/credential/two' },
    { name: 'Certification Three', issuer: 'Example Academy', year: 'YYYY', url: 'https://example.com/credential/three' },
    { name: 'Certification Four', issuer: 'Example Platform', year: 'YYYY', url: 'https://example.com/credential/four' },
    { name: 'Certification Five', issuer: 'Example Academy', year: 'YYYY', url: 'https://example.com/credential/five' },
    { name: 'Certification Six', issuer: 'Example Academy', year: 'YYYY', url: 'https://example.com/credential/six' },
    { name: 'Certification Seven', issuer: 'Example Academy', year: 'YYYY', url: 'https://example.com/credential/seven' },
    { name: 'Certification Eight', issuer: 'Example School', year: 'YYYY', url: 'https://example.com/credential/eight' },
  ],
  experience: [
    {
      project: 'Project One',
      role: 'Senior Designer',
      company: 'Example Company A',
      industry: 'Industry',
      startDate: 'MMM YYYY',
      endDate: 'Present',
      description:
        'Led end-to-end UX design for an **enterprise application** that digitised a manual workflow for multiple user roles across the organisation. Ensured accessibility and platform guidelines were met throughout delivery.',
      responsibilities: [
        'Ran stakeholder discovery to define business requirements, constraints and user expectations.',
        'Synthesised insights into role-based workflows and permission architectures for distinct user personas.',
        'Designed **XX plus screens** including input flows, assisted visualisation, offline sync patterns and multi-step acknowledgment.',
        'Maintained strict Figma hygiene with reusable component libraries and comprehensive design documentation.',
        'Enforced **WCAG 2.1 AA** and platform contrast guidance across all deliverables and workflows.',
        'Collaborated daily with frontend developers, UI engineers and QA; conducted iterative usability testing with real users.',
      ],
    },
    {
      project: 'Project Two',
      role: 'Designer',
      company: 'Example Company B',
      industry: 'Industry',
      startDate: 'MMM YYYY',
      endDate: 'MMM YYYY',
      description:
        'Led UX design for a **B2B operations platform** that gave engineers the ability to track system health, resolve issues and manage operations at scale, serving a large user base.',
      responsibilities: [
        'Delivered **XX plus user flows and prototypes**, enhancing productivity through intuitive employee-facing interfaces.',
        'Designed high-fidelity wireframes, mockups and interactive prototypes in Figma using the platform design system; ensured seamless handoff to engineering.',
        'Ran qualitative user research and translated insights into actionable design strategies and intuitive user flows.',
        'Presented key research findings to executive leadership to inform strategic design decisions.',
        'Redesigned a secondary web product (XX plus UI screens, X user flows): **XX% improved navigation efficiency** and **XX% increase in resource accessibility**.',
        'Led end-to-end design of an internal **operations platform** (XX plus UI screens) covering several workflows and team collaboration.',
        'Spearheaded a corporate website redesign: **plus XX% engagement**, **minus XX% bounce rate** and **plus XX% conversion**.',
        'Created an internal **design system** with core principles, XX plus atomic components, a page template and an 8px grid: **XX% faster iterations** and **XX% improved consistency**.',
      ],
    },
    {
      project: 'Project Three',
      role: 'Designer',
      company: 'Example Company C',
      industry: 'Industry',
      startDate: 'MMM YYYY',
      endDate: 'MMM YYYY',
      description:
        'Designed the **core workflows** of a product handling a large transaction volume per month. Matured the initial design layout alongside the development team.',
      responsibilities: [
        'Led UX for the admin interface and the product and service workflows of the system.',
        'Revamped the website: fixed compatibility and load-time issues, improved mobile responsiveness, UX and SEO: **minus XX% bounce rate**.',
        'Designed and implemented web experiences for a sibling product, recreating key sections to emphasise consistency and improve information hierarchy: **plus XX% engagement and clarity**.',
        'Presented UI drafts to internal teams and stakeholders; gathered feedback for iteration and usability testing.',
      ],
    },
  ],
  skills: [
    'User Research',
    'User Scenarios',
    'User Interviews',
    'User Flow',
    'Empathy Mapping',
    'Journey Mapping',
    'Scenario Creation',
    'Persona Creation',
    'Critical & Logical Thinking',
    'Problem Solving',
    'Data Visualization',
    'Data Analytics',
  ],
  tools: [
    'Design System',
    'Competitor Analysis',
    'Agile UX',
    'Wireframing',
    'Prototyping',
    'Interaction Design',
    'Figma',
    'Adobe XD',
    'Illustrator',
    'Photoshop',
    'InVision',
    'Miro',
  ],
  caseStudies: [
    {
      client: 'Example Client',
      title: 'Case Study One',
      challenge: 'Short description of the problem the project set out to solve, written as placeholder copy for layout testing.',
      imageCount: 1,
      url: 'https://example.com/case-studies/one',
    },
    {
      client: 'Example Client',
      title: 'Case Study Two',
      challenge: 'Short description of the problem the project set out to solve.',
      outcome: 'Short description of the outcome.',
      imageCount: 1,
      url: 'https://example.com/case-studies/two',
    },
    {
      client: 'Example Client',
      title: 'Case Study Three',
      challenge: 'Short description of the problem the project set out to solve.',
      imageCount: 1,
      url: 'https://example.com/case-studies/three',
    },
    {
      client: 'Example Client',
      title: 'Case Study Four',
      challenge: 'Short description of the problem the project set out to solve.',
      solution: 'Short description of the proposed solution.',
      imageCount: 1,
      url: 'https://example.com/case-studies/four',
    },
  ],
}

/**
 * Multi-role career fixture: 6 roles across 4 companies, 2 education
 * entries, 1 case study. All content is fictional placeholder data.
 */
export const careerProfile: ConsultantProfile = {
  header: {
    name: 'Morgan Lee',
    title: 'UX Designer',
  },
  summary: [
    'Designer with **XX years** of experience across multiple industries. Passionate about creating **user-focused interfaces** through collaboration with design, product and engineering teams.',
    'Has delivered desktop, mobile, web and tablet experiences, with a track record of designing successful, compelling and consumer-focused applications.',
  ].join('\n\n'),
  competencies: [
    { label: 'Empathise', icon: 'empathise' },
    { label: 'Data Visualization', icon: 'data-visualization' },
    { label: 'User Scenario', icon: 'user-scenario' },
    { label: 'Mind Mapping', icon: 'mind-mapping' },
    { label: 'Ideate', icon: 'ideate' },
    { label: 'Design', icon: 'design' },
  ],
  education: [
    { degree: 'Master’s Degree', institution: 'Example University', startYear: 'YYYY', endYear: 'YYYY' },
    { degree: 'Bachelor’s Degree', institution: 'Example University', startYear: 'YYYY', endYear: 'YYYY' },
  ],
  certifications: [],
  experience: [
    {
      project: 'Project One',
      role: 'Senior Designer',
      company: 'Example Company A',
      industry: 'Industry',
      startDate: 'MMM YYYY',
      endDate: 'MMM YYYY',
      description:
        'Optimised the end-to-end experience on web and mobile for an **example client**. Refined the **core journeys** to align with the brand. Received a **team recognition award**.',
      responsibilities: [
        'Ran user interviews, surveys and usability tests to uncover customer behaviours, preferences and pain points.',
        'Developed wireframes and interactive prototypes to iterate on the core journey concepts.',
        'Produced high-fidelity mockups aligned to the brand aesthetic: cohesive and visually appealing.',
        'Successfully delivered multiple products in the targeted categories.',
      ],
    },
    {
      project: 'Project Two',
      role: 'Senior Designer',
      company: 'Example Company A',
      industry: 'Industry',
      description:
        'Centralised dashboard giving analysts, product managers and support teams a view of the **main process flow**, aligned to the client brand guidelines.',
      responsibilities: [
        'Gathered requirements with stakeholders and clarified functional scope for each user group.',
        'Produced the information architecture grouping related features and designing a logical user flow.',
        'Delivered wireframes and prototypes for layout, content and interactions.',
        'Designed visuals aligned with the client brand: colours, typography, icons and components.',
        'Prepared documentation and training materials to support user adoption.',
      ],
    },
    {
      project: 'Project Three',
      role: 'Designer',
      company: 'Example Company A',
      industry: 'Industry',
      description:
        'Streamlined a transactional experience on the web app. Key insights: **fewer steps**, **frictionless path** and **mobile-first optimisation**. Recognised with an industry benchmark award.',
      responsibilities: [
        'Ran user interviews uncovering friction in the existing flow.',
        'Prioritised a streamlined, mobile-first path.',
        'Delivered designs that led to industry recognition for the team.',
      ],
    },
    {
      project: 'Project Four',
      role: 'Designer',
      company: 'Example Company B',
      industry: 'Industry',
      startDate: 'MMM YYYY',
      endDate: 'MMM YYYY',
      description:
        'Founded and led a studio delivering UX services to several clients. Built and maintained design guidelines, standards and patterns for consistency across engagements.',
      responsibilities: [
        'Ran user research to understand target audiences in each client’s domain.',
        'Created personas based on the research findings.',
        'Designed clear and intuitive information architectures.',
        'Produced wireframes and low- and high-fidelity prototypes to visualise layouts.',
        'Ensured designs aligned with each client’s brand identity.',
      ],
    },
    {
      project: 'Project Five',
      role: 'Designer',
      company: 'Example Company C',
      industry: 'Industry',
      startDate: 'MMM YYYY',
      endDate: 'MMM YYYY',
      description:
        'Translated user requirements into project designs and implementation plans. Produced mockups and prototypes to improve site interactions and recommended iterative design updates to the IT manager.',
      responsibilities: [
        'Conducted and evaluated research methodologies; implemented user-research strategies.',
        'Delivered full redesigns of existing websites: improved navigation, visuals and SEO.',
        'Worked with product managers to translate requirements into polished UIs.',
        'Tested websites at different design and production stages.',
      ],
    },
    {
      project: 'Project Six',
      role: 'Visual Designer',
      company: 'Example Company D',
      industry: 'Industry',
      startDate: 'MMM YYYY',
      endDate: 'MMM YYYY',
      description:
        'Led end-to-end design and delivery of an **example brand’s online identity** (responsive website, brand elements). Served as design consultant for an **example client application** UI.',
      responsibilities: [
        'Contributed to brainstorming and strategy to meet project goals.',
        'Completed full redesigns of existing websites to improve navigation, visuals and SEO.',
        'Translated user requirements into project designs and implementation plans.',
      ],
    },
  ],
  skills: [
    'User Research',
    'User Scenarios',
    'User Interviews',
    'User Flow',
    'Empathy Mapping',
    'Journey Mapping',
    'Scenario Creation',
    'Persona Creation',
    'Critical & Logical Thinking',
    'Problem Solving',
    'Data Visualization',
    'Data Analytics',
  ],
  tools: [
    'Design System',
    'Mind Mapping',
    'Sketching',
    'Wireframing',
    'Prototyping',
    'Interaction Design',
    'Adobe XD',
    'Illustrator',
    'Photoshop',
    'InVision',
    'Figma',
  ],
  caseStudies: [
    {
      client: 'Example Client',
      title: 'Case Study One',
      challenge: 'Short description of the problem the project set out to solve.',
      solution: 'Short description of the proposed solution.',
      outcome: 'Short description of the outcome.',
      imageCount: 2,
    },
  ],
}

/** Smallest valid profile: one role, empty lists, no icons or case studies. */
export const minimalProfile: ConsultantProfile = {
  header: { name: 'Sam Patel', title: 'Data Consultant' },
  summary: 'Data consultant focused on analytics engineering.',
  education: [],
  experience: [
    {
      role: 'Data Consultant',
      company: 'Example Analytics Ltd',
      startDate: 'Jan 2023',
      endDate: 'Present',
      responsibilities: ['Built reporting pipelines for retail clients.'],
    },
  ],
  skills: ['SQL'],
  tools: [],
  certifications: [],
}

/** Long names, long text, contact details, dates, unknown icons and many entries. */
export const stressProfile: ConsultantProfile = {
  ...testProfile,
  header: {
    name: 'Alexandra Montgomery-Fitzwilliam',
    title: 'Principal Consultant, Enterprise Architecture, Cloud Platforms and Large-Scale Digital Transformation Programmes',
    location: 'London, UK',
    email: 'alexandra.mf@example.com',
    phone: '+44 20 7946 0958',
  },
  summary: [testProfile.summary, testProfile.summary].join('\n\n'),
  competencies: [
    ...(testProfile.competencies ?? []).slice(0, 4),
    { label: 'Service Blueprinting and Facilitation', icon: 'not-a-real-icon' },
    { label: 'Research' },
  ],
  experience: [...testProfile.experience, ...testProfile.experience.slice(0, 2)].map(
    (entry, i): ExperienceEntry => ({
      ...entry,
      role: i % 2 === 0 ? 'Lead Experience Designer' : undefined,
      company: i === 1 ? 'Example Consulting Group International Holdings' : undefined,
      startDate: i < 2 ? 'Mar 2021' : undefined,
      endDate: i === 0 ? 'Present' : i === 1 ? 'Feb 2023' : undefined,
    }),
  ),
  skills: [...testProfile.skills, 'Service Design', 'Accessibility (WCAG 2.2)', 'Content Strategy'],
  tools: [...testProfile.tools, 'Jira', 'Confluence', 'Power BI', 'Tableau', 'Maze', 'Hotjar'],
  caseStudies: [
    ...(testProfile.caseStudies ?? []),
    {
      client: 'Retail Domain',
      title: 'Store Operations Dashboard',
      challenge: 'Store managers lacked a single view of stock, staffing and sales.',
      solution: 'A role-based dashboard with prioritised alerts and drill-down reports.',
      outcome: 'Daily reporting time cut by 40 minutes per store.',
    },
  ],
}

/** Deliberately broken data, to check that errors are reported clearly. */
const invalidProfile = {
  ...testProfile,
  header: { ...testProfile.header, name: '' },
  experience: [{ company: 'Has neither project nor role', responsibilities: 'not a list' }],
  caseStudies: [{ title: 'Bad image count', imageCount: 5 }],
} as unknown as ConsultantProfile

export type FixtureKind = 'sample' | 'edge-case'

export interface FixtureSpec {
  id: string
  /** Short label shown as the dropdown option. */
  label: string
  /** One-line explanation shown under the preview card. */
  description: string
  /** Grouping heading in the dropdown. */
  kind: FixtureKind
  profile: ConsultantProfile
}

export const TEST_PROFILES: FixtureSpec[] = [
  {
    id: 'reference',
    label: 'Layout 1',
    description: 'Mirrors the reference profile exactly. Use it to A/B check layout changes against the baseline.',
    kind: 'sample',
    profile: testProfile,
  },
  {
    id: 'linked',
    label: 'Layout 2',
    description: 'Three-role shape with 8 certifications and 4 case studies, each carrying a link URL to exercise the hyperlink rendering.',
    kind: 'sample',
    profile: linkedProfile,
  },
  {
    id: 'career',
    label: 'Layout 3',
    description: 'Six roles across four companies, 2 education entries and 1 case study. Covers a wider career history.',
    kind: 'sample',
    profile: careerProfile,
  },
  {
    id: 'minimal',
    label: 'Minimum data',
    description: 'Smallest profile the renderer accepts. Tests that empty sections do not crash the layout.',
    kind: 'edge-case',
    profile: minimalProfile,
  },
  {
    id: 'stress',
    label: 'Overflow stress test',
    description: 'Long name and title, 6 projects, extra skills and unknown competency icons. Exercises text wrapping.',
    kind: 'edge-case',
    profile: stressProfile,
  },
  {
    id: 'invalid',
    label: 'Invalid data',
    description: 'Deliberately invalid: missing name, bad responsibilities, bad imageCount. Verifies error messages.',
    kind: 'edge-case',
    profile: invalidProfile,
  },
]

export function fixtureStats(profile: ConsultantProfile): {
  experience: number
  education: number
  certifications: number
  skills: number
  tools: number
  caseStudies: number
} {
  return {
    experience: profile.experience?.length ?? 0,
    education: profile.education?.length ?? 0,
    certifications: profile.certifications?.length ?? 0,
    skills: profile.skills?.length ?? 0,
    tools: profile.tools?.length ?? 0,
    caseStudies: profile.caseStudies?.length ?? 0,
  }
}
