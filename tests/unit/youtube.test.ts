import { describe, expect, it } from 'vitest';
import { youtubeId, youtubeUrl } from '../../shared/youtube';

describe('YouTube links', () => {
  it('finds the video in every kind of link', () => {
    const id = 'WUvTyaaNkzM';
    for (const link of [
      `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=42s&list=PL1`, `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`, `https://youtu.be/${id}?si=abc`, `youtu.be/${id}`, `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/live/${id}?feature=share`, `https://www.youtube-nocookie.com/embed/${id}`,
      `  https://www.youtube.com/watch?v=${id}  `, id,
    ]) expect(youtubeId(link), link).toBe(id);
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'hello', 'https://vimeo.com/12345678', 'https://www.youtube.com/', 'https://www.youtube.com/watch?v=short', 'https://evil.com/watch?v=WUvTyaaNkzM', 'https://youtu.be/']) {
      expect(youtubeId(bad), bad).toBeNull();
    }
  });

  it('links to a moment', () => {
    expect(youtubeUrl('WUvTyaaNkzM')).toBe('https://www.youtube.com/watch?v=WUvTyaaNkzM');
    expect(youtubeUrl('WUvTyaaNkzM', 95.7)).toBe('https://www.youtube.com/watch?v=WUvTyaaNkzM&t=95s');
  });
});

describe('tidying the transcript', () => {
  it('splits a very long paragraph at sentence ends, spreading the times to the next one', async () => {
    const { tidyTranscript } = await import('../../shared/youtube');
    const long = 'This is one sentence about calculus and areas. '.repeat(60);
    const out = tidyTranscript({ speech: true, length: 300, segments: [{ start: 100, text: long }, { start: 10, text: 'Intro.' }, { start: 250, text: 'End.' }] });
    expect(out.segments[0]).toEqual({ start: 10, text: 'Intro.' });
    const middle = out.segments.slice(1, -1);
    expect(middle.length).toBeGreaterThan(3);
    expect(middle.every((s) => s.text.length <= 650 && /\.$/.test(s.text))).toBe(true);
    expect(middle[0].start).toBe(100);
    expect(middle.every((s, i) => i === 0 || s.start > middle[i - 1].start)).toBe(true);
    expect(middle.at(-1)!.start).toBeLessThan(250);
    expect(out.segments.at(-1)).toEqual({ start: 250, text: 'End.' });
  });

  it('reads times the model wrote as minutes and seconds run together (1:07 → 107)', async () => {
    const { tidyTranscript, looksLikeClock } = await import('../../shared/youtube');
    const clock = [15, 58, 107, 115, 127, 146, 200, 223, 251, 300, 560, 642, 1612, 1638];
    expect(looksLikeClock(clock)).toBe(true);
    expect(looksLikeClock([15, 58, 75, 99, 130, 171, 205, 266, 290, 333, 388, 412])).toBe(false); // real seconds
    const out = tidyTranscript({ speech: true, length: 1705, segments: clock.map((start, i) => ({ start, text: `p${i}.` })) });
    expect(out.segments.map((s) => s.start)).toEqual([15, 58, 67, 75, 87, 106, 120, 143, 171, 180, 360, 402, 972, 998]);
  });

  it('squeezes times that ran past the end of the video', async () => {
    const { tidyTranscript } = await import('../../shared/youtube');
    const out = tidyTranscript({ speech: true, length: 1024, segments: [{ start: 0, text: 'a' }, { start: 800, text: 'b' }, { start: 1612, text: 'c' }] });
    expect(out.segments.at(-1)!.start).toBeLessThan(1024);
    expect(out.segments.map((s) => s.start)).toEqual([...out.segments.map((s) => s.start)].sort((x, y) => x - y));
  });
});
