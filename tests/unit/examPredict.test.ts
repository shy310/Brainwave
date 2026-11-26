import { describe, expect, it } from 'vitest';
import { EXAM_CUE, cleanPrediction, mockMinutes, predictionText, rankLectures } from '../../shared/examPredict';

const seg = (start: number, text: string) => ({ start, text });

describe('exam predictor', () => {
  it('spots exam cues in every language', () => {
    for (const s of ['This will be on the exam', 'זה יהיה במבחן', 'שימו לב לזה', 'هذا مهم جدا', 'Это будет на экзамене', 'Remember this formula']) expect(EXAM_CUE.test(s)).toBe(true);
    expect(EXAM_CUE.test('The weather is nice')).toBe(false);
  });

  it('sends notes and the timed transcript, all of it when it fits', () => {
    const text = predictionText({ notes: { summary: 'Sum', sections: [{ heading: 'H', points: ['p'] }], reminders: ['HW 3'] }, segments: [seg(0, 'Hello'), seg(75, 'Key idea')] }, [false, true], 10_000);
    expect(text).toContain('Notes:\nSum\n# H\n- p\nReminders the lecturer gave:\n- HW 3');
    expect(text).toContain('[0:00] Hello\n[1:15] ⭐ Key idea');
  });

  it('keeps marked and exam-cue lines when the lecture is too long, in order', () => {
    const segments = Array.from({ length: 400 }, (_, i) => seg(i * 10, `Filler sentence number ${i} about nothing much at all.`));
    segments[300] = seg(3000, 'This will be on the exam: the chain rule.');
    const marked = segments.map((_, i) => i === 350);
    const text = predictionText({ segments }, marked, 3000);
    expect(text.length).toBeLessThanOrEqual(3000);
    expect(text).toContain('[50:00] This will be on the exam');
    expect(text).toContain('⭐ Filler sentence number 350');
    const times = [...text.matchAll(/\[(\d+):(\d+)\]/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.length).toBeGreaterThan(10); // evenly sampled too
  });

  it('tidies the prediction: order, repeats, evidence from real lectures only', () => {
    const topics = cleanPrediction({ topics: [
      { title: 'Limits', likelihood: 'low', why: 'Once', evidence: [] },
      { title: 'Chain rule', likelihood: 'high', why: 'Said it is on the exam', evidence: [{ lecture: 2, quote: '⭐ on the exam', at: 300 }, { lecture: 9, quote: 'x', at: 1 }] },
      { title: 'chain rule', likelihood: 'medium', why: 'dup', evidence: [] },
      { title: 'Product rule', likelihood: 'medium', why: 'Example', evidence: [{ lecture: 1, quote: 'notes line', at: null }, { lecture: 1, quote: 'late', at: 99_999 }] },
    ] }, ['a', 'b'], [600, 600]);
    expect(topics.map((t) => t.title)).toEqual(['Chain rule', 'Product rule', 'Limits']);
    expect(topics[0].evidence).toEqual([{ lectureId: 'b', quote: 'on the exam', at: 300 }]);
    expect(topics[1].evidence).toEqual([{ lectureId: 'a', quote: 'notes line' }, { lectureId: 'a', quote: 'late' }]);
  });

  it('puts the lectures behind likely topics first, and times the mock exam', () => {
    const topics = [{ title: 't', likelihood: 'high' as const, why: '', evidence: [{ lectureId: 'c', quote: 'q' }] },
      { title: 'u', likelihood: 'low' as const, why: '', evidence: [{ lectureId: 'a', quote: 'q' }] }];
    expect(rankLectures(['a', 'b', 'c'], topics)).toEqual(['c', 'a', 'b']);
    expect(mockMinutes([{ kind: 'choice' }, { kind: 'input' }, { kind: 'open' }])).toBe(6);
    expect(mockMinutes([{ kind: 'choice' }])).toBe(5);
  });
});
