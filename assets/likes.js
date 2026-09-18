import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { getOptionList } from './customOptions.js';
import { escapeHtml } from './fields.js';

export async function loadLikes(programmeId) {
  const { data } = await supabase.from('likes').select('*').eq('programme_id', programmeId);
  return data || [];
}

// Returns { mine, othersCount } for a given likeable target — `mine` is the current
// user's own like row (or null), `othersCount` excludes the current user's own like.
export function likeSummary(likes, targetType, targetLabel) {
  const identity = getIdentity();
  const matches = likes.filter(l => l.target_type === targetType && l.target_label === targetLabel);
  const mine = matches.find(l => l.liked_by === identity) || null;
  const othersCount = matches.filter(l => l.liked_by !== identity).length;
  return { mine, othersCount };
}

// Renders a heart button + optional count for one likeable target. Call wireHearts()
// afterward on the containing element to make it interactive.
// A plain heart outline when not liked, filled when liked — both grey, no color
// change, so the heart never competes visually with the accent/status colors used
// elsewhere in the app. Path is Feather's "heart" icon (24x24, symmetric about x=12).
function heartIconSVG(filled) {
  return `<svg class="heart-icon" viewBox="0 0 24 24" width="14" height="14" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

// Just shows whether the current user has liked it — no count. `summary.othersCount`
// is still returned by likeSummary() for callers that need it (e.g. Favorites' own
// "N others" isn't shown either, but the data stays available if that changes later).
export function heartHTML(targetType, targetLabel, targetId, summary) {
  const filled = !!summary.mine;
  return `
    <button type="button" class="like-heart ${filled ? 'liked' : ''}"
      data-target-type="${escapeHtml(targetType)}"
      data-target-label="${escapeHtml(targetLabel)}"
      data-target-id="${targetId ? escapeHtml(targetId) : ''}">
      ${heartIconSVG(filled)}
    </button>
  `;
}

// Wires every .like-heart button inside `container`. `ctx` = { programmeId, programmeName,
// likes (current array), onChange(newLikes) — called after a save/remove so the caller can re-render }.
export function wireHearts(container, ctx) {
  container.querySelectorAll('.like-heart').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetType = btn.dataset.targetType;
      const targetLabel = btn.dataset.targetLabel;
      const targetId = btn.dataset.targetId || null;
      const { mine } = likeSummary(ctx.likes, targetType, targetLabel);
      openLikeModal({ ...ctx, targetType, targetLabel, targetId, existingLike: mine });
    });
  });
}

export function targetTypeLabel(type) {
  const labels = {
    mechanism: 'Mechanism', membership_type: 'Membership Type',
    target_customer: 'Target Customer', tier: 'Tier', feature: 'Feature', other: 'Other'
  };
  return labels[type] || type;
}

// The selectable values for a given target type, drawn from the programme's own
// (already-loaded) data — not the full global taxonomy — so a manually-created
// Favourite always points at something genuinely present on that programme.
// Each option carries the row id when one exists (tier/feature), else null.
function valueOptionsFor(targetType, { programme, tiers, features }) {
  switch (targetType) {
    case 'mechanism': return (programme.mechanisms || []).map(v => ({ value: v, id: null }));
    case 'membership_type': return programme.membership_type ? [{ value: programme.membership_type, id: null }] : [];
    case 'target_customer': return (programme.target_customer || []).map(v => ({ value: v, id: null }));
    case 'tier': return (tiers || []).map(t => ({ value: t.tier_name, id: t.id }));
    case 'feature': return (features || []).map(f => ({ value: f.feature_name, id: f.id }));
    default: return [];
  }
}

// Step 1 of manual Favourite creation: pick WHAT on this programme to favourite
// (as opposed to clicking a heart already attached to a specific chip). Once
// confirmed, hands off to the normal openLikeModal — same object, same table,
// whichever entry point was used to get there.
export function openTargetPickerModal({ programmeId, programmeName, programme, tiers, features, likes, onChange }) {
  let root = document.getElementById('like-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'like-modal-root';
    document.body.appendChild(root);
  }

  const TYPES = ['mechanism', 'membership_type', 'target_customer', 'tier', 'feature', 'other'];

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="picker-modal">
      <div class="form-modal" style="max-width: 460px;">
        <div class="form-modal-head">
          <h2>Add Favourite</h2>
          <button type="button" class="form-modal-close" id="picker-close">&times;</button>
        </div>
        <form id="picker-form">
          <div class="form-modal-body">
            <div class="form-field full">
              <label>What are you favouriting on ${escapeHtml(programmeName)}?</label>
              <select name="target_type" id="picker-type">
                ${TYPES.map(t => `<option value="${t}">${escapeHtml(targetTypeLabel(t))}</option>`).join('')}
              </select>
            </div>
            <div class="form-field full" id="picker-value-wrap">
              <label>Which one?</label>
              <select name="target_value" id="picker-value"></select>
            </div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="picker-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Continue</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('picker-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('picker-close').addEventListener('click', close);
  document.getElementById('picker-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const typeSel = document.getElementById('picker-type');
  const valueWrap = document.getElementById('picker-value-wrap');
  let currentOptions = [];

  function syncValueField() {
    const type = typeSel.value;
    currentOptions = type === 'other' ? [] : valueOptionsFor(type, { programme, tiers, features });

    if (type === 'other' || currentOptions.length === 0) {
      valueWrap.innerHTML = `
        <label>${type === 'other' ? 'Describe it' : `No ${targetTypeLabel(type).toLowerCase()} values found on this programme, describe it`}</label>
        <input type="text" name="target_value_other" placeholder="e.g. a detail not yet captured elsewhere" required />
      `;
    } else {
      valueWrap.innerHTML = `
        <label>Which one?</label>
        <select name="target_value" id="picker-value">
          ${currentOptions.map((o, i) => `<option value="${i}">${escapeHtml(o.value)}</option>`).join('')}
        </select>
      `;
    }
  }
  typeSel.addEventListener('change', syncValueField);
  syncValueField();

  document.getElementById('picker-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const type = typeSel.value;

    let targetLabel, targetId;
    if (type === 'other' || currentOptions.length === 0) {
      targetLabel = form.elements['target_value_other'].value.trim();
      targetId = null;
      if (!targetLabel) return;
    } else {
      const opt = currentOptions[Number(form.elements['target_value'].value)];
      targetLabel = opt.value;
      targetId = opt.id;
    }

    close();
    const { mine } = likeSummary(likes, type, targetLabel);
    openLikeModal({ programmeId, programmeName, targetType: type, targetLabel, targetId, existingLike: mine, likes, onChange });
  });
}

export function openLikeModal({ programmeId, programmeName, targetType, targetLabel, targetId, existingLike, likes, onChange }) {
  let root = document.getElementById('like-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'like-modal-root';
    document.body.appendChild(root);
  }

  const psychOptions = getOptionList('psychological_effect');
  const selectedEffects = existingLike?.psychological_effect || [];

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="like-modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head">
          <h2>${existingLike ? 'Edit Like' : 'Like this'}</h2>
          <button type="button" class="form-modal-close" id="like-modal-close">&times;</button>
        </div>
        <form id="like-form">
          <div class="form-modal-body">
            <div class="form-field full">
              <label>What did you like?</label>
              <div class="like-target-display">${escapeHtml(programmeName)} · ${escapeHtml(targetLabel)} <span class="badge badge-muted" style="margin-left:6px;">${targetTypeLabel(targetType)}</span></div>
            </div>
            <div class="form-field full">
              <label>Why is it interesting?</label>
              <textarea name="description" rows="2" placeholder="Short 1-2 sentence description">${escapeHtml(existingLike?.description)}</textarea>
            </div>
            <div class="form-field full">
              <label>Psychological effect</label>
              <div class="checkbox-row">${psychOptions.map(o => `
                <label class="checkbox-item"><input type="checkbox" name="psychological_effect" value="${escapeHtml(o)}" ${selectedEffects.includes(o) ? 'checked' : ''} /> ${escapeHtml(o)}</label>
              `).join('')}</div>
            </div>
            <div class="form-field full">
              <label>Why does it matter?</label>
              <textarea name="psychological_effect_notes" rows="2" placeholder="Very short psychological / customer-behaviour explanation">${escapeHtml(existingLike?.psychological_effect_notes)}</textarea>
            </div>
          </div>
          <div class="form-modal-foot">
            ${existingLike ? `<button type="button" class="btn-danger-text" id="like-remove" style="margin-right:auto;">Remove like</button>` : ''}
            <button type="button" class="btn-text" id="like-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('like-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('like-modal-close').addEventListener('click', close);
  document.getElementById('like-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  if (existingLike) {
    document.getElementById('like-remove').addEventListener('click', async () => {
      await supabase.from('likes').delete().eq('id', existingLike.id);
      close();
      showToast('Like removed.');
      onChange(await loadLikes(programmeId));
    });
  }

  document.getElementById('like-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      description: form.elements['description'].value.trim() || null,
      psychological_effect: [...form.querySelectorAll('input[name="psychological_effect"]:checked')].map(cb => cb.value),
      psychological_effect_notes: form.elements['psychological_effect_notes'].value.trim() || null
    };

    let error;
    if (existingLike) {
      ({ error } = await supabase.from('likes').update(payload).eq('id', existingLike.id));
    } else {
      ({ error } = await supabase.from('likes').insert({
        programme_id: programmeId,
        liked_by: getIdentity(),
        target_type: targetType,
        target_label: targetLabel,
        target_id: targetId,
        created_at: new Date().toISOString(),
        ...payload
      }));
    }

    if (error) {
      showToast(`Couldn't save like: ${error.message}`, true);
      return;
    }

    close();
    showToast(existingLike ? 'Like updated.' : 'Liked.');
    onChange(await loadLikes(programmeId));
  });
}
