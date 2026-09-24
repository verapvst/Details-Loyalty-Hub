// Analysis tab — data loading + generic aggregation.
//
// Every function here is pure (dataset in, plain object out) and analytically
// disciplined: percentages always carry their denominator, missing values are
// counted and surfaced rather than silently dropped or zeroed, and multi-select
// fields (mechanisms, target_customer, geographic_scope) are never forced into
// mutually-exclusive buckets — a programme with 3 mechanisms contributes to 3
// counts, and percentages for these fields are allowed to exceed 100%.
import { supabase } from './supabase.js';
import { MECHANISM_ANALYTICAL_ORDER, sortByMechanismOrder } from './options.js';

// ---------------- Dimension registry ----------------
// Single place describing every field Analysis can group/filter/cross-tab by.
// `kind`: 'single' (scalar, mutually exclusive), 'multi' (array, non-exclusive),
// or 'time' (numeric, sorted by value not frequency).
export const DIMENSIONS = {
  industry: { label: 'Industry', kind: 'single', get: p => nonEmpty(p.industry) },
  programme_positioning: { label: 'Programme Positioning', kind: 'single', get: p => nonEmpty(p.programme_positioning) },
  membership_type: { label: 'Membership Type', kind: 'single', get: p => nonEmpty(p.membership_type) },
  access_registration: { label: 'Access / Registration', kind: 'single', get: p => nonEmpty(p.access_registration) },
  country: { label: 'Company Country', kind: 'single', get: p => nonEmpty(p.country) },
  geographic_scope: { label: 'Geographic Scope', kind: 'multi', get: p => arr(p.geographic_scope) },
  target_customer: { label: 'Target Customer', kind: 'multi', get: p => arr(p.target_customer) },
  mechanisms: { label: 'Mechanism', kind: 'multi', get: p => arr(p.mechanisms) },
  feature: { label: 'Feature', kind: 'multi', get: p => arr(p.programme_features).map(f => f.feature_name).filter(Boolean) },
  launch_year: { label: 'Launch Year', kind: 'time', get: p => (typeof p.launch_year === 'number' ? p.launch_year : null) }
};

function nonEmpty(v) { return (v === null || v === undefined || v === '') ? null : v; }
function arr(v) { return Array.isArray(v) ? v.filter(x => x !== null && x !== undefined && x !== '') : []; }
function valuesOf(dim, p) { return dim.kind === 'multi' ? dim.get(p) : (dim.get(p) === null ? [] : [dim.get(p)]); }

// ---------------- Load ----------------

let cachedDataset = null;

export async function loadAnalysisDataset({ force = false } = {}) {
  if (cachedDataset && !force) return cachedDataset;
  const { data, error } = await supabase
    .from('programmes')
    .select('*, programme_tiers(*), programme_features(*)')
    .order('programme_name', { ascending: true });
  if (error) throw error;
  cachedDataset = data || [];
  return cachedDataset;
}

export function getCachedDataset() {
  return cachedDataset || [];
}

// ---------------- Global filters ----------------
// filters: { industry:[], programme_positioning:[], membership_type:[],
//   country:[], geographic_scope:[], target_customer:[], access_registration:[],
//   yearMin:number|null, yearMax:number|null }
export function applyGlobalFilters(programmes, filters = {}) {
  return programmes.filter(p => {
    for (const key of ['industry', 'programme_positioning', 'membership_type', 'country', 'access_registration']) {
      const selected = filters[key];
      if (selected && selected.length && !selected.includes(p[key])) return false;
    }
    for (const key of ['geographic_scope', 'target_customer']) {
      const selected = filters[key];
      if (selected && selected.length) {
        const values = arr(p[key]);
        if (!selected.some(v => values.includes(v))) return false;
      }
    }
    // A year-range filter only excludes programmes that HAVE a launch year outside the
    // range — programmes with no recorded year are left alone rather than silently
    // dropped by a filter that isn't about them.
    if (typeof p.launch_year === 'number') {
      if (filters.yearMin != null && p.launch_year < filters.yearMin) return false;
      if (filters.yearMax != null && p.launch_year > filters.yearMax) return false;
    }
    return true;
  });
}

