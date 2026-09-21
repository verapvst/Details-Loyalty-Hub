// Team members used to be a hardcoded array (TEAM_MEMBERS in options.js). They're now
// real rows in the app_team_members table so the team can Add/Deactivate itself from
// Settings. Deliberately no rename yet — a name is copied as plain text into many
// tables (assignees, participants, created_by, liked_by...) and a safe rename needs a
// cascade tool across all of them (see the Settings proposal) — Phase 2, not v1.
// Named app_team_members (not team_members): this Supabase project already has an
// unrelated `team_members` table (full legal names, no `active` column) predating
// this app — left completely untouched, see migration 017.
import { supabase } from './supabase.js';
import { escapeHtml } from './fields.js';

// One Storage bucket, public-read — see supabase/025_team_avatar_and_rename.sql, same
// pattern as figures.image_path / insight-images (021).
const AVATAR_BUCKET = 'team-avatars';

let allRows = [];
let loaded = false;

export function teamAvatarUrl(path) {
  if (!path) return null;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

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

// For the nav identity avatar / picker — looks up a member's row by name so their
// photo (if any) can be shown instead of plain initials.
export function getTeamMemberByName(name) {
  return allRows.find(r => r.name === name) || null;
}

export function teamMembersLoaded() {
  return loaded;
}

// A single-person <select> for "who added/liked this" fields (created_by, liked_by) —
// lets a mistaken or bulk-assigned attribution be corrected by hand. Kept to a plain
// <select> (not the avatar-grid identity picker) since this edits someone ELSE's
// record, not "who am I right now". An already-set value outside the active team list
// (a deactivated member, or a placeholder like "Migration") stays selectable, tagged
// "(inactive)", so editing a record never silently drops what it was set to.
export function teamMemberSelectHTML(fieldName, selected) {
  const active = getActiveTeamMembers();
  const options = (selected && !active.includes(selected)) ? [...active, selected] : active;
  return `<select name="${escapeHtml(fieldName)}">${options.map(name => `
    <option value="${escapeHtml(name)}" ${name === selected ? 'selected' : ''}>${escapeHtml(name)}${!active.includes(name) ? ' (inactive)' : ''}</option>
  `).join('')}</select>`;
}
