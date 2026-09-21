// Keeps a page's filter controls reflected in the URL (via replaceState — no new
// history entries) so the browser's own Back button restores them for free.
// Without this, opening a detail page (a programme, a source, an insight) and
// pressing Back reloads the list page from a plain URL with every filter reset,
// since filter state only ever lived in the DOM/JS, never anywhere the browser
// itself would bring back. Used by database.js, sources.js, figures.js, favorites.js.
//
// `fields`: [{ key, get, set, multi? }] — get() reads the current value (a string,
// or an array when multi:true); set(value) applies a restored value back to the
// page's own state/DOM. Plain <select>/<input> fields can pass get/set straight
// through to `.value`; a multi-select (e.g. a checkbox-group scope filter) needs a
// `set` that also re-checks the right boxes and updates any dependent UI (button
// label, etc.) — see sources.js/figures.js for that fuller example.

export function syncFiltersToURL(fields) {
  const params = new URLSearchParams();
  fields.forEach(({ key, get }) => {
    const v = get();
    if (Array.isArray(v)) { if (v.length) params.set(key, v.join(',')); }
    else if (v) params.set(key, v);
  });
  const qs = params.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
}

export function restoreFiltersFromURL(fields) {
  const params = new URLSearchParams(location.search);
  fields.forEach(({ key, set, multi }) => {
    if (!params.has(key)) return;
    const raw = params.get(key);
    set(multi ? raw.split(',').filter(Boolean) : raw);
  });
}
