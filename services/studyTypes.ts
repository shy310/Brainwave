import type {
  Exercise,
  GradeLevel,
  Language,
  Message,
  Subject,
} from "../types";

export interface StudySource {
  id: string;
  kind: "pdf" | "photo" | "text" | "transcript" | "topic" | "legacy";
  name: string;
  pages: { number: number; text: string }[];
  reviewed: boolean;
}
export interface StudySet {
  messages?: Message[];
  id: string;
  ownerId: string;
  title: string;
  createdAt: string;
  language: Language;
  grade: GradeLevel;
  subject: Subject;
  source: StudySource;
  notes: string;
  cards: { front: string; back: string; pages: number[] }[];
  questions: (Exercise & { sourcePages: number[] })[];
}
export interface ActivityResult {
  id: string;
  activityId: string;
  skillTag: string;
  subject: Subject;
  questionType: Exercise["questionType"];
  difficulty: number;
  correct: boolean;
  hintsUsed: number;
  revealed: boolean;
  answer: string;
  feedback: string;
  kind: "question" | "teach";
  ts: string;
}
export interface StudySprint {
  id: string;
  ownerId: string;
  setId: string;
  minutes: 5 | 10 | 15;
  createdAt: string;
  completedAt?: string;
  step: number;
  questionIds: string[];
  results: ActivityResult[];
  drafts: Record<string, string>;
  hints: Record<string, number>;
  reveals: Record<string, boolean>;
  messages: Message[];
}
export interface StudyLibrary {
  version: 1;
  sets: StudySet[];
  sprints: StudySprint[];
  importedLegacyIds: string[];
}