export function isFilterActive(filters = {}) {
  return ['industry', 'programme_positioning', 'membership_type', 'country', 'access_registration', 'geographic_scope', 'target_customer']
    .some(k => filters[k] && filters[k].length) || filters.yearMin != null || filters.yearMax != null;
}

// ---------------- Core aggregation ----------------

// Groups programmes by a dimension's values, tracking both programme count and
// distinct company count per group. Programmes with no value for the dimension are
// counted in `missingProgrammes`, never assigned a fake bucket.
export function aggregateByDimension(programmes, dimKey) {
  const dim = DIMENSIONS[dimKey];
  const groups = new Map();
  let missingProgrammes = 0;
  programmes.forEach(p => {
    const values = valuesOf(dim, p);
    if (!values.length) { missingProgrammes++; return; }
    values.forEach(v => {
      if (!groups.has(v)) groups.set(v, { programmeCount: 0, companies: new Set() });
      const g = groups.get(v);
      g.programmeCount++;
      if (p.company) g.companies.add(p.company);
    });
  });
  return { groups, total: programmes.length, missingProgrammes, multiSelect: dim.kind === 'multi', kind: dim.kind };
}

function sortedValues(agg, dimKey) {
  const dim = DIMENSIONS[dimKey];
  const values = [...agg.groups.keys()];
  if (dim.kind === 'time') return values.sort((a, b) => a - b);
  // Mechanisms always read transactional -> experiential, never as a leaderboard.
  if (dimKey === 'mechanisms') return sortByMechanismOrder(values.sort((a, b) => agg.groups.get(b).programmeCount - agg.groups.get(a).programmeCount));
  return values.sort((a, b) => agg.groups.get(b).programmeCount - agg.groups.get(a).programmeCount);
}

// measure: 'count' | 'pct' | 'companies'
export function measureOf(group, measure, denomTotal) {
  if (!group) return 0;
  if (measure === 'companies') return group.companies.size;
  if (measure === 'pct') return denomTotal ? (group.programmeCount / denomTotal) * 100 : 0;
  return group.programmeCount;
}

// Distribution of a single dimension — the building block for KPI cards, the
// Distribution Lab, Mechanics Lab, and category drill-down profiles.
export function distribution(programmes, dimKey, { measure = 'count' } = {}) {
  const agg = aggregateByDimension(programmes, dimKey);
  const order = sortedValues(agg, dimKey);
  const rows = order.map(value => {
    const g = agg.groups.get(value);
    return { value, count: g.programmeCount, companies: g.companies.size, pct: agg.total ? (g.programmeCount / agg.total) * 100 : 0, measureValue: measureOf(g, measure, agg.total) };
  });
  return { rows, total: agg.total, missing: agg.missingProgrammes, multiSelect: agg.multiSelect, dimKey };
}

// ---------------- Launch Trends (time series) ----------------

