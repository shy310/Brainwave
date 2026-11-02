import type { Grade } from './grades';
import { COURSES } from './curriculumData';
import type { Band, Course, Subject, Topic, Unit } from './curriculumTypes';

export * from './curriculumTypes';
export { COURSES };

export const bandForGrade = (g: Grade): Band => {
  if (g === 'k') return 'k';
  if (g === 'college') return 'college';
  const n = Number(g);
  if (n <= 3) return '1-3';
  if (n <= 6) return '4-6';
  if (n <= 8) return '7-8';
  if (n <= 10) return '9-10';
  return '11-12';
};

export interface TopicRef {
  topic: Topic;
  unit: Unit;
  course: Course;
}

const topicIndex = new Map<string, TopicRef>();
for (const course of COURSES) {
  for (const unit of course.units) {
    for (const topic of unit.topics) topicIndex.set(topic.id, { topic, unit, course });
  }
}

export const findTopic = (id: string): TopicRef | undefined => topicIndex.get(id);
export const findCourse = (id: string): Course | undefined => COURSES.find((c) => c.id === id);
export const coursesForBand = (band: Band): Course[] => COURSES.filter((c) => c.band === band);
export const courseFor = (subject: Subject, band: Band): Course | undefined =>
  COURSES.find((c) => c.subject === subject && c.band === band);
export const allTopicIds = (): string[] => [...topicIndex.keys()];
export const courseTopics = (course: Course): Topic[] => course.units.flatMap((u) => u.topics);
