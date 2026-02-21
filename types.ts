
export type Language = 'en' | 'he' | 'ar' | 'ru';
export type Direction = 'ltr' | 'rtl';

export enum Subject {
  MATH = 'MATH',
  SCIENCE = 'SCIENCE',
  LANGUAGE = 'LANGUAGE',
  HISTORY = 'HISTORY',
  CODING = 'CODING',
  ECONOMICS = 'ECONOMICS'
}

export enum GradeLevel {
  // Legacy grouped values — kept for backward compatibility with stored user data
  KINDER = 'KINDER',
  ELEMENTARY_1_3 = 'ELEMENTARY_1_3',
  ELEMENTARY_4_6 = 'ELEMENTARY_4_6',
  MIDDLE_7_8 = 'MIDDLE_7_8',
  HIGH_9_10 = 'HIGH_9_10',
  HIGH_11_12 = 'HIGH_11_12',
  COLLEGE_FRESHMAN = 'COLLEGE_FRESHMAN',
  COLLEGE_ADVANCED = 'COLLEGE_ADVANCED',
  // Individual grade years
  GRADE_1 = 'GRADE_1',
  GRADE_2 = 'GRADE_2',
  GRADE_3 = 'GRADE_3',
  GRADE_4 = 'GRADE_4',
  GRADE_5 = 'GRADE_5',
  GRADE_6 = 'GRADE_6',
  GRADE_7 = 'GRADE_7',
  GRADE_8 = 'GRADE_8',
  GRADE_9 = 'GRADE_9',
  GRADE_10 = 'GRADE_10',
  GRADE_11 = 'GRADE_11',
  GRADE_12 = 'GRADE_12',
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  MULTI_STEP = 'MULTI_STEP',
  FILL_IN_BLANK = 'FILL_IN_BLANK',
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  isLocked: boolean;
  mastery: number;
}

export interface Unit {
  id: string;
  title: string;
  topics: Topic[];
}

export interface Course {
  id: string;
  subject: Subject;
  title: string;
  description: string;
  gradeLevel: GradeLevel;
  iconName: string;
  progress: number;
  units: Unit[];
}

// Skill mastery for granular progress tracking
export interface SkillMastery {
  skillTag: string;
  masteryScore: number; // 0–100 EMA
  lastPracticed: string; // ISO date
  attemptsTotal: number;
  attemptsCorrect: number;
}

// Per-topic progress stored inside ProgressMap
export interface TopicProgress {
  topicId: string;
  mastery: number;        // 0–100
  attemptsTotal: number;
  attemptsCorrect: number;
  lastPracticed: string;
  skills: Record<string, SkillMastery>;
}

// Map of topicId → progress
export type ProgressMap = Record<string, TopicProgress>;

// A section of a lesson (intro, concept, example, practice cue)
export interface LessonSection {
  type: 'intro' | 'concept' | 'example' | 'summary';
  heading: string;
  body: string;
}

// Full AI-generated lesson for a topic
export interface Lesson {
  topicId: string;
  topicTitle: string;
  sections: LessonSection[];
  keyPoints: string[];
  diagramPrompt?: string;   // optional prompt for visual diagram
}

// Result of evaluating a student answer
export interface AnswerEvaluation {
  isCorrect: boolean;
  score: number;           // 0–100
  feedback: string;        // explanation of what was right/wrong
  followUp?: string;       // Socratic follow-up question if partially correct
  hint?: string;           // hint if score < 50 and not yet submitted
  fullSolution?: string;   // revealed after max attempts
}

// Result of AI upload analysis
export interface UploadAnalysis {
  summary: string;
  topics: string[];
  suggestedExercises: string[];
  detectedSubject: Subject | null;
  detectedGrade: GradeLevel | null;
}

export type SessionPhase = 'lesson' | 'exercises' | 'review' | 'upload_analysis';

export interface LearningSession {
  subject: Subject;
  grade: GradeLevel;
  topicId: string | null;
  topicTitle: string;
  phase: SessionPhase;
  lesson: Lesson | null;
  uploadAnalysis: UploadAnalysis | null;
  studyContext: Attachment[];
  quiz?: Exercise[]; // cached so language switches don't trigger regeneration
}

