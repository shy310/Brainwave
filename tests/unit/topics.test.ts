import { describe, expect, it } from 'vitest';
import { candidateTopics, cleanTopicIds, words } from '../../shared/topicMatch';
import { findTopic } from '../../shared/curriculum';

const titles = (ids: string[]) => ids.map((id) => findTopic(id)!.topic.title.en);

describe('related Learn topics', () => {
  it('handles Hebrew prefixes and English plurals', () => {
    expect(words('הנגזרת של פונקציות')).toEqual(expect.arrayContaining(['הנגזרת', 'נגזרת', 'פונקציות']));
    expect(words('Derivatives and limits')).toEqual(expect.arrayContaining(['derivatives', 'derivative', 'limits']));
  });

  it('shortlists topics an English lecture is about', () => {
    const ids = candidateTopics('Today: photosynthesis. Plants use light, water and carbon dioxide to make glucose in the chloroplast. Photosynthesis releases oxygen.');
    expect(ids.length).toBeGreaterThan(0);
    expect(titles(ids.slice(0, 5)).join(' | ').toLowerCase()).toMatch(/photosynth|plant/);
  });

  it('shortlists topics a Hebrew lecture is about', () => {
    const ids = candidateTopics('היום נלמד על פוטוסינתזה: הצמח משתמש באור, במים ובפחמן דו-חמצני כדי לייצר סוכר. הפוטוסינתזה משחררת חמצן.');
    expect(ids.length).toBeGreaterThan(0);
    expect(titles(ids.slice(0, 5)).join(' | ').toLowerCase()).toMatch(/photosynth|plant/);
  });

  it('finds nothing for unrelated text', () => {
    expect(candidateTopics('Lorem ipsum dolor sit amet')).toEqual([]);
  });

  it('keeps only real topics, at most four', () => {
    const real = candidateTopics('fractions decimals percentages ratios equations graphs', 10);
    expect(cleanTopicIds(['nope', real[0], real[0], ...real.slice(1)])).toEqual(real.slice(0, 4));
  });
});
