
export type Language = 'en' | 'he' | 'ar' | 'ru';
export type Direction = 'ltr' | 'rtl';

export enum Subject {
  MATH = 'MATH',
  SCIENCE = 'SCIENCE',
  GEOGRAPHY = 'GEOGRAPHY',
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
  TRUE_FALSE = 'TRUE_FALSE',
  NUMERIC = 'NUMERIC',
  MULTI_SELECT = 'MULTI_SELECT',
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

// A section of a lesson. Lessons are a paced sequence of short, varied cards:
// - intro / concept / example / scenario / summary — bite-size explanatory cards
// - check — a quick tap-to-answer question with instant feedback
// - challenge — a think-first prompt whose answer is revealed on demand
export type LessonSectionType =
  | 'intro' | 'concept' | 'example' | 'scenario' | 'check' | 'challenge' | 'summary';

export interface LessonSection {
  type: LessonSectionType;
  heading: string;
  body: string;              // short: 2–4 sentences max
  bullets?: string[];        // optional visual bullet list (kept short)
  // Interactive fields — used by 'check' (and 'challenge' reveals via explanation)
  question?: string;
  options?: string[];        // 3 answer choices for 'check'
  correctIndex?: number;     // index into options
  explanation?: string;      // one-sentence "why" shown after answering / revealing
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
  // ── Engagement / retention ─────────────────────────────────────────────────
  dailyXpGoal?: number;          // XP target for today (default 30)
  todayXp?: number;              // XP earned during the current day
  lastXpDate?: string;           // YYYY-MM-DD the todayXp counter belongs to
  lastGoalMetDate?: string;      // YYYY-MM-DD the daily goal was last completed
  streakFreezes?: number;        // protects the streak across one missed day
  bestStreak?: number;           // longest streak ever reached
  dailyGoalsMet?: number;        // total days the daily goal was completed
  unlockedAchievements?: string[]; // achievement ids the user has earned
  soundEnabled?: boolean;        // reward sound cues toggle
  // ── Adaptive learning ──────────────────────────────────────────────────────
  skillMap?: SkillMap;           // per-skill mastery records (Mastery Map)
  activeQuests?: ErrorQuest[];   // personal error quests in progress (cap 3)
  completedQuests?: CompletedQuest[]; // recent completions (cooldown window)
  questBadges?: string[];        // collectible badges earned from quests
}

// ─── ADAPTIVE LEARNING: SKILL MASTERY ────────────────────────────────────────
// The central per-skill record that powers the Mastery Map and every adaptive
// feature. Updated deterministically by services/masteryEngine.ts.

export type SkillStatus = 'new' | 'learning' | 'developing' | 'secure' | 'mastered' | 'needs_review';

export type MistakeKind =
  | 'sign'        // right magnitude, wrong sign
  | 'magnitude'   // off by a power of ten / decimal slip
  | 'arithmetic'  // close numeric miss (calculation slip)
  | 'units'       // value right, unit missing or wrong
  | 'concept'     // chose a plausible-but-wrong idea (distractor)
  | 'incomplete'  // partial multi-select / missing steps
  | 'recall'      // blank / unrelated / couldn't retrieve the fact
  | 'other';

export type ConfidenceLevel = 1 | 2 | 3; // 1 = guessing, 2 = think so, 3 = sure

// One answered question, as reported by the exercise UI
export interface SkillAttemptEvent {
  skillTag: string;
  subject?: Subject;
  topicId?: string | null;
  correct: boolean;
  questionType: QuestionType;
  difficulty: number;
  timeMs?: number;
  hintsUsed: number;
  skippedQuestion?: boolean;
  mistakeKind?: MistakeKind;    // the mistake made (final answer, or the first wrong try when later corrected)
  corrected?: boolean;          // got it right on a retry of the same question
  confidence?: ConfidenceLevel; // when the student volunteered it
  // Open-format correct answers count as "can explain" evidence — the student
  // produced the answer rather than recognizing it among options.
  explainEvidence?: boolean;
  ts?: string;                  // ISO timestamp (defaults to now)
}

// Compact stored attempt (recent history, capped)
export interface SkillAttempt {
  ts: string;
  correct: boolean;
  questionType: QuestionType;
  difficulty: number;
  timeMs?: number;
  hintsUsed: number;
  mistakeKind?: MistakeKind;
  corrected?: boolean;
  confidence?: ConfidenceLevel;
}

export interface SkillRecord {
  skillTag: string;
  subject?: Subject;
  topicId?: string | null;
  status: SkillStatus;
  masteryScore: number;              // 0–100 EMA, difficulty-weighted
  attemptsTotal: number;
  attemptsCorrect: number;
  streak: number;                    // consecutive correct answers
  lastPracticed: string;             // ISO — any activity
  lastReviewed: string;              // ISO — last successful recall after a gap
  reviewDue: string;                 // ISO — spaced-repetition next review date
  reviewIntervalDays: number;        // current position on the interval ladder
  successDays: string[];             // distinct local days with ≥1 correct (cap 12)
  formatsCorrect: string[];          // question formats answered correctly (cap 8)
  hintsTotal: number;
  avgTimeMs?: number;
  mistakeCounts: Partial<Record<MistakeKind, number>>;
  mistakesTotal: number;
  correctedCount: number;            // mistakes later fixed by the student
  canExplain: boolean;               // produced (not just recognized) a correct answer
  confidenceSum: number;             // for average confidence when volunteered
  confidenceCount: number;
  recent: SkillAttempt[];            // last 10 attempts, newest last
}

export type SkillMap = Record<string, SkillRecord>;

// ─── ADAPTIVE LEARNING: PERSONAL ERROR QUESTS ────────────────────────────────
// Short personalized missions generated from a student's RECURRING mistake
// pattern on a skill — targeting the misconception, never repeating the same
// question, and always framed encouragingly.

export type QuestStageType =
  | 'reminder'      // quick visual re-explanation of the rule
  | 'example'       // one clean worked example
  | 'spot-mistake'  // find the error in a worked solution
  | 'guided-fix'    // fix it with scaffolding
  | 'independent'   // similar question, no help
  | 'challenge'     // optional stretch question
  | 'reflection';   // explain / pick the best explanation of the rule

export interface QuestStage {
  type: QuestStageType;
  heading: string;
  body: string;
  bullets?: string[];
  // Interactive stages (spot-mistake, guided-fix, independent, challenge, reflection)
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
}

export interface ErrorQuest {
  id: string;
  skillTag: string;
  subject?: Subject;
  topicId?: string | null;
  mistakeKind: MistakeKind;
  title: string;             // adventurous, non-punitive (e.g. "The Sign Detective")
  reason: string;            // encouraging explanation of why this quest exists
  estimatedMinutes: number;
  difficulty: number;        // 1–5
  xpReward: number;
  badgeReward: string;       // collectible emoji badge earned on completion
  stages: QuestStage[];      // filled by AI generation when the quest starts
  createdAt: string;
  language: Language;        // language the stages were generated in
  // Progress
  stageIndex: number;
  correctInQuest: number;
  completedAt?: string;
}

// Record kept after completion (cooldown + review follow-up bookkeeping)
export interface CompletedQuest {
  id: string;
  skillTag: string;
  mistakeKind: MistakeKind;
  completedAt: string;
}

// ─── ENGAGEMENT: ACHIEVEMENTS ─────────────────────────────────────────────────

export type AchievementCategory = 'streak' | 'xp' | 'mastery' | 'goal' | 'milestone';

// A snapshot of user stats used to evaluate achievement predicates
export interface AchievementStats {
  totalXp: number;
  streakDays: number;
  bestStreak: number;
  topicsMastered: number;      // topics with mastery >= 80
  topicsStarted: number;       // topics with any attempts
  dailyGoalsMet: number;
}

export interface Achievement {
  id: string;
  category: AchievementCategory;
  icon: string;                // lucide icon name
  xpReward: number;
  // Localized copy keyed by language
  title: Record<Language, string>;
  description: Record<Language, string>;
  // Returns true when the achievement is earned for the given stats
  predicate: (s: AchievementStats) => boolean;
  // Progress 0–1 toward unlocking (for "next achievement" nudges)
  progress: (s: AchievementStats) => number;
}

export interface AppState {
  isLoggedIn: boolean;
  theme: 'light' | 'dark';
  language: Language;
  user: UserProfile;
  activeView: 'dashboard' | 'courses' | 'exercise' | 'settings' | 'profile' | 'lesson' | 'progress' | 'review' | 'achievements' | 'leaderboard' | 'mastery' | 'quest';
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
  options: ExerciseOption[];           // for MULTIPLE_CHOICE / TRUE_FALSE / MULTI_SELECT
  correctOptionId?: string;            // for MULTIPLE_CHOICE / TRUE_FALSE
  correctOptionIds?: string[];         // for MULTI_SELECT (every correct option)
  sampleAnswer?: string;               // for SHORT_ANSWER / FILL_IN_BLANK / NUMERIC
  // Machine-checkable canonical answer: a pure math expression or value
  // ("3/4", "0.5", "42", "5 cm"). The math engine — not the AI — verifies and
  // judges answers against this.
  answerExpression?: string;
  acceptableAnswers?: string[];        // additional valid answers (synonyms, forms)
  unitRequired?: boolean;              // answer must include a unit
  tolerance?: number;                  // absolute tolerance for decimal answers
  roundTo?: number;                    // question explicitly asks to round to N decimals
  steps?: string[];                    // for MULTI_STEP: expected step descriptions
  skillTag?: string;
  xpValue?: number;
  explanation: string;
  hint: string;
}

// ─── PRESENTATION GENERATOR ──────────────────────────────────────────────────

export interface PresentationSlide {
  slideNumber: number;
  title: string;
  layout?: 'title' | 'content' | 'split' | 'quote';
  bullets: string[];
  body?: string;
  imageKeyword?: string;
  speakerNotes: string;
}

export interface Presentation {
  title: string;
  subject: string;
  totalSlides: number;
  slides: PresentationSlide[];
}

// ─── CODE LAB ────────────────────────────────────────────────────────────────

export type CodeLanguage = 'python' | 'javascript' | 'java' | 'cpp' | 'sql';

export interface CodingChallenge {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  expectedBehavior: string;
  hints: string[];
  xpValue: number;
}

export interface PistonRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ─── EDUCATIONAL GAMES ────────────────────────────────────────────────────────

export type GameType = 'balloon-pop' | 'cave-runner' | 'memory-match' | 'bug-fix' | 'picture-tap' | 'word-scramble';

export interface GameQuestion {
  id: string;
  question: string;
  answer: string;
  distractors?: string[];
}

export interface MemoryCard {
  id: string;
  pairId: string;
  face: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface BugFix {
  lineIndex: number;
  buggyLine: string;
  fixedLine: string;
  hint: string;
}

export interface BuggyCode {
  title: string;
  narrative: string;
  language: string;
  code: string[];
  bugs: BugFix[];
}

// ─── DEBATE ARENA ─────────────────────────────────────────────────────────────

export interface DebateTurn {
  role: 'ai' | 'user';
  text: string;
  score?: number;
  feedback?: string;
}

// ─── STORY ENGINE ─────────────────────────────────────────────────────────────

export interface StoryChapter {
  role: 'ai' | 'user';
  text: string;
  prompt?: string;
}

export interface StoryEvaluation {
  creativity: number;
  vocabulary: number;
  narrative: number;
  overall: number;
  feedback: string;
}

// ─── CODE LAB (v2) ────────────────────────────────────────────────────────────

export interface ChallengeTestResult {
  passed: boolean;
  testLabel: string;
  actual: string;
}

export interface CodeReview {
  suggestions: string[];
  conceptTags: string[];
}

// ─── DEBATE ARENA (v2) ───────────────────────────────────────────────────────

export type DebateFormat = 'classic' | 'devils-advocate' | 'steel-man' | 'socratic';
export type DebateDifficulty = 'casual' | 'competitive' | 'academic';

export interface ArgumentScore {
  logic: number;
  evidence: number;
  persuasiveness: number;
  relevance: number;
  explanation: string;
}

// ─── STORY ENGINE (v2) ───────────────────────────────────────────────────────

export type StoryMode = 'collaborative' | 'solo' | 'guided';
export type StoryLength = 'short' | 'medium' | 'epic';
export type WritingFocus = 'descriptive' | 'dialogue' | 'plot-twists' | 'character';

export interface BranchChoice {
  id: string;
  text: string;
  consequence: string;
}

export interface InlineSuggestion {
  text: string;
  type: 'sensory' | 'motivation' | 'tension' | 'vocabulary';
}

// ─── SQL DETECTIVE (v2) ──────────────────────────────────────────────────────

export type CaseTheme = 'crime' | 'corporate' | 'archaeological' | 'medical';
export type CaseDifficulty = 'rookie' | 'detective' | 'inspector' | 'chief';

// ─── PRESENTATION (v2) ───────────────────────────────────────────────────────

export type PresentationTheme = 'vivid' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'paper';
export type PresentationAudience = 'class' | 'teacher' | 'parents' | 'competition';
export type PresStructure = 'informative' | 'persuasive' | 'how-to' | 'compare-contrast' | 'timeline';

// ─── GAMES (v2) ──────────────────────────────────────────────────────────────

export interface FlashCard {
  front: string;
  back: string;
}

export interface ConceptNode {
  id: string;
  label: string;
}

export interface ConceptEdge {
  fromId: string;
  toId: string;
  relationship: string;
}

export interface TrueFalseItem {
  statement: string;
  isTrue: boolean;
  explanation: string;
}

// ─── SQL DETECTIVE ────────────────────────────────────────────────────────────

export interface MysteryCase {
  title: string;
  description: string;
  schemaDescription: string;
  pythonSetup: string;
  suspects: string[];
  culprit: string;
  clues: string[];
}

export interface QueryResult {
  query: string;
  output: string;
  isError: boolean;
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
  // Presentation Generator
  presentationGenerator: string;
  presentationGeneratorDesc: string;
  generatePresentation: string;
  generatingPresentation: string;
  slide: string;
  ofWord: string;
  speakerNotes: string;
  enterTopicForSlides: string;
  topicPlaceholder: string;
  // Code Lab
  codeLab: string;
  codeLabDesc: string;
  selectLanguage: string;
  runCode: string;
  runningCode: string;
  outputLabel: string;
  noOutput: string;
  generateChallenge: string;
  generatingChallenge: string;
  askAboutCode: string;
  codeAiPlaceholder: string;
  challengeComplete: string;
  // Educational Games
  educationalGames: string;
  educationalGamesDesc: string;
  mathRush: string;
  mathRushDesc: string;
  wordFlash: string;
  wordFlashDesc: string;
  memoryMatch: string;
  memoryMatchDesc: string;
  livesLeft: string;
  timeLeft: string;
  gameOver: string;
  playAgain: string;
  yourScore: string;
  generatingGame: string;
  tapToFlip: string;
  matched: string;
  // Bug-Fix game
  bugFix: string;
  bugFixDesc: string;
  systemCompromised: string;
  worldSaved: string;
  missionFailed: string;
  generatingBuggyCode: string;
  submitFix: string;
  bugsRemaining: string;
  clickBugToFix: string;
  typeCorrectLine: string;
  confirmFix: string;
  // Cave Runner game
  caveRunner: string;
  caveRunnerDesc: string;
  directTheCart: string;
  // Debate Arena
  debateArena: string;
  debateArenaDesc: string;
  generatingDebate: string;
  yourArgument: string;
  submitArgument: string;
  roundLabel: string;
  debateComplete: string;
  finalDebateScore: string;
  debatePlaceholder: string;
  forSide: string;
  againstSide: string;
  // Story Engine
  storyEngine: string;
  storyEngineDesc: string;
  generatingStory: string;
  continueStoryBtn: string;
  continuingStory: string;
  writeYourChapter: string;
  storyComplete: string;
  wordsWritten: string;
  minWords: string;
  // SQL Detective
  sqlDetective: string;
  sqlDetectiveDesc: string;
  generatingMystery: string;
  runQuery: string;
  queryResults: string;
  accuseSuspect: string;
  caseSchema: string;
  caseSolved: string;
  wrongAccusation: string;
  sqlPlaceholder: string;
  // Picture Tap (K-2)
  pictureTap: string;
  pictureTapDesc: string;
  tapTheCorrect: string;
  // Word Scramble (Grades 3-5)
  wordScramble: string;
  wordScrambleDesc: string;
  unscrambleWord: string;
  clickLetters: string;
  // Upload topic selection
  selectAll: string;
  deselectAll: string;
  // Exercise feedback heading
  feedback: string;
  // Auth
  continueAsGuest: string;
  // ── Code Lab v2 ──────────────────────────────────────────────────────────
  submitSolution: string;
  testResults: string;
  passedTests: string;
  failedTests: string;
  allTestsPassed: string;
  explainError: string;
  codeReview: string;
  conceptTags: string;
  difficultyTier: string;
  nextChallenge: string;
  hintsRemaining: string;
  getHint: string;
  // ── Debate Arena v2 ──────────────────────────────────────────────────────
  debateFormat: string;
  classicFormat: string;
  devilsAdvocate: string;
  steelMan: string;
  socraticFormat: string;
  debateDifficulty: string;
  casualMode: string;
  competitiveMode: string;
  academicMode: string;
  roundCount: string;
  evidenceBtn: string;
  rebuttalsBtn: string;
  logic: string;
  persuasiveness: string;
  relevance: string;
  strongestArg: string;
  weakestArg: string;
  whatOpponentSaid: string;
  finalVerdict: string;
  winVerdict: string;
  drawVerdict: string;
  lossVerdict: string;
  // ── Story Engine v2 ──────────────────────────────────────────────────────
  writingMode: string;
  collaborativeMode: string;
  soloMode: string;
  guidedMode: string;
  storyLength: string;
  shortStory: string;
  mediumStory: string;
  epicStory: string;
  writingFocus: string;
  descriptiveFocus: string;
  dialogueFocus: string;
  plotTwistFocus: string;
  characterFocus: string;
  branchChoicePrompt: string;
  suggestionLabel: string;
  acceptSuggestion: string;
  bestSentence: string;
  vocabularyElevate: string;
  readingLevel: string;
  // ── SQL Detective v2 ─────────────────────────────────────────────────────
  caseDifficulty: string;
  rookieCase: string;
  detectiveCase: string;
  inspectorCase: string;
  chiefCase: string;
  caseTheme: string;
  crimeTheme: string;
  corporateTheme: string;
  archaeologicalTheme: string;
  medicalTheme: string;
  evidenceLog: string;
  queryExplainer: string;
  optimalSolution: string;
  efficiencyScore: string;
  newCase: string;
  // ── Educational Games v2 ─────────────────────────────────────────────────
  flashcardBlitz: string;
  flashcardBlitzDesc: string;
  wordScramblePlus: string;
  wordScramblePlusDesc: string;
  bugHunt: string;
  bugHuntDesc: string;
  conceptConnector: string;
  conceptConnectorDesc: string;
  trueFalse: string;
  trueFalseDesc: string;
  pictureThis: string;
  pictureThisDesc: string;
  dailyChallenge: string;
  highScore: string;
  knowIt: string;
  dontKnow: string;
  connectConcepts: string;
  selectRelationship: string;
  causes: string;
  requires: string;
  opposes: string;
  isTypeOf: string;
  justifyConnection: string;
  comboBonus: string;
  cardsDeck: string;
  timedMode: string;
  relaxedMode: string;
  coldFeedback: string;
  warmFeedback: string;
  hotFeedback: string;
  fixItMode: string;
  // ── Presentation Generator v2 ────────────────────────────────────────────
  slideCount: string;
  audiencePicker: string;
  audienceClass: string;
  audienceTeacher: string;
  audienceParents: string;
  audienceCompetition: string;
  structureType: string;
  informativeStructure: string;
  persuasiveStructure: string;
  howToStructure: string;
  compareContrastStructure: string;
  timelineStructure: string;
  visualTheme: string;
  editSlide: string;
  regenerateSlide: string;
  makeSimpler: string;
  moreDetailed: string;
  addSlide: string;
  deleteSlide: string;
  exportPptx: string;
  presenterTimer: string;
  generatingSlide: string;
  includes: string;
  // ── Engagement / retention ─────────────────────────────────────────────────
  dailyGoal: string;
  dailyGoalDesc: string;
  goalMet: string;
  goalMetDesc: string;
  todayProgress: string;
  xpToGo: (n: number) => string;
  setGoal: string;
  streakSaved: string;
  freezeUsed: string;
  freezesLeft: (n: number) => string;
  achievements: string;
  achievementsDesc: string;
  achievementUnlocked: string;
  nextUp: string;
  unlocked: (n: number, total: number) => string;
  leaderboard: string;
  leaderboardDesc: string;
  rank: string;
  you: string;
  yourRank: (n: number) => string;
  noRankYet: string;
  loadingBoard: string;
  rewardSounds: string;
  rewardSoundsDesc: string;
  keepStreakAlive: string;
  masteryMap: string;
}