export function timeSeries(programmes, { groupByKey = 'none', measure = 'count' } = {}) {
  const withYear = programmes.filter(p => typeof p.launch_year === 'number');
  const missingLaunchYearCount = programmes.length - withYear.length;
  const years = [...new Set(withYear.map(p => p.launch_year))].sort((a, b) => a - b);

  if (!groupByKey || groupByKey === 'none') {
    const perYear = new Map(years.map(y => [y, { programmeCount: 0, companies: new Set() }]));
    withYear.forEach(p => {
      const g = perYear.get(p.launch_year);
      g.programmeCount++;
      if (p.company) g.companies.add(p.company);
    });
    const values = years.map(y => {
      const g = perYear.get(y);
      return measure === 'companies' ? g.companies.size : g.programmeCount;
    });
    return { years, series: [{ name: 'All Programmes', values }], missingLaunchYearCount, multiSelect: false, measure };
  }

  const dim = DIMENSIONS[groupByKey];
  // year -> value -> {programmeCount, companies}
  const perYear = new Map(years.map(y => [y, new Map()]));
  const seriesNames = new Set();
  withYear.forEach(p => {
    const values = valuesOf(dim, p);
    const yearMap = perYear.get(p.launch_year);
    values.forEach(v => {
      seriesNames.add(v);
      if (!yearMap.has(v)) yearMap.set(v, { programmeCount: 0, companies: new Set() });
      const g = yearMap.get(v);
      g.programmeCount++;
      if (p.company) g.companies.add(p.company);
    });
  });

  // Order series by total volume (most common first) for stable, readable stacking/legends.
  const totals = new Map([...seriesNames].map(n => [n, 0]));
  perYear.forEach(yearMap => yearMap.forEach((g, name) => totals.set(name, totals.get(name) + g.programmeCount)));
  let orderedNames = [...seriesNames].sort((a, b) => totals.get(b) - totals.get(a));
  if (groupByKey === 'mechanisms') orderedNames = sortByMechanismOrder(orderedNames);

  const series = orderedNames.map(name => {
    const values = years.map(y => {
      const g = perYear.get(y).get(name);
      if (!g) return 0;
      if (measure === 'companies') return g.companies.size;
      if (measure === 'pct') {
        const yearTotal = [...perYear.get(y).values()].reduce((s, x) => s + x.programmeCount, 0);
        return yearTotal ? (g.programmeCount / yearTotal) * 100 : 0;
      }
      return g.programmeCount;
    });
    return { name, values };
  });

  return { years, series, missingLaunchYearCount, multiSelect: dim.kind === 'multi', measure };
}

// ---------------- Cross-tab (two dimensions) ----------------

// Rows = Y dimension, columns = X dimension. Row/column totals come from each
// dimension's OWN independent distribution (not summed from the matrix), so
// Row%/Column% stay correct even when one or both axes are multi-select.
export function crossTab(programmes, xKey, yKey, { measure = 'count' } = {}) {
  const xDim = DIMENSIONS[xKey];
  const yDim = DIMENSIONS[yKey];
  const xAgg = aggregateByDimension(programmes, xKey);
  const yAgg = aggregateByDimension(programmes, yKey);
  const xValues = sortedValues(xAgg, xKey);
  const yValues = sortedValues(yAgg, yKey);

  // Nested Map (y -> x -> value) rather than a joined string key, so a category
  // value can never collide with the separator.
  const cellCounts = new Map();
  const cellCompanies = new Map();
  function bump(map, y, x, updater) {
    if (!map.has(y)) map.set(y, new Map());
    const row = map.get(y);
    row.set(x, updater(row.get(x)));
  }
  programmes.forEach(p => {
    const xs = valuesOf(xDim, p);
    const ys = valuesOf(yDim, p);
    if (!xs.length || !ys.length) return;
    ys.forEach(y => xs.forEach(x => {
      bump(cellCounts, y, x, (v) => (v || 0) + 1);
      if (p.company) bump(cellCompanies, y, x, (v) => { const s = v || new Set(); s.add(p.company); return s; });
    }));
  });

  const cellValue = (y, x) => {
    if (measure === 'companies') {
      const s = cellCompanies.get(y) && cellCompanies.get(y).get(x);
      return s ? s.size : 0;
    }
    return (cellCounts.get(y) && cellCounts.get(y).get(x)) || 0;
  };
  const matrix = yValues.map(y => xValues.map(x => cellValue(y, x)));
  const rowTotals = yValues.map(y => measureOf(yAgg.groups.get(y), measure));
  const colTotals = xValues.map(x => measureOf(xAgg.groups.get(x), measure));

  return {
    xValues, yValues, matrix, rowTotals, colTotals, measure,
    grandTotal: measure === 'companies' ? new Set(programmes.map(p => p.company).filter(Boolean)).size : programmes.length,
    xMissing: xAgg.missingProgrammes, yMissing: yAgg.missingProgrammes,
    xMultiSelect: xDim.kind === 'multi', yMultiSelect: yDim.kind === 'multi',
    xLabel: xDim.label, yLabel: yDim.label
  };
}

export function normaliseCell(value, rowIdx, colIdx, table, mode) {
  if (mode === 'row') return table.rowTotals[rowIdx] ? (value / table.rowTotals[rowIdx]) * 100 : 0;
  if (mode === 'col') return table.colTotals[colIdx] ? (value / table.colTotals[colIdx]) * 100 : 0;
  return value;
}

