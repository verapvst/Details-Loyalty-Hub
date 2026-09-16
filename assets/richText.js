// A deliberately minimal rich-text input: a small Bold/Italic/bullet+numbered-list
// toolbar over a contenteditable area, using document.execCommand — still fully
// supported by every current browser for exactly these basic commands. Not a document
// editor: no external library, no complex model, no more formatting than an email.
//
// Content is stored as plain HTML in the same text columns the fields already used
// (insight_text / supporting_detail) — no schema type change. A value saved before
// this feature existed is plain text; it's converted to equivalent paragraph/line-break
// HTML the first time it's shown, so nothing is lost and it's immediately editable.
//
// escapeHtml is duplicated (not imported from fields.js) to avoid a circular import —
// fields.js's inputHTML() needs to call into this module for the 'richtext' field type.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function looksLikeHtml(str) {
  return /<\/?[a-z][\s\S]*>/i.test(str || '');
}

// Legacy plain text -> equivalent HTML (double newline = new paragraph, single = line
// break). A value that already contains HTML (saved by this editor) passes through as-is.
export function toEditableHtml(value) {
  if (!value) return '';
  if (looksLikeHtml(value)) return value;
  return value.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

// Clean plain text for Copy actions and search — letting the browser compute it (via
// innerText) would be the natural choice here, but it only respects block-level line
// breaks for elements that have actually been *laid out* on the page — a detached
// element (never appended to the document) has no layout at all, so innerText
// silently collapses every paragraph/list item onto one line. Walking the DOM
// manually and inserting '\n' after each block element sidesteps that entirely.
const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

export function htmlToPlainText(html) {
  if (!html) return '';
  const container = document.createElement('div');
  container.innerHTML = html;

  let text = '';
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) { text += node.textContent; return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'BR') { text += '\n'; return; }
    node.childNodes.forEach(walk);
    if (BLOCK_TAGS.has(node.tagName)) text += '\n';
  }
  container.childNodes.forEach(walk);

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// Convenience for "plain text of a field that might be legacy-plain or rich HTML".
export function fieldPlainText(value) {
  return htmlToPlainText(toEditableHtml(value));
}

// execCommand('insertUnorderedList'/'insertOrderedList') is unreliable here — with a
// collapsed selection in an empty paragraph next to other content, it can merge
// adjacent paragraphs into one list item instead of converting only the current
// line. Bold/Italic (plain inline formatting) don't have this problem and stay on
// execCommand; list toggling gets its own small, predictable DOM-manipulation instead.
function closestBlock(node, editable) {
  while (node && node !== editable) {
    if (node.nodeType === 1 && ['P', 'LI', 'DIV'].includes(node.tagName)) return node;
    node = node.parentNode;
  }
  return null;
}

function placeCaretAtStart(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// Converts only the current block (the one containing the caret) into a list item —
// or, if it's already a list item of that same type, back into a plain paragraph.
// Everything else in the editor is left completely untouched.
function toggleList(editable, tag) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const block = closestBlock(sel.getRangeAt(0).startContainer, editable);
  if (!block) return;

  const parentList = block.tagName === 'LI' ? block.parentElement : null;

  if (parentList && parentList.tagName.toLowerCase() === tag) {
    const p = document.createElement('p');
    p.innerHTML = block.innerHTML || '<br>';
    parentList.parentNode.insertBefore(p, parentList);
    block.remove();
    if (!parentList.children.length) parentList.remove();
    placeCaretAtStart(p);
    return;
  }

  const list = document.createElement(tag);
  const li = document.createElement('li');
  li.innerHTML = block.innerHTML || '<br>';
  list.appendChild(li);

  if (parentList) {
    parentList.parentNode.insertBefore(list, parentList); // switching ul <-> ol
    block.remove();
    if (!parentList.children.length) parentList.remove();
  } else {
    block.parentNode.insertBefore(list, block);
    block.remove();
  }
  placeCaretAtStart(li);
}

let uid = 0;

export function richTextEditorHTML(name, value, { minHeight = 90 } = {}) {
  const id = `rte-${name}-${++uid}`;
  // A truly empty contenteditable (no block element at all) makes execCommand behave
  // unpredictably the first time a command runs — e.g. a list/bold toggle can end up
  // wrapping content at the wrong position instead of acting on the caret. Always
  // start from one real (possibly empty) paragraph so there's a well-defined block
  // to operate on from the very first keystroke.
  const initialHtml = toEditableHtml(value) || '<p><br></p>';
  return `
    <div class="rich-text-field" data-rte-name="${name}">
      <div class="rich-text-toolbar">
        <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
        <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
        <button type="button" data-cmd="insertUnorderedList" title="Bullet list">&bull; List</button>
        <button type="button" data-cmd="insertOrderedList" title="Numbered list">1. List</button>
      </div>
      <div class="rich-text-editable" id="${id}" contenteditable="true" style="min-height: ${minHeight}px;">${initialHtml}</div>
    </div>
  `;
}

// Wires every rich-text field's toolbar within `root` (a form or modal body).
export function wireRichTextEditors(root) {
  // Make Enter consistently create <p> elements (some browsers default to <div>),
  // matching what toEditableHtml() produces so typed and legacy-converted content
  // look and behave the same.
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* unsupported: harmless, browser default still works */ }

  root.querySelectorAll('.rich-text-field').forEach(field => {
    const editable = field.querySelector('.rich-text-editable');

    field.querySelectorAll('[data-cmd]').forEach(btn => {
      // preventDefault on the button's own mousedown stops it from stealing focus
      // away from the editor, which is what actually keeps the live browser
      // selection (window.getSelection()) intact and pointing at the real caret —
      // no need to manually cache/restore a Range on top of that.
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        editable.focus();
        const cmd = btn.dataset.cmd;
        if (cmd === 'insertUnorderedList') toggleList(editable, 'ul');
        else if (cmd === 'insertOrderedList') toggleList(editable, 'ol');
        else document.execCommand(cmd, false, null);
      });
    });

    // Force every paste to plain text — pasting straight HTML (from a PDF, website,
    // Word, another field's rich text, ...) brings its own font-family/size/color
    // inline styles along with it, breaking the "one consistent editor font"
    // guarantee. Stripping to plain text keeps Bold/Italic/lists as something only
    // the toolbar controls, never something a paste can smuggle in. The CSS lock on
    // .rich-text-editable/.rich-text-display is the backstop for anything already
    // saved with stray inline styles from before this fix.
    editable.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  });
}

// Reads a rich-text field's current value back out for saving. A field left visually
// empty can still contain a stray "<br>" from browser editing behavior — treated as
// empty rather than saved as noise.
export function getRichTextValue(root, name) {
  const field = root.querySelector(`.rich-text-field[data-rte-name="${name}"]`);
  const editable = field?.querySelector('.rich-text-editable');
  const html = editable ? editable.innerHTML.trim() : '';
  return (html === '' || html === '<br>') ? null : html;
}
