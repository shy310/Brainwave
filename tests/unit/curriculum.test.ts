import { describe, expect, it } from 'vitest';
import { BANDS, COURSES, SUBJECTS, allTopicIds, bandForGrade, courseFor, findTopic } from '../../shared/curriculum';
import { GRADES } from '../../shared/grades';

describe('curriculum', () => {
  it('has one course per subject and band', () => {
    for (const s of SUBJECTS) for (const b of BANDS) expect(courseFor(s, b), `${s}/${b}`).toBeDefined();
    expect(COURSES).toHaveLength(SUBJECTS.length * BANDS.length);
  });

  it('has unique ids and valid prerequisites', () => {
    const ids = allTopicIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) for (const p of findTopic(id)!.topic.prerequisites) expect(findTopic(p), `${id} → ${p}`).toBeDefined();
  });

  it('is fully translated', () => {
    for (const id of allTopicIds()) {
      const { topic, unit } = findTopic(id)!;
      for (const text of [topic.title, topic.description, unit.title]) {
        expect(text.en.trim()).not.toBe('');
        expect(text.he).toMatch(/[֐-׿]/);
      }
    }
  });

  it('maps every grade to a band', () => {
    for (const g of GRADES) expect(BANDS).toContain(bandForGrade(g));
    expect(bandForGrade('5')).toBe('4-6');
  });
});