// ---------------- Mechanism co-occurrence ----------------

export function mechanismCooccurrence(programmes) {
  const singleCounts = new Map();
  programmes.forEach(p => arr(p.mechanisms).forEach(m => singleCounts.set(m, (singleCounts.get(m) || 0) + 1)));
  // Conceptual order (taxonomy due diligence, Section 5), not frequency — a
  // heatmap should read as a spectrum/family grouping, not a leaderboard. Anything
  // present in the data but not in the fixed order (legacy values) sorts after it,
  // by frequency, so nothing silently disappears.
  const known = MECHANISM_ANALYTICAL_ORDER.filter(m => singleCounts.has(m));
  const rest = [...singleCounts.keys()].filter(m => !MECHANISM_ANALYTICAL_ORDER.includes(m)).sort((a, b) => singleCounts.get(b) - singleCounts.get(a));
  const list = [...known, ...rest];
  const idx = new Map(list.map((m, i) => [m, i]));
  const matrix = list.map(() => list.map(() => 0));

  programmes.forEach(p => {
    const ms = [...new Set(arr(p.mechanisms))];
    for (let i = 0; i < ms.length; i++) {
      for (let j = 0; j < ms.length; j++) {
        matrix[idx.get(ms[i])][idx.get(ms[j])]++;
      }
    }
  });

  return { mechanisms: list, matrix, singleCounts, total: programmes.length };
}

