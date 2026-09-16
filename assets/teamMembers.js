// Team members used to be a hardcoded array (TEAM_MEMBERS in options.js). They're now
// real rows in the app_team_members table so the team can Add/Deactivate itself from
// Settings. Deliberately no rename yet — a name is copied as plain text into many
// tables (assignees, participants, created_by, liked_by...) and a safe rename needs a
// cascade tool across all of them (see the Settings proposal) — Phase 2, not v1.
// Named app_team_members (not team_members): this Supabase project already has an
// unrelated `team_members` table (full legal names, no `active` column) predating
// this app — left completely untouched, see migration 017.
import { supabase } from './supabase.js';

let allRows = [];
let loaded = false;

export async function loadTeamMembers() {
  const { data } = await supabase.from('app_team_members').select('*').order('created_at');
  allRows = data || [];
  loaded = true;
}

// For pickers (assignees, participants, identity switcher) — active members only.
export function getActiveTeamMembers() {
  return allRows.filter(r => r.active).map(r => r.name);
}

// For Settings — every member, including deactivated ones, so the team can see who's
// inactive and reactivate them.
export function getAllTeamMembers() {
  return allRows;
}

export function teamMembersLoaded() {
  return loaded;
}
