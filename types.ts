
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
  activeView: 'dashboard' | 'courses' | 'exercise' | 'settings' | 'tools' | 'profile' | 'lesson' | 'progress' | 'review' | 'presentation' | 'codelab' | 'games' | 'debate' | 'story' | 'sql-detective' | 'math-tutor' | 'notes';
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
}
