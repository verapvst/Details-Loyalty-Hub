// Shared reference data: team members and dropdown picklists.
// Keep wording exact — it must match the historical Excel data-validation lists.

export const TEAM_MEMBERS = ['André', 'Alice', 'Cá', 'Chica', 'Maria', 'Vera'];

// Shown pinned at the top of the Country dropdown, in this order — the markets this
// project benchmarks most often. Everything else follows alphabetically below them.
export const PINNED_COUNTRIES = ['Portugal', 'United States', 'United Kingdom', 'Spain', 'France'];

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
  geography_market: [
    'Portugal', 'Iberia', 'Southern Europe', 'Western Europe', 'Europe (other)',
    'North America', 'Middle East', 'Asia-Pacific', 'Global', 'Other'
  ],
  industry: [
    'Hotels & Hospitality', 'Golf', 'Airlines & Travel', 'Luxury', 'Retail',
    'Banking & Financial Services (incl. Credit Cards)', 'Fitness & Wellness',
    'Restaurants & F&B', 'Automotive', 'Entertainment & Media',
    "Private Members' Clubs", 'Subscription Businesses', 'Other'
  ],
  programme_type: [
    'Points-based', 'Tier-based', 'Cashback-based', 'Paid membership', 'Subscription',
    'Coalition / partner ecosystem', 'Hybrid', 'Other', 'None'
  ],
  membership_model: [
    'Open / automatic enrolment', 'Application-based', 'Invitation-only', 'Fee-based'
  ],
  free_vs_paid: ['Free', 'Paid', 'Freemium / hybrid'],
  fee_range: [
    'Free (no paid tier)', 'Under EUR10/mo', 'EUR10-25/mo', 'EUR25-50/mo', 'EUR50-100/mo',
    'EUR100+/mo', 'Other'
  ],
  main_target_customer: [
    'Mass market', 'Affluent / premium', 'High-net-worth', 'Frequent traveller',
    'Young / next-gen', 'Family', 'Corporate / B2B', 'Niche enthusiast', 'Other'
  ],
  programme_positioning: ['Mass', 'Mid-market', 'Premium', 'Luxury'],
  benefit: [
    'Free product/nights/service credit', 'Discounts', 'Upgrades', 'Priority access',
    'Complimentary services', 'Access/exclusivity (lounge, members-only)',
    'Experiences/events', 'Personalised benefits', 'Partner/cross-brand benefits',
    'Other', 'None'
  ],
  discount_type: [
    'Percentage discount', 'Fixed discount', 'Member-only pricing', 'Tier-based discount',
    'Preferential pricing', 'None'
  ],
  tier_qualification_basis: [
    'Spend', 'Nights/visits', 'Points accumulated', 'Invitation-only', 'Fee-based', 'Other'
  ],
  single_brand_vs_ecosystem: [
    'Single-brand', 'Cross-brand within group', 'Cross-industry ecosystem',
    'Coalition (multi-company, shared currency)'
  ],
  relevance_to_details: ['Low', 'Medium', 'High'],
  meeting_type: ['Client', 'Group', 'Professor'],
  // The tasks.status column has a pre-existing database CHECK constraint allowing only
  // these three machine values — the labels are just how they're shown in the UI.
  task_status: [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' }
  ],
  task_type: ['Task', 'Deliverable']
};

