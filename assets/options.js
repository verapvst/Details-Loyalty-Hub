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

// ---------------- Scorecard taxonomies (14 mechanisms, 16 benefits) ----------------
// Source of truth: Steering 1 (Oct 2026) and METHODOLOGY/Scorecards (Mechanisms_Scorecard.xlsx,
// Benefits_Scorecard.xlsx). Names, families and definitions are exactly the ones on the steering slides.
// Mechanisms answer "how do you unlock the benefits"; benefits answer "what does the member get".
// The database columns are still called programmes.mechanisms_14 / programmes.benefits_18 (no schema
// change); benefits_18 holds the 16 steering benefits.
export const MECHANISMS_14 = [
  { name: "Paid Subscription", family: "Tiers", definition: "Access to the tier is unlocked by paying a fixed subscription/fee, with no need to reach any spend/frequency threshold" },
  { name: "Temporary for Spending", family: "Tiers", definition: "Spend X per year (own brand or/and partners) to obtain or maintain the tier, requiring annual requalification" },
  { name: "Lifetime for Spending", family: "Tiers", definition: "Tier advances as money is accumulated over time (brand or/and partners); once a threshold is reached, it is never lost" },
  { name: "Accumulated by Spending", family: "Points", definition: "Points accumulated by spending (brand or/and partners) on products/services, e.g. through a brand credit card" },
  { name: "Accumulated by Actions", family: "Points", definition: "Points accumulated through non-spend actions (e.g. completing a survey, visiting a store), redeemable for spending" },
  { name: "Do X, Get Y", family: "Points", definition: "Includes classic buy X units and receive 1 free, do X times an activity and unlock Y (e.g. discount or experience)" },
  { name: "Newsletter, Email, Phone", family: "Free enrolment", definition: "Free enrolment by sharing contact details (newsletter, email or phone), with no need to create an account" },
  { name: "Create Account", family: "Free enrolment", definition: "Enrolment through creating an account, for example in the brand's app, or issuance of a physical/digital card" },
  { name: "Missions / Gamification", family: "Missions / Gamification", definition: "Progression unlocked by completing missions, with non-redeemable progression, such as badges or levels" },
  { name: "Referral", family: "Outreach", definition: "Benefit unlocked by referring a new member" },
  { name: "Invite", family: "Outreach", definition: "Benefit unlocked by being invited by an existing member of the loyalty programme or by the company" },
  { name: "Ambassador", family: "Outreach", definition: "Status granted to selected members to represent the brand, typically by invitation/curation from the company" },
  { name: "Access by Ownership", family: "Recognition", definition: "Access to the programme granted through ownership of an asset (e.g. a residential property in the portfolio)" },
  { name: "Tenure / Legacy Recognition", family: "Recognition", definition: "Status or perks earned simply by years as a member, rewarding relationship and belonging over transactions" },
];
export const MECHANISM14_FAMILIES = [...new Set(MECHANISMS_14.map(m => m.family))];

export const BENEFITS_16 = [
  { name: "Savings", family: "Financial & Commercial", examples: "Direct monetary savings (e.g. member-rate discount, cashback, coupons)" },
  { name: "Points Inflation", family: "Financial & Commercial", examples: "Accelerated earn rates and multipliers to drive spend volume" },
  { name: "Flexibility & Credit", family: "Financial & Commercial", examples: "Liquidity solutions and credit advances that eliminate barriers to booking (e.g. no blackout dates, points rollover)" },
  { name: "Partner Benefits", family: "Financial & Commercial", examples: "Alliances with external brands" },
  { name: "Contests & Prize Draws", family: "Financial & Commercial", examples: "Gamified opportunities offering chances to win prizes (e.g. automatic entry into prize draws)" },
  { name: "Upgrades & Complementary", family: "Stay & Convenience", examples: "Complimentary service or tier elevations (e.g. automatic room upgrade, complimentary welcome amenity)" },
  { name: "Convenience", family: "Stay & Convenience", examples: "Perks to save time (e.g. late checkout / early check-in, complimentary parking / valet)" },
  { name: "AI-powered", family: "Stay & Convenience", examples: "AI-driven automation for planning, discovery and assistance" },
  { name: "Service Exclusivity", family: "Exclusivity", examples: "Privileged access to dedicated service, priority channels and enhanced availability (e.g. dedicated concierge, reservation with no waitlist, priority service line, early access)" },
  { name: "Extra-service Exclusivity", family: "Exclusivity", examples: "Access to restricted events and spaces" },
  { name: "Community & Networking", family: "Community", examples: "Platforms and events fostering networking and belonging among brand members" },
  { name: "Social / Transferable", family: "Community", examples: "Extension of privileges with guests (e.g. bring a friend)" },
  { name: "Family", family: "Community", examples: "Multi-user access extending perks to immediate family" },
  { name: "ESG Donation", family: "Impact", examples: "Options to convert value into ESG impact or reward sustainable choices" },
  { name: "Personalization", family: "Recognition & Personalization", examples: "Tailored communications and adaptive services shaped by preferences (e.g. personalized recommendations, choice of offers)" },
  { name: "Personalized Gifts", family: "Recognition & Personalization", examples: "Tangible recognition items (e.g. birthday gift, milestone gift)" },
];
export const BENEFIT_FAMILIES = [...new Set(BENEFITS_16.map(b => b.family))];

