import { memo, useMemo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { parseInline, parseRich, type Block, type Inline } from '@/lib/rich';
import { cn } from '@/lib/cn';

const Math = ({ tex, display }: { tex: string; display?: boolean }) => {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false, output: 'html' }),
    [tex, display],
  );
  // KaTeX escapes all text it renders; math is always laid out left-to-right.
  return display
    ? <div dir="ltr" className="my-3 overflow-x-auto overflow-y-hidden py-1 text-center" dangerouslySetInnerHTML={{ __html: html }} />
    : <span dir="ltr" className="[unicode-bidi:isolate]" dangerouslySetInnerHTML={{ __html: html }} />;
};

const inline = (nodes: Inline[]): ReactNode[] => nodes.map((n, i) => {
  switch (n.t) {
    case 'text': return n.v;
    case 'br': return <br key={i} />;
    case 'strong': return <strong key={i} className="font-semibold">{inline(n.c)}</strong>;
    case 'em': return <em key={i}>{inline(n.c)}</em>;
    case 'code': return <code key={i} dir="ltr" className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.9em]">{n.v}</code>;
    case 'math': return <Math key={i} tex={n.v} />;
  }
});

const block = (b: Block, i: number): ReactNode => {
  switch (b.t) {
    case 'p': return <p key={i} dir="auto">{inline(b.c)}</p>;
    case 'h': {
      const cls = b.level === 1 ? 'text-xl' : b.level === 2 ? 'text-lg' : 'text-base';
      return <p key={i} dir="auto" role="heading" aria-level={b.level + 2} className={cn('font-semibold', cls)}>{inline(b.c)}</p>;
    }
    case 'ul': return <ul key={i} className="list-disc space-y-1 ps-6">{b.items.map((it, j) => <li key={j} dir="auto">{inline(it)}</li>)}</ul>;
    case 'ol': return <ol key={i} start={b.start} className="list-decimal space-y-1 ps-6">{b.items.map((it, j) => <li key={j} dir="auto">{inline(it)}</li>)}</ol>;
    case 'code': return (
      <pre key={i} dir="ltr" className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
        <code>{b.v}</code>
      </pre>
    );
    case 'math': return <Math key={i} tex={b.v} display />;
    case 'quote': return <blockquote key={i} className="border-s-4 border-brand-300 ps-3 text-muted">{inline(b.c)}</blockquote>;
  }
};

/** Render AI-written Markdown with LaTeX math, safely. */
export const Rich = memo(({ text, className }: { text: string; className?: string }) => {
  const blocks = useMemo(() => parseRich(text), [text]);
  return <div className={cn('space-y-3 leading-relaxed', className)}>{blocks.map(block)}</div>;
});
Rich.displayName = 'Rich';

/** Single-line variant for options, titles and short answers. */
export const RichInline = ({ text }: { text: string }) => {
  const nodes = useMemo(() => parseInline(text.trim()), [text]);
  return <>{inline(nodes)}</>;
};
