// Shared reference data: dropdown picklists.
// Keep wording exact — it must match the staging workbook's Pick Lists sheet.
// Team members live in the team_members table now (see teamMembers.js) so the team
// can Add/Deactivate themselves from Settings — no hardcoded array here any more.

// Shown pinned at the top of the Country dropdown, in this order — the markets this
// project benchmarks most often. This is only the code-shipped DEFAULT; Settings can
// override the actual order via app_settings ('pinned_countries') — see appSettings.js.
export const PINNED_COUNTRIES = ['Portugal', 'United States', 'United Kingdom', 'Spain', 'France'];

// Data & Insights / Sources: "what is this about" — separate from Source Type / Insight
// Type, which answer "what kind of source/information is this". Flat for v1 (no sub-scope).
// A Source's Scope is set once and Insights snapshot-copy it at creation, staying editable.
export const SCOPE_GROUPS = {
  'Market / Industry': [
    'Tourism', 'Hospitality', 'Golf', 'Food & Beverage', 'Sports & Leisure',
    'Travel & Transportation', 'Retail'
  ],
  'Loyalty': [
    'Loyalty Programmes', 'Consumer Behaviour', 'Loyalty Strategy', 'Loyalty Economics', 'Loyalty Technology'
  ],
  'Company / Internal': ['Details', 'Customer / Consumer', 'Portfolio / Assets']
};
export const SCOPE_OTHER = 'Other';
export const ALL_SCOPE_VALUES = [...Object.values(SCOPE_GROUPS).flat(), SCOPE_OTHER];

// Shared team dictionary so everyone classifies Data & Insights the same way —
// surfaced as hover tooltips next to the Type field/legend, never a separate page.
export const INSIGHT_TYPE_DEFINITIONS = {
  'Statistic': 'A specific quantitative data point.',
  'Market Fact': 'A factual condition about a market or industry that is not necessarily quantitative.',
  'Key Finding': 'A substantive conclusion or insight reported by the source, beyond a standalone fact or statistic.',
  'Relationship': 'A documented relationship between concepts, variables or behaviours.',
  'Framework': 'A conceptual model or structured way of analysing a topic.',
  'Strategic Implication': 'What a finding may imply for strategy or decision-making.',
  'Benchmark': 'Explicitly comparative information involving companies, programmes, markets or practices.',
  'Figure': 'A diagram, chart, map or other visual that is the evidence itself, not just an illustration of a text finding.',
  'Table': 'Structured tabular data best preserved as-is (e.g. a comparison table from a report) rather than re-typed.',
  'Other': 'Information that does not clearly fit any of the categories above.'
};