// Drives both the Add Programme form and the record-sheet view/edit layout,
// so field metadata (label, input type, dropdown source) lives in one place.
export const PROGRAMME_FIELDS = [
  { section: 'Identity', fields: [
    { key: 'programme_name', label: 'Programme Name', type: 'text', required: true },
    { key: 'company', label: 'Company', type: 'text', required: true },
    { key: 'parent_company', label: 'Parent Company', type: 'text' },
    { key: 'country', label: 'Country', type: 'select', options: 'country' },
    { key: 'geography_market', label: 'Geography / Market', type: 'select', options: 'geography_market' },
    { key: 'industry', label: 'Industry', type: 'select', options: 'industry' },
    { key: 'sub_industry', label: 'Sub-Industry', type: 'text' },
    { key: 'cover_image_url', label: 'Cover Image URL', type: 'text', full: true }
  ]},
  { section: 'Programme Type & Model', fields: [
    { key: 'primary_programme_type', label: 'Primary Programme Type', type: 'select', options: 'programme_type' },
    { key: 'secondary_programme_type', label: 'Secondary Programme Type', type: 'select', options: 'programme_type' },
    { key: 'membership_model', label: 'Membership Model', type: 'select', options: 'membership_model' },
    { key: 'free_vs_paid', label: 'Free vs Paid', type: 'select', options: 'free_vs_paid' }
  ]},
  { section: 'Target & Positioning', fields: [
    { key: 'main_target_customer', label: 'Main Target Customer', type: 'select', options: 'main_target_customer' },
    { key: 'target_customer_notes', label: 'Target Customer Notes', type: 'textarea', full: true },
    { key: 'programme_positioning', label: 'Programme Positioning', type: 'select', options: 'programme_positioning' }
  ]},
  { section: 'Offer & Benefits', fields: [
    { key: 'main_core_offer', label: 'Main Core Offer', type: 'textarea', full: true },
    { key: 'primary_benefit', label: 'Primary Benefit', type: 'select', options: 'benefit' },
    { key: 'secondary_benefit', label: 'Secondary Benefit', type: 'select', options: 'benefit' },
    { key: 'tertiary_benefit', label: 'Tertiary Benefit', type: 'select', options: 'benefit' },
    { key: 'discount_type', label: 'Discount Type', type: 'select', options: 'discount_type' }
  ]},
  { section: 'Tier Structure', fields: [
    { key: 'number_of_tiers', label: 'Number of Tiers', type: 'number' },
    { key: 'tier_qualification_basis', label: 'Tier Qualification Basis', type: 'select', options: 'tier_qualification_basis' },
    { key: 'single_brand_vs_ecosystem', label: 'Single-Brand vs Ecosystem', type: 'select', options: 'single_brand_vs_ecosystem' },
    { key: 'number_of_fee_tiers', label: 'Number of Fee Tiers', type: 'number' },
    { key: 'fee_range', label: 'Fee Range', type: 'select', options: 'fee_range' }
  ]},
  { section: 'Partners & Value Flow', fields: [
    { key: 'partner_companies', label: 'Partner Companies', type: 'textarea', full: true },
    { key: 'primary_partner_industry', label: 'Primary Partner Industry', type: 'select', options: 'industry' },
    { key: 'secondary_partner_industry', label: 'Secondary Partner Industry', type: 'select', options: 'industry' },
    { key: 'how_value_moves', label: 'How Value Moves', type: 'textarea', full: true }
  ]},
  { section: 'Strategic Notes', fields: [
    { key: 'key_differentiator', label: 'Key Differentiator', type: 'textarea', full: true },
    { key: 'relevance_to_details', label: 'Relevance to Details', type: 'select', options: 'relevance_to_details' },
    { key: 'sources', label: 'Sources', type: 'textarea', full: true },
    { key: 'date_checked', label: 'Date Checked', type: 'date' }
  ]}
];

export const SOURCE_FIELDS = [
  { key: 'citation_tag', label: 'Citation Tag', type: 'text', required: true },
  { key: 'full_citation', label: 'Full Citation', type: 'textarea', full: true, required: true },
  { key: 'link_or_path', label: 'Link or Path (paste a URL to show a "Visit Website" button)', type: 'text', full: true }
];

// source_id is added dynamically once sources are loaded (see figures.js)
export const FIGURE_FIELDS = [
  { key: 'market', label: 'Market', type: 'text', required: true },
  { key: 'statistic', label: 'Statistic', type: 'textarea', full: true, required: true },
  { key: 'value', label: 'Value', type: 'text', required: true }
];

export const MEETING_FIELDS = [
  { key: 'title', label: 'Meeting Title', type: 'text', required: true },
  { key: 'meeting_type', label: 'Type', type: 'select', options: 'meeting_type', required: true },
  { key: 'meeting_date', label: 'Date', type: 'date', required: true },
  { key: 'meeting_time', label: 'Time', type: 'time' },
  { key: 'notes', label: 'Notes', type: 'textarea', full: true }
];

export const TASK_FIELDS = [
  { key: 'title', label: 'Task Title', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea', full: true },
  { key: 'due_date', label: 'Due Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: 'task_status', required: true },
  { key: 'task_type', label: 'Task Type', type: 'select', options: 'task_type', required: true }
];