// Scorecard results shown in Steering 1 (weighted score, rank, tier). Tier cut-offs are the mean of the
// totals +/- 0.5 SD, so tiers are relative to the 14 mechanisms / 16 benefits compared.
export const SCORECARD_MECHANISMS = {
  "Lifetime for Spending": { score: 10.19, rank: 1, tier: "Prioritize" },
  "Tenure / Legacy Recognition": { score: 9.21, rank: 2, tier: "Prioritize" },
  "Temporary for Spending": { score: 8.94, rank: 3, tier: "Prioritize" },
  "Accumulated by Spending": { score: 8.74, rank: 4, tier: "Prioritize" },
  "Do X, Get Y": { score: 8.59, rank: 5, tier: "Prioritize" },
  "Create Account": { score: 8.26, rank: 6, tier: "Consider" },
  "Newsletter, Email, Phone": { score: 8.01, rank: 7, tier: "Consider" },
  "Paid Subscription": { score: 7.99, rank: 8, tier: "Consider" },
  "Access by Ownership": { score: 7.31, rank: 9, tier: "Consider" },
  "Referral": { score: 6.61, rank: 10, tier: "Exclude" },
  "Invite": { score: 6.23, rank: 11, tier: "Exclude" },
  "Ambassador": { score: 5.89, rank: 12, tier: "Exclude" },
  "Missions / Gamification": { score: 5.29, rank: 13, tier: "Exclude" },
  "Accumulated by Actions": { score: 3.74, rank: 14, tier: "Exclude" },
};
export const SCORECARD_BENEFITS = {
  "Family": { score: 12.71, rank: 1, tier: "Prioritize" },
  "Social / Transferable": { score: 11.11, rank: 2, tier: "Prioritize" },
  "Personalization": { score: 10.06, rank: 3, tier: "Prioritize" },
  "Convenience": { score: 9.56, rank: 4, tier: "Prioritize" },
  "Community & Networking": { score: 9.40, rank: 5, tier: "Consider" },
  "Extra-service Exclusivity": { score: 9.04, rank: 6, tier: "Consider" },
  "Partner Benefits": { score: 8.83, rank: 7, tier: "Consider" },
  "Flexibility & Credit": { score: 8.69, rank: 8, tier: "Consider" },
  "AI-powered": { score: 8.20, rank: 9, tier: "Consider" },
  "ESG Donation": { score: 8.00, rank: 10, tier: "Consider" },
  "Service Exclusivity": { score: 7.86, rank: 11, tier: "Consider" },
  "Upgrades & Complementary": { score: 7.51, rank: 12, tier: "Exclude" },
  "Personalized Gifts": { score: 7.03, rank: 13, tier: "Exclude" },
  "Savings": { score: 6.73, rank: 14, tier: "Exclude" },
  "Points Inflation": { score: 5.91, rank: 15, tier: "Exclude" },
  "Contests & Prize Draws": { score: 5.36, rank: 16, tier: "Exclude" },
};

