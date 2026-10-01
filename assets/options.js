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

// ---------------- Scorecard taxonomies (14 mechanisms, 18 benefits) ----------------
// Source of truth: METHODOLOGY/Scorecards (Mechanisms_Scorecard_FINAL.xlsx, Benefits Scorecard.xlsx),
// list confirmed by the team on 2026-10-01. Mechanisms answer "how do you unlock the benefits";
// benefits answer "what does the member get". These REPLACE the v3 mechanisms (11) for coding and
// analysis; v3 values stay on programmes.mechanisms / programmes.benefits as read-only legacy
// for reference while programmes are recoded (see supabase/032_taxonomy_14_18.sql).
// Scores and tiers are deliberately NOT stored here: the scorecard owns them.
export const MECHANISMS_14 = [
  { name: "Paid Subscription", family: "Tiers", definition: "Access to the tier is unlocked by paying a fixed subscription/fee, with no need to reach any spend or frequency threshold" },
  { name: "Spending at Brand/Partners - Temporary", family: "Tiers", definition: "Spend X per year (own brand or/and partners) to obtain or maintain the tier; not cumulative - requires annual requalification" },
  { name: "Spending at Brand/Partners - Lifetime & Cumulative", family: "Tiers", definition: "The tier advances as more money is accumulated over time (own brand or/and partners); once a threshold is reached, it is never lost" },
  { name: "Accumulated by Spending (redeemable for spending)", family: "Points", definition: "Points accumulated by spending (own brand or/and partners), redeemable for spending on products/services - the classic \"earn & burn\" model" },
  { name: "Accumulated by Actions (redeemable for spending)", family: "Points", definition: "Points accumulated through non-spend actions (e.g., completing a survey, visiting a partner's store, creating an account, donating to an NGO, etc etc), redeemable for spending" },
  { name: "Do X, Get Y", family: "Points", definition: "Includes classic punch-card-style loyalty mechanism: buy X units and receive 1 free, do x times an activity and unlock y (e.g., go to all 5 golf courses in the region and get to visit one for free or an experience)" },
  { name: "Newsletter, Email, Phone", family: "Free enrolment", definition: "Free enrollment by sharing contact details (newsletter, email or phone), with no need to create an account" },
  { name: "Create Account (e.g. Card, App, automatic, etc)", family: "Free enrolment", definition: "Enrollment through creating an account, for example in the brand's app or issuance of a physical or digital membership card" },
  { name: "Missions/Gamification", family: "Missions / Gamification", definition: "Access or progression unlocked by completing missions or gamified challenges, strictly with non-redeemable progression, such as badges, levels or unlocks status only, with no tangible value or monetary/experiential value." },
  { name: "Referral", family: "Referral & Invite", definition: "Benefit unlocked by referring a new member" },
  { name: "Invite", family: "Referral & Invite", definition: "Benefit unlocked by being invited by an existing member of the loyalty" },
  { name: "Ambassador", family: "Ambassador", definition: "Status granted to selected members to represent the brand, typically by invitation/curation from the company" },
  { name: "Access by Ownership", family: "Access by ownership", definition: "Access to the programme granted through ownership of an asset (eg, a residential property in the portfolio)" },
  { name: "Tenure / Legacy Recognition", family: "Tenure / Legacy", definition: "Status or perks earned simply by years as a member, rewarding relationship and belonging over transactions" },
];
export const MECHANISM14_FAMILIES = [...new Set(MECHANISMS_14.map(m => m.family))];

export const BENEFITS_18 = [
  { name: "Upgrades & Complimentary Offers", examples: "Automatic Room/Suite Upgrade; Complimentary Welcome Amenity; Complimentary Night / Round After Streak" },
  { name: "Service Exclusivity & Priority Access", examples: "Dedicated Concierge / Named Contact; Guaranteed Reservation (No Waitlist); Priority Service Line" },
  { name: "Experiential Exclusivity", examples: "Access to Member-Only Events; Access to Exclusive Facilities; Curated Experience Catalogue Access" },
  { name: "Convenience Benefits", examples: "Late Checkout / Early Check-in; Complimentary Parking / Valet; Fast-Track Check-in / Check-out" },
  { name: "Community & Networking", examples: "Member Directory / Networking Access; Alumni / Legacy Community Access" },
  { name: "Partner Benefits", examples: "Curated External Partner Perks; Reciprocal Travel Partner Benefits" },
  { name: "Flexibility & Credit", examples: "No Blackout Dates; Credit / Points Rollover; Annual Resort / F&B Statement Credit" },
  { name: "Social / Transferable Benefits", examples: "Guest Privileges; Status or Credit Gifting; Bring a friend" },
  { name: "Personalised Gifts", examples: "Birthday / Anniversary Gift; Milestone Gift" },
  { name: "Personalisation", examples: "Personalised Recommendations; Tailored Communications & Offers; Preference-Based Service Delivery" },
  { name: "Points Inflation", examples: "Extra points when spending at the brand; higher earning rate at premium assets; extra points when using multiple services; bonus points for cross-asset spending" },
  { name: "Family Benefits", examples: "Family Membership Extension; Family Programming Access" },
  { name: "Cashback / Direct Discounts / Coupons", examples: "Member-Rate Discount; Cash-Equivalent Account Credit" },
  { name: "Early Access", examples: "Tier-Based Priority Booking Window; Paid Early-Access Unlock" },
  { name: "Sustainability & Charitable Giving", examples: "Points-to-Donation Conversion; Sustainable-Choice Recognition Credit" },
  { name: "Proprietary Credit Card Benefits", examples: "Card Purchase Protection & Travel Insurance; Card-Exclusive Statement Credits" },
  { name: "AI-Powered Benefits", examples: "AI Concierge / Trip Planning Assistant; AI-Curated Personal Offers" },
  { name: "Sweepstakes, Contests & Prize Draws", examples: "Automatic Entry into Prize Draws; Challenge-Linked Contest Entry" },
];

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
  benefits18: BENEFITS_18.map(b => b.name),
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

// Analytical ordering for Mechanisms: from more transactional to more experiential.
// Used in ALL analysis (cards, charts, heatmaps, trends); only picklists stay
// alphabetical (OPTIONS.mechanisms). It is a reading convention, not a measured score:
// Reach (partners, ecosystem) and Referral sit where their typical value type sits.
export const MECHANISM_ANALYTICAL_ORDER = [
  'Member pricing', 'Spend-based earning', 'External partner network',
  'Included member benefits', 'Ecosystem cross-use', 'Behaviour-based rewards',
  'Referral', 'Earned status', 'Privileged access', 'Member experiences & events',
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
