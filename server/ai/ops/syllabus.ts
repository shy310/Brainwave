import { defineOp } from '../ops.js';
import { SyllabusInputSchema, SyllabusSchema, cleanSyllabus } from '../../../shared/syllabus.js';

/** Read a course syllabus: class times, exams and deadlines, with real dates. */
export const syllabusOp = defineOp({
  name: 'syllabus',
  input: SyllabusInputSchema,
  output: SyllabusSchema,
  cost: 1,
  maxTokens: 3000,
  temperature: 0.1,
  build: ({ text, today }) => [
    {
      role: 'system',
      content: `You read course syllabuses and pull out the schedule. The syllabus may be in any language; keep titles in the syllabus's language.

Today is ${today}.

Return:
- "course": the course name (short).
- "meetings": when the class meets each week: "weekday" 0 = Sunday … 6 = Saturday, "starts" and "ends" as 24-hour "HH:MM", "label" like "Lecture", "Lab" or "Tutorial" in the syllabus's language. Only times the syllabus states.
- "exams": midterms, finals and other exams, with "date" as "YYYY-MM-DD".
- "deadlines": assignments, homework, problem sets, quizzes, projects, papers and presentations with a due date, each with "kind" (assignment / quiz / project / other) and "date".

Rules:
- Only include an exam or deadline when the syllabus gives (or lets you work out) a specific date. If it says "Week 6" and gives the semester's start date, work the date out; otherwise leave it out.
- When a date has no year, use the year that makes it the next such date on or after the semester start (or after today if there is none).
- Never invent anything. Empty lists are fine.`,
    },
    { role: 'user', content: `Syllabus:\n"""\n${text}\n"""` },
  ],
  post: (out, { today }) => cleanSyllabus(out, today),
});