// Coding progress per programme while the Hub moves from the v3 taxonomy to the 14/18 one.
export const RECODE_STATUS = ['To recode', 'Suggested', 'Recoded', 'Verified'];

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
  // Industries (final, 2026-10): the first 7 are the Core Industries (ordered by relevance to Details' assets: Hotels, Golf,
  // Food & Beverage, Wellness, Beach, Marine, Nightlife); the rest are non-core, alphabetical. One industry per programme, no secondary.
  // Leisure destinations (ski, parks) sit in Leisure & Entertainment, consumer packaged
  // goods sit in Retail (not Food & Beverage), education sits in Leisure & Entertainment.
  industry: [
    'Hotels', 'Golf', 'Food & Beverage', 'Wellness', 'Beach', 'Marine', 'Nightlife',
    'Automotive', 'Banking & Financial Services', 'Leisure & Entertainment', 'Retail', 'Travel & Mobility',
    'Other'
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
  // Senior / Retiree added 2026-09 (age-dimension pass): golf-club membership and
  // cruise loyalty are the two segments in this dataset with well-documented older/
  // retiree-skewed demographics (NGF/R&A golfer-age data; cruise-industry age data) —
  // added for those, not applied speculatively elsewhere.
  target_customer: [
    'Mass Market', 'Families', 'Students', 'Young Adults', 'Professionals',
    'Business Customers', 'High-Value Customers', 'Frequent Customers',
    'Price-Sensitive Customers', 'Enthusiasts / Hobbyists', 'Local Customers',
    'International Customers', 'Premium / Luxury Customers', 'Senior / Retiree', 'Other'
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
  // New coding taxonomies (see MECHANISMS_14 / BENEFITS_18 / RECODE_STATUS below).
  mechanisms14: MECHANISMS_14.map(m => m.name),
  benefits18: BENEFITS_16.map(b => b.name),
  recode_status: RECODE_STATUS,
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

// Analytical ordering for Mechanisms: the 14 final scorecard mechanisms, in family order
// (Tiers, Points, Free enrolment, Missions, Referral & Invite, Ambassador, Ownership, Tenure).
// Used in ALL analysis (cards, charts, heatmaps, trends); only picklists stay alphabetical.
// Reading convention, not a measured score (the scorecard owns the scores).
export const MECHANISM_ANALYTICAL_ORDER = MECHANISMS_14.map(m => m.name);

export const MECHANISM_DIMENSIONS = {
  'Spend-based earning': 'Earning', 'Behaviour-based rewards': 'Earning',
  'Member pricing': 'Value delivered', 'Included member benefits': 'Value delivered',
  'Privileged access': 'Value delivered', 'Member experiences & events': 'Value delivered',
  'Earned status': 'Progression',
  'Ecosystem cross-use': 'Reach', 'External partner network': 'Reach',
  'Referral': 'Acquisition',
  'Community': 'Belonging'
};

// Spectrum colour: grey (transactional) to Details gold (experiential).
const SPECTRUM_FROM = [110, 110, 115]; // #6E6E73
const SPECTRUM_TO = [177, 143, 70];    // #B18F46
export const MECHANISM_SPECTRUM_GRADIENT = 'linear-gradient(90deg, #C7C7CC 0%, #B18F46 100%)';
export function mechanismSpectrumColor(name) {
  const i = MECHANISM_ANALYTICAL_ORDER.indexOf(name);
  if (i === -1) return null;
  const t = MECHANISM_ANALYTICAL_ORDER.length > 1 ? i / (MECHANISM_ANALYTICAL_ORDER.length - 1) : 0;
  const c = SPECTRUM_FROM.map((f, k) => Math.round(f + (SPECTRUM_TO[k] - f) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
export function sortByMechanismOrder(values) {
  const known = MECHANISM_ANALYTICAL_ORDER.filter(m => values.includes(m));
  const rest = values.filter(v => !MECHANISM_ANALYTICAL_ORDER.includes(v));
  return [...known, ...rest];
}


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

// Industries always read in the agreed order (core 7 by relevance to Details' assets, then non-core
// alphabetical, "Other" last), never as a frequency leaderboard.
export function sortByIndustryOrder(values) {
  const order = OPTIONS.industry;
  const known = order.filter(v => values.includes(v));
  return [...known, ...values.filter(v => !order.includes(v))];
}
