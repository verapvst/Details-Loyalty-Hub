import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://dyuflyhkanmczwshmbyh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// The free-tier database sometimes stalls for 5-10 seconds on tiny requests. Anything that is not essential to
// drawing a page (settings, labels, option lists, team) must never block it: after `ms` we carry on with `fallback`.
export function withTimeout(promise, ms, fallback) {
  return Promise.race([Promise.resolve(promise).catch(() => fallback), new Promise(resolve => setTimeout(() => resolve(fallback), ms))]);
}
