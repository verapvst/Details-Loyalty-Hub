// A detail page's "← Back to X" link should return the visitor to the exact list
// state they came from — including any filters, which the list pages now keep in
// their own URL (see filterUrlSync.js) so the browser's native Back button already
// restores them. This link is a separate, hardcoded href to the bare list page
// though, so clicking it (instead of using Back) was still discarding filters even
// after that fix. When the visitor actually arrived from that list page, wiring the
// link to history.back() reuses that same already-correct history entry. When they
// didn't (a direct link, a bookmark, a new tab), there's no such entry to return to,
// so the plain href to the clean list page — already in the markup — is left as the
// correct, safe fallback.
export function wireBackLink(linkEl, listPagePath) {
  if (!linkEl || !document.referrer) return;
  let cameFromList = false;
  try { cameFromList = new URL(document.referrer).pathname.endsWith(listPagePath); } catch { cameFromList = false; }
  if (!cameFromList) return;
  linkEl.addEventListener('click', (e) => {
    e.preventDefault();
    history.back();
  });
}
