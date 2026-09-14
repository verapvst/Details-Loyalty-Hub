import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://dyuflyhkanmczwshmbyh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