export const OPTIONS = {
  country: [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
    'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
    'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
    'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon',
    'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
    'Congo (DRC)', 'Congo (Republic)', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia',
    'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador',
    'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
    'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea',
    'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India',
    'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
    'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
    'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi',
    'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
    'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
    'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
    'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
    'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
    'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
    'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
    'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa',
    'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
    'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
    'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
    'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
    'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe', 'Other'
  ],
  // Industries (taxonomy review 2026-09): 9 analytical industries, sized for comparison.
  // Leisure destinations (ski, parks) sit in Leisure & Entertainment, consumer packaged
  // goods sit in Retail (not Food & Beverage), education sits in Leisure & Entertainment.
  industry: [
    'Hotels & Hospitality', 'Golf', 'Food & Beverage', 'Fitness & Wellness',
    'Leisure & Entertainment', 'Automotive', 'Travel & Mobility', 'Retail',
    'Banking & Financial Services', 'Other'
  ],
  // Data & Insights: what KIND of information this is (see INSIGHT_TYPE_DEFINITIONS
  // below for the shared team definitions) — orthogonal to Scope, which is what it's about.
  insight_type: [
    'Statistic', 'Market Fact', 'Key Finding', 'Relationship', 'Framework', 'Strategic Implication', 'Benchmark', 'Figure', 'Table', 'Other'
  ],
  // Sources: "what kind of source is this" — separate from Scope ("what is it about").
  source_type: [
    'Academic Article', 'Industry Report', 'Company Report', 'Consulting Report',
    'Market Report', 'Book / Book Chapter', 'News / Media', 'Website', 'Other'
  ],
  programme_positioning: ['Mass', 'Mid-market', 'Premium', 'Luxury'],
  target_customer: [
    'Mass Market', 'Families', 'Students', 'Young Adults', 'Professionals',
    'Business Customers', 'High-Value Customers', 'Frequent Customers',
    'Price-Sensitive Customers', 'Enthusiasts / Hobbyists', 'Local Customers',
    'International Customers', 'Premium / Luxury Customers', 'Other'
  ],
  geographic_scope: [
    'Portugal', 'Europe', 'North America', 'Latin America & Caribbean',
    'Middle East', 'Africa', 'Asia', 'Oceania', 'Global'
  ],
  membership_type: ['Free', 'Paid', 'Subscription', 'Hybrid', 'Other'],
  access_registration: [
    'Open registration', 'Application required', 'Request membership',
    'Invitation only', 'Referral required'
  ],
  // Issue Tree: Vertical/Audience relevance tags on an Issue node — attributes of the
  // strategic question, not a branching structure (an Issue can touch several, or
  // none). Ideas themselves carry no classification at all — see brainstormIdeas.js.
  brainstorm_vertical: ['Hospitality', 'Golf', 'Sports & Leisure', 'Food & Beverages'],
  brainstorm_audience: ['B2C', 'B2B', 'B2B2C'],
  // Mechanisms (taxonomy review 2026-09, v3): what the programme structurally does to
  // create value or change behaviour. Benefits (what the customer receives) and feelings
  // (exclusivity, belonging, "money can't buy") are NOT mechanisms. 11 mechanisms in
  // 6 dimensions (see MECHANISM_ANALYTICAL_ORDER). Old -> new mapping and coding rules:
  // migration/remap_mechanisms_v3.md.
  mechanisms: [
    'Behaviour-based rewards', 'Community', 'Earned status', 'Ecosystem cross-use',
    'External partner network', 'Included member benefits', 'Member experiences & events',
    'Member pricing', 'Privileged access', 'Referral', 'Spend-based earning'
  ],
  discount_type: [
    'Percentage discount', 'Fixed discount', 'Member-only pricing', 'Tiered discount',
    'Preferential pricing', 'None'
  ],
  currency: ['EUR', 'USD', 'GBP', 'Other'],
  qualification_unit: [
    'Spend (EUR)', 'Nights', 'Points', 'Events attended', 'Transactions',
    'Automatic / No qualification', 'Invitation only', 'Other'
  ],
  yes_no: ['Yes', 'No'],
  // The Favorites/Likes annotation layer's controlled psychology taxonomy.
  // Deliberately kept lean — revisit only once real liked data has accumulated.
  psychological_effect: [
    'Anchoring', 'Loss Aversion', 'Social Proof', 'Scarcity', 'Status / Signalling',
    'Switching Costs / Lock-in', 'Goal-Gradient', 'Variable Reward', 'Convenience', 'Reciprocity'
  ],
  meeting_type: ['Team', 'Professor', 'Client'],
  meeting_format: ['Online', 'In-person'],
  // The tasks.status column has a database CHECK constraint allowing only these four
  // machine values (see 009_calendar_and_milestones.sql) — the labels are just how
  // they're shown in the UI. 'cancelled' keeps a cancelled occurrence visible/muted
  // rather than deleting it.
  task_status: [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
    { value: 'cancelled', label: 'Cancelled' }
  ],
  task_type: ['Task', 'Deliverable'],
  milestone_type: [
    { value: 'deadline', label: 'Deadline' },
    { value: 'steering', label: 'Steering' },
    { value: 'presentation', label: 'Presentation' }
  ],
  milestone_precision: [
    { value: 'exact', label: 'Exact date' },
    { value: 'window', label: 'Approximate window' },
    { value: 'tbd', label: 'TBD' }
  ],
  question_status: [
    { value: 'open', label: 'Open' },
    { value: 'answered', label: 'Answered' }
  ]
};

// Analytical ordering for Mechanisms, used ONLY in analysis (heatmaps, co-occurrence,
// Mechanics Lab); data entry and filters stay alphabetical. Grouped by dimension, not a
// single transactional -> experiential ladder:
//   Earning (how value is earned) · Value delivered · Progression · Reach · Acquisition · Belonging
export const MECHANISM_ANALYTICAL_ORDER = [
  'Spend-based earning', 'Behaviour-based rewards',
  'Member pricing', 'Included member benefits', 'Privileged access', 'Member experiences & events',
  'Earned status',
  'Ecosystem cross-use', 'External partner network',
  'Referral',
  'Community'
];

export const MECHANISM_DIMENSIONS = {
  'Spend-based earning': 'Earning', 'Behaviour-based rewards': 'Earning',
  'Member pricing': 'Value delivered', 'Included member benefits': 'Value delivered',
  'Privileged access': 'Value delivered', 'Member experiences & events': 'Value delivered',
  'Earned status': 'Progression',
  'Ecosystem cross-use': 'Reach', 'External partner network': 'Reach',
  'Referral': 'Acquisition',
  'Community': 'Belonging'
};

// ---------------- Programme form structure ----------------
// Simple fields (no conditional logic) — driven generically like other forms.
// Mechanisms/Benefits/Tiers/Features have bespoke rendering (progressive disclosure,
// repeatable rows) and are handled directly in database.js / programme.js.

export const PROGRAMME_IDENTITY_FIELDS = [
  { key: 'programme_name', label: 'Programme Name', type: 'text', required: true },
  { key: 'company', label: 'Company', type: 'text', required: true },
  { key: 'parent_company', label: 'Parent Company', type: 'text' },
  { key: 'cover_image_url', label: 'Logo / Image URL', type: 'text', full: true },
  { key: 'launch_year', label: 'Launch Year', type: 'number' }
];

