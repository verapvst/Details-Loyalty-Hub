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
// elsewhere in the app.
function heartIconSVG(filled) {
  return `<svg class="heart-icon" viewBox="0 0 24 24" width="14" height="14" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.7-4.35-9.3-8.1C.7 9.9 1.7 6 5 5c2-.1 3.6 1 4.5 2.5C10.4 6 12 4.9 14 5c3.3 1 4.3 4.9 2.3 7.9C18.7 16.65 12 21 12 21z"/></svg>`;
}

export function heartHTML(targetType, targetLabel, targetId, summary) {
  const filled = !!summary.mine;
  return `
    <button type="button" class="like-heart ${filled ? 'liked' : ''}"
      data-target-type="${escapeHtml(targetType)}"
      data-target-label="${escapeHtml(targetLabel)}"
      data-target-id="${targetId ? escapeHtml(targetId) : ''}">
      ${heartIconSVG(filled)}
      ${summary.othersCount > 0 ? `<span class="heart-count">${summary.othersCount}</span>` : ''}
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
    mechanism: 'Mechanism', benefit: 'Benefit', membership_type: 'Membership Type',
    target_customer: 'Target Customer', tier: 'Tier', feature: 'Feature'
  };
  return labels[type] || type;
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
              <div class="like-target-display">${escapeHtml(programmeName)} — ${escapeHtml(targetLabel)} <span class="badge badge-muted" style="margin-left:6px;">${targetTypeLabel(targetType)}</span></div>
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
