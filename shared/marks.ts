// "Mark as important" while recording: the student taps when the teacher says
// something that matters ("this will be on the test"). A mark is a time in
// seconds; it covers what was said a little before the tap and just after it.

import type { Segment } from './lectures.js';

/** Seconds before / after a mark that count as the marked moment. */
export const MARK_BEFORE = 30;
export const MARK_AFTER = 10;
/** Taps closer together than this are the same moment. */
export const MARK_MERGE = 5;
export const MAX_MARKS = 200;

/** Add a mark at `t` seconds (sorted; a tap right after another is ignored). */
export const addMark = (marks: number[], t: number): number[] => {
  const at = Math.max(0, Math.round(t * 10) / 10);
  if (marks.some((m) => Math.abs(m - at) < MARK_MERGE) || marks.length >= MAX_MARKS) return marks;
  return [...marks, at].sort((a, b) => a - b);
};

/** For each segment, whether it falls in a marked moment. A segment lasts until the next one starts. */
export const markedSegments = (segments: Segment[], marks: number[]): boolean[] =>
  segments.map((s, i) => {
    const end = segments[i + 1]?.start ?? s.start + 60;
    return marks.some((m) => s.start <= m + MARK_AFTER && end > m - MARK_BEFORE);
  });

/** The transcript for the AI, with ⭐ in front of the marked parts. */
export const transcriptWithMarks = (segments: Segment[], marks: number[]): string => {
  const marked = markedSegments(segments, marks);
  return segments.map((s, i) => s.text.trim() && `${marked[i] ? '⭐ ' : ''}${s.text.trim()}`).filter(Boolean).join('\n\n');
};

/** The segment each mark points at: the last one starting at or before it. */
export const markSegment = (segments: Segment[], mark: number): number => {
  let found = 0;
  segments.forEach((s, i) => { if (s.start <= mark) found = i; });
  return found;
};