export const PROGRAMME_CLASSIFICATION_FIELDS = [
  { key: 'industry', label: 'Industry', type: 'select', options: 'industry', required: true },
  { key: 'programme_positioning', label: 'Programme Positioning', type: 'select', options: 'programme_positioning' }
];

export const PROGRAMME_GEOGRAPHY_FIELDS = [
  { key: 'country', label: 'Company Country', type: 'select', options: 'country', required: true }
];

export const PROGRAMME_MEMBERSHIP_FIELDS = [
  { key: 'membership_type', label: 'Membership Type', type: 'select', options: 'membership_type', required: true },
  { key: 'access_registration', label: 'Access / Registration', type: 'select', options: 'access_registration', required: true }
];

export const PROGRAMME_SOURCE_FIELDS = [
  { key: 'source_url', label: 'Source / Programme URL', type: 'text', full: true }
];

// Short/Full Citation are generated from the fields above but stay fully editable —
// a starting point, not a strict citation-formatting engine (see generateCitations() below).
// Scope is rendered separately as grouped checkboxes (see scopeCheckboxGroupsHTML in fields.js).
export const SOURCE_FIELDS = [
  { key: 'source_name', label: 'Article / Source Name', type: 'text', full: true, required: true },
  { key: 'author_org', label: 'Author / Organisation', type: 'text', required: true },
  { key: 'year', label: 'Year', type: 'number', required: true },
  { key: 'source_type', label: 'Source Type', type: 'select', options: 'source_type', required: true },
  { key: 'link_or_path', label: 'URL / DOI', type: 'text', full: true },
  { key: 'short_citation', label: 'Short Citation', type: 'text', full: true },
  { key: 'full_citation', label: 'Full Citation', type: 'textarea', full: true }
];

// A deliberately simple, generic citation generator — not a full citation-formatting
// engine. Always a starting point the researcher can edit, never force-regenerated
// over an existing hand-edited citation (see the "Regenerate" affordance in sources.js).
export function generateShortCitation({ author_org, year }) {
  if (!author_org) return '';
  return year ? `${author_org} (${year})` : author_org;
}

export function generateFullCitation({ source_name, author_org, year, source_type, link_or_path }) {
  if (!author_org || !source_name) return '';
  const yearPart = year ? ` (${year}).` : '.';
  const base = `${author_org}${yearPart} ${source_name}.`;
  // Industry/Company/Consulting/Market reports: the org is both author and publisher —
  // repeating it is expected in citation style. For everything else (academic articles,
  // books, news, websites) the publisher is unknown, so don't invent a duplicate.
  const repeatsPublisher = ['Industry Report', 'Company Report', 'Consulting Report', 'Market Report'];
  if (repeatsPublisher.includes(source_type)) return `${base} ${author_org}.`;
  if (source_type === 'Website' && link_or_path) return `${base} Retrieved from ${link_or_path}`;
  return base;
}

// source_id is added dynamically once sources are loaded (see figures.js). Scope is
// rendered separately as grouped checkboxes, inherited from the chosen Source at creation.
// title: short and searchable — what the main Data & Insights list shows. Required.
// insight_text ("Main Insight"): the concise, reusable takeaway — optional, rich text.
// supporting_detail ("Source Detail", column name unchanged): the longer extracted
// evidence — optional, rich text. Both stay actual `figures` columns; only the field
// labels/type changed, so no data was renamed or moved.
export const INSIGHT_FIELDS = [
  { key: 'title', label: 'Insight Title', type: 'text', full: true, required: true },
  { key: 'insight_type', label: 'Type', type: 'select', options: 'insight_type', required: true },
  { key: 'insight_text', label: 'Main Insight', type: 'richtext', full: true, minHeight: 100 },
  { key: 'supporting_detail', label: 'Source Detail', type: 'richtext', full: true, minHeight: 160 }
];

// format/location/online_link/participants are deliberately not here — they're
// rendered with bespoke conditional logic (see wireFormatToggle in tasks.js).
export const MEETING_FIELDS = [
  { key: 'title', label: 'Meeting Title', type: 'text', required: true },
  { key: 'meeting_type', label: 'Type', type: 'select', options: 'meeting_type', required: true },
  { key: 'meeting_date', label: 'Date', type: 'date', required: true },
  { key: 'meeting_time', label: 'Start Time', type: 'time' },
  { key: 'end_time', label: 'End Time', type: 'time' },
  { key: 'notes', label: 'Notes', type: 'textarea', full: true }
];

export const TASK_FIELDS = [
  { key: 'title', label: 'Task Title', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea', full: true },
  { key: 'due_date', label: 'Due Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: 'task_status', required: true },
  { key: 'task_type', label: 'Task Type', type: 'select', options: 'task_type', required: true }
];