export interface UserProfile {
  id: string;
  username: string;
  password?: string;
  name: string;
  email?: string;
  avatar?: string;
  gradeLevel: GradeLevel;
  preferredLanguage: Language;
  enrolledCourses: string[];
  totalXp: number;
  streakDays: number;
  isRegistered: boolean;
  progressMap: ProgressMap;
  lastActivityDate?: string; // ISO date for streak calculation
}

export interface AppState {
  isLoggedIn: boolean;
  theme: 'light' | 'dark';
  language: Language;
  user: UserProfile;
  activeView: 'dashboard' | 'courses' | 'exercise' | 'settings' | 'tools' | 'profile' | 'lesson' | 'progress' | 'review';
  activeCourseId: string | null;
  activeTopicId: string | null;
  currentSession: LearningSession | null;
  messages: Message[];
  currentContext: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
  timestamp: number;
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string;
}

export interface ExerciseOption {
  id: string;
  text: string;
}

export interface Exercise {
  id: string;
  courseId?: string;
  topicId?: string;
  questionType: QuestionType;
  difficulty: number;
  question: string;
  options: ExerciseOption[];           // for MULTIPLE_CHOICE
  correctOptionId?: string;            // for MULTIPLE_CHOICE
  sampleAnswer?: string;               // for SHORT_ANSWER / FILL_IN_BLANK
  steps?: string[];                    // for MULTI_STEP: expected step descriptions
  skillTag?: string;
  xpValue?: number;
  explanation: string;
  hint: string;
}

export interface Translations {
  signIn: string;
  register: string;
  username: string;
  password: string;
  name: string;
  noAccount: string;
  hasAccount: string;
  authError: string;
  userExists: string;
  googleSignIn: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  createAccount: string;
  enterUsername: string;
  selectGrade: string;
  finish: string;
  signOut: string;
  profile: string;
  dashboard: string;
  courses: string;
  practice: string;
  tutor: string;
  settings: string;
  aiTools: string;
  learning: string;
  tools: string;
  welcome: string;
  continueLearning: string;
  dailyProgress: string;
  recommended: string;
  start: string;
  resume: string;
  locked: string;
  uploadMaterial: string;
  uploadDesc: string;
  mastery: string;
  streak: string;
  xp: string;
  topics: string;
  units: string;
  questions: string;
  generateQuiz: string;
  loading: string;
  submit: string;
  next: string;
  hint: string;
  correct: string;
  incorrect: string;
  explanation: string;
  chatPlaceholder: string;
  theme: string;
  language: string;
  noActiveCourses: string;
  exploreLibrary: string;
  browseLibrary: string;
  backToDashboard: string;
  difficulty: string;
  fileTypeHint: string;
  mentorAiTutor: string;
  watching: string;
  attachment: string;
  upload: string;
  thinking: string;
  reset: string;
  subjects: string;
  selectLevel: string;
  selectSubject: string;
  generalPractice: string;
  toolsHeader: string;
  toolsDesc: string;
  dropFiles: string;
  uploadedDocs: string;
  howItWorks: string;
  howItWorksSteps: string[];
  genQuizDesc: string;
  domainChoiceDesc: string;
  imageGen: string;
  imageGenDesc: string;
  imageEdit: string;
  imageEditDesc: string;
  videoAnalysis: string;
  videoAnalysisDesc: string;
  searchGrounding: string;
  searchGroundingDesc: string;
  courseCompleted: string;
  grades: Record<GradeLevel, string>;
  subjectsList: Record<Subject, string>;
  readyToLearn: string;
  dayStreakBadge: string;
  chooseCurriculumHint: string;
  masterFundamentals: string;
  launchTool: string;
  backToLab: string;
  connectingToAI: string;
  preparingExercises: string;
  scoredOutOf: string;
  tryNewSet: string;
  search: string;
  // New keys for redesign
  startLesson: string;
  startPractice: string;
  viewProgress: string;
  lessonComplete: string;
  reviewWeakness: string;
  analyzingUpload: string;
  uploadAnalysisReady: string;
  generatingLesson: string;
  revealSolution: string;
  checkAnswer: string;
  typeYourAnswer: string;
  stepByStep: string;
  showSteps: string;
  overallMastery: string;
  weakAreas: string;
  strongAreas: string;
  practiceMore: string;
  continueLesson: string;
  keyPoints: string;
  uploadToLearn: string;
  detectedTopics: string;
  suggestedPractice: string;
  tryAgain: string;
  partiallyCorrect: string;
  keepGoing: string;
  maxAttemptsReached: string;
  progress: string;
  backToLesson: string;
}
