// Shared reference data: team members and dropdown picklists.
// Keep wording exact — it must match the historical Excel data-validation lists.

export const TEAM_MEMBERS = ['André', 'Alice', 'Cá', 'Chica', 'Maria', 'Vera'];

export const OPTIONS = {
  country: [
    'Portugal', 'Spain', 'United Kingdom', 'France', 'Germany', 'Italy', 'Netherlands',
    'Belgium', 'Ireland', 'Switzerland', 'Austria', 'Sweden', 'Denmark', 'Norway',
    'United States', 'Canada', 'United Arab Emirates', 'Qatar', 'Singapore', 'Hong Kong',
    'Japan', 'China', 'Brazil', 'Other'
  ],
  geography_market: [
    'Portugal', 'Iberia', 'Southern Europe', 'Western Europe', 'Europe (other)',
    'North America', 'Middle East', 'Asia-Pacific', 'Global', 'Other'
  ],
  industry: [
    'Hotels & Hospitality', 'Golf', 'Airlines & Travel', 'Luxury', 'Retail',
    'Banking & Financial Services', 'Credit Cards', 'Fitness & Wellness',
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
  relevance_to_details: ['Low', 'Medium', 'High']
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
    { key: 'sub_industry', label: 'Sub-Industry', type: 'text' }
  ]},
  { section: 'Programme Type & Model', fields: [
    { key: 'primary_programme_type', label: 'Primary Programme Type', type: 'select', options: 'programme_type' },
    { key: 'secondary_programme_type', label: 'Secondary Programme Type', type: 'select', options: 'programme_type' },
    { key: 'membership_model', label: 'Membership Model', type: 'select', options: 'membership_model' },
    { key: 'free_vs_paid', label: 'Free vs Paid', type: 'select', options: 'free_vs_paid' },
    { key: 'number_of_fee_tiers', label: 'Number of Fee Tiers', type: 'number' },
    { key: 'fee_range', label: 'Fee Range', type: 'select', options: 'fee_range' }
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
    { key: 'single_brand_vs_ecosystem', label: 'Single-Brand vs Ecosystem', type: 'select', options: 'single_brand_vs_ecosystem' }
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
