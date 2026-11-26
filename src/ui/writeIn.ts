// New AI text "writes itself" in, word by word. The words are hidden with
// the CSS Custom Highlight API (::highlight(bw-unwritten) paints them
// transparent) and uncovered one by one, so the text is laid out at its full
// size from the start (nothing below it jumps) and React's DOM is untouched.

const supported = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Characters to skip before the new text starts (it was added to the end of a paragraph). */
const startOf = (els: Element[], from?: string): number => {
  if (!from) return 0;
  const text = els.map((e) => e.textContent ?? '').join('');
  const probe = from.replace(/[*_`$]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const at = probe ? text.replace(/\s/g, ' ').lastIndexOf(probe) : -1;
  return at > 0 ? at : 0;
};

/**
 * Write the text of `els` in word by word. `from` is the start of the new
 * text when only the end of an element is new. Returns a function that stops
 * it (showing everything).
 */
export const writeIn = (els: Element[], { from, msPerWord = 26, maxMs = 1600 }: { from?: string; msPerWord?: number; maxMs?: number } = {}) => {
  if (!els.length || !supported() || reduced()) return () => {};
  // The end of every word, in order, across all the elements' text.
  const ends: [Node, number][] = [];
  let first: [Node, number] | null = null;
  let last: [Node, number] | null = null;
  let skip = startOf(els, from);
  for (const el of els) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? '';
      if (skip >= text.length) { skip -= text.length; continue; }
      const from0 = skip;
      skip = 0;
      if (!first) first = [n, from0];
      last = [n, text.length];
      for (const m of text.slice(from0).matchAll(/\S+/g)) ends.push([n, from0 + m.index! + m[0].length]);
    }
  }
  if (!first || !last || !ends.length) return () => {};
  const range = document.createRange();
  range.setStart(first[0], first[1]);
  range.setEnd(last[0], last[1]);
  // Above the highlight colours, which set their own text colour.
  const paint = () => { const h = new Highlight(range); h.priority = 10; CSS.highlights.set('bw-unwritten', h); };
  paint();
  // Long text writes faster, so it never takes more than `maxMs`.
  const step = Math.max(1, Math.ceil((ends.length * msPerWord) / maxMs));
  const tick = Math.max(16, Math.min(msPerWord, maxMs / ends.length));
  let i = 0;
  let timer = 0;
  const stop = () => { clearInterval(timer); CSS.highlights.delete('bw-unwritten'); };
  timer = window.setInterval(() => {
    i += step;
    if (i >= ends.length) { stop(); return; }
    const [node, at] = ends[i - 1];
    try { range.setStart(node, at); paint(); } catch { stop(); } // the text changed under us
  }, tick);
  return stop;
};