// How many distinct mechanisms a programme carries, bucketed — tells you whether
// programmes tend to lean on one mechanic or stack several together.
export function mechanismStackingDistribution(programmes) {
  const buckets = new Map([['0', 0], ['1', 0], ['2', 0], ['3', 0], ['4+', 0]]);
  programmes.forEach(p => {
    const n = new Set(arr(p.mechanisms)).size;
    const key = n >= 4 ? '4+' : String(n);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return [...buckets.entries()].map(([bucket, count]) => ({ bucket, count }));
}

// Headline stats for the Mechanisms workspace: how many distinct mechanisms are in
// use, how much programmes stack them, and the single strongest pairing (by raw
// co-occurrence count, excluding a mechanism paired with itself).
export function mechanismKpis(programmes) {
  const total = programmes.length;
  const co = mechanismCooccurrence(programmes);
  const counts = [...co.singleCounts.entries()].sort((a, b) => b[1] - a[1]);
  const perProgramme = programmes.map(p => new Set(arr(p.mechanisms)).size);
  const withAny = perProgramme.filter(n => n > 0).length;
  const multiCount = perProgramme.filter(n => n >= 2).length;

  let topPair = null;
  for (let i = 0; i < co.mechanisms.length; i++) {
    for (let j = i + 1; j < co.mechanisms.length; j++) {
      const count = co.matrix[i][j];
      if (count > 0 && (!topPair || count > topPair.count)) topPair = { a: co.mechanisms[i], b: co.mechanisms[j], count };
    }
  }

  return {
    total,
    distinctMechanisms: counts.length,
    avgPerProgramme: withAny ? perProgramme.reduce((a, b) => a + b, 0) / withAny : 0,
    multiMechanismPct: withAny ? (multiCount / withAny) * 100 : 0,
    topMechanism: counts.length ? { value: counts[0][0], count: counts[0][1], pct: total ? (counts[0][1] / total) * 100 : 0 } : null,
    topPair
  };
}

// Ranked co-occurrence pairs (excluding a mechanism with itself) — the "strongest
// pairings" list shown next to the full co-occurrence heatmap.
export function mechanismTopPairs(programmes, limit = 10) {
  const co = mechanismCooccurrence(programmes);
  const pairs = [];
  for (let i = 0; i < co.mechanisms.length; i++) {
    for (let j = i + 1; j < co.mechanisms.length; j++) {
      const count = co.matrix[i][j];
      if (count > 0) pairs.push({ a: co.mechanisms[i], b: co.mechanisms[j], count });
    }
  }
  return pairs.sort((a, b) => b.count - a.count).slice(0, limit);
}

// One mechanism's own profile — reuses categoryProfile (a mechanism IS just a
// dimension value) and adds what categoryProfile doesn't cover: which other
// mechanisms most often appear alongside it, and its own launch-year trend.
export function mechanismProfile(programmes, mechanism) {
  const profile = categoryProfile(programmes, 'mechanisms', mechanism);
  const co = mechanismCooccurrence(programmes);
  const idx = co.mechanisms.indexOf(mechanism);
  const coOccurring = idx === -1 ? [] : co.mechanisms
    .map((m, i) => ({ value: m, count: co.matrix[idx][i] }))
    .filter(r => r.value !== mechanism && r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const trend = timeSeries(profile.subset, { groupByKey: 'none' });
  return { ...profile, coOccurring, trend };
}

// ---------------- Tier Lab ----------------

// Whether a programme is tiered is now answered only by the structured
// programme_tiers table — the old Mechanisms "Tiering" checkbox was removed
// (taxonomy due diligence: pure duplication of this, less reliable) so there is
// exactly one source of truth for this question, not two that could disagree.
function hasTierRows(p) { return Array.isArray(p.programme_tiers) && p.programme_tiers.length > 0; }

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function tierOverview(programmes) {
  const total = programmes.length;
  const withTierRows = programmes.filter(hasTierRows);
  const tierCounts = withTierRows.map(p => p.programme_tiers.length);
  // '1' is included deliberately: some programmes have exactly one tier row recorded
  // (often a single membership fee entry rather than real tiering) — surfacing it
  // rather than hiding it is the honest reading of what's actually in the database.
  const distBuckets = new Map([['1', 0], ['2', 0], ['3', 0], ['4', 0], ['5+', 0]]);
  tierCounts.forEach(n => {
    const key = n >= 5 ? '5+' : String(n);
    distBuckets.set(key, (distBuckets.get(key) || 0) + 1);
  });
  return {
    total,
    // A single source of truth now (programme_tiers) — see hasTierRows above.
    tieredCount: withTierRows.length,
    tieredPct: total ? (withTierRows.length / total) * 100 : 0,
    withStructureCount: withTierRows.length,
    avgTiers: tierCounts.length ? tierCounts.reduce((a, b) => a + b, 0) / tierCounts.length : null,
    medianTiers: median(tierCounts),
    distribution: [...distBuckets.entries()].map(([bucket, count]) => ({ bucket, count }))
  };
}

// "Tiering by X": % of programmes within each category of dimKey that have a
// recorded tier structure — denominator is that category's own programme count.
export function tieringByDimension(programmes, dimKey) {
  const dim = DIMENSIONS[dimKey];
  const groups = new Map();
  programmes.forEach(p => {
    const tiered = hasTierRows(p);
    valuesOf(dim, p).forEach(v => {
      if (!groups.has(v)) groups.set(v, { total: 0, tiered: 0 });
      const g = groups.get(v);
      g.total++;
      if (tiered) g.tiered++;
    });
  });
  return [...groups.entries()]
    .map(([value, g]) => ({ value, total: g.total, tiered: g.tiered, pct: g.total ? (g.tiered / g.total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
}

// Tier-to-tier jump analysis, segmented so incompatible qualification units (or
// currencies, for fee jumps) are never diffed against each other.
export function tierJumps(programmes) {
  const byUnit = new Map();   // qualification_unit -> [{programme, from, to, fromAmount, toAmount, absolute, pct}]
  const byCurrency = new Map(); // currency -> [{programme, from, to, fromFee, toFee, absolute, pct}]

  programmes.filter(hasTierRows).forEach(p => {
    const rows = [...p.programme_tiers].sort((a, b) => (a.tier_order ?? 0) - (b.tier_order ?? 0));
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1], cur = rows[i];
      if (prev.qualification_unit && prev.qualification_unit === cur.qualification_unit &&
          prev.qualification_amount != null && cur.qualification_amount != null) {
        const absolute = cur.qualification_amount - prev.qualification_amount;
        const pct = prev.qualification_amount !== 0 ? (absolute / prev.qualification_amount) * 100 : null;
        const key = prev.qualification_unit;
        if (!byUnit.has(key)) byUnit.set(key, []);
        byUnit.get(key).push({ programme: p.programme_name, from: prev.tier_name, to: cur.tier_name, fromAmount: prev.qualification_amount, toAmount: cur.qualification_amount, absolute, pct });
      }
      const prevCurrency = prev.currency || 'EUR', curCurrency = cur.currency || 'EUR';
      if (prev.tier_price != null && cur.tier_price != null && prevCurrency === curCurrency) {
        const absolute = cur.tier_price - prev.tier_price;
        const pct = prev.tier_price !== 0 ? (absolute / prev.tier_price) * 100 : null;
        if (!byCurrency.has(prevCurrency)) byCurrency.set(prevCurrency, []);
        byCurrency.get(prevCurrency).push({ programme: p.programme_name, from: prev.tier_name, to: cur.tier_name, fromFee: prev.tier_price, toFee: cur.tier_price, absolute, pct });
      }
    }
  });

  return { byUnit, byCurrency };
}

// A programme's cheapest (entry) and priciest (top) recorded tier_price, kept to one
// currency (the entry tier's) — fees in different currencies can't be pooled, so a
// programme whose tiers mix currencies just isn't represented past its entry fee.
function entryAndTopFee(p) {
  if (!hasTierRows(p)) return null;
  const rows = [...p.programme_tiers].sort((a, b) => (a.tier_order ?? 0) - (b.tier_order ?? 0)).filter(r => r.tier_price != null);
  if (!rows.length) return null;
  const currency = rows[0].currency || 'EUR';
  const sameCurrency = rows.filter(r => (r.currency || 'EUR') === currency);
  return { currency, entryFee: sameCurrency[0].tier_price, topFee: sameCurrency[sameCurrency.length - 1].tier_price };
}

// Per-currency fee KPIs (avg/median entry & top fee) — the Pricing workspace's
// headline numbers, always segmented by currency so they're never a mix of EUR/USD/etc.
export function feeOverview(programmes) {
  const byCurrency = new Map();
  programmes.forEach(p => {
    const f = entryAndTopFee(p);
    if (!f) return;
    if (!byCurrency.has(f.currency)) byCurrency.set(f.currency, { entry: [], top: [] });
    byCurrency.get(f.currency).entry.push(f.entryFee);
    byCurrency.get(f.currency).top.push(f.topFee);
  });
  const currencies = [...byCurrency.entries()]
    .map(([currency, v]) => ({
      currency, count: v.entry.length,
      avgEntryFee: v.entry.reduce((a, b) => a + b, 0) / v.entry.length,
      medianEntryFee: median(v.entry),
      avgTopFee: v.top.reduce((a, b) => a + b, 0) / v.top.length,
      medianTopFee: median(v.top)
    }))
    .sort((a, b) => b.count - a.count);
  return { total: programmes.length, withFeeCount: [...byCurrency.values()].reduce((a, v) => a + v.entry.length, 0), currencies };
}

// Entry-fee distribution for one currency, bucketed into round ranges — "what does it
// typically cost to join", independent of how fees jump between tiers.
export function entryFeeDistribution(programmes, currency) {
  const fees = programmes.map(entryAndTopFee).filter(f => f && f.currency === currency).map(f => f.entryFee);
  if (!fees.length) return [];
  const max = Math.max(...fees);
  const bucketSize = max <= 100 ? 10 : max <= 500 ? 50 : max <= 2000 ? 250 : 1000;
  const buckets = new Map();
  fees.forEach(fee => {
    const start = Math.floor(fee / bucketSize) * bucketSize;
    const label = `${start}–${start + bucketSize}`;
    buckets.set(label, (buckets.get(label) || 0) + 1);
  });
  return [...buckets.entries()]
    .map(([bucket, count]) => ({ bucket, count, start: Number(bucket.split('–')[0]) }))
    .sort((a, b) => a.start - b.start);
}

// Average entry fee by another dimension (e.g. Industry), scoped to one currency so
// values stay comparable — same per-category shape as tieringByDimension.
export function avgEntryFeeByDimension(programmes, dimKey, currency) {
  const dim = DIMENSIONS[dimKey];
  const groups = new Map();
  programmes.forEach(p => {
    const f = entryAndTopFee(p);
    if (!f || f.currency !== currency) return;
    valuesOf(dim, p).forEach(v => {
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(f.entryFee);
    });
  });
  return [...groups.entries()]
    .map(([value, fees]) => ({ value, count: fees.length, avgEntryFee: fees.reduce((a, b) => a + b, 0) / fees.length }))
    .sort((a, b) => b.avgEntryFee - a.avgEntryFee);
}

// ---------------- Generic "which programmes is this?" lookup ----------------
// criteria: [{dimKey, value}, ...] — every criterion must match (AND). Powers every
// click-through on the page (a bar, a heatmap cell, a KPI card): the same function
// works whether it's one dimension (a distribution bar) or two (a cross-tab cell,
// including two values of the SAME multi-select dimension, e.g. a mechanism pair).
export function programmesMatching(programmes, criteria) {
  return programmes.filter(p => criteria.every(({ dimKey, value }) => valuesOf(DIMENSIONS[dimKey], p).includes(value)));
}

// ---------------- Category drill-down profile ----------------

export function categoryProfile(programmes, dimKey, value) {
  const dim = DIMENSIONS[dimKey];
  const subset = programmes.filter(p => {
    const values = valuesOf(dim, p);
    return values.includes(value);
  });
  return {
    dimKey, value, count: subset.length, subset,
    positioning: distribution(subset, 'programme_positioning'),
    membership: distribution(subset, 'membership_type'),
    geography: distribution(subset, 'geographic_scope'),
    topMechanisms: distribution(subset, 'mechanisms').rows.slice(0, 6)
  };
}

// ---------------- KPI snapshot / data quality ----------------

export function snapshotKpis(programmes) {
  const total = programmes.length;
  const companies = new Set(programmes.map(p => p.company).filter(Boolean)).size;
  const industries = new Set(programmes.map(p => p.industry).filter(Boolean)).size;
  const countries = new Set(programmes.map(p => p.country).filter(Boolean)).size;
  const geoMarkets = new Set(programmes.flatMap(p => arr(p.geographic_scope))).size;
  const freeCount = programmes.filter(p => p.membership_type === 'Free').length;
  const paidCount = programmes.filter(p => p.membership_type === 'Paid').length;
  const subscriptionCount = programmes.filter(p => p.membership_type === 'Subscription').length;
  const tieredCount = programmes.filter(hasTierRows).length;
  return {
    total, companies, industries, countries, geoMarkets,
    freePct: total ? (freeCount / total) * 100 : 0,
    paidPct: total ? (paidCount / total) * 100 : 0,
    subscriptionPct: total ? (subscriptionCount / total) * 100 : 0,
    tieredPct: total ? (tieredCount / total) * 100 : 0
  };
}

const DATA_QUALITY_FIELDS = [
  { key: 'launch_year', label: 'Launch Year', has: p => typeof p.launch_year === 'number' },
  { key: 'programme_positioning', label: 'Programme Positioning', has: p => !!p.programme_positioning },
  { key: 'membership_type', label: 'Membership Type', has: p => !!p.membership_type },
  { key: 'geographic_scope', label: 'Geographic Scope', has: p => arr(p.geographic_scope).length > 0 },
  { key: 'source_url', label: 'Source URL', has: p => !!p.source_url }
];

export function dataQuality(programmes) {
  const total = programmes.length;
  return DATA_QUALITY_FIELDS.map(f => {
    const present = programmes.filter(f.has).length;
    return { key: f.key, label: f.label, present, missing: total - present, pct: total ? (present / total) * 100 : 0 };
  });
}

const CURRENT_YEAR = new Date().getFullYear();
export function suspiciousLaunchYears(programmes) {
  return programmes.filter(p => typeof p.launch_year === 'number' && (p.launch_year < 1850 || p.launch_year > CURRENT_YEAR + 1));
}
