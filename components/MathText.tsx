
/**
 * MathText — renders a string that may contain LaTeX math.
 *   inline math  →  $...$
 *   display math →  $$...$$
 * Plain text segments are rendered as-is.
 */
import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type SegType = 'text' | 'inline' | 'display';
interface Seg { type: SegType; content: string; }

function parse(raw: string): Seg[] {
  const segs: Seg[] = [];
  // $$...$$ must be matched before $...$ to avoid consuming the delimiters greedily
  const re = /\$\$([\s\S]*?)\$\$|\$([^\$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) segs.push({ type: 'text', content: raw.slice(last, m.index) });
    if (m[1] !== undefined) segs.push({ type: 'display', content: m[1].trim() });
    else                    segs.push({ type: 'inline',  content: m[2] });
    last = re.lastIndex;
  }
  if (last < raw.length) segs.push({ type: 'text', content: raw.slice(last) });
  return segs;
}

interface Props {
  children: string;
  className?: string;
}

const MathText: React.FC<Props> = ({ children, className }) => {
  const segments = useMemo(() => parse(children ?? ''), [children]);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <React.Fragment key={i}>{seg.content}</React.Fragment>;
        try {
          const html = katex.renderToString(seg.content, {
            displayMode: seg.type === 'display',
            throwOnError: false,
            output: 'html',
          });
          return (
            <span
              key={i}
              className={seg.type === 'display' ? 'block text-center my-3 overflow-x-auto' : 'inline align-middle mx-0.5'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          // Graceful fallback — show raw source if KaTeX throws
          return <React.Fragment key={i}>{seg.type === 'display' ? `$$${seg.content}$$` : `$${seg.content}$`}</React.Fragment>;
        }
      })}
    </span>
  );
};

export default MathText;
